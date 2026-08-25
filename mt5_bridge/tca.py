"""
Pure computation layer for the JARVIS MT5 bridge.

Everything in this module is deliberately free of any MetaTrader5 import so the
arithmetic can be unit-tested on a machine without the terminal (CI runs
`python -m pytest mt5_bridge -q` on a runner that has no MT5). `bridge.py` does
the IO — it pulls raw records out of the terminal, turns them into plain dicts
and hands them here. Nothing in this file ever invents a value: a number that
cannot be derived from the input comes back as `None`, never as an estimate.

Two entry points:
  normalize_order(raw)          -> one pending order as JSON-safe dict
  compute_tca(deals, now_ts)    -> transaction cost analysis over real fills
"""

import datetime

# ── MT5 order types ───────────────────────────────────────────────────────────
# Mirrored as literals instead of read from the MetaTrader5 package: this module
# must import on a machine without MT5. The values are part of the MT5 wire
# protocol (ENUM_ORDER_TYPE) and are stable across terminal builds.
ORDER_TYPE_NAMES = {
    0: "BUY",
    1: "SELL",
    2: "BUY_LIMIT",
    3: "SELL_LIMIT",
    4: "BUY_STOP",
    5: "SELL_STOP",
    6: "BUY_STOP_LIMIT",
    7: "SELL_STOP_LIMIT",
    8: "CLOSE_BY",
}

# Order types whose `price_open` is a price the *operator* asked for rather than
# a price the market produced. See requested_price_from_order().
PENDING_ORDER_TYPES = (2, 3, 4, 5, 6, 7)

# ENUM_DEAL_TYPE: only these two are actual fills. Everything else in the deal
# history (2 = balance, 3 = credit, 4 = charge, 5 = correction, 7 = commission
# booking, …) is an accounting entry and must not pollute fill statistics.
DEAL_TYPE_BUY = 0
DEAL_TYPE_SELL = 1

# MT5 stamps deals in BROKER SERVER time, while now_ts comes from the local clock.
# Server offsets around UTC+2/+3 are the norm, so the period check gets a tolerance
# instead of a hard edge: silently dropping a real fill because the broker sits
# three hours ahead is data loss, and that is worse than keeping a deal that sits a
# few hours outside a 30-day window. MT5 has already filtered the range server-side;
# this check only catches gross outliers. The tolerance is disclosed in every payload.
PERIOD_SKEW_TOLERANCE_S = 48 * 3600

_MONEY_FIELDS = ("commission", "swap", "fee", "profit")
_SUMMED_FIELDS = ("volume",) + _MONEY_FIELDS

_UNKNOWN_SYMBOL = "(unknown)"


# ── small helpers ─────────────────────────────────────────────────────────────

def _num(raw, key):
    """Float value of raw[key], or None when the field is absent/uncoercible.

    None means "the broker did not give us this", which is a different fact from
    0.0 ("the broker charged nothing") — the callers below keep them apart so a
    missing field is reported as missing instead of silently counted as zero.
    """
    if key not in raw:
        return None
    v = raw.get(key)
    if v is None or isinstance(v, bool):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _int(raw, key):
    if key not in raw:
        return None
    v = raw.get(key)
    if v is None or isinstance(v, bool):
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _iso(ts):
    """Epoch seconds -> ISO-8601 UTC string, or None if there is no usable time.

    MT5 hands out *server* time as a unix timestamp. We render it as UTC and say
    so in the payload assumptions rather than guessing the broker's offset — an
    unlabelled local-time conversion would be a fabricated timezone.
    """
    if ts is None:
        return None
    try:
        t = int(ts)
    except (TypeError, ValueError):
        return None
    if t <= 0:
        return None
    try:
        return (
            datetime.datetime.fromtimestamp(t, datetime.timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )
    except (OverflowError, OSError, ValueError):
        return None


# ── Upgrade 11: pending orders ────────────────────────────────────────────────

def normalize_order(raw: dict) -> dict:
    """Normalize one MT5 TradeOrder (as a dict) into the bridge's JSON shape.

    Unknown type codes are surfaced as UNKNOWN_<code> instead of being mapped to
    a plausible-looking neighbour: a wrong direction on a trading screen is worse
    than an obviously unrecognised one.
    """
    raw = raw or {}
    type_code = _int(raw, "type")
    if type_code is None:
        type_name = "UNKNOWN"
    else:
        type_name = ORDER_TYPE_NAMES.get(type_code, "UNKNOWN_%d" % type_code)

    # A partially filled pending order has volume_current < volume_initial; the
    # remaining (current) volume is what is still working in the book, so that is
    # what "volume" means here. Fall back only if the field is absent.
    volume = _num(raw, "volume_current")
    if volume is None:
        volume = _num(raw, "volume_initial")
    if volume is None:
        volume = _num(raw, "volume")

    time_setup = _int(raw, "time_setup")
    symbol = raw.get("symbol")
    comment = raw.get("comment")

    return {
        "ticket": _int(raw, "ticket"),
        "symbol": str(symbol) if isinstance(symbol, str) else None,
        "type": type_name,
        "type_code": type_code,
        "volume": volume,
        "price_open": _num(raw, "price_open"),
        "sl": _num(raw, "sl"),
        "tp": _num(raw, "tp"),
        "time_setup": _iso(time_setup),
        "time_setup_ts": time_setup,
        "comment": comment if isinstance(comment, str) else None,
    }


def requested_price_from_order(raw: dict):
    """The price the operator asked for, or None when MT5 cannot tell us.

    THIS IS THE HONESTY GATE FOR SLIPPAGE. For a *pending* order (LIMIT/STOP)
    `price_open` is the level the operator placed — comparing it against the fill
    price yields real slippage. For a *market* order (BUY/SELL) MT5's historical
    order record is not a reliable request price: most servers write the executed
    price back into `price_open`, so the difference would be a hard 0.0 that
    merely looks like a measurement. We refuse to produce that number.

    For stop-limit orders the requested execution price is `price_stoplimit`
    (`price_open` is only the trigger level).
    """
    raw = raw or {}
    type_code = _int(raw, "type")
    if type_code not in PENDING_ORDER_TYPES:
        return None
    if type_code in (6, 7):  # BUY_STOP_LIMIT / SELL_STOP_LIMIT
        limit = _num(raw, "price_stoplimit")
        if limit is not None and limit > 0:
            return limit
        return None  # trigger price alone is not the requested fill price
    price = _num(raw, "price_open")
    if price is None or price <= 0:
        return None
    return price


# ── Upgrade 8: transaction cost analysis ──────────────────────────────────────

def _new_acc():
    return {
        "fills": 0,
        "volume": 0.0,
        "commission": 0.0,
        "swap": 0.0,
        "fee": 0.0,
        "profit": 0.0,
        "missing": {f: 0 for f in _SUMMED_FIELDS},
        "slip_sum": 0.0,
        "slip_n": 0,
    }


def _deal_slippage(raw: dict):
    """Signed slippage of one fill in price units, or None if not derivable.

    Sign convention: POSITIVE = adverse (a buy paid more / a sell received less
    than requested). Reported in raw price units, not points — the point size is
    a symbol property that the deal record does not carry, and converting with a
    guessed point size would be an invented unit.
    """
    for key in ("price_request", "requested_price", "price_requested"):
        req = _num(raw, key)
        if req is not None and req > 0:
            break
    else:
        return None
    fill = _num(raw, "price")
    if fill is None or fill <= 0:
        return None
    side = _int(raw, "type")
    if side == DEAL_TYPE_BUY:
        return fill - req
    if side == DEAL_TYPE_SELL:
        return req - fill
    return None


def _accumulate(acc, raw, slip):
    acc["fills"] += 1
    for field in _SUMMED_FIELDS:
        val = _num(raw, field)
        if val is None:
            acc["missing"][field] += 1
            continue
        acc[field] += val
    if slip is not None:
        acc["slip_sum"] += slip
        acc["slip_n"] += 1


def _finalize(acc):
    """Turn one accumulator into rounded output. No division without a guard."""
    volume = round(acc["volume"], 2)
    commission = round(acc["commission"], 2)
    swap = round(acc["swap"], 2)
    fee = round(acc["fee"], 2)
    profit = round(acc["profit"], 2)
    # Broker charges arrive signed (commission and swap are normally negative);
    # they are summed with their sign, so cost_total is negative when trading
    # cost money. net_profit is therefore profit PLUS cost_total, not minus.
    cost_total = round(commission + swap + fee, 2)
    slip_available = acc["slip_n"] > 0
    return {
        "fills": acc["fills"],
        "volume": volume,
        "commission": commission,
        "swap": swap,
        "fee": fee,
        "profit": profit,
        "cost_total": cost_total,
        "net_profit": round(profit + cost_total, 2),
        "cost_per_lot": round(cost_total / acc["volume"], 4) if acc["volume"] > 0 else None,
        "avg_volume_per_fill": round(acc["volume"] / acc["fills"], 4) if acc["fills"] > 0 else None,
        "avg_profit_per_fill": round(acc["profit"] / acc["fills"], 4) if acc["fills"] > 0 else None,
        # Slippage stays None unless a requested price was actually present.
        "slippage": round(acc["slip_sum"] / acc["slip_n"], 8) if slip_available else None,
        "slippage_available": slip_available,
        "slippage_samples": acc["slip_n"],
        "slippage_unit": "price" if slip_available else None,
    }


def _metrics_report(total_acc, evaluated):
    """Which numbers this response actually stands behind, and which it does not."""
    available, partial, unavailable = ["fills"], [], []

    for field in _SUMMED_FIELDS:
        missing = total_acc["missing"][field]
        if missing == 0:
            available.append(field)
        else:
            partial.append({
                "metric": field,
                "missing_deals": missing,
                "of_deals": evaluated,
                "note": "summed over the deals that carried the field; the rest "
                        "contributed nothing because their value was absent, not zero",
            })

    # cost_total / net_profit are only as trustworthy as their components.
    incomplete = {p["metric"] for p in partial}
    money_complete = not (incomplete & set(_MONEY_FIELDS))
    for name in ("cost_total", "net_profit"):
        if money_complete:
            available.append(name)
        else:
            partial.append({
                "metric": name,
                "missing_deals": None,
                "of_deals": evaluated,
                "note": "derived from a component that was missing on some deals: "
                        + ", ".join(sorted(incomplete & set(_MONEY_FIELDS))),
            })

    if total_acc["volume"] > 0:
        available.append("cost_per_lot")
    else:
        unavailable.append({
            "metric": "cost_per_lot",
            "reason": "total volume is 0 — dividing by it would be undefined",
        })

    if total_acc["slip_n"] > 0:
        available.append("slippage")
    else:
        unavailable.append({
            "metric": "slippage",
            "reason": "no evaluated deal carried a requested price, so slippage is "
                      "not derivable from this data; it is reported as null and is "
                      "deliberately NOT estimated",
        })

    return {"available": available, "partial": partial, "unavailable": unavailable}


def compute_tca(deals: list, now_ts: int, days: int = 30) -> dict:
    """Transaction cost analysis over real MT5 fills.

    `deals` are plain dicts built from MT5 TradeDeal records (see bridge.py).
    Optional per-deal key `price_request` enables slippage; without it the
    slippage fields stay null. `now_ts` is the epoch second the window ends at.
    """
    try:
        days = max(1, int(days))
    except (TypeError, ValueError):
        days = 30
    try:
        now_ts = int(now_ts)
    except (TypeError, ValueError):
        now_ts = 0
    from_ts = now_ts - days * 86400

    total = _new_acc()
    per_symbol = {}
    skipped = {"non_trade_deal": 0, "missing_type": 0, "outside_period": 0}
    missing_time = 0
    request_sources = set()

    for raw in (deals or []):
        if not isinstance(raw, dict):
            skipped["missing_type"] += 1
            continue

        side = _int(raw, "type")
        if side is None:
            skipped["missing_type"] += 1
            continue
        if side not in (DEAL_TYPE_BUY, DEAL_TYPE_SELL):
            skipped["non_trade_deal"] += 1
            continue

        t = _int(raw, "time")
        if t is None:
            # Cannot judge the window; keep the deal and disclose the gap rather
            # than silently dropping a real fill or silently inventing a date.
            missing_time += 1
        elif t < from_ts - PERIOD_SKEW_TOLERANCE_S or t > now_ts + PERIOD_SKEW_TOLERANCE_S:
            skipped["outside_period"] += 1
            continue

        slip = _deal_slippage(raw)
        if slip is not None:
            src = raw.get("price_request_source")
            request_sources.add(str(src) if isinstance(src, str) else "caller-supplied requested price")

        symbol = raw.get("symbol")
        key = symbol if isinstance(symbol, str) and symbol else _UNKNOWN_SYMBOL
        _accumulate(total, raw, slip)
        _accumulate(per_symbol.setdefault(key, _new_acc()), raw, slip)

    evaluated = total["fills"]
    totals = _finalize(total)

    by_symbol = []
    for name in sorted(per_symbol):
        row = _finalize(per_symbol[name])
        row["symbol"] = name
        by_symbol.append(row)

    assumptions = [
        "period is [from, to] as stated above, derived from now_ts minus %d day(s)" % days,
        "MT5 timestamps are broker server time; they are rendered as UTC and not "
        "shifted to any local timezone",
        "the period filter allows %d hour(s) of broker-vs-local clock skew at each "
        "edge, so a real fill is never dropped for a timezone offset"
        % (PERIOD_SKEW_TOLERANCE_S // 3600),
        "only DEAL_TYPE_BUY(0) and DEAL_TYPE_SELL(1) count as fills; balance, "
        "credit, charge, correction and commission bookings are excluded",
        "commission, swap and fee are taken as the broker reported them, signed; "
        "cost_total = commission + swap + fee and net_profit = profit + cost_total",
        "profit is realised profit as booked on the deal, not mark-to-market",
        "slippage is only computed where a requested price is present; it is "
        "signed so that a POSITIVE value means an adverse fill, and it is given "
        "in price units because the deal record carries no point size",
        "no value in this response is simulated, estimated or interpolated; "
        "anything not derivable from the deals is null",
    ]
    if missing_time > 0:
        assumptions.append(
            "%d evaluated deal(s) carried no timestamp and could not be checked "
            "against the period window; they are included" % missing_time
        )
    if request_sources:
        assumptions.append(
            "requested prices used for slippage came from: %s"
            % ", ".join(sorted(request_sources))
        )

    return {
        "period": {
            "days": days,
            "from_ts": from_ts,
            "from": _iso(from_ts),
            "to_ts": now_ts,
            "to": _iso(now_ts),
        },
        "deals_evaluated": evaluated,
        "deals_skipped": sum(skipped.values()),
        "skipped_breakdown": skipped,
        "totals": totals,
        # Repeated at the root so a caller can gate a slippage widget without
        # reaching into totals — same value, computed once.
        "slippage_available": totals["slippage_available"],
        "by_symbol": by_symbol,
        "metrics": _metrics_report(total, evaluated),
        "assumptions": assumptions,
    }
