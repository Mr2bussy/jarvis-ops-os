"""
JARVIS MT5 Python Bridge  v2.0
Connects to the running MetaTrader 5 terminal via the official Python API
and exposes a REST server on localhost:1234 for JARVIS OS.

Endpoints (v1 — unchanged):
  GET  /api/v1/ping
  GET  /api/v1/account
  GET  /api/v1/positions
  GET  /api/v1/history
  POST /api/v1/expert/toggle        body: {"enabled": true|false}
  POST /api/v1/positions/close_all

Endpoints (v2 — new):
  GET  /api/v1/rates?symbol=BTCUSD&tf=M15&n=200
  GET  /api/v1/tick?symbol=BTCUSD
  GET  /api/v1/batch?symbols=BTCUSD,EURUSD,XAUUSD,GBPUSD,USDJPY
  GET  /api/v1/book?symbol=BTCUSD&depth=20
  GET  /api/v1/ticks_cvd?symbol=BTCUSD&n=500
  GET  /api/v1/swaps?symbols=BTCUSD,EURUSD,XAUUSD,GBPUSD,USDJPY
  GET  /api/v1/corr?symbols=BTCUSD,ETHUSD,EURUSD,GBPUSD,USDJPY,XAUUSD,AUDUSD,USDCHF,SOLUSD,USDCAD&n=32
  GET  /api/v1/symbols

Usage:
  python bridge.py              (port 1234)
  python bridge.py 8080         (custom port)
"""

import sys, os, hmac, json, threading, time, datetime, math, random
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 1234

# Shared-secret auth. The Electron main process generates this token, sets it as
# JARVIS_BRIDGE_TOKEN when it spawns the bridge, and sends it as the X-JARVIS-Token
# header on every request. Enforce-if-set: when configured, requests without the
# matching header get 401. Unset (manual standalone run) → open, but warns loudly.
AUTH_TOKEN = os.environ.get("JARVIS_BRIDGE_TOKEN", "")

try:
    import MetaTrader5 as mt5
except ImportError:
    print("ERROR: MetaTrader5 package not found.  Run:  pip install MetaTrader5")
    sys.exit(1)

_mt5_ok = False

TF_MAP = {
    "M1":  mt5.TIMEFRAME_M1,  "M5":  mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15, "M30": mt5.TIMEFRAME_M30,
    "H1":  mt5.TIMEFRAME_H1,  "H4":  mt5.TIMEFRAME_H4,
    "D1":  mt5.TIMEFRAME_D1,  "W1":  mt5.TIMEFRAME_W1,
}

SYMBOL_VARIANTS = {
    "BTCUSD":  ["BTCUSD","BTCUSD.s","BTCUSD.c","BTC/USD","#BTCUSD","BTCUSD+","BTC.USD"],
    "ETHUSD":  ["ETHUSD","ETHUSD.s","ETHUSD.c","ETH/USD","#ETHUSD"],
    "SOLUSD":  ["SOLUSD","SOLUSD.s","SOL/USD","#SOLUSD","SOLUSD.c"],
    "BNBUSD":  ["BNBUSD","BNB/USD","BNBUSD.s","#BNBUSD"],
    "XRPUSD":  ["XRPUSD","XRP/USD","XRPUSD.s","#XRPUSD"],
    "LTCUSD":  ["LTCUSD","LTC/USD","LTCUSD.s","#LTCUSD"],
    "DOGEUSD": ["DOGEUSD","DOGE/USD","DOGEUSD.s","#DOGEUSD","DOGUSD"],
    "LINKUSD": ["LINKUSD","LINK/USD","LINKUSD.s","#LINKUSD","LNKUSD"],
    "ADAUSD":  ["ADAUSD","ADA/USD","ADAUSD.s","#ADAUSD"],
    "AVAXUSD": ["AVAXUSD","AVAX/USD","AVAXUSD.s","#AVAXUSD"],
    "XAGUSD":  ["XAGUSD","XAGUSD.s","XAG/USD","#XAGUSD","SILVER","XAGUSDS"],
    "XRPUSD":  ["XRPUSD","XRP/USD","XRPUSD.s","#XRPUSD"],
    "US500":   ["US500","SP500","US500cash","SP500cash","SPX500","US500.cash","#SP500","USA500","US_500","USTEC"],
    "US30":    ["US30","DJI","DJ30","#DJI","USDOW","US30cash","DJ30cash","USA30","DOW30","US30+"],
    "USDCAD":  ["USDCAD"],
    "NZDUSD":  ["NZDUSD"],
}

def resolve_symbol(sym: str) -> str:
    variants = SYMBOL_VARIANTS.get(sym, [sym])
    for v in variants:
        info = mt5.symbol_info(v)
        if info is not None:
            mt5.symbol_select(v, True)
            return v
    return sym

def ensure_mt5() -> bool:
    global _mt5_ok
    if _mt5_ok:
        if mt5.terminal_info() is not None:
            return True
        _mt5_ok = False
    if mt5.initialize():
        _mt5_ok = True
        acc = mt5.account_info()
        print(f"[MT5] Connected  #{acc.login}  {acc.name}  {acc.currency}  1:{acc.leverage}")
        return True
    print(f"[MT5] Initialize failed: {mt5.last_error()}")
    return False

# ─── v1 builders ──────────────────────────────────────────────────────────────

def account_json():
    if not ensure_mt5(): return None
    a = mt5.account_info()
    if a is None: return None
    return {"login":a.login,"name":a.name,"balance":round(a.balance,2),
            "equity":round(a.equity,2),"profit":round(a.profit,2),
            "margin":round(a.margin,2),"free_margin":round(a.margin_free,2),
            "leverage":a.leverage,"currency":a.currency}

def positions_json():
    if not ensure_mt5(): return []
    pos = mt5.positions_get()
    if pos is None: return []
    return [{"ticket":p.ticket,"symbol":p.symbol,"type":p.type,"volume":p.volume,
             "price_open":p.price_open,"price_current":p.price_current,
             "profit":round(p.profit,2),"swap":round(p.swap,2)} for p in pos]

def history_json(n=30):
    if not ensure_mt5(): return []
    from_dt = datetime.datetime.now() - datetime.timedelta(days=7)
    deals = mt5.history_deals_get(from_dt, datetime.datetime.now())
    if deals is None: return []
    return [{"ticket":d.ticket,"symbol":d.symbol,"type":d.type,"entry":d.entry,
             "volume":d.volume,"price":d.price,"profit":round(d.profit,2),
             "time":d.time} for d in list(deals)[-n:]]

_armed = False

def toggle_json(body: bytes):
    global _armed
    try:
        data = json.loads(body or b"{}")
        _armed = bool(data.get("enabled", False))
    except Exception:
        pass
    print(f"[MT5] Expert {'ARMED' if _armed else 'SAFED'}")
    return {"ok": True, "armed": _armed}

def close_all_json():
    if not _armed:
        return {"closed":0,"failed":0,"error":"SAFED — arm the expert before closing positions"}
    if not ensure_mt5(): return {"closed":0,"failed":0,"error":"MT5 not connected"}
    pos = mt5.positions_get()
    closed = failed = 0
    if pos:
        for p in pos:
            t = mt5.symbol_info_tick(p.symbol)
            price = t.bid if p.type == mt5.ORDER_TYPE_BUY else t.ask
            req = {"action":mt5.TRADE_ACTION_DEAL,"position":p.ticket,"symbol":p.symbol,
                   "volume":p.volume,
                   "type":mt5.ORDER_TYPE_SELL if p.type==mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY,
                   "price":price,"deviation":50,"type_filling":mt5.ORDER_FILLING_IOC,"comment":"JARVIS PANIC"}
            res = mt5.order_send(req)
            if res and res.retcode == mt5.TRADE_RETCODE_DONE: closed += 1
            else: failed += 1
    return {"closed":closed,"failed":failed}

# ─── v2 builders ──────────────────────────────────────────────────────────────

def rates_json(symbol: str, tf_str: str, n: int):
    if not ensure_mt5(): return None
    sym = resolve_symbol(symbol)
    tf = TF_MAP.get(tf_str.upper(), mt5.TIMEFRAME_M15)
    r = mt5.copy_rates_from_pos(sym, tf, 0, n)
    if r is None or len(r) == 0: return None
    return [{"time":int(x["time"]),"open":float(x["open"]),"high":float(x["high"]),
             "low":float(x["low"]),"close":float(x["close"]),"vol":int(x["tick_volume"])} for x in r]

def tick_json(symbol: str):
    if not ensure_mt5(): return None
    sym = resolve_symbol(symbol)
    t = mt5.symbol_info_tick(sym)
    if t is None: return None
    info = mt5.symbol_info(sym)
    dg = info.digits if info else 5
    return {"symbol":sym,"bid":round(t.bid,dg),"ask":round(t.ask,dg),
            "last":round(t.last or t.bid,dg),"time":int(t.time),
            "spread":round(t.ask-t.bid,dg)}

def batch_json(symbols: list):
    if not ensure_mt5(): return []
    results = []
    for symbol in symbols:
        try:
            sym = resolve_symbol(symbol)
            t = mt5.symbol_info_tick(sym)
            if t is None: continue
            info = mt5.symbol_info(sym)
            dg = info.digits if info else 5
            d1 = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_D1, 0, 2)
            change24h = 0.0; high = t.ask; low = t.bid; volume = 0
            if d1 is not None and len(d1) >= 2:
                pc = float(d1[0]["close"])
                cc = float(d1[1]["close"])
                change24h = round((cc-pc)/pc*100, 2) if pc > 0 else 0.0
                high = float(d1[1]["high"]); low = float(d1[1]["low"])
                volume = int(d1[1]["tick_volume"])
            elif d1 is not None and len(d1) == 1:
                high = float(d1[0]["high"]); low = float(d1[0]["low"])
                volume = int(d1[0]["tick_volume"])
            mid = (t.bid+t.ask)/2
            results.append({"symbol":symbol,"price":round(mid,dg),"bid":round(t.bid,dg),
                             "ask":round(t.ask,dg),"change24h":change24h,
                             "high":round(high,dg),"low":round(low,dg),"volume":volume})
        except Exception as e:
            print(f"[MT5] batch error {symbol}: {e}")
    return results

def book_json(symbol: str, depth: int):
    if not ensure_mt5(): return None
    sym = resolve_symbol(symbol)
    mt5.market_book_add(sym)
    time.sleep(0.05)
    book = mt5.market_book_get(sym)
    if book and len(book) > 0:
        bids = sorted([{"p":float(b.price),"s":float(b.volume)} for b in book if b.type==mt5.BOOK_TYPE_BUY],
                      key=lambda x:-x["p"])[:depth]
        asks = sorted([{"p":float(b.price),"s":float(b.volume)} for b in book if b.type==mt5.BOOK_TYPE_SELL],
                      key=lambda x:x["p"])[:depth]
        return {"bids":bids,"asks":asks,"source":"DOM"}
    # Synthetic book from tick
    t = mt5.symbol_info_tick(sym)
    if t is None: return None
    info = mt5.symbol_info(sym)
    dg = info.digits if info else 5
    tick_size = (info.trade_tick_size if info and info.trade_tick_size > 0 else 10**-dg)
    step = max(tick_size*2, (t.ask-t.bid)*0.5) if (t.ask-t.bid)>0 else tick_size*5
    bids=[]; asks=[]
    for i in range(depth):
        vol = round(max(0.01,(depth-i)*0.8+random.uniform(0,1.5)),2)
        bids.append({"p":round(t.bid-step*i,dg),"s":vol})
        asks.append({"p":round(t.ask+step*i,dg),"s":vol})
    return {"bids":bids,"asks":asks,"source":"synthetic"}

def ticks_cvd_json(symbol: str, n: int):
    if not ensure_mt5(): return []
    sym = resolve_symbol(symbol)
    from_dt = datetime.datetime.now() - datetime.timedelta(hours=2)
    ticks = mt5.copy_ticks_from(sym, from_dt, n, mt5.COPY_TICKS_ALL)
    if ticks is not None and len(ticks) > 0:
        results = []
        for tk in ticks[-n:]:
            flags = int(tk["flags"])
            is_buy = bool(flags & 2)
            results.append({"time":int(tk["time"]),
                             "price":float(tk["ask"] if is_buy else tk["bid"]),
                             "vol":max(0.001,float(tk.get("volume",0) or 0.001)),
                             "buy":is_buy})
        return results
    # Fallback: deal history
    from_dt2 = datetime.datetime.now()-datetime.timedelta(days=1)
    deals = mt5.history_deals_get(from_dt2, datetime.datetime.now())
    if deals is None: return []
    return [{"time":int(d.time),"price":float(d.price),
             "vol":float(d.volume),"buy":d.type==mt5.DEAL_TYPE_BUY}
            for d in list(deals)[-n:] if d.symbol in (sym,symbol)]

def swaps_json(symbols: list):
    if not ensure_mt5(): return []
    results = []
    for symbol in symbols:
        try:
            sym = resolve_symbol(symbol)
            info = mt5.symbol_info(sym)
            if info is None: continue
            t = mt5.symbol_info_tick(sym)
            price = t.bid if t else 1.0
            swap_l = float(info.swap_long)
            swap_s = float(info.swap_short)
            lot = float(info.trade_contract_size) if info.trade_contract_size>0 else 100000
            ann_l = round(swap_l/(lot*max(price,1)/100000)*365,2) if price>0 else 0
            ann_s = round(swap_s/(lot*max(price,1)/100000)*365,2) if price>0 else 0
            results.append({"symbol":symbol,"swap_long":swap_l,"swap_short":swap_s,
                             "ann_long":ann_l,"ann_short":ann_s,
                             "exchange":"MT5","currency":info.currency_profit})
        except Exception as e:
            print(f"[MT5] swaps error {symbol}: {e}")
    return results

def corr_json(symbols: list, n: int):
    if not ensure_mt5(): return {"symbols":symbols,"matrix":[]}
    closes = {}
    for symbol in symbols:
        sym = resolve_symbol(symbol)
        r = mt5.copy_rates_from_pos(sym, mt5.TIMEFRAME_D1, 0, n+2)
        if r is not None and len(r)>=3:
            closes[symbol] = [float(x["close"]) for x in r]
    def rets(arr): return [arr[i]/arr[i-1]-1 for i in range(1,len(arr))]
    def pearson(a,b):
        n2=min(len(a),len(b))
        if n2<3: return 0.0
        a,b=a[-n2:],b[-n2:]
        ma,mb=sum(a)/n2,sum(b)/n2
        num=sum((a[i]-ma)*(b[i]-mb) for i in range(n2))
        da=sum((x-ma)**2 for x in a); db=sum((x-mb)**2 for x in b)
        return round(num/math.sqrt(da*db),3) if da*db>0 else 0.0
    rv={s:rets(closes[s]) for s in closes}
    valid=[s for s in symbols if s in rv and len(rv[s])>=3]
    matrix=[[pearson(rv[r],rv[c]) if r!=c else 1.0 for c in valid] for r in valid]
    return {"symbols":valid,"matrix":matrix}

def symbols_json():
    if not ensure_mt5(): return []
    syms = mt5.symbols_get()
    if syms is None: return []
    return [{"name":s.name,"desc":s.description,"digits":s.digits,"visible":s.visible}
            for s in syms[:200]]

# ─── HTTP handler ──────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def send_json(self, code: int, obj):
        body = json.dumps(obj, allow_nan=False, default=lambda x: None).encode()
        self.send_response(code)
        self.send_header("Content-Type",  "application/json")
        self.send_header("Content-Length", len(body))
        # No CORS headers: the bridge is reached only by the Electron main process
        # via Node fetch (not subject to the same-origin policy). Dropping the
        # permissive "Access-Control-Allow-Origin: *" closes the browser-CSRF vector.
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        if not AUTH_TOKEN:
            return True  # standalone/manual run — see startup warning
        return hmac.compare_digest(self.headers.get("X-JARVIS-Token", ""), AUTH_TOKEN)

    def do_OPTIONS(self): self.send_json(200,{})

    def do_GET(self):
        if not self._authorized():
            return self.send_json(401, {"error": "unauthorized"})
        parsed = urlparse(self.path)
        p = parsed.path.rstrip("/")
        qs = parse_qs(parsed.query)
        def q(k,d=""): return qs.get(k,[d])[0]

        if   p=="/api/v1/ping":
            self.send_json(200,{"ok":True,"version":"2.0"})
        elif p=="/api/v1/account":
            a=account_json()
            if a: self.send_json(200,a)
            else: self.send_json(503,{"error":"MT5 not connected"})
        elif p=="/api/v1/positions":
            self.send_json(200,positions_json())
        elif p=="/api/v1/history":
            self.send_json(200,history_json())
        elif p=="/api/v1/rates":
            d=rates_json(q("symbol","BTCUSD"),q("tf","M15"),min(int(q("n","200")),1000))
            if d is not None: self.send_json(200,d)
            else: self.send_json(503,{"error":"no rates"})
        elif p=="/api/v1/tick":
            d=tick_json(q("symbol","BTCUSD"))
            if d: self.send_json(200,d)
            else: self.send_json(503,{"error":"no tick"})
        elif p=="/api/v1/batch":
            syms=[s.strip() for s in q("symbols","BTCUSD,EURUSD,XAUUSD,GBPUSD,USDJPY").split(",") if s.strip()]
            self.send_json(200,batch_json(syms))
        elif p=="/api/v1/book":
            d=book_json(q("symbol","BTCUSD"),min(int(q("depth","20")),50))
            if d: self.send_json(200,d)
            else: self.send_json(503,{"error":"no book"})
        elif p=="/api/v1/ticks_cvd":
            self.send_json(200,ticks_cvd_json(q("symbol","BTCUSD"),min(int(q("n","500")),5000)))
        elif p=="/api/v1/swaps":
            syms=[s.strip() for s in q("symbols","BTCUSD,EURUSD,XAUUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,NZDUSD").split(",") if s.strip()]
            self.send_json(200,swaps_json(syms))
        elif p=="/api/v1/corr":
            syms=[s.strip() for s in q("symbols","BTCUSD,ETHUSD,EURUSD,GBPUSD,USDJPY,XAUUSD,AUDUSD,USDCHF,SOLUSD,USDCAD").split(",") if s.strip()]
            self.send_json(200,corr_json(syms,min(int(q("n","32")),200)))
        elif p=="/api/v1/symbols":
            self.send_json(200,symbols_json())
        else:
            self.send_json(404,{"error":"unknown endpoint"})

    def do_POST(self):
        if not self._authorized():
            return self.send_json(401, {"error": "unauthorized"})
        p=self.path.split("?")[0].rstrip("/")
        length=int(self.headers.get("Content-Length",0))
        body=self.rfile.read(length) if length>0 else b""
        if   p=="/api/v1/expert/toggle":     self.send_json(200,toggle_json(body))
        elif p=="/api/v1/positions/close_all":self.send_json(200,close_all_json())
        else: self.send_json(404,{"error":"unknown endpoint"})

# ─── MT5 keep-alive thread ─────────────────────────────────────────────────────

def keepalive():
    while True:
        ensure_mt5()
        time.sleep(15)

# ─── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"[JARVIS MT5 Bridge v2.0]  http://localhost:{PORT}/api/v1/")
    if not AUTH_TOKEN:
        print("[JARVIS MT5 Bridge] WARNING: running UNAUTHENTICATED (JARVIS_BRIDGE_TOKEN not set)")
    ensure_mt5()
    threading.Thread(target=keepalive, daemon=True).start()
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[JARVIS MT5 Bridge] Stopped.")
        mt5.shutdown()
