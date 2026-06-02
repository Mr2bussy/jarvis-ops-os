"""
JARVIS MT5 Bridge — FastAPI server on port 1234
Connects MetaTrader 5 to JARVIS via HTTP.

Requirements:
    pip install fastapi uvicorn MetaTrader5

Usage:
    python bridge.py
"""
from __future__ import annotations
import sys, os, asyncio
from datetime import datetime
from typing import Any

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
except ImportError:
    print("ERROR: pip install fastapi uvicorn")
    sys.exit(1)

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    print("WARNING: MetaTrader5 not installed — running in MOCK mode")

app = FastAPI(title="JARVIS MT5 Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "app://.", "file://"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MT5 initialisation ────────────────────────────────────────────────────────
_mt5_ready = False

def ensure_mt5() -> bool:
    global _mt5_ready
    if not MT5_AVAILABLE:
        return False
    if _mt5_ready:
        return True
    if mt5.initialize():
        _mt5_ready = True
        return True
    return False

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/ping")
def ping():
    return {"status": "ok", "ts": datetime.utcnow().isoformat(), "mt5": MT5_AVAILABLE and ensure_mt5()}


@app.get("/account")
def account():
    if not ensure_mt5():
        return {"mock": True, "balance": 10000.0, "equity": 10000.0, "margin": 0.0, "free_margin": 10000.0, "currency": "USD"}
    info = mt5.account_info()
    if info is None:
        raise HTTPException(500, f"MT5 error: {mt5.last_error()}")
    return {
        "balance":      info.balance,
        "equity":       info.equity,
        "margin":       info.margin,
        "free_margin":  info.margin_free,
        "profit":       info.profit,
        "currency":     info.currency,
        "leverage":     info.leverage,
        "server":       info.server,
        "company":      info.company,
        "login":        info.login,
    }


@app.get("/positions")
def positions():
    if not ensure_mt5():
        return {"mock": True, "positions": []}
    pos = mt5.positions_get()
    if pos is None:
        return {"positions": []}
    return {"positions": [
        {
            "ticket":   p.ticket,
            "symbol":   p.symbol,
            "type":     "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL",
            "volume":   p.volume,
            "open_price": p.price_open,
            "current_price": p.price_current,
            "profit":   p.profit,
            "sl":       p.sl,
            "tp":       p.tp,
            "comment":  p.comment,
            "time":     datetime.utcfromtimestamp(p.time).isoformat(),
        }
        for p in pos
    ]}


@app.get("/symbol/{symbol}")
def symbol_info(symbol: str):
    if not ensure_mt5():
        return {"mock": True, "symbol": symbol, "bid": 0, "ask": 0}
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        raise HTTPException(404, f"Symbol not found: {symbol}")
    info = mt5.symbol_info(symbol)
    return {
        "symbol":   symbol,
        "bid":      tick.bid,
        "ask":      tick.ask,
        "spread":   round((tick.ask - tick.bid) / mt5.symbol_info(symbol).point if info else 0, 1),
        "digits":   info.digits if info else 5,
        "time":     datetime.utcfromtimestamp(tick.time).isoformat(),
    }


@app.get("/history")
def history(days: int = 7, limit: int = 50):
    if not ensure_mt5():
        return {"mock": True, "deals": []}
    from datetime import timedelta
    from_dt = datetime.utcnow() - timedelta(days=days)
    deals = mt5.history_deals_get(from_dt, datetime.utcnow())
    if deals is None:
        return {"deals": []}
    return {"deals": [
        {
            "ticket":  d.ticket,
            "symbol":  d.symbol,
            "type":    d.type,
            "volume":  d.volume,
            "price":   d.price,
            "profit":  d.profit,
            "time":    datetime.utcfromtimestamp(d.time).isoformat(),
            "comment": d.comment,
        }
        for d in list(deals)[-limit:]
    ]}


@app.post("/close/{ticket}")
def close_position(ticket: int):
    if not ensure_mt5():
        return {"mock": True, "ok": True, "ticket": ticket}
    pos = mt5.positions_get(ticket=ticket)
    if not pos:
        raise HTTPException(404, f"Position {ticket} not found")
    p = pos[0]
    order_type = mt5.ORDER_TYPE_SELL if p.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
    tick = mt5.symbol_info_tick(p.symbol)
    price = tick.bid if order_type == mt5.ORDER_TYPE_SELL else tick.ask
    req = {
        "action":   mt5.TRADE_ACTION_DEAL,
        "symbol":   p.symbol,
        "volume":   p.volume,
        "type":     order_type,
        "position": ticket,
        "price":    price,
        "deviation": 20,
        "magic":    0,
        "comment":  "JARVIS close",
        "type_time":  mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(req)
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        raise HTTPException(500, f"Close failed: {result.comment}")
    return {"ok": True, "ticket": result.order}


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("BRIDGE_PORT", 1234))
    print(f"JARVIS MT5 Bridge starting on port {port}  (MT5 available: {MT5_AVAILABLE})")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
