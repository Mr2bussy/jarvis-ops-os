"""
Unit tests for the JARVIS MT5 bridge.

MetaTrader5 is a Windows-only package that requires a running terminal, so it is
mocked into sys.modules BEFORE importing the bridge (the bridge imports it and
builds TF_MAP from its constants at module load time). These tests therefore run
on any machine with just `pip install pytest`.
"""
import sys
import os
import importlib
from unittest.mock import MagicMock

import pytest

# ── Mock MetaTrader5 before importing the bridge ────────────────────────────────
mt5_mock = MagicMock()
# Deterministic integer constants (the bridge compares against several of these).
_CONSTS = [
    'TIMEFRAME_M1', 'TIMEFRAME_M5', 'TIMEFRAME_M15', 'TIMEFRAME_M30',
    'TIMEFRAME_H1', 'TIMEFRAME_H4', 'TIMEFRAME_D1', 'TIMEFRAME_W1',
    'ORDER_TYPE_BUY', 'ORDER_TYPE_SELL', 'TRADE_ACTION_DEAL',
    'ORDER_FILLING_IOC', 'TRADE_RETCODE_DONE', 'DEAL_TYPE_BUY',
    'BOOK_TYPE_BUY', 'BOOK_TYPE_SELL', 'COPY_TICKS_ALL',
]
for _i, _name in enumerate(_CONSTS):
    setattr(mt5_mock, _name, _i + 1)
sys.modules['MetaTrader5'] = mt5_mock

# bridge.py parses sys.argv[1] as the listen port at import time; under pytest
# argv[1] is the test file path, so neutralise argv before importing.
sys.argv = ['bridge.py']
sys.path.insert(0, os.path.dirname(__file__))
bridge = importlib.import_module('bridge')


@pytest.fixture(autouse=True)
def _reset_state():
    """Reset module globals + the shared mock between tests."""
    bridge._mt5_ok = True
    bridge._armed = False
    bridge.AUTH_TOKEN = ''
    mt5_mock.reset_mock()
    mt5_mock.terminal_info.return_value = object()  # ensure_mt5() short-circuits True
    mt5_mock.symbol_info.side_effect = None
    mt5_mock.symbol_info.return_value = object()
    mt5_mock.copy_rates_from_pos.side_effect = None
    yield


class _FakeReq:
    """Stand-in for BaseHTTPRequestHandler exposing only `.headers.get(...)`."""
    def __init__(self, headers):
        self.headers = headers


# ── Auth (the security change) ──────────────────────────────────────────────────
def test_authorized_open_when_no_token():
    bridge.AUTH_TOKEN = ''
    assert bridge.Handler._authorized(_FakeReq({})) is True


def test_authorized_enforces_matching_header_when_token_set():
    bridge.AUTH_TOKEN = 'secret-token'
    assert bridge.Handler._authorized(_FakeReq({'X-JARVIS-Token': 'secret-token'})) is True
    assert bridge.Handler._authorized(_FakeReq({'X-JARVIS-Token': 'wrong'})) is False
    assert bridge.Handler._authorized(_FakeReq({})) is False


# ── Arm-gate on close_all (the trading-safety change) ────────────────────────────
def test_close_all_refuses_when_safed():
    bridge._armed = False
    res = bridge.close_all_json()
    assert res['closed'] == 0
    assert 'SAFED' in res['error']
    mt5_mock.order_send.assert_not_called()


def test_close_all_sends_orders_when_armed():
    bridge._armed = True
    pos = MagicMock()
    pos.type = bridge.mt5.ORDER_TYPE_BUY
    pos.ticket, pos.symbol, pos.volume = 1, 'BTCUSD', 0.1
    mt5_mock.positions_get.return_value = [pos]
    tick = MagicMock(); tick.bid, tick.ask = 100.0, 100.5
    mt5_mock.symbol_info_tick.return_value = tick
    sent = MagicMock(); sent.retcode = bridge.mt5.TRADE_RETCODE_DONE
    mt5_mock.order_send.return_value = sent

    res = bridge.close_all_json()
    assert mt5_mock.order_send.called
    assert res['closed'] == 1
    assert res['failed'] == 0


# ── Symbol resolution ────────────────────────────────────────────────────────────
def test_resolve_symbol_falls_back_to_available_variant():
    # First variant ('BTCUSD') has no symbol_info; the next ('BTCUSD.s') does.
    mt5_mock.symbol_info.side_effect = lambda name: None if name == 'BTCUSD' else object()
    assert bridge.resolve_symbol('BTCUSD') == 'BTCUSD.s'


# ── Correlation maths (pearson, via the public corr_json) ────────────────────────
def test_corr_identical_series_is_one_and_symmetric():
    closes = [{'close': c} for c in [1.0, 1.1, 1.2, 1.3, 1.25, 1.4]]
    mt5_mock.copy_rates_from_pos.return_value = closes
    out = bridge.corr_json(['AAA', 'BBB'], 4)
    assert out['symbols'] == ['AAA', 'BBB']
    m = out['matrix']
    assert m[0][0] == pytest.approx(1.0, abs=1e-9)   # diagonal
    assert m[1][1] == pytest.approx(1.0, abs=1e-9)
    assert m[0][1] == pytest.approx(1.0, abs=1e-6)   # identical series → corr 1.0
    assert m[0][1] == pytest.approx(m[1][0], abs=1e-9)  # symmetric
