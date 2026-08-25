"""
Unit tests for the pure computation layer (mt5_bridge/tca.py).

No MetaTrader5 mock is needed here: tca.py deliberately has no MT5 import, which
is the whole point of splitting it out of bridge.py. `pip install pytest` is the
only requirement, so CI can run this on a runner with no terminal.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tca import (  # noqa: E402
    ORDER_TYPE_NAMES,
    compute_tca,
    normalize_order,
    requested_price_from_order,
)

# Fixed clock so period maths is deterministic: 2025-06-01T00:00:00Z.
NOW = 1748736000
DAY = 86400


def _deal(**kw):
    """A complete MT5-shaped trade deal; individual tests override what matters."""
    base = {
        "ticket": 1,
        "order": 1,
        "time": NOW - DAY,
        "type": 0,           # DEAL_TYPE_BUY
        "entry": 0,
        "symbol": "EURUSD",
        "volume": 1.0,
        "price": 1.1000,
        "commission": -7.0,
        "swap": 0.0,
        "fee": 0.0,
        "profit": 25.0,
    }
    base.update(kw)
    return base


# ── TCA over a realistic deal list ────────────────────────────────────────────

def test_tca_sums_and_averages_over_realistic_deals():
    deals = [
        _deal(ticket=1, symbol="EURUSD", volume=1.0, commission=-7.0, swap=-1.5, profit=25.0),
        _deal(ticket=2, symbol="EURUSD", volume=0.5, commission=-3.5, swap=-0.25, profit=-12.0, type=1),
        _deal(ticket=3, symbol="BTCUSD", volume=0.2, commission=-4.0, swap=-2.0, profit=140.0),
        _deal(ticket=4, symbol="BTCUSD", volume=0.3, commission=-6.0, swap=0.0, profit=-40.0, type=1),
    ]
    out = compute_tca(deals, NOW, days=30)

    assert out["deals_evaluated"] == 4
    assert out["deals_skipped"] == 0

    t = out["totals"]
    assert t["fills"] == 4
    assert t["volume"] == pytest.approx(2.0)
    assert t["commission"] == pytest.approx(-20.5)
    assert t["swap"] == pytest.approx(-3.75)
    assert t["profit"] == pytest.approx(113.0)
    # Charges are signed, so cost_total is negative and net_profit is profit + costs.
    assert t["cost_total"] == pytest.approx(-24.25)
    assert t["net_profit"] == pytest.approx(88.75)
    assert t["cost_per_lot"] == pytest.approx(-12.125)
    assert t["avg_volume_per_fill"] == pytest.approx(0.5)

    by_symbol = {row["symbol"]: row for row in out["by_symbol"]}
    assert sorted(by_symbol) == ["BTCUSD", "EURUSD"]
    assert by_symbol["EURUSD"]["fills"] == 2
    assert by_symbol["EURUSD"]["volume"] == pytest.approx(1.5)
    assert by_symbol["EURUSD"]["commission"] == pytest.approx(-10.5)
    assert by_symbol["EURUSD"]["profit"] == pytest.approx(13.0)
    assert by_symbol["BTCUSD"]["fills"] == 2
    assert by_symbol["BTCUSD"]["volume"] == pytest.approx(0.5)
    assert by_symbol["BTCUSD"]["net_profit"] == pytest.approx(100.0 - 10.0 - 2.0)

    # Every response states its window and its assumptions.
    assert out["period"]["days"] == 30
    assert out["period"]["to_ts"] == NOW
    assert out["period"]["from_ts"] == NOW - 30 * DAY
    assert out["period"]["from"] == "2025-05-02T00:00:00Z"
    assert out["period"]["to"] == "2025-06-01T00:00:00Z"
    assert any("not simulated" in a or "simulated" in a for a in out["assumptions"])


def test_tca_excludes_non_trade_deals_and_out_of_period_deals():
    deals = [
        _deal(ticket=1),
        _deal(ticket=2, type=2, profit=5000.0, volume=0.0),   # DEAL_TYPE_BALANCE
        _deal(ticket=3, time=NOW - 90 * DAY),                 # older than the window
        {"ticket": 4, "symbol": "EURUSD", "volume": 1.0},     # no type -> unjudgeable
    ]
    out = compute_tca(deals, NOW, days=30)

    assert out["deals_evaluated"] == 1
    assert out["deals_skipped"] == 3
    assert out["skipped_breakdown"] == {
        "non_trade_deal": 1, "missing_type": 1, "outside_period": 1,
    }
    # The 5000.0 balance entry must not have leaked into realised profit.
    assert out["totals"]["profit"] == pytest.approx(25.0)


def test_broker_clock_skew_does_not_drop_a_real_fill():
    # MT5 stamps deals in server time; a broker three hours ahead of the local
    # clock must not have its newest fill filtered out as "in the future".
    ahead = compute_tca([_deal(time=NOW + 3 * 3600)], NOW, days=30)
    assert ahead["deals_evaluated"] == 1
    assert ahead["skipped_breakdown"]["outside_period"] == 0
    # A genuinely old deal is still excluded.
    old = compute_tca([_deal(time=NOW - 40 * DAY)], NOW, days=30)
    assert old["deals_evaluated"] == 0
    assert old["skipped_breakdown"]["outside_period"] == 1


# ── Empty input: zeros, not crashes, not nulls ────────────────────────────────

def test_tca_empty_deal_list_returns_zeros_without_dividing_by_zero():
    out = compute_tca([], NOW, days=30)

    assert out["deals_evaluated"] == 0
    assert out["deals_skipped"] == 0
    t = out["totals"]
    assert t["fills"] == 0
    assert t["volume"] == 0.0
    assert t["commission"] == 0.0
    assert t["swap"] == 0.0
    assert t["fee"] == 0.0
    assert t["profit"] == 0.0
    assert t["cost_total"] == 0.0
    assert t["net_profit"] == 0.0
    # Guarded divisions return None rather than raising ZeroDivisionError.
    assert t["cost_per_lot"] is None
    assert t["avg_volume_per_fill"] is None
    assert t["avg_profit_per_fill"] is None
    assert out["by_symbol"] == []
    assert out["slippage_available"] is False


def test_tca_handles_none_input_like_an_empty_list():
    assert compute_tca(None, NOW)["deals_evaluated"] == 0


# ── The honesty rule: no requested price -> no slippage ───────────────────────

def test_slippage_is_null_when_no_requested_price_is_present():
    out = compute_tca([_deal(ticket=1), _deal(ticket=2, symbol="BTCUSD")], NOW)

    assert out["slippage_available"] is False
    assert out["totals"]["slippage"] is None
    assert out["totals"]["slippage_available"] is False
    assert out["totals"]["slippage_samples"] == 0
    for row in out["by_symbol"]:
        assert row["slippage"] is None
        assert row["slippage_available"] is False

    # It must be listed as an unavailable metric, with a reason — not quietly 0.
    unavailable = {m["metric"] for m in out["metrics"]["unavailable"]}
    assert "slippage" in unavailable
    assert "slippage" not in out["metrics"]["available"]


def test_slippage_is_computed_only_for_deals_that_carry_a_requested_price():
    deals = [
        # BUY filled 0.0002 above the request -> adverse -> +0.0002
        _deal(ticket=1, type=0, price=1.1002, price_request=1.1000),
        # SELL filled 0.0004 below the request -> adverse -> +0.0004
        _deal(ticket=2, type=1, price=1.0996, price_request=1.1000),
        # No requested price at all -> contributes no sample
        _deal(ticket=3, type=0, price=1.1050),
    ]
    out = compute_tca(deals, NOW)

    t = out["totals"]
    assert t["slippage_samples"] == 2          # the third deal is NOT counted
    assert t["slippage_available"] is True
    assert t["slippage"] == pytest.approx(0.0003, abs=1e-9)
    assert t["slippage_unit"] == "price"
    assert out["slippage_available"] is True
    assert "slippage" in out["metrics"]["available"]


def test_positive_slippage_means_adverse_for_both_sides():
    buy = compute_tca([_deal(type=0, price=100.5, price_request=100.0)], NOW)
    sell = compute_tca([_deal(type=1, price=99.5, price_request=100.0)], NOW)
    assert buy["totals"]["slippage"] == pytest.approx(0.5)
    assert sell["totals"]["slippage"] == pytest.approx(0.5)
    # Price improvement is reported as negative slippage, not clamped to zero.
    better = compute_tca([_deal(type=0, price=99.8, price_request=100.0)], NOW)
    assert better["totals"]["slippage"] == pytest.approx(-0.2)


# ── Negative commissions and swaps ────────────────────────────────────────────

def test_negative_commissions_and_swaps_sum_with_their_sign():
    deals = [
        _deal(ticket=1, commission=-12.34, swap=-5.5, fee=-0.5, profit=0.0),
        _deal(ticket=2, commission=-7.66, swap=-4.5, fee=-1.5, profit=0.0),
        # A positive swap (carry credit) must offset, not be treated as a cost.
        _deal(ticket=3, commission=0.0, swap=+3.0, fee=0.0, profit=0.0),
    ]
    t = compute_tca(deals, NOW)["totals"]

    assert t["commission"] == pytest.approx(-20.0)
    assert t["swap"] == pytest.approx(-7.0)
    assert t["fee"] == pytest.approx(-2.0)
    assert t["cost_total"] == pytest.approx(-29.0)
    assert t["net_profit"] == pytest.approx(-29.0)
    assert t["cost_per_lot"] == pytest.approx(-29.0 / 3.0, abs=1e-4)


def test_missing_money_field_is_reported_as_partial_not_counted_as_zero():
    complete = _deal(ticket=1, commission=-5.0)
    without_commission = _deal(ticket=2)
    del without_commission["commission"]

    out = compute_tca([complete, without_commission], NOW)

    assert out["totals"]["commission"] == pytest.approx(-5.0)
    partial = {p["metric"]: p for p in out["metrics"]["partial"]}
    assert partial["commission"]["missing_deals"] == 1
    assert partial["commission"]["of_deals"] == 2
    assert "commission" not in out["metrics"]["available"]
    # Anything derived from an incomplete component is flagged too.
    assert "cost_total" in partial and "net_profit" in partial


# ── Order normalisation ───────────────────────────────────────────────────────

@pytest.mark.parametrize("code,name", [
    (0, "BUY"),
    (1, "SELL"),
    (2, "BUY_LIMIT"),
    (3, "SELL_LIMIT"),
    (4, "BUY_STOP"),
    (5, "SELL_STOP"),
    (6, "BUY_STOP_LIMIT"),
    (7, "SELL_STOP_LIMIT"),
    (8, "CLOSE_BY"),
])
def test_every_mt5_order_type_constant_maps_to_its_readable_string(code, name):
    out = normalize_order({"ticket": 1, "symbol": "EURUSD", "type": code})
    assert out["type"] == name
    assert out["type_code"] == code
    # Guard against a silent gap in the table itself.
    assert ORDER_TYPE_NAMES[code] == name


def test_unknown_order_type_is_surfaced_not_guessed():
    assert normalize_order({"type": 99})["type"] == "UNKNOWN_99"
    assert normalize_order({})["type"] == "UNKNOWN"
    assert normalize_order({})["type_code"] is None


def test_normalize_order_full_shape():
    raw = {
        "ticket": 123456789,
        "symbol": "BTCUSD",
        "type": 2,                      # BUY_LIMIT
        "volume_initial": 1.0,
        "volume_current": 0.4,          # partially filled
        "price_open": 61000.5,
        "sl": 60000.0,
        "tp": 65000.0,
        "time_setup": NOW,
        "comment": "JARVIS entry",
    }
    out = normalize_order(raw)

    assert out == {
        "ticket": 123456789,
        "symbol": "BTCUSD",
        "type": "BUY_LIMIT",
        "type_code": 2,
        "volume": 0.4,                  # remaining volume, not the initial size
        "price_open": 61000.5,
        "sl": 60000.0,
        "tp": 65000.0,
        "time_setup": "2025-06-01T00:00:00Z",
        "time_setup_ts": NOW,
        "comment": "JARVIS entry",
    }


def test_normalize_order_falls_back_to_initial_volume_and_survives_junk():
    assert normalize_order({"type": 3, "volume_initial": 2.5})["volume"] == 2.5
    junk = normalize_order({"ticket": "x", "type": "y", "price_open": None, "time_setup": 0})
    assert junk["ticket"] is None
    assert junk["type"] == "UNKNOWN"
    assert junk["price_open"] is None
    assert junk["time_setup"] is None    # 0 is "never set", not 1970


# ── The requested-price gate that feeds slippage ──────────────────────────────

def test_requested_price_only_comes_from_pending_orders():
    # Pending orders: price_open IS the level the operator asked for.
    assert requested_price_from_order({"type": 2, "price_open": 1.1}) == 1.1
    assert requested_price_from_order({"type": 5, "price_open": 99.5}) == 99.5
    # Market orders: MT5 writes the executed price back into price_open, so using
    # it would manufacture a slippage of exactly 0.
    assert requested_price_from_order({"type": 0, "price_open": 1.1}) is None
    assert requested_price_from_order({"type": 1, "price_open": 1.1}) is None
    # Stop-limit: the limit leg is the requested price, the trigger is not.
    assert requested_price_from_order(
        {"type": 6, "price_open": 100.0, "price_stoplimit": 100.5}) == 100.5
    assert requested_price_from_order({"type": 6, "price_open": 100.0}) is None
    # Junk in, None out.
    assert requested_price_from_order({}) is None
    assert requested_price_from_order({"type": 2, "price_open": 0.0}) is None
