import { useEffect, useMemo, useRef, useState } from 'react';
import { HoloPanel, Sparkline, Stat } from '../components/primitives';
import { ScreenHeader } from '../components/shell';
import { DraggableTabs, type DragTab } from '../components/draggable';
import { CYAN, CYAN_BRIGHT, AMBER, ROSE, JADE, VIOLET, colorFor } from '../theme';
import GodModeChart, { type GodModeTradeSetup } from '../components/GodModeChart';
import { CHANNELS, BRIEFINGS } from '../data/os-data';
import { lsGet, LS, runResearch, runContent } from '../lib/claude';
import type { ScreenProps } from './Bridge';
import {
  useZeusCandles, useZeusBook, useZeusCVD,
  useZeusSwaps, useZeusTickers, useZeusLiquidityMap, useZeusCorrelation,
  useFearGreed,
  useDeribitOptionsTrades, useDeribitOptionsData,
  useTreasuryYieldCurve,
  statusColor, statusLabel,
  type DataStatus,
} from '../lib/trading-data';

/* ── ZeusBot strategies ────────────────────────────────────────────────── */
type StratStatus = 'live' | 'paused' | 'testing' | 'disabled';

interface ZeusStrategy {
  id: string; name: string; desc: string;
  markets: string; risk: string; winRate: string;
  avgReturn: string; color: string; status: StratStatus;
}

const ZEUS_STRATEGIES: ZeusStrategy[] = [
  { id:'ZS-01', name:'Mean Reversion',    desc:'Fades overextended moves on 1h-4h timeframe. Uses Bollinger + RSI divergence.',  markets:'BTC ETH SOL',   risk:'1.2%', winRate:'64%', avgReturn:'+0.8%/trade', color: JADE,        status:'live'     },
  { id:'ZS-02', name:'Momentum Rider',    desc:'Rides strong trends via EMA crossover + volume confirmation. ATR-based stops.',   markets:'ALL PAIRS',     risk:'1.8%', winRate:'58%', avgReturn:'+1.4%/trade', color: CYAN_BRIGHT, status:'live'     },
  { id:'ZS-03', name:'Funding-Rate Arb',  desc:'Exploits funding-rate differentials between perp and spot on major CEXs.',       markets:'BTC ETH',       risk:'0.6%', winRate:'72%', avgReturn:'+0.3%/trade', color: AMBER,       status:'live'     },
  { id:'ZS-04', name:'Breakout Hunter',   desc:'Captures range breakouts with volume surge confirmation. Pyramids on strength.',  markets:'ALTCOINS',      risk:'2.0%', winRate:'51%', avgReturn:'+2.1%/trade', color: VIOLET,      status:'testing'  },
  { id:'ZS-05', name:'Grid Scalper',      desc:'High-frequency grid on tight BTC/USD range. 14ms tick. Hundreds of fills/day.',  markets:'BTC/USD',       risk:'0.4%', winRate:'80%', avgReturn:'+0.12%/fill', color: '#00e5ff',   status:'live'     },
  { id:'ZS-06', name:'Delta-Neutral MM',  desc:'Options-style market-making: long gamma, hedges delta every 60s via perp.',     markets:'BTC ETH OPTIONS',risk:'0.8%', winRate:'—',   avgReturn:'+Theta/day',   color: '#e879f9',   status:'paused'   },
  { id:'ZS-07', name:'Sentiment Overlay', desc:'Derives net-bias from Fear/Greed + social volume. Adjusts all strategy sizing.', markets:'GLOBAL BIAS',   risk:'—',    winRate:'—',   avgReturn:'Multiplier',   color: AMBER,       status:'live'     },
  { id:'ZS-08', name:'VWAP Band Fade',    desc:'Fades intraday deviations from VWAP ±2σ. 15min chart. Targets reversion.',      markets:'EURUSD DAX',    risk:'1.0%', winRate:'67%', avgReturn:'+0.6%/trade', color: JADE,        status:'testing'  },
  { id:'ZS-09', name:'News Alpha Bot',    desc:'Scans headlines via JARVIS news feed. Enters immediately on key catalysts.',     markets:'CRYPTO MACRO',  risk:'1.5%', winRate:'55%', avgReturn:'+1.8%/event', color: '#c8fb4e',   status:'disabled' },
];

// ── Real-time MT5 data hook ─────────────────────────────────────────────────
type PosRow = { sym: string; side: 'LONG'|'SHORT'; size: string; entry: string; mark: string; pnl: string; pct: string; up: boolean; bot: string; };
type LogRow = [string, string, string, string, string];

/** Module-level event bus: ZeusBotMiniPlayer fires this after a successful connect */
const MT5_CONNECTED_EVENT = 'mt5:connected';

function useMt5LiveData() {
  const [positions, setPositions] = useState<PosRow[]>([]);
  const [log, setLog]             = useState<LogRow[]>([]);
  const [equity, setEquity]       = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastErr, setLastErr]     = useState('');

  useEffect(() => {
    let alive = true;
    let ivId: number;

    async function poll() {
      // Read MT5 config from safeStorage (falls back to defaults)
      let host = 'localhost', port = 1234;
      try {
        const cfg = await window.jarvisBridge.config?.getMt5?.();
        if (cfg) { host = cfg.host; port = cfg.port; }
      } catch {
        host = 'localhost'; port = 1234;
      }
      // allow polling regardless of zeus.mode so TradingScreen stays in sync
      try {
        const r = await window.jarvisBridge.mt5({ host, port, endpoint: 'positions' });
        if (!alive) return;
        if (r.ok && Array.isArray(r.data)) {
          const mapped: PosRow[] = (r.data as any[]).map(p => {
            const profit: number = typeof p.profit === 'number' ? p.profit : 0;
            const openP:  number = typeof p.price_open === 'number' ? p.price_open : 1;
            const vol:    number = p.volume ?? 1;
            const pctVal = openP > 0 ? (profit / (openP * vol)) * 100 : 0;
            const dec = openP > 100 ? 2 : 5;
            return {
              sym:  p.symbol || '—',
              side: p.type === 0 ? 'LONG' : 'SHORT',
              size: String(vol),
              entry: openP.toFixed(dec),
              mark: ((p.price_current ?? openP) as number).toFixed(dec),
              pnl:  (profit >= 0 ? '+' : '') + profit.toFixed(2),
              pct:  (pctVal >= 0 ? '+' : '') + pctVal.toFixed(2) + '%',
              up:   profit >= 0,
              bot:  'ZeusBot',
            };
          });
          setPositions(mapped);
          setConnected(true);
          setLastErr('');
        } else {
          if (alive) { setConnected(false); setPositions([]); setLastErr(r.err || `HTTP ${r.status}`); }
          return;
        }
      } catch (e: any) {
        if (alive) { setConnected(false); setPositions([]); setLastErr(String(e?.message || e)); }
        return;
      }
      try {
        const a = await window.jarvisBridge.mt5({ host, port, endpoint: 'account' });
        if (!alive) return;
        if (a.ok && a.data && typeof (a.data as any).equity === 'number') {
          setEquity(prev => { const arr = [...prev, (a.data as any).equity as number]; return arr.length > 80 ? arr.slice(-80) : arr; });
        }
      } catch { /* skip */ }
      try {
        const h = await window.jarvisBridge.mt5({ host, port, endpoint: 'history' });
        if (!alive) return;
        if (h.ok && Array.isArray(h.data)) {
          setLog((h.data as any[]).slice(0, 12).map((d: any) => {
            const ts = d.time ? new Date(d.time * 1000).toTimeString().slice(0, 8) : '—';
            return [ts, d.entry === 0 ? 'ENTRY' : 'EXIT', d.symbol || '—', `${d.type === 0 ? 'BUY' : 'SELL'} ${d.volume ?? ''} @ ${d.price ?? '—'}`, 'ZeusBot'] as LogRow;
          }));
        }
      } catch { /* history endpoint may not exist */ }
    }

    function onConnected() { poll(); }

    poll();
    ivId = window.setInterval(poll, 5000);
    window.addEventListener(MT5_CONNECTED_EVENT, onConnected);
    return () => { alive = false; window.clearInterval(ivId); window.removeEventListener(MT5_CONNECTED_EVENT, onConnected); };
  }, []);
  return { positions, log, equity, connected, lastErr };
}

function StrategiesPanel() {
  const [active, setActive] = useState<Set<string>>(
    () => new Set(ZEUS_STRATEGIES.filter(s => s.status === 'live').map(s => s.id))
  );
  const [selected, setSelected] = useState<ZeusStrategy | null>(null);

  function toggle(id: string) {
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const statusColor = (s: StratStatus) =>
    s === 'live' ? JADE : s === 'testing' ? AMBER : s === 'paused' ? VIOLET : 'var(--cyan-dim)';

  return (
    <HoloPanel label="ZEUSBOT · ALL STRATEGIES" code="STR-Σ" status="live" style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'4px 0 8px', display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:7.5, fontFamily:'var(--font-mono)', letterSpacing:'0.22em', color: AMBER, background:`${AMBER}18`, border:`1px solid ${AMBER}44`, padding:'2px 7px' }}>CATALOG · NOT CONNECTED TO MT5</span>
        <span style={{ fontSize:8, fontFamily:'var(--font-mono)', color:'var(--cyan-dim)' }}>Toggles are local until ZEUS bot is connected via CONNECT</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, flex:1, minHeight:0 }}>
        {/* strategy list */}
        <div style={{ display:'flex', flexDirection:'column', gap:4, overflowY:'auto' }} className="nx-scroll">
          {ZEUS_STRATEGIES.map(s => {
            const on = active.has(s.id);
            const isSel = selected?.id === s.id;
            return (
              <div key={s.id}
                onClick={() => setSelected(isSel ? null : s)}
                style={{
                  padding:'8px 10px', cursor:'pointer',
                  border:`1px solid ${isSel ? s.color : 'var(--line-soft)'}`,
                  background: isSel ? `oklch(0.09 0.018 240 / 0.9)` : 'oklch(0.07 0.012 240 / 0.5)',
                  display:'flex', alignItems:'center', gap:8,
                  transition:'border-color 0.15s',
                }}>
                {/* toggle */}
                <button onClick={e => { e.stopPropagation(); toggle(s.id); }}
                  disabled={s.status === 'disabled'}
                  style={{
                    width:28, height:14, borderRadius:7, border:'none', cursor:'pointer',
                    background: on && s.status !== 'disabled' ? s.color : 'oklch(0.3 0.04 215)',
                    flexShrink:0, transition:'background 0.2s', opacity: s.status === 'disabled' ? 0.4 : 1,
                    position:'relative',
                  }}>
                  <span style={{
                    position:'absolute', top:2, left: on ? 16 : 2, width:10, height:10, borderRadius:'50%',
                    background:'white', transition:'left 0.2s',
                  }} />
                </button>
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span className="hud-label" style={{ fontSize:9.5, color: on ? s.color : 'var(--cyan-dim)', letterSpacing:'0.12em' }}>{s.name}</span>
                    <span className="font-mono" style={{ fontSize:8, color: statusColor(s.status), marginLeft:4 }}>{s.status.toUpperCase()}</span>
                  </div>
                  <div className="font-mono" style={{ fontSize:8, color:'var(--cyan-dim)', marginTop:1 }}>{s.markets} · WR {s.winRate}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* detail pane */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {selected ? (
            <div className="anim-fade-up">
              <div className="hud-label" style={{ fontSize:9, color: selected.color, letterSpacing:'0.28em', marginBottom:6 }}>{selected.id}</div>
              <div className="hud-label" style={{ fontSize:13, color:'var(--fg)', marginBottom:6 }}>{selected.name}</div>
              <div className="font-mono" style={{ fontSize:9.5, color:'var(--cyan-dim)', lineHeight:1.55, marginBottom:10 }}>{selected.desc}</div>
              {[
                ['MARKETS',    selected.markets],
                ['RISK/TRADE', selected.risk],
                ['WIN RATE',   selected.winRate],
                ['AVG RETURN', selected.avgReturn],
                ['STATUS',     selected.status.toUpperCase()],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px dashed var(--line-soft)' }}>
                  <span className="hud-label" style={{ fontSize:8.5, color:'var(--cyan-dim)' }}>{k}</span>
                  <span className="font-mono" style={{ fontSize:9.5, color: selected.color }}>{v}</span>
                </div>
              ))}
              <button onClick={() => setSelected(null)} className="hud-label"
                style={{ marginTop:10, width:'100%', padding:'6px', fontSize:8.5, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', background:'transparent', letterSpacing:'0.2em', cursor:'pointer' }}>
                CLOSE
              </button>
            </div>
          ) : (
            <div>
              <div className="hud-label" style={{ fontSize:9, color:'var(--cyan-dim)', letterSpacing:'0.22em', marginBottom:10 }}>STRATEGY SUMMARY</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                <div className="holo" style={{ padding:'10px 12px' }}>
                  <div className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)' }}>LIVE</div>
                  <div className="font-mono" style={{ fontSize:18, color: JADE }}>{ZEUS_STRATEGIES.filter(s => s.status==='live').length}</div>
                </div>
                <div className="holo" style={{ padding:'10px 12px' }}>
                  <div className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)' }}>TESTING</div>
                  <div className="font-mono" style={{ fontSize:18, color: AMBER }}>{ZEUS_STRATEGIES.filter(s => s.status==='testing').length}</div>
                </div>
                <div className="holo" style={{ padding:'10px 12px' }}>
                  <div className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)' }}>ACTIVE NOW</div>
                  <div className="font-mono" style={{ fontSize:18, color: CYAN_BRIGHT }}>{active.size}</div>
                </div>
                <div className="holo" style={{ padding:'10px 12px' }}>
                  <div className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)' }}>STRATS TOTAL</div>
                  <div className="font-mono" style={{ fontSize:18, color:'var(--fg)' }}>{ZEUS_STRATEGIES.length}</div>
                </div>
              </div>
              <div className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)', lineHeight:1.55 }}>
                Click a strategy to inspect. Toggle to arm/disarm.<br/>Changes are local — connect ZEUS bot to activate live execution.
              </div>
            </div>
          )}
        </div>
      </div>
    </HoloPanel>
  );
}

interface Mt5Acct { login: number; name: string; balance: number; equity: number; profit: number; margin: number; free_margin: number; leverage: number; currency: string; }

export function ZeusBotMiniPlayer() {
  // ── Refs for stable closures in intervals/timeouts ──
  const hostRef  = useRef('localhost');
  const portRef  = useRef(1234);
  const runRef   = useRef(false);   // mirrors running state for interval closures
  const dbRef    = useRef(localStorage.getItem('zeus.dauerbetrieb') === '1'); // dauerbetrieb ref

  const [host, setHostState] = useState('localhost');
  const [port, setPortState] = useState(1234);
  const [mode, setMode]      = useState<'mt5' | 'url'>(() => localStorage.getItem('zeus.mode') === 'url' ? 'url' : 'mt5');
  const [url,  setUrl]       = useState(() => localStorage.getItem('zeus.url') || '');

  // Load MT5 config from safeStorage on mount
  useEffect(() => {
    window.jarvisBridge.config?.getMt5?.().then(cfg => {
      if (cfg) {
        hostRef.current = cfg.host;
        portRef.current = cfg.port;
        setHostState(cfg.host);
        setPortState(cfg.port);
      }
    }).catch(() => {});
  }, []);

  const [status,       setStatus]       = useState<'disconnected'|'connecting'|'connected'|'error'|'demo'>('disconnected');
  const [info,         setInfo]         = useState('Connecting to MT5 bridge…');
  const [account,      setAccount]      = useState<Mt5Acct | null>(null);
  const [running,      setRunning]      = useState(false);
  const [dauerbetrieb, setDauerbetrieb] = useState(dbRef.current);
  const [equity,       setEquity]       = useState<number[]>([100, 100]);
  const [retryIn,      setRetryIn]      = useState(0); // seconds until next reconnect

  const tickRef     = useRef<number | null>(null);
  const pollRef     = useRef<number | null>(null);
  const reconnRef   = useRef<number | null>(null);
  const retryCount  = useRef(0);
  const retryTimer  = useRef<number | null>(null);

  function setHost(v: string) { hostRef.current = v; setHostState(v); }
  function setPort(v: number) { portRef.current = v; setPortState(v); }
  function toggleDauerbetrieb() {
    const next = !dbRef.current;
    dbRef.current = next;
    setDauerbetrieb(next);
    localStorage.setItem('zeus.dauerbetrieb', next ? '1' : '0');
  }

  // ── Arm / Safe ──
  function arm() {
    runRef.current = true; setRunning(true);
    setInfo('▶ ZeusBot ARMED · DAUERBETRIEB active');
    if (tickRef.current) window.clearInterval(tickRef.current);
    window.jarvisBridge.mt5({ host: hostRef.current, port: portRef.current, endpoint: 'expert/toggle', method: 'POST', body: { enabled: true } }).catch(() => {});
  }
  function safe() {
    runRef.current = false; setRunning(false);
    setInfo('◼ SAFED · positions held');
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    window.jarvisBridge.mt5({ host: hostRef.current, port: portRef.current, endpoint: 'expert/toggle', method: 'POST', body: { enabled: false } }).catch(() => {});
  }
  async function panic() {
    runRef.current = false; setRunning(false);
    setInfo('⚠ PANIC · flattening all positions…');
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    try {
      const r = await window.jarvisBridge.mt5({ host: hostRef.current, port: portRef.current, endpoint: 'positions/close_all', method: 'POST' });
      setInfo(r.ok ? '⚡ ALL POSITIONS CLOSED' : `PANIC error: ${r.err}`);
    } catch (e: any) { setInfo(`PANIC error: ${e?.message || e}`); }
  }

  // ── Stop all timers ──
  function clearAll() {
    if (tickRef.current)   { window.clearInterval(tickRef.current);   tickRef.current  = null; }
    if (pollRef.current)   { window.clearInterval(pollRef.current);   pollRef.current  = null; }
    if (reconnRef.current) { window.clearTimeout(reconnRef.current);  reconnRef.current = null; }
    if (retryTimer.current){ window.clearInterval(retryTimer.current); retryTimer.current = null; }
  }

  // ── Reconnect countdown ──
  function startCountdown(delaySec: number) {
    setRetryIn(delaySec);
    if (retryTimer.current) window.clearInterval(retryTimer.current);
    retryTimer.current = window.setInterval(() => {
      setRetryIn(prev => {
        if (prev <= 1) { window.clearInterval(retryTimer.current!); retryTimer.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Auto-reconnect scheduler ──
  function scheduleReconnect(silent = false) {
    if (reconnRef.current) return;
    const delaySec = Math.min(5 * Math.pow(1.5, retryCount.current), 60);
    retryCount.current++;
    if (!silent) setInfo(`⟳ MT5 offline — reconnect in ${Math.round(delaySec)}s (attempt ${retryCount.current})`);
    startCountdown(Math.round(delaySec));
    reconnRef.current = window.setTimeout(() => {
      reconnRef.current = null;
      connectMt5(true);
    }, delaySec * 1000);
  }

  // ── Start equity poll loop ──
  function startPoll() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const p = await window.jarvisBridge.mt5({ host: hostRef.current, port: portRef.current, endpoint: 'account' });
        if (p.ok && p.data && typeof p.data === 'object') {
          const a = p.data as Mt5Acct;
          setAccount(a);
          setEquity(prev => { const arr = [...prev, a.equity]; return arr.length > 80 ? arr.slice(-80) : arr; });
        } else {
          // connection dropped
          window.clearInterval(pollRef.current!); pollRef.current = null;
          setStatus('error'); setAccount(null);
          if (runRef.current) { runRef.current = false; setRunning(false); }
          scheduleReconnect();
        }
      } catch {
        window.clearInterval(pollRef.current!); pollRef.current = null;
        setStatus('error'); setAccount(null);
        if (runRef.current) { runRef.current = false; setRunning(false); }
        scheduleReconnect();
      }
    }, 3000);
  }

  // ── Core MT5 connect ──
  async function connectMt5(silent = false) {
    if (reconnRef.current) { window.clearTimeout(reconnRef.current); reconnRef.current = null; }
    if (retryTimer.current) { window.clearInterval(retryTimer.current); retryTimer.current = null; setRetryIn(0); }
    setStatus('connecting');
    setInfo(`connecting → http://${hostRef.current}:${portRef.current}/api/v1/account …`);
    try {
      const r = await window.jarvisBridge.mt5({ host: hostRef.current, port: portRef.current, endpoint: 'account' });
      if (r.ok && r.data && typeof r.data === 'object') {
        const acc = r.data as Mt5Acct;
        retryCount.current = 0;
        setAccount(acc); setStatus('connected');
        setInfo(`◉ ${acc.name} · #${acc.login} · ${acc.currency} · lev 1:${acc.leverage}${dbRef.current ? ' · DAUERBETRIEB' : ''}`);
        window.jarvisBridge.config?.setMt5?.(hostRef.current, portRef.current).catch(() => {});
        localStorage.setItem('zeus.mode', 'mt5');
        window.dispatchEvent(new Event(MT5_CONNECTED_EVENT));
        startPoll();
        // DAUERBETRIEB: auto-arm after connect/reconnect
        if (dbRef.current && !runRef.current) {
          setTimeout(() => arm(), 400);
        }
      } else {
        setStatus('error');
        setInfo(`✕ http://${hostRef.current}:${portRef.current}/api/v1 → ${r.err || `HTTP ${r.status}`}`);
        scheduleReconnect(silent);
      }
    } catch (e: any) {
      setStatus('error');
      setInfo(`✕ http://${hostRef.current}:${portRef.current}/api/v1 — ${String(e?.message || e)}`);
      scheduleReconnect(silent);
    }
  }

  // ── Auto-probe ports ──
  async function probe() {
    const tryPorts = [portRef.current, 1234, 8080, 8081, 5000, 3000];
    setStatus('connecting'); setInfo('auto-probing common ports…');
    for (const p of [...new Set(tryPorts)]) {
      setInfo(`probing http://${hostRef.current}:${p}/api/v1/account …`);
      try {
        const r = await window.jarvisBridge.mt5({ host: hostRef.current, port: p, endpoint: 'account' });
        if (r.ok && r.data && typeof r.data === 'object') {
          setPort(p);
          await connectMt5();
          return;
        }
      } catch {}
    }
    setStatus('error');
    setInfo(`✕ not found on ${hostRef.current} — tried: ${[...new Set(tryPorts)].join(', ')}`);
    scheduleReconnect();
  }

  // ── Custom URL ping ──
  async function connectUrl() {
    if (!url.trim()) { setStatus('demo'); setInfo('◉ DEMO MODE · ZeusBot simulated'); return; }
    setStatus('connecting'); setInfo('pinging endpoint…');
    const r = await window.jarvisBridge.zeusPing(url);
    if (r.ok) {
      setStatus('connected'); setInfo(`◉ connected · HTTP ${r.status}`);
      localStorage.setItem('zeus.url', url); localStorage.setItem('zeus.mode', 'url');
    } else {
      setStatus('error'); setInfo(`✕ ${r.err || 'HTTP ' + r.status}`);
    }
  }

  function connect() { mode === 'mt5' ? connectMt5() : connectUrl(); }

  // ── Auto-connect on mount ──
  useEffect(() => {
    connectMt5(true);
    return clearAll;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dotColor =
    status === 'connected'  ? JADE  :
    status === 'demo'       ? '#c8fb4e' :
    status === 'connecting' ? AMBER :
    status === 'error'      ? ROSE  : 'oklch(0.5 0.04 215)';
  const isOnline = status === 'connected' || status === 'demo';
  const pnl = account?.profit ?? (isOnline ? equity[equity.length - 1] - equity[0] : 0);

  return (
    <HoloPanel label="ZEUSBOT · MT5 CONNECTOR" code="ZEUS-Δ" status={isOnline ? 'live' : 'queue'}>
      {/* status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className={isOnline ? 'anim-pulse-soft' : status === 'connecting' ? 'anim-pulse-soft' : ''} style={{ width: 8, height: 8, borderRadius: 99, background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
        <span className="hud-label" style={{ fontSize: 9, color: dotColor, letterSpacing: '0.22em' }}>
          {status === 'error' && retryIn > 0 ? `ERROR · RETRY IN ${retryIn}s` : status.toUpperCase()}
        </span>
        {/* DAUERBETRIEB toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="hud-label" style={{ fontSize: 7.5, color: dauerbetrieb ? JADE : 'var(--cyan-dim)', letterSpacing: '0.18em' }}>DAUERBETRIEB</span>
          <button onClick={toggleDauerbetrieb}
            style={{ width: 30, height: 15, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: dauerbetrieb ? JADE : 'oklch(0.25 0.04 215)', position: 'relative', transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 2.5, left: dauerbetrieb ? 16 : 2.5, width: 10, height: 10,
              borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
          </button>
        </div>
      </div>

      {/* mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['mt5', 'url'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setStatus('disconnected'); setAccount(null); clearAll(); }}
            className="hud-label"
            style={{ flex: 1, padding: '4px', fontSize: 8.5, letterSpacing: '0.18em', cursor: 'pointer',
              color: mode === m ? '#0d1117' : CYAN_BRIGHT,
              background: mode === m ? CYAN_BRIGHT : 'transparent',
              border: `1px solid ${CYAN}60` }}>
            {m === 'mt5' ? '◆ MT5 REAL' : '◇ CUSTOM URL'}
          </button>
        ))}
      </div>

      {/* inputs */}
      {mode === 'mt5' ? (
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          <input value={host} onChange={e => setHost(e.target.value)} placeholder="localhost" className="font-mono"
            style={{ flex: 2, padding: '6px 8px', fontSize: 10.5, color: 'var(--fg)', background: 'oklch(0.07 0.014 240 / 0.7)', border: `1px solid ${CYAN}55`, outline: 'none', minWidth: 0 }} />
          <input value={String(port)} onChange={e => setPort(Number(e.target.value) || 1234)} type="number" className="font-mono"
            style={{ flex: 1, padding: '6px 8px', fontSize: 10.5, color: 'var(--fg)', background: 'oklch(0.07 0.014 240 / 0.7)', border: `1px solid ${CYAN}55`, outline: 'none', minWidth: 0 }} />
          <button onClick={connect} disabled={status === 'connecting'} className="hud-label"
            style={{ padding: '0 10px', fontSize: 9, color: CYAN_BRIGHT, border: `1px solid ${CYAN}`, background: `${CYAN}12`, letterSpacing: '0.24em', cursor: 'pointer', opacity: status === 'connecting' ? 0.5 : 1 }}>
            ◆ CONNECT
          </button>
          <button onClick={probe} disabled={status === 'connecting'} className="hud-label" title="Auto-probe ports 1234 8080 8081 5000 3000"
            style={{ padding: '0 8px', fontSize: 9, color: AMBER, border: `1px solid ${AMBER}60`, background: `${AMBER}10`, cursor: 'pointer', opacity: status === 'connecting' ? 0.5 : 1 }}>
            ⊕
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://bot.local/api  or  empty → DEMO" className="font-mono"
            style={{ flex: 1, padding: '6px 8px', fontSize: 10.5, color: 'var(--fg)', background: 'oklch(0.07 0.014 240 / 0.7)', border: `1px solid ${CYAN}55`, outline: 'none' }} />
          <button onClick={connect} className="hud-label"
            style={{ padding: '0 10px', fontSize: 9, color: CYAN_BRIGHT, border: `1px solid ${CYAN}`, background: `${CYAN}12`, letterSpacing: '0.24em', cursor: 'pointer' }}>
            {url.trim() ? '◆ CONNECT' : '▷ DEMO'}
          </button>
        </div>
      )}

      {/* MT5 account strip */}
      {account && (
        <div className="anim-fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
          {([
            ['BALANCE',  account.balance.toFixed(2),          JADE],
            ['EQUITY',   account.equity.toFixed(2),           account.equity >= account.balance ? JADE : ROSE],
            ['P&L',      (account.profit >= 0 ? '+' : '') + account.profit.toFixed(2), account.profit >= 0 ? JADE : ROSE],
            ['MARGIN',   account.margin.toFixed(2),           AMBER],
            ['FREE-M',   account.free_margin.toFixed(2),      'var(--fg)'],
            ['LEVERAGE', `1:${account.leverage}`,             'var(--cyan-dim)'],
          ] as [string, string, string][]).map(([k, v, c]) => (
            <div key={k} style={{ padding: '5px 7px', background: 'oklch(0.08 0.012 240 / 0.5)', border: '1px solid var(--line-soft)' }}>
              <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>{k}</div>
              <div className="font-mono" style={{ fontSize: 10, color: c, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* equity chart */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
        <div>
          <div className="hud-label" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>{mode === 'mt5' && account ? 'LIVE P&L' : 'SESSION P&L'}</div>
          <div className="font-display glow-cyan" style={{ fontSize: 20, color: pnl >= 0 ? JADE : ROSE }}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} <span style={{ fontSize: 10, color: 'var(--cyan-dim)' }}>{account?.currency ?? 'USD'}</span>
          </div>
        </div>
        <div style={{ width: 130 }}>
          <Sparkline data={equity} height={36} color={pnl >= 0 ? JADE : ROSE} />
        </div>
      </div>

      {/* buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={arm} disabled={!isOnline || running} className="hud-label"
          style={{ flex: 1, padding: '8px', fontSize: 10, color: JADE, border: `1px solid ${JADE}80`, background: running ? `${JADE}14` : 'oklch(0.74 0.16 145 / 0.06)', letterSpacing: '0.28em', opacity: (!isOnline || running) ? 0.45 : 1, cursor: (!isOnline || running) ? 'default' : 'pointer' }}>
          {running ? '▶ ARMED' : '▶ ARM'}
        </button>
        <button onClick={safe} disabled={!running} className="hud-label"
          style={{ flex: 1, padding: '8px', fontSize: 10, color: AMBER, border: `1px solid ${AMBER}80`, background: 'oklch(0.78 0.15 75 / 0.06)', letterSpacing: '0.28em', opacity: !running ? 0.4 : 1, cursor: !running ? 'default' : 'pointer' }}>
          ◼ SAFE
        </button>
        <button onClick={panic} className="hud-label"
          style={{ flex: 1, padding: '8px', fontSize: 10, color: ROSE, border: `1px solid ${ROSE}80`, background: 'oklch(0.66 0.20 22 / 0.06)', letterSpacing: '0.28em', cursor: 'pointer' }}>
          ⚠ PANIC
        </button>
      </div>
      <div className="font-mono" style={{ fontSize: 9, color: status === 'error' ? ROSE + 'cc' : 'var(--cyan-dim)', marginTop: 8, lineHeight: 1.4 }}>
        // {info}
      </div>
    </HoloPanel>
  );
}

/* ══════════════════════════════════════════════════════════════════
   JARVIS PRO — INSTITUTIONAL TRADING TERMINAL
   20 Hedge-Fund / Quant widgets — all data-dense, expert-grade
   ══════════════════════════════════════════════════════════════════ */

/* ─── Shared types ───────────────────────────────────────────────── */
type WidgetId =
  | 'PRICE_CHART' | 'ORDER_BOOK' | 'CVD'
  | 'GAMMA_EXPOSURE' | 'OPTIONS_FLOW' | 'DARK_POOL'
  | 'FUNDING_RATES' | 'CORRELATION' | 'YIELD_CURVE' | 'COT_POSITIONING'
  | 'LIQUIDITY_MAP' | 'SECTOR_ROTATION' | 'RISK_DASHBOARD' | 'CREDIT_SPREADS'
  | 'INST_FLOW' | 'VOL_SURFACE' | 'MACRO_POSITIONING'
  | 'POSITIONS' | 'EQUITY_CURVE' | 'EXECUTION_LOG' | 'ORDER_TICKET';

interface WidgetDef {
  id: WidgetId; label: string; desc: string;
  category: 'PRICE'|'FLOW'|'RISK'|'MACRO'|'QUANT'; color: string;
}

const WIDGET_REGISTRY: WidgetDef[] = [
  { id:'PRICE_CHART',     label:'Price Chart',              desc:'OHLCV candlestick · EMA 9/21 · VWAP · Bollinger Bands · volume bars',        category:'PRICE', color:'#ff1a6b' },
  { id:'ORDER_BOOK',      label:'Order Book L2',            desc:'Bid/ask depth map · cumulative imbalance · large order detection',            category:'FLOW',  color:'#00d084' },
  { id:'CVD',             label:'CVD · Delta Flow',         desc:'Cumulative volume delta · buy vs sell pressure · aggressive order tracking',  category:'FLOW',  color:'#00e5ff' },
  { id:'GAMMA_EXPOSURE',  label:'Gamma Exposure (GEX)',     desc:'Dealer net gamma by strike · flip level · pin/magnet risk analysis',         category:'RISK',  color:'#ffb300' },
  { id:'OPTIONS_FLOW',    label:'Options Unusual Flow',     desc:'Large unusual options prints · sentiment score · whale activity radar',       category:'FLOW',  color:'#e879f9' },
  { id:'DARK_POOL',       label:'Dark Pool Prints',         desc:'Institutional block trades · ATS volume · dark vs lit ratio by symbol',       category:'FLOW',  color:'#c8fb4e' },
  { id:'FUNDING_RATES',   label:'Funding Rates',            desc:'8h perpetual funding across Binance/Bybit/OKX · annualised carry cost',       category:'FLOW',  color:'#e879f9' },
  { id:'CORRELATION',     label:'Correlation Matrix',       desc:'30d rolling cross-asset correlation · regime shift detector',                 category:'QUANT', color:'#00e5ff' },
  { id:'YIELD_CURVE',     label:'Yield Curve',              desc:'US Treasury 2Y/5Y/10Y/30Y · inversion signal · real yield vs breakeven',      category:'MACRO', color:'#ffb300' },
  { id:'COT_POSITIONING', label:'COT Positioning',          desc:'CFTC Commitments of Traders · net spec vs commercial · extremes highlighted', category:'MACRO', color:'#c8fb4e' },
  { id:'LIQUIDITY_MAP',   label:'Liquidity Map',            desc:'Stop cluster heatmap · liquidation levels · equal highs/lows',               category:'FLOW',  color:'#00e5ff' },
  { id:'SECTOR_ROTATION', label:'Sector Rotation',          desc:'GICS sector relative strength vs SPX · risk-on/off flow · rotation speed',   category:'MACRO', color:'#00d084' },
  { id:'RISK_DASHBOARD',  label:'Risk Dashboard',           desc:'Portfolio VaR (95/99%) · Sharpe · Sortino · max DD · beta vs SPX',           category:'QUANT', color:'#ff1a6b' },
  { id:'CREDIT_SPREADS',  label:'Credit Spreads',           desc:'HY/IG OAS spreads · CDS 5Y · swap spreads · credit cycle indicator',         category:'MACRO', color:'#ffb300' },
  { id:'INST_FLOW',       label:'Institutional Flow',       desc:'Net institutional buy/sell by asset · 13F delta · smart money tracker',       category:'FLOW',  color:'#00d084' },
  { id:'VOL_SURFACE',     label:'Vol Surface',              desc:'Implied vol term structure · put/call skew · 25d RR · DVOL index',            category:'RISK',  color:'#e879f9' },
  { id:'MACRO_POSITIONING',label:'Macro Positioning',       desc:'G10 FX COT net specs · commodity net longs · hedge fund beta exposure',      category:'MACRO', color:'#c8fb4e' },
  { id:'POSITIONS',       label:'Open Positions',           desc:'Live MT5 positions · real-time PnL · risk per trade · margin used',          category:'PRICE', color:'#00d084' },
  { id:'EQUITY_CURVE',    label:'Equity Curve',             desc:'Account equity timeline · drawdown overlay · Sharpe / Calmar metrics',       category:'QUANT', color:'#00d084' },
  { id:'EXECUTION_LOG',   label:'Execution Log',            desc:'Order fills · slippage · algo attribution · market impact analysis',         category:'PRICE', color:'var(--cyan-dim)' },
  { id:'ORDER_TICKET',    label:'Order Ticket',             desc:'Live MT5 order placement · market orders · SL/TP auto-calc · R:R display',  category:'PRICE', color:'#00d084' },
];

const DEFAULT_LAYOUT: WidgetId[][] = [
  ['PRICE_CHART',    'ORDER_BOOK',     'CVD'],
  ['GAMMA_EXPOSURE', 'OPTIONS_FLOW',   'DARK_POOL'],
  ['RISK_DASHBOARD', 'EQUITY_CURVE',   'EXECUTION_LOG'],
];

function rnd(lo: number, hi: number, d = 2) { return +(Math.random()*(hi-lo)+lo).toFixed(d); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)]; }

/* ══════════════════════════════════════════════════════════════════
   WIDGET 1 — PRICE CHART (LIVE · Binance REST klines)
   ══════════════════════════════════════════════════════════════════ */
function WPriceChart({connected, symbol='BTCUSD'}:{connected:boolean;livePrice?:number;symbol?:string}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tf,setTf]   = useState<'1m'|'3m'|'5m'|'15m'|'1h'>('3m');
  const [ind,setInd] = useState<'EMA'|'VWAP'|'BB'>('EMA');
  const { candles, status, lastPrice } = useZeusCandles(symbol, tf === '1m' ? 'M1' : tf === '3m' ? 'M5' : tf === '5m' ? 'M5' : tf === '15m' ? 'M15' : 'H1', 80);
  const change24h = candles.length >= 2
    ? (((candles[candles.length-1].c - candles[0].o) / candles[0].o) * 100)
    : 0;

  useEffect(()=>{
    const cv=ref.current; if(!cv||candles.length===0)return;
    const ctx=cv.getContext('2d')!;
    const W=cv.width,H=cv.height;
    const PR=64,PT=8,PB=32,PL=6;
    const pW=W-PR-PL, pH=H-PT-PB;
    const lows=candles.map(c=>c.l),highs=candles.map(c=>c.h);
    const lo=Math.min(...lows),hi=Math.max(...highs),rng=hi-lo||1;
    const toY=(v:number)=>PT+(1-(v-lo)/rng)*pH;
    const cSp=pW/candles.length, cW=cSp*0.62;
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#04070f'); bg.addColorStop(1,'#020408');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    // grid + price axis
    for(let i=0;i<=5;i++){
      const y=PT+(i/5)*pH;
      ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(PL+pW,y); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.font='8px monospace';
      ctx.fillText('$'+(hi-(i/5)*rng).toFixed(0),PL+pW+2,y+3);
    }
    // time axis — show candle timestamp labels
    candles.forEach((c,i)=>{
      if(i%Math.max(1,Math.floor(candles.length/5))!==0)return;
      const t=new Date(c.time); const label=t.getHours().toString().padStart(2,'0')+':'+t.getMinutes().toString().padStart(2,'0');
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.font='7px monospace';
      ctx.fillText(label,PL+i*cSp,H-2);
    });
    // EMA
    if(ind==='EMA'){
      [[9,'#00e5ffaa'],[21,'#ffb300aa']].forEach(([per,col])=>{
        const k=2/(+per+1); let e=candles[0].c;
        ctx.beginPath(); ctx.strokeStyle=col as string; ctx.lineWidth=1.2;
        candles.forEach((c,i)=>{ e=c.c*k+e*(1-k); const x=PL+i*cSp+cSp/2; if(i===0)ctx.moveTo(x,toY(e)); else ctx.lineTo(x,toY(e)); });
        ctx.stroke();
      });
    }
    // VWAP
    if(ind==='VWAP'){
      let cumPV=0,cumV=0;
      ctx.beginPath(); ctx.strokeStyle='#e879f9cc'; ctx.lineWidth=1.5;
      candles.forEach((c,i)=>{ const typ=(c.h+c.l+c.c)/3; cumPV+=typ*c.v; cumV+=c.v; const v=cumPV/cumV; const x=PL+i*cSp+cSp/2; if(i===0)ctx.moveTo(x,toY(v)); else ctx.lineTo(x,toY(v)); });
      ctx.stroke();
    }
    // BB
    if(ind==='BB'){
      const closes=candles.map(c=>c.c), per=20;
      const sma:number[]=[],upper:number[]=[],lower:number[]=[];
      for(let i=0;i<closes.length;i++){
        const sl=closes.slice(Math.max(0,i-per+1),i+1);
        const m=sl.reduce((a,b)=>a+b,0)/sl.length;
        const sd=Math.sqrt(sl.reduce((a,b)=>a+(b-m)**2,0)/sl.length);
        sma.push(m); upper.push(m+2*sd); lower.push(m-2*sd);
      }
      const drawLine=(arr:number[],col:string,dash:number[])=>{
        ctx.beginPath(); ctx.strokeStyle=col; ctx.lineWidth=1; ctx.setLineDash(dash);
        arr.forEach((v,i)=>{ const x=PL+i*cSp+cSp/2; if(i===0)ctx.moveTo(x,toY(v)); else ctx.lineTo(x,toY(v)); }); ctx.stroke(); ctx.setLineDash([]);
      };
      drawLine(sma,'#ffb30099',[]); drawLine(upper,'#00e5ff66',[2,2]); drawLine(lower,'#00e5ff66',[2,2]);
    }
    // candles
    candles.forEach((c,i)=>{
      const x=PL+i*cSp, up=c.c>=c.o, col=up?'#00d084':'#ff1a6b';
      ctx.strokeStyle=col; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x+cW/2,toY(c.h)); ctx.lineTo(x+cW/2,toY(c.l)); ctx.stroke();
      ctx.fillStyle=up?col+'bb':col+'ee';
      ctx.fillRect(x,toY(Math.max(c.o,c.c)),cW,Math.max(1,Math.abs(toY(c.o)-toY(c.c))));
    });
    // volume bars
    const maxV=Math.max(...candles.map(c=>c.v),1);
    candles.forEach((c,i)=>{ const up=c.c>=c.o; ctx.fillStyle=(up?'#00d084':'#ff1a6b')+'44'; ctx.fillRect(PL+i*cSp,H-PB-(c.v/maxV)*22,cSp-1,(c.v/maxV)*22); });
    // price tag
    const last=candles[candles.length-1].c, ly=toY(last);
    ctx.setLineDash([3,3]); ctx.strokeStyle='#ff1a6b'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PL,ly); ctx.lineTo(PL+pW,ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#ff1a6b'; ctx.fillRect(PL+pW,ly-8,PR-1,14);
    ctx.fillStyle='#fff'; ctx.font='bold 8.5px monospace'; ctx.fillText('$'+last.toFixed(1),PL+pW+2,ly+4);
    if(!connected){ ctx.fillStyle='rgba(0,208,132,0.08)'; ctx.fillRect(PL+3,H-PB-13,82,11); ctx.fillStyle='#00d08488'; ctx.font='7.5px monospace'; ctx.fillText('LIVE·BINANCE',PL+5,H-PB-3); }
  },[candles,ind]);

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#04070f',border:'1px solid #ff1a6b30'}}>
      <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 7px',borderBottom:'1px solid #ff1a6b20',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#ff1a6b',letterSpacing:'0.22em'}}>{symbol.replace(/([A-Z]{2,5})(USD)$/,'$1/$2')}</span>
        <span className="font-display" style={{fontSize:14,color:'#fff',letterSpacing:'-0.02em'}}>${lastPrice>0?lastPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'...'}</span>
        <span className="font-mono" style={{fontSize:8,color:change24h>=0?'#00d084':'#ff1a6b'}}>{change24h>=0?'+':''}{change24h.toFixed(2)}%</span>
        <span className="font-mono" style={{fontSize:7,marginLeft:4,color:statusColor(status)}}>{statusLabel(status)}</span>
        <div style={{marginLeft:'auto',display:'flex',gap:2}}>
          {(['1m','3m','5m','15m','1h'] as const).map(t=>(
            <button key={t} onClick={()=>setTf(t)} className="hud-label" style={{padding:'1px 4px',fontSize:7,border:`1px solid ${tf===t?'#ff1a6b':'rgba(255,255,255,0.08)'}`,background:tf===t?'#ff1a6b14':'transparent',color:tf===t?'#ff1a6b':'rgba(255,255,255,0.35)',cursor:'pointer',letterSpacing:'0.08em'}}>{t}</button>
          ))}
          {(['EMA','VWAP','BB'] as const).map(i=>(
            <button key={i} onClick={()=>setInd(i)} className="hud-label" style={{padding:'1px 4px',fontSize:7,border:`1px solid ${ind===i?'#00e5ff':'rgba(255,255,255,0.08)'}`,background:ind===i?'#00e5ff14':'transparent',color:ind===i?'#00e5ff':'rgba(255,255,255,0.35)',cursor:'pointer',letterSpacing:'0.08em'}}>{i}</button>
          ))}
        </div>
      </div>
      {status==='loading'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><span className="font-mono" style={{fontSize:9,color:'#00e5ff'}}>FETCHING LIVE DATA...</span></div>}
      {status!=='loading'&&<canvas ref={ref} width={640} height={220} style={{width:'100%',flex:1,display:'block'}} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 2 — ORDER BOOK L2
   ══════════════════════════════════════════════════════════════════ */
function WOrderBook({symbol='BTCUSD'}:{symbol?:string}={}) {
  const { book, status } = useZeusBook(symbol, 14);
  if (!book) return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#04090e',border:'1px solid #00d08432',alignItems:'center',justifyContent:'center'}}>
      <span className="font-mono" style={{fontSize:9,color:statusColor(status)}}>{statusLabel(status)}</span>
    </div>
  );
  const askCum: number[]=[], bidCum: number[]=[];
  let ca=0,cb=0;
  book.asks.forEach(a=>{ca+=a.s; askCum.push(ca);});
  book.bids.forEach(b=>{cb+=b.s; bidCum.push(cb);});
  const maxCum=Math.max(ca,cb);
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#04090e',border:'1px solid #00d08432'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #00d08420',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#00d084',letterSpacing:'0.22em'}}>ORDER BOOK · {symbol.replace(/([A-Z]{2,5})(USD)$/,'$1/$2')}</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:8,color:'#00d084'}}>BID {book.bidImbalance}%</span>
          <span className="font-mono" style={{fontSize:8,color:'#ff1a6b'}}>ASK {100-book.bidImbalance}%</span>
          <span className="font-mono" style={{fontSize:8,color:'#ffb300'}}>SPR {book.spread}</span>
          <span className="font-mono" style={{fontSize:7,color:statusColor(status)}}>{statusLabel(status)}</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['PRICE','SIZE'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.1em'}}>{h}</span>)}
      </div>
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
          {book.asks.map((a,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr',padding:'2px 7px',position:'relative'}}>
              <div style={{position:'absolute',right:0,top:0,bottom:0,width:`${(askCum[i]/maxCum)*100}%`,background:'#ff1a6b14'}}/>
              <span className="font-mono" style={{fontSize:9,color:'#ff1a6b',zIndex:1}}>{a.p.toFixed(1)}</span>
              <span className="font-mono" style={{fontSize:9,color:'rgba(255,255,255,0.65)',zIndex:1}}>{a.s.toFixed(3)}</span>
            </div>
          ))}
        </div>
        <div style={{padding:'3px 7px',background:'rgba(255,255,255,0.04)',textAlign:'center',flexShrink:0}}>
          <span className="font-mono" style={{fontSize:9,color:'#ffb300'}}>MID ${book.midPrice.toFixed(1)} · SPREAD {book.spread}</span>
        </div>
        <div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
          {book.bids.map((b,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr',padding:'2px 7px',position:'relative'}}>
              <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${(bidCum[i]/maxCum)*100}%`,background:'#00d08414'}}/>
              <span className="font-mono" style={{fontSize:9,color:'#00d084',zIndex:1}}>{b.p.toFixed(1)}</span>
              <span className="font-mono" style={{fontSize:9,color:'rgba(255,255,255,0.65)',zIndex:1}}>{b.s.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 3 — CVD · DELTA FLOW
   ══════════════════════════════════════════════════════════════════ */
function WCVD({symbol='BTCUSD'}:{symbol?:string}={}) {
  const ref=useRef<HTMLCanvasElement>(null);
  const { points: rows, status } = useZeusCVD(symbol, 300);
  useEffect(()=>{
    const cv=ref.current; if(!cv||rows.length===0)return;
    const ctx=cv.getContext('2d')!;
    const W=cv.width,H=cv.height;
    const cvds=rows.map(r=>r.cvd), lo=Math.min(...cvds),hi=Math.max(...cvds),rng=hi-lo||1;
    const toY=(v:number)=>8+(1-(v-lo)/rng)*(H-44);
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#04080c'; ctx.fillRect(0,0,W,H);
    // zero line
    const zY=toY(0);
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(0,zY); ctx.lineTo(W,zY); ctx.stroke(); ctx.setLineDash([]);
    const bw=W/rows.length;
    const maxD=Math.max(...rows.map(r=>Math.abs(r.delta)),0.001);
    rows.forEach((r,i)=>{
      const bh=(Math.abs(r.delta)/maxD)*22;
      ctx.fillStyle=(r.delta>0?'#00d084':'#ff1a6b')+'88';
      ctx.fillRect(i*bw,H-32-bh,bw-0.5,bh);
    });
    ctx.beginPath(); ctx.strokeStyle='#00e5ff'; ctx.lineWidth=1.5;
    rows.forEach((r,i)=>{ const x=i*bw+bw/2; if(i===0)ctx.moveTo(x,toY(r.cvd)); else ctx.lineTo(x,toY(r.cvd)); }); ctx.stroke();
    const last=rows[rows.length-1];
    ctx.fillStyle=last.cvd>=0?'#00d084':'#ff1a6b'; ctx.font='bold 9px monospace';
    ctx.fillText((last.cvd>=0?'+':'')+last.cvd.toFixed(2),6,18);
    ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.font='7.5px monospace'; ctx.fillText('CVD BTC',6,28);
  },[rows]);
  const last=rows.length>0?rows[rows.length-1]:null;
  const buyCount=rows.filter(r=>r.delta>0).length;
  const buyPct=rows.length>0?(buyCount/rows.length*100).toFixed(0):'0';
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#04080c',border:'1px solid #00e5ff30'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'3px 7px',borderBottom:'1px solid #00e5ff18',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#00e5ff',letterSpacing:'0.22em'}}>CVD · CUMULATIVE DELTA</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:8,color:'#00d084'}}>BUY {buyPct}%</span>
          <span className="font-mono" style={{fontSize:8,color:'#ff1a6b'}}>SELL {(100-+buyPct)}%</span>
          {last&&<span className="font-mono" style={{fontSize:8,color:last.delta>0?'#00d084':'#ff1a6b'}}>Δ{last.delta>=0?'+':''}{last.delta.toFixed(2)}</span>}
          {last&&<span className="font-mono" style={{fontSize:8,color:last.cvd>=0?'#00d084':'#ff1a6b'}}>Σ{last.cvd>=0?'+':''}{last.cvd.toFixed(2)}</span>}
          <span className="font-mono" style={{fontSize:7,color:statusColor(status)}}>{statusLabel(status)}</span>
        </div>
      </div>
      {status==='loading'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><span className="font-mono" style={{fontSize:9,color:'#00e5ff'}}>COMPUTING CVD...</span></div>}
      {status!=='loading'&&<canvas ref={ref} width={480} height={160} style={{width:'100%',flex:1,display:'block'}} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 4 — GAMMA EXPOSURE (GEX)
   ══════════════════════════════════════════════════════════════════ */
function WGammaExposure() {
  const ref=useRef<HTMLCanvasElement>(null);
  const { gexStrikes: strikes, spotPrice: spot, status } = useDeribitOptionsData('BTC');
  useEffect(()=>{
    const cv=ref.current; if(!cv || strikes.length === 0)return;
    const ctx=cv.getContext('2d')!;
    const W=cv.width,H=cv.height,PAD=8,LH=18,pH=H-PAD*2-LH;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#060a0f'; ctx.fillRect(0,0,W,H);
    const maxA=Math.max(...strikes.map(s=>Math.abs(s.g)));
    const bw=(W-PAD*2)/strikes.length, zy=PAD+pH/2;
    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(PAD,zy); ctx.lineTo(W-PAD,zy); ctx.stroke(); ctx.setLineDash([]);
    strikes.forEach((st,i)=>{
      const x=PAD+i*bw, bh=(Math.abs(st.g)/maxA)*(pH/2-4);
      if(st.atm){ ctx.strokeStyle='#ffb30055'; ctx.lineWidth=1.5; ctx.setLineDash([2,2]); ctx.beginPath(); ctx.moveTo(x+bw/2,PAD); ctx.lineTo(x+bw/2,H-LH); ctx.stroke(); ctx.setLineDash([]); }
      const col=st.g>0?'#00d084bb':'#ff1a6bbb';
      ctx.fillStyle=col;
      if(st.g>0) ctx.fillRect(x+1,zy-bh,bw-2,bh); else ctx.fillRect(x+1,zy,bw-2,bh);
      ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.font='6px monospace';
      ctx.fillText((st.s/1000).toFixed(0)+'K',x+1,H-2);
    });
    const net=strikes.reduce((s,x)=>s+x.g,0);
    ctx.fillStyle='#ffb300'; ctx.font='8px monospace'; ctx.fillText('NET GEX '+(net>=0?'+':''+(net/1000).toFixed(1)+'K'),6,14);
    ctx.fillStyle=net>0?'#00d084':'#ff1a6b'; ctx.fillText(net>0?'DEALER LONG γ':'DEALER SHORT γ',6,24);
  });
  const net=strikes.reduce((s,x)=>s+x.g,0);
  const flipStrike=strikes.find(s=>s.g*strikes[strikes.indexOf(s)+1]?.g<0);
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#060a0f',border:'1px solid #ffb30030'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #ffb30018',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#ffb300',letterSpacing:'0.22em'}}>GAMMA EXPOSURE · DEALER NET</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:8,color:'#ffb300'}}>GEX {net>=0?'+':''}{(net/1000).toFixed(1)}B</span>
          {flipStrike && <span className="font-mono" style={{fontSize:8,color:'#e879f9'}}>FLIP ${flipStrike.s.toLocaleString()}</span>}
          <span className="font-mono" style={{fontSize:8,color:net>0?'#00d084':'#ff1a6b'}}>{net>0?'PIN ↑':'MAGNET ↓'}</span>
          <span className="font-mono" style={{fontSize:7,color:statusColor(status)}}>{statusLabel(status)}</span>
        </div>
      </div>
      {status==='loading'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><span className="font-mono" style={{fontSize:9,color:'#ffb300'}}>FETCHING GEX DATA...</span></div>}
      {status!=='loading'&&<canvas ref={ref} width={480} height={160} style={{width:'100%',flex:1,display:'block'}} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 5 — OPTIONS UNUSUAL FLOW
   ══════════════════════════════════════════════════════════════════ */
function WOptionsFlow() {
  const { rows, status } = useDeribitOptionsTrades('BTC', 20);
  const scoreCol=(s:number)=>s>=90?'#ff1a6b':s>=80?'#ffb300':s>=70?'#00e5ff':'#00d084';
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#080412',border:'1px solid #e879f930'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #e879f918',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#e879f9',letterSpacing:'0.22em'}}>OPTIONS UNUSUAL FLOW · DERIBIT LIVE</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>SWEEP = aggressive · BLOCK = negotiated</span>
          <span className="font-mono" style={{fontSize:7,color:statusColor(status)}}>{statusLabel(status)}</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'46px 34px 34px 38px 44px 46px 36px 28px 28px',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['TIME','SYM','TYPE','EXP','STK','PREM','SIDE','IV','SCR'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.08em'}}>{h}</span>)}
      </div>
      {status==='loading'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><span className="font-mono" style={{fontSize:9,color:'#e879f9'}}>FETCHING OPTIONS FLOW...</span></div>}
      {status!=='loading'&&<div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
        {rows.map((r,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'46px 34px 34px 38px 44px 46px 36px 28px 28px',padding:'2.5px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)',alignItems:'center',background:i===0?'rgba(232,121,249,0.05)':'transparent'}}>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.35)'}}>{r.t}</span>
            <span className="font-mono" style={{fontSize:9.5,color:'#00e5ff',fontWeight:600}}>{r.sym}</span>
            <span className="hud-label" style={{fontSize:7.5,color:r.type==='CALL'?'#00d084':'#ff1a6b',letterSpacing:'0.08em'}}>{r.type}</span>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.45)'}}>{r.exp}</span>
            <span className="font-mono" style={{fontSize:8.5,color:'rgba(255,255,255,0.7)'}}>{r.str}</span>
            <span className="font-mono" style={{fontSize:9,color:'#e879f9',fontWeight:600}}>{r.prem}</span>
            <span className="hud-label" style={{fontSize:7.5,color:r.side==='SWEEP'?'#ff1a6b':'#ffb300',letterSpacing:'0.06em'}}>{r.side}</span>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.4)'}}>{r.iv}</span>
            <span className="font-mono" style={{fontSize:9,color:scoreCol(r.score),fontWeight:700}}>{r.score}</span>
          </div>
        ))}
      </div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 6 — DARK POOL PRINTS
   ══════════════════════════════════════════════════════════════════ */
function WDarkPool() {
  const [rows]=useState(()=>[
    {t:'14:27:18',sym:'SPY', px:550.42,sz:485000,val:'$266.7M',venue:'FINRA ATS',litPct:12,bull:true },
    {t:'14:24:05',sym:'AAPL',px:188.90,sz:920000,val:'$173.8M',venue:'IEX',       litPct:8, bull:true },
    {t:'14:20:33',sym:'TSLA',px:174.20,sz:640000,val:'$111.5M',venue:'BATS ATS',  litPct:5, bull:false},
    {t:'14:18:11',sym:'QQQ', px:471.85,sz:230000,val:'$108.5M',venue:'FINRA ATS', litPct:18,bull:false},
    {t:'14:15:44',sym:'MSFT',px:414.30,sz:260000,val:'$107.7M',venue:'IEX',       litPct:22,bull:true },
    {t:'14:12:02',sym:'NVDA',px:1025.0,sz:95000, val:'$97.4M', venue:'BATS ATS',  litPct:7, bull:true },
    {t:'14:09:50',sym:'BTC', px:78050, sz:1240,  val:'$96.8M', venue:'COINBASE',  litPct:0, bull:true },
    {t:'14:06:22',sym:'GLD', px:222.80,sz:420000,val:'$93.6M', venue:'FINRA ATS', litPct:15,bull:true },
  ]);
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#060b05',border:'1px solid #c8fb4e28'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #c8fb4e14',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#c8fb4e',letterSpacing:'0.22em'}}>DARK POOL PRINTS · ATS BLOCK TRADES</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>LIT% = exchange-routed portion</span>
          <span className="font-mono" style={{fontSize:7.5,color:'#ffb300'}}>◎ SIM</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'46px 36px 58px 58px 60px 1fr 28px',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['TIME','SYM','PRICE','SIZE','VALUE','VENUE','LIT'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.08em'}}>{h}</span>)}
      </div>
      <div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
        {rows.map((r,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'46px 36px 58px 58px 60px 1fr 28px',padding:'2.5px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)',alignItems:'center',background:i===0?'rgba(200,251,78,0.04)':'transparent'}}>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.35)'}}>{r.t}</span>
            <span className="font-mono" style={{fontSize:9.5,color:'#00e5ff',fontWeight:600}}>{r.sym}</span>
            <span className="font-mono" style={{fontSize:8.5,color:'rgba(255,255,255,0.7)'}}>${r.px.toLocaleString()}</span>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.5)'}}>{(r.sz/1000).toFixed(0)}K</span>
            <span className="font-mono" style={{fontSize:9,color:'#c8fb4e',fontWeight:600}}>{r.val}</span>
            <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>{r.venue}</span>
            <span className="font-mono" style={{fontSize:8,color:r.litPct<10?'#ff1a6b':'rgba(255,255,255,0.4)'}}>{r.litPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 7 — FUNDING RATES MULTI-EXCHANGE
   ══════════════════════════════════════════════════════════════════ */
function WFundingRates() {
  const { rows, status } = useZeusSwaps();
  const maxAnn=rows.length>0?Math.max(...rows.map(r=>Math.abs(r.annRate)),0.001):1;
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#07030f',border:'1px solid #e879f928'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #e879f914',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#e879f9',letterSpacing:'0.22em'}}>FUNDING RATES · PERP · 8H</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.3)'}}>+rate = longs pay shorts</span>
          <span className="font-mono" style={{fontSize:7,color:statusColor(status)}}>{statusLabel(status)}</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'52px 80px 60px 60px 60px',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['EXCH','SYMBOL','8H RATE','ANNLSD','NEXT FUND'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.08em'}}>{h}</span>)}
      </div>
      {status==='loading'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><span className="font-mono" style={{fontSize:9,color:'#e879f9'}}>FETCHING FUNDING DATA...</span></div>}
      {status!=='loading'&&<div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
        {rows.map((r,i)=>(
          <div key={i} style={{padding:'2px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)'}}>
            <div style={{display:'grid',gridTemplateColumns:'52px 80px 60px 60px 60px',alignItems:'center'}}>
              <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.4)'}}>{r.exchange}</span>
              <span className="font-mono" style={{fontSize:9,color:'#e879f9'}}>{r.symbol}</span>
              <span className="font-mono" style={{fontSize:10,color:r.rate>0?'#00d084':'#ff1a6b',fontWeight:600}}>{r.rate>0?'+':''}{r.rate.toFixed(4)}%</span>
              <span className="font-mono" style={{fontSize:8.5,color:r.annRate>0?'#00d08499':'#ff1a6b99'}}>{r.annRate>0?'+':''}{r.annRate.toFixed(1)}%</span>
              <span className="font-mono" style={{fontSize:7.5,color:'#ffb300'}}>{r.nextTime}</span>
            </div>
            <div style={{height:2,marginTop:1,background:'rgba(255,255,255,0.05)',position:'relative'}}>
              <div style={{position:'absolute',top:0,left:0,height:'100%',width:`${(Math.abs(r.annRate)/maxAnn)*100}%`,background:r.annRate>0?'#00d08466':'#ff1a6b66'}} />
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 8 — CORRELATION MATRIX
   ══════════════════════════════════════════════════════════════════ */
function WCorrelation() {
  const ref=useRef<HTMLCanvasElement>(null);
  const { assets, matrix: mat, status } = useZeusCorrelation();
  useEffect(()=>{
    const cv=ref.current; if(!cv || mat.length === 0)return;
    const ctx=cv.getContext('2d')!;
    const W=cv.width,H=cv.height,n=assets.length;
    const lw=32, cell=(W-lw)/(n+0.5), cellH=(H-lw)/(n+0.5);
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#050813'; ctx.fillRect(0,0,W,H);
    for(let i=0;i<n;i++){
      for(let j=0;j<n;j++){
        const v=mat[i][j];
        const t=(v+1)/2;
        const r=Math.round(t<0.5?t*2*180:180+(t*2-1)*75);
        const g=Math.round(t<0.5?t*2*180:255);
        const b=Math.round(t<0.5?255-(t*2)*220:100-(t*2-1)*80);
        ctx.fillStyle=`rgba(${r},${g},${b},0.82)`;
        ctx.fillRect(lw+j*cell+1,lw+i*cellH+1,cell-2,cellH-2);
        ctx.fillStyle=Math.abs(v)>0.5?'rgba(0,0,0,0.7)':'rgba(255,255,255,0.7)'; ctx.font='7px monospace';
        ctx.fillText(v.toFixed(2),lw+j*cell+3,lw+i*cellH+cellH*0.65);
      }
      ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='7.5px monospace';
      ctx.fillText(assets[i],1,lw+i*cellH+cellH*0.65);
      ctx.fillText(assets[i],lw+i*cell+2,lw-4);
    }
  });
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#050813',border:'1px solid #00e5ff28'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #00e5ff14',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#00e5ff',letterSpacing:'0.22em'}}>CRYPTO CORRELATION MATRIX · 30d ROLLING</span>
        <div style={{display:'flex',gap:10}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>GREEN = pos · RED = neg</span>
          <span className="font-mono" style={{fontSize:7,color:statusColor(status)}}>{statusLabel(status)}</span>
        </div>
      </div>
      {status==='loading'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><span className="font-mono" style={{fontSize:9,color:'#00e5ff'}}>COMPUTING CORRELATIONS...</span></div>}
      {status!=='loading'&&<canvas ref={ref} width={480} height={180} style={{width:'100%',flex:1,display:'block'}} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 9 — YIELD CURVE
   ══════════════════════════════════════════════════════════════════ */
function WYieldCurve() {
  const ref=useRef<HTMLCanvasElement>(null);
  const { current: ylds, previous: prev, tenors, status } = useTreasuryYieldCurve();
  useEffect(()=>{
    const cv=ref.current; if(!cv || ylds.length === 0)return;
    const ctx=cv.getContext('2d')!;
    const W=cv.width,H=cv.height,PT=14,PB=22,PL=38,PR=8;
    const pW=W-PL-PR,pH=H-PT-PB;
    const lo=Math.min(...ylds,...prev)-0.1, hi=Math.max(...ylds,...prev)+0.1, rng=hi-lo;
    const toY=(v:number)=>PT+(1-(v-lo)/rng)*pH;
    const toX=(i:number)=>PL+(i/(tenors.length-1))*pW;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#070a05'; ctx.fillRect(0,0,W,H);
    // grid
    for(let i=0;i<=4;i++){
      const y=PT+(i/4)*pH; const v=hi-(i/4)*rng;
      ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(W-PR,y); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='7.5px monospace';
      ctx.fillText(v.toFixed(2)+'%',1,y+3);
    }
    // inversion zone
    const inv=ylds[4]>ylds[8];
    if(inv){ ctx.fillStyle='rgba(255,26,107,0.07)'; ctx.fillRect(PL,PT,pW,pH); }
    // previous curve (dashed)
    ctx.beginPath(); ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    prev.forEach((v,i)=>{ if(i===0)ctx.moveTo(toX(i),toY(v)); else ctx.lineTo(toX(i),toY(v)); }); ctx.stroke(); ctx.setLineDash([]);
    // current curve
    const grad=ctx.createLinearGradient(PL,0,W-PR,0);
    grad.addColorStop(0,'#ff1a6b'); grad.addColorStop(0.5,'#ffb300'); grad.addColorStop(1,'#00d084');
    ctx.beginPath(); ctx.strokeStyle=grad; ctx.lineWidth=2;
    ylds.forEach((v,i)=>{ if(i===0)ctx.moveTo(toX(i),toY(v)); else ctx.lineTo(toX(i),toY(v)); }); ctx.stroke();
    ylds.forEach((v,i)=>{
      ctx.beginPath(); ctx.arc(toX(i),toY(v),3,0,Math.PI*2);
      ctx.fillStyle='#ffb300'; ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='7px monospace';
      ctx.fillText(tenors[i],toX(i)-8,H-4);
    });
    if(inv){ ctx.fillStyle='#ff1a6b'; ctx.font='bold 9px monospace'; ctx.fillText('⚠ 2Y>10Y INVERSION',PL+4,PT+12); }
  });
  const spread2_10=ylds.length>0?(ylds[4]-ylds[8]).toFixed(2):'0.00';
  const inv=+spread2_10>0;
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#070a05',border:'1px solid #ffb30028'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #ffb30018',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#ffb300',letterSpacing:'0.22em'}}>US TREASURY YIELD CURVE</span>
        <div style={{display:'flex',gap:10}}>
          <span className="font-mono" style={{fontSize:8,color:inv?'#ff1a6b':'#00d084'}}>2Y-10Y {inv?'+':'−'}{Math.abs(+spread2_10).toFixed(2)}%</span>
          <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.4)'}}>10Y {ylds[8]?.toFixed(2)}%</span>
          <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.4)'}}>30Y {ylds[10]?.toFixed(2)}%</span>
          <span className="font-mono" style={{fontSize:7,color:statusColor(status)}}>{statusLabel(status)}</span>
        </div>
      </div>
      <canvas ref={ref} width={480} height={160} style={{width:'100%',flex:1,display:'block'}} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 10 — COT POSITIONING (CFTC)
   ══════════════════════════════════════════════════════════════════ */
function WCotPositioning() {
  const [rows]=useState(()=>[
    {asset:'BTC',     netSpec:+42800, chg:+3200,  pctile:78, extreme:false, bull:true},
    {asset:'GOLD',    netSpec:+186000,chg:-8400,  pctile:82, extreme:true,  bull:true},
    {asset:'CRUDE',   netSpec:+64200, chg:+1100,  pctile:55, extreme:false, bull:true},
    {asset:'EUR',     netSpec:-38400, chg:-4200,  pctile:24, extreme:false, bull:false},
    {asset:'JPY',     netSpec:-184000,chg:-12000, pctile:8,  extreme:true,  bull:false},
    {asset:'SPX E-M', netSpec:+298000,chg:+18000, pctile:91, extreme:true,  bull:true},
    {asset:'NAS100',  netSpec:+186000,chg:+9200,  pctile:88, extreme:true,  bull:true},
    {asset:'T-BONDS', netSpec:-121000,chg:-6800,  pctile:12, extreme:true,  bull:false},
    {asset:'COPPER',  netSpec:+28400, chg:+2100,  pctile:62, extreme:false, bull:true},
    {asset:'SILVER',  netSpec:+14200, chg:-1400,  pctile:58, extreme:false, bull:true},
  ]);
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#080b06',border:'1px solid #c8fb4e28'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #c8fb4e14',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#c8fb4e',letterSpacing:'0.22em'}}>CFTC COT · NET SPECULATOR POSITIONING</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>PCTILE = 3yr historical rank</span>
          <span className="font-mono" style={{fontSize:7.5,color:'#ffb300'}}>◎ SIM</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'56px 74px 52px 48px 1fr',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['ASSET','NET SPEC','WK CHG','PCTILE','POSITIONING BAR'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.08em'}}>{h}</span>)}
      </div>
      <div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
        {rows.map((r,i)=>(
          <div key={i} style={{padding:'2.5px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)',background:r.extreme?'rgba(255,179,0,0.04)':'transparent'}}>
            <div style={{display:'grid',gridTemplateColumns:'56px 74px 52px 48px 1fr',alignItems:'center'}}>
              <span className="font-mono" style={{fontSize:9,color:'#c8fb4e'}}>{r.asset}</span>
              <span className="font-mono" style={{fontSize:9,color:r.bull?'#00d084':'#ff1a6b',fontWeight:600}}>{r.netSpec>0?'+':''}{(r.netSpec/1000).toFixed(1)}K</span>
              <span className="font-mono" style={{fontSize:8,color:r.chg>0?'#00d08499':'#ff1a6b99'}}>{r.chg>0?'+':''}{(r.chg/1000).toFixed(1)}K</span>
              <div style={{display:'flex',alignItems:'center',gap:3}}>
                <span className="font-mono" style={{fontSize:9,color:r.pctile>80?'#ff1a6b':r.pctile<20?'#ff1a6b':'rgba(255,255,255,0.6)',fontWeight:r.extreme?700:400}}>{r.pctile}%</span>
                {r.extreme&&<span className="hud-label" style={{fontSize:6.5,color:'#ffb300'}}>EXT</span>}
              </div>
              <div style={{height:5,background:'rgba(255,255,255,0.07)',position:'relative'}}>
                <div style={{position:'absolute',top:0,left:`${50-(r.pctile/2)}%`,height:'100%',width:`${r.pctile/2}%`,background:r.bull?'#00d08488':'#ff1a6b88'}} />
                <div style={{position:'absolute',top:0,left:'50%',width:1,height:'100%',background:'rgba(255,255,255,0.3)'}} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 11 — LIQUIDITY MAP
   ══════════════════════════════════════════════════════════════════ */
function WLiquidityMap({symbol='BTCUSD'}:{symbol?:string}={}) {
  const ref=useRef<HTMLCanvasElement>(null);
  const { levels, spot, status } = useZeusLiquidityMap(symbol);
  useEffect(()=>{
    const cv=ref.current; if(!cv || levels.length === 0)return;
    const ctx=cv.getContext('2d')!;
    const W=cv.width,H=cv.height,PAD=8;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#04090f'; ctx.fillRect(0,0,W,H);
    const maxL=Math.max(...levels.map(l=>l.liq));
    const bw=(H-PAD*2)/levels.length;
    const maxBar=W*0.55;
    levels.forEach((l,i)=>{
      const y=PAD+i*bw, barW=(l.liq/maxL)*maxBar;
      ctx.fillStyle=(l.bull?'#00d084':'#ff1a6b')+(l.liq>600?'cc':'44');
      ctx.fillRect(1,y+1,barW,bw-2);
      if(l.isEH||l.isEL){
        ctx.strokeStyle='#ffb300'; ctx.lineWidth=1; ctx.setLineDash([2,2]);
        ctx.beginPath(); ctx.moveTo(1,y+bw/2); ctx.lineTo(maxBar+30,y+bw/2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='#ffb300'; ctx.font='7px monospace';
        ctx.fillText(l.isEH?'EQH':'EQL',maxBar+2,y+bw*0.75);
      }
      if(Math.abs(l.p-spot)<600){
        ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(0,y+bw/2); ctx.lineTo(W,y+bw/2); ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='bold 7.5px monospace'; ctx.fillText('SPOT',W-32,y+bw*0.75);
      }
      ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='7px monospace';
      ctx.fillText('$'+(l.p/1000).toFixed(0)+'K',maxBar+32,y+bw*0.75);
      ctx.fillStyle=(l.liq>400?'#ffb300':'rgba(255,255,255,0.25)'); ctx.font='7px monospace';
      ctx.fillText(l.liq.toFixed(0)+'M',maxBar+58,y+bw*0.75);
    });
  });
  const topLiq=levels.filter(l=>l.liq>500).length;
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#04090f',border:'1px solid #00e5ff28'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #00e5ff14',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#00e5ff',letterSpacing:'0.22em'}}>LIQUIDITY MAP · BINANCE LIVE</span>
        <div style={{display:'flex',gap:10}}>
          <span className="font-mono" style={{fontSize:8,color:'#ffb300'}}>{topLiq} HIGH-LIQ ZONES</span>
          <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.4)'}}>EQH/EQL = equal highs/lows</span>
          <span className="font-mono" style={{fontSize:7,color:statusColor(status)}}>{statusLabel(status)}</span>
        </div>
      </div>
      {status==='loading'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><span className="font-mono" style={{fontSize:9,color:'#00e5ff'}}>FETCHING ORDER BOOK...</span></div>}
      {status!=='loading'&&<canvas ref={ref} width={480} height={200} style={{width:'100%',flex:1,display:'block'}} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 12 — SECTOR ROTATION
   ══════════════════════════════════════════════════════════════════ */
function WSectorRotation() {
  const [sectors]=useState(()=>[
    {n:'Technology',    sym:'XLK',rs:+2.81,mom:+1.44,q:'LEADING',   w1:+3.2,m1:+8.1,m3:+14.2},
    {n:'Healthcare',    sym:'XLV',rs:+0.54,mom:+0.22,q:'IMPROVING', w1:+0.8,m1:+2.1,m3:+4.5},
    {n:'Financials',    sym:'XLF',rs:+1.24,mom:+0.88,q:'LEADING',   w1:+1.4,m1:+3.8,m3:+9.2},
    {n:'Energy',        sym:'XLE',rs:-0.32,mom:+0.11,q:'IMPROVING', w1:-0.4,m1:-1.2,m3:+2.1},
    {n:'Utilities',     sym:'XLU',rs:-1.84,mom:-0.92,q:'LAGGING',   w1:-2.1,m1:-4.2,m3:-8.8},
    {n:'Real Estate',   sym:'XLRE',rs:-1.12,mom:-0.44,q:'LAGGING',  w1:-1.5,m1:-3.1,m3:-5.4},
    {n:'Consumer Disc', sym:'XLY',rs:+0.88,mom:+0.62,q:'LEADING',   w1:+1.1,m1:+2.9,m3:+6.8},
    {n:'Materials',     sym:'XLB',rs:-0.21,mom:+0.08,q:'IMPROVING', w1:-0.3,m1:-0.8,m3:+1.2},
    {n:'Industrials',   sym:'XLI',rs:+0.44,mom:+0.18,q:'LEADING',   w1:+0.6,m1:+1.4,m3:+3.8},
    {n:'Comm Services', sym:'XLC',rs:+1.62,mom:+0.94,q:'LEADING',   w1:+2.0,m1:+5.2,m3:+11.4},
    {n:'Cons Staples',  sym:'XLP',rs:-0.88,mom:-0.32,q:'WEAKENING', w1:-1.1,m1:-2.4,m3:-4.2},
  ]);
  const qColor=(q:string)=>q==='LEADING'?'#00d084':q==='IMPROVING'?'#00e5ff':q==='WEAKENING'?'#ffb300':'#ff1a6b';
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#05080c',border:'1px solid #00d08430'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #00d08418',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#00d084',letterSpacing:'0.22em'}}>SECTOR ROTATION · RS vs SPX</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>JdK RS-Momentum · GICS sectors</span>
          <span className="font-mono" style={{fontSize:7.5,color:'#ffb300'}}>◎ SIM</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'82px 36px 34px 34px 36px 36px 36px 1fr',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['SECTOR','ETF','RS','MOM','1W','1M','3M','QUADRANT'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.08em'}}>{h}</span>)}
      </div>
      <div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
        {sectors.map((s,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'82px 36px 34px 34px 36px 36px 36px 1fr',padding:'2.5px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)',alignItems:'center'}}>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.7)'}}>{s.n}</span>
            <span className="font-mono" style={{fontSize:8,color:'#00e5ff'}}>{s.sym}</span>
            <span className="font-mono" style={{fontSize:9,color:s.rs>0?'#00d084':'#ff1a6b',fontWeight:600}}>{s.rs>0?'+':''}{s.rs.toFixed(2)}</span>
            <span className="font-mono" style={{fontSize:8,color:s.mom>0?'#00d08499':'#ff1a6b99'}}>{s.mom>0?'+':''}{s.mom.toFixed(2)}</span>
            <span className="font-mono" style={{fontSize:8,color:s.w1>0?'#00d08480':'#ff1a6b80'}}>{s.w1>0?'+':''}{s.w1.toFixed(1)}</span>
            <span className="font-mono" style={{fontSize:8,color:s.m1>0?'#00d08080':'#ff1a6b80'}}>{s.m1>0?'+':''}{s.m1.toFixed(1)}</span>
            <span className="font-mono" style={{fontSize:8,color:s.m3>0?'#00d08080':'#ff1a6b80'}}>{s.m3>0?'+':''}{s.m3.toFixed(1)}</span>
            <span className="hud-label" style={{fontSize:7,color:qColor(s.q),letterSpacing:'0.08em'}}>{s.q}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 13 — PORTFOLIO RISK DASHBOARD
   ══════════════════════════════════════════════════════════════════ */
function WRiskDashboard() {
  const metrics=[
    {l:'VaR 95% (1D)',    v:'−$2,841', n:'2.84% NAV', warn:false},
    {l:'VaR 99% (1D)',    v:'−$4,188', n:'4.19% NAV', warn:true},
    {l:'Expected Shortfall',v:'−$5,240',n:'CVaR 99%',  warn:true},
    {l:'Sharpe Ratio',    v:'1.84',    n:'trailing 1Y', warn:false},
    {l:'Sortino Ratio',   v:'2.41',    n:'downside σ',  warn:false},
    {l:'Calmar Ratio',    v:'3.12',    n:'ret / maxDD',  warn:false},
    {l:'Max Drawdown',    v:'−12.4%',  n:'peak → trough',warn:true},
    {l:'Beta (vs SPX)',   v:'0.68',    n:'rolling 60d', warn:false},
    {l:'Information Ratio',v:'0.92',   n:'vs benchmark', warn:false},
    {l:'Win Rate',        v:'58.3%',   n:'267 trades',   warn:false},
    {l:'Profit Factor',   v:'1.74',    n:'gross P/L',    warn:false},
    {l:'Avg Win / Loss',  v:'2.14x',   n:'R-multiple',   warn:false},
  ];
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#0a0308',border:'1px solid #ff1a6b28'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #ff1a6b18',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#ff1a6b',letterSpacing:'0.22em'}}>PORTFOLIO RISK DASHBOARD</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>NAV: $100,000 · Simulated metrics</span>
          <span className="font-mono" style={{fontSize:7.5,color:'#ffb300'}}>◎ SIM</span>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'4px 7px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'3px 8px'}} className="nx-scroll">
        {metrics.map((m,i)=>(
          <div key={i} style={{padding:'4px 6px',background:'rgba(255,255,255,0.03)',border:`1px solid ${m.warn?'rgba(255,26,107,0.3)':'rgba(255,255,255,0.06)'}`,position:'relative'}}>
            {m.warn&&<div style={{position:'absolute',top:2,right:4,width:4,height:4,borderRadius:'50%',background:'#ff1a6b'}} />}
            <div className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.35)',letterSpacing:'0.1em'}}>{m.l}</div>
            <div className="font-display" style={{fontSize:13,color:m.warn?'#ff1a6b':'#fff',letterSpacing:'-0.02em',marginTop:1}}>{m.v}</div>
            <div className="font-mono" style={{fontSize:7,color:'rgba(255,255,255,0.3)'}}>{m.n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 14 — CREDIT SPREAD MONITOR
   ══════════════════════════════════════════════════════════════════ */
function WCreditSpreads() {
  const [rows]=useState(()=>[
    {l:'US HY OAS (ICE)',     v:362,  chg:+8,   prev:354, base:280, unit:'bps', warn:true},
    {l:'US IG OAS (ICE)',     v:98,   chg:+3,   prev:95,  base:80,  unit:'bps', warn:false},
    {l:'EUR HY OAS',          v:418,  chg:+14,  prev:404, base:310, unit:'bps', warn:true},
    {l:'CDX NA IG (5Y)',      v:68,   chg:+2,   prev:66,  base:50,  unit:'bps', warn:false},
    {l:'CDX NA HY (5Y)',      v:388,  chg:+11,  prev:377, base:290, unit:'bps', warn:true},
    {l:'US 2Y Swap Spread',   v:24.8, chg:-0.4, prev:25.2,base:15,  unit:'bps', warn:false},
    {l:'TED Spread',          v:18.4, chg:+0.9, prev:17.5,base:10,  unit:'bps', warn:false},
    {l:'LIBOR-OIS Spread',    v:11.2, chg:+0.1, prev:11.1,base:8,   unit:'bps', warn:false},
    {l:'EM Sovereign (EMBI)', v:491,  chg:+22,  prev:469, base:380, unit:'bps', warn:true},
    {l:'SOFR Basis (vs FF)',  v:5.2,  chg:-0.2, prev:5.4, base:4,   unit:'bps', warn:false},
  ]);
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#080a04',border:'1px solid #ffb30030'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #ffb30018',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#ffb300',letterSpacing:'0.22em'}}>CREDIT SPREAD MONITOR</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>HY/IG · CDS · Swap · TED spreads</span>
          <span className="font-mono" style={{fontSize:7.5,color:'#ffb300'}}>◎ SIM</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 50px 44px 1fr',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['INSTRUMENT','SPREAD','CHG','BAR vs MEAN'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.08em'}}>{h}</span>)}
      </div>
      <div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
        {rows.map((r,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 50px 44px 1fr',padding:'3px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)',alignItems:'center',background:r.warn?'rgba(255,26,107,0.04)':'transparent'}}>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.6)'}}>{r.l}</span>
            <span className="font-mono" style={{fontSize:10,color:r.warn?'#ff1a6b':'#ffb300',fontWeight:600}}>{r.v}</span>
            <span className="font-mono" style={{fontSize:9,color:r.chg>0?'#ff1a6b':'#00d084'}}>{r.chg>0?'+':''}{r.chg.toFixed(1)}</span>
            <div style={{height:5,background:'rgba(255,255,255,0.06)',position:'relative'}}>
              <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${Math.min(100,(r.v/r.base/2)*100)}%`,background:r.warn?'#ff1a6b55':'#ffb30055'}} />
              <div style={{position:'absolute',left:'50%',top:0,width:1,height:'100%',background:'rgba(255,255,255,0.2)'}} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 15 — INSTITUTIONAL FLOW
   ══════════════════════════════════════════════════════════════════ */
function WInstFlow() {
  const [rows]=useState(()=>[
    {asset:'US Equities',   flow:+4820,units:'$M',  d7:+12400,bias:'+'},
    {asset:'US Bonds',      flow:-1240,units:'$M',  d7:-8200, bias:'-'},
    {asset:'Gold / Silver', flow:+680, units:'$M',  d7:+2800, bias:'+'},
    {asset:'BTC / ETH',     flow:+290, units:'$M',  d7:+1200, bias:'+'},
    {asset:'EM Equities',   flow:-380, units:'$M',  d7:-2100, bias:'-'},
    {asset:'DM ex-US Eq',  flow:+240, units:'$M',  d7:+980,  bias:'+'},
    {asset:'Crude / Energy',flow:-120, units:'$M',  d7:-440,  bias:'-'},
    {asset:'Currencies',    flow:+80,  units:'$M',  d7:+320,  bias:'+'},
  ]);
  const maxFlow=Math.max(...rows.map(r=>Math.abs(r.flow)));
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#040c08',border:'1px solid #00d08428'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #00d08418',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#00d084',letterSpacing:'0.22em'}}>INSTITUTIONAL FLOW · SMART MONEY</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>ETF + prime broker + 13F composite</span>
          <span className="font-mono" style={{fontSize:7.5,color:'#ffb300'}}>◎ SIM</span>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'4px 0'}} className="nx-scroll">
        {rows.map((r,i)=>(
          <div key={i} style={{padding:'3px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
              <span className="font-mono" style={{fontSize:9,color:'rgba(255,255,255,0.7)'}}>{r.asset}</span>
              <div style={{display:'flex',gap:8}}>
                <span className="font-mono" style={{fontSize:9,color:r.flow>0?'#00d084':'#ff1a6b',fontWeight:600}}>{r.flow>0?'+':''}{r.flow.toFixed(0)}M</span>
                <span className="font-mono" style={{fontSize:8,color:r.d7>0?'#00d08466':'#ff1a6b66'}}>{r.d7>0?'+':''}{(r.d7/1000).toFixed(1)}B 7d</span>
              </div>
            </div>
            <div style={{height:6,background:'rgba(255,255,255,0.05)',display:'flex',overflow:'hidden'}}>
              {r.flow>0
                ? <><div style={{width:'50%'}} /><div style={{width:`${(r.flow/maxFlow)*50}%`,background:'#00d08477'}} /></>
                : <><div style={{width:`${50-(Math.abs(r.flow)/maxFlow)*50}%`}} /><div style={{width:`${(Math.abs(r.flow)/maxFlow)*50}%`,background:'#ff1a6b77'}} /><div style={{width:'50%'}} /></>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 16 — VOL SURFACE (IV TERM STRUCTURE)
   ══════════════════════════════════════════════════════════════════ */
function WVolSurface() {
  const ref=useRef<HTMLCanvasElement>(null);
  const { volSurface: surf, volExpiries: expiries, atmIv30d, rrSkew30d: rrSkew, status } = useDeribitOptionsData('BTC');
  const strikes=[0.85,0.90,0.95,1.0,1.05,1.10,1.15]; // axis labels only
  useEffect(()=>{
    const cv=ref.current; if(!cv || surf.length === 0 || !surf[0]) return;
    const ctx=cv.getContext('2d')!;
    const W=cv.width,H=cv.height,PL=28,PT=14,PR=8,PB=22;
    const pW=W-PL-PR,pH=H-PT-PB;
    const cellW=pW/expiries.length, cellH=pH/strikes.length;
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#06030f'; ctx.fillRect(0,0,W,H);
    const allV=surf.flat();
    const lo=Math.min(...allV),hi=Math.max(...allV);
    for(let i=0;i<expiries.length;i++){
      for(let j=0;j<strikes.length;j++){
        const v=surf[i][j],t=(v-lo)/(hi-lo);
        const r=Math.round(255*t), g=Math.round(80+100*t), b=Math.round(255*(1-t));
        ctx.fillStyle=`rgba(${r},${g},${b},0.85)`;
        ctx.fillRect(PL+i*cellW+1,PT+j*cellH+1,cellW-2,cellH-2);
        ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='7px monospace';
        ctx.fillText(v.toFixed(0)+'%',PL+i*cellW+3,PT+j*cellH+cellH*0.7);
      }
      ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='7px monospace';
      ctx.fillText(expiries[i],PL+i*cellW+2,H-4);
    }
    strikes.forEach((s,j)=>{
      ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font='7px monospace';
      ctx.fillText((s*100).toFixed(0)+'%',1,PT+j*cellH+cellH*0.7);
    });
    // term at ATM
    ctx.beginPath(); ctx.strokeStyle='#ffb300'; ctx.lineWidth=1.5;
    for(let i=0;i<expiries.length;i++){
      const y=PT+3*cellH+cellH/2, x=PL+i*cellW+cellW/2;
      if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
    } ctx.stroke();
  });
  const atmTerm=surf.length>0?surf.map(e=>e[3]):[30,30,30,30,30,30,30];
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#06030f',border:'1px solid #e879f930'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #e879f918',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#e879f9',letterSpacing:'0.22em'}}>IV SURFACE · DERIBIT LIVE</span>
        <div style={{display:'flex',gap:10}}>
          <span className="font-mono" style={{fontSize:8,color:'#e879f9'}}>ATM 30d: {atmIv30d.toFixed(1)}%</span>
          <span className="font-mono" style={{fontSize:8,color:rrSkew>0?'#ff1a6b':'#00d084'}}>25d RR: {rrSkew>0?'+':''}{rrSkew.toFixed(1)}%</span>
          <span className="font-mono" style={{fontSize:7,color:statusColor(status)}}>{statusLabel(status)}</span>
        </div>
      </div>
      {status==='loading'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}><span className="font-mono" style={{fontSize:9,color:'#e879f9'}}>FETCHING VOL SURFACE...</span></div>}
      {status!=='loading'&&<canvas ref={ref} width={480} height={170} style={{width:'100%',flex:1,display:'block'}} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 17 — MACRO POSITIONING (G10 + COMMODITIES)
   ══════════════════════════════════════════════════════════════════ */
function WMacroPositioning() {
  const [rows]=useState(()=>[
    {sym:'EUR/USD', pos:'+12.4K',  netUsd:'$1.24B',  beta:0.42, regime:'RISK-ON',  dir:'+'},
    {sym:'GBP/USD', pos:'+8.2K',   netUsd:'$0.82B',  beta:0.38, regime:'RISK-ON',  dir:'+'},
    {sym:'USD/JPY', pos:'-184K',   netUsd:'-$1.84B', beta:0.71, regime:'CARRY',    dir:'-'},
    {sym:'AUD/USD', pos:'+6.1K',   netUsd:'$0.61B',  beta:0.58, regime:'COMMODITY',dir:'+'},
    {sym:'USD/CAD', pos:'-9.8K',   netUsd:'-$0.98B', beta:0.44, regime:'COMMODITY',dir:'-'},
    {sym:'GOLD',    pos:'+186K',   netUsd:'$8.2B',   beta:0.22, regime:'SAFE',     dir:'+'},
    {sym:'CRUDE',   pos:'+64K',    netUsd:'$2.8B',   beta:0.51, regime:'REFLATION',dir:'+'},
    {sym:'SILVER',  pos:'+14K',    netUsd:'$0.6B',   beta:0.68, regime:'RISK-ON',  dir:'+'},
    {sym:'COPPER',  pos:'+28K',    netUsd:'$1.1B',   beta:0.62, regime:'REFLATION',dir:'+'},
    {sym:'NAT GAS', pos:'-18K',    netUsd:'-$0.4B',  beta:0.18, regime:'SEASONAL', dir:'-'},
  ]);
  const regCol=(r:string)=>r==='RISK-ON'?'#00d084':r==='CARRY'?'#e879f9':r==='SAFE'?'#00e5ff':r==='REFLATION'?'#ffb300':'rgba(255,255,255,0.4)';
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#050b06',border:'1px solid #c8fb4e28'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #c8fb4e14',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#c8fb4e',letterSpacing:'0.22em'}}>MACRO POSITIONING · G10 FX + COMMODITIES</span>
        <div style={{display:'flex',gap:8}}>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>CFTC + Prime broker composite beta</span>
          <span className="font-mono" style={{fontSize:7.5,color:'#ffb300'}}>◎ SIM</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'52px 52px 56px 30px 1fr',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['SYMBOL','NET POS','NET USD','β','REGIME'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.08em'}}>{h}</span>)}
      </div>
      <div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
        {rows.map((r,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'52px 52px 56px 30px 1fr',padding:'2.5px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)',alignItems:'center'}}>
            <span className="font-mono" style={{fontSize:9,color:'#c8fb4e'}}>{r.sym}</span>
            <span className="font-mono" style={{fontSize:8,color:r.dir==='+'?'#00d084':'#ff1a6b'}}>{r.pos}</span>
            <span className="font-mono" style={{fontSize:8,color:r.dir==='+'?'#00d08499':'#ff1a6b99'}}>{r.netUsd}</span>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.45)'}}>{r.beta.toFixed(2)}</span>
            <span className="hud-label" style={{fontSize:7,color:regCol(r.regime),letterSpacing:'0.08em'}}>{r.regime}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 18 — OPEN POSITIONS (MT5 LIVE)
   ══════════════════════════════════════════════════════════════════ */
interface PosMock { ticket:number; symbol:string; type:string; lots:number; openPrice:number; currentPrice:number; pnl:number; comment:string; }
function WPositions({connected,posRows}:{connected:boolean;posRows:PosRow[]}) {
  const mock: PosMock[]=[
    {ticket:102441,symbol:'EURUSD',type:'BUY', lots:0.50,openPrice:1.0871,currentPrice:1.0893,pnl:+110.00,comment:'Zeus-L'},
    {ticket:102442,symbol:'GBPUSD',type:'SELL',lots:0.30,openPrice:1.2742,currentPrice:1.2718,pnl:+72.00, comment:'Zeus-S'},
    {ticket:102443,symbol:'BTCUSD',type:'BUY', lots:0.01,openPrice:77800, currentPrice:78120,pnl:+32.00, comment:'Manual'},
    {ticket:102444,symbol:'XAUUSD',type:'SELL',lots:0.10,openPrice:2341,  currentPrice:2338, pnl:+30.00, comment:'Zeus-S'},
    {ticket:102445,symbol:'USDJPY',type:'BUY', lots:0.40,openPrice:151.42,currentPrice:151.28,pnl:-56.00,comment:'Manual'},
  ];
  const adapted: PosMock[] = posRows.map((p,i)=>({ ticket:100000+i, symbol:p.sym, type:p.side==='LONG'?'BUY':'SELL', lots:parseFloat(p.size)||0.1, openPrice:parseFloat(p.entry)||1, currentPrice:parseFloat(p.mark)||1, pnl:parseFloat(p.pnl)||0, comment:p.bot }));
  const rows: PosMock[]=connected&&adapted.length>0?adapted:mock;
  const totalPnl=rows.reduce((s,p)=>s+p.pnl,0);
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#040e07',border:'1px solid #00d08430'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #00d08418',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#00d084',letterSpacing:'0.22em'}}>OPEN POSITIONS {connected?'· LIVE MT5':'· SIM DATA'}</span>
        <div style={{display:'flex',gap:10}}>
          <span className="font-mono" style={{fontSize:9,color:totalPnl>=0?'#00d084':'#ff1a6b',fontWeight:700}}>TOTAL P&amp;L {totalPnl>=0?'+':''}{totalPnl.toFixed(2)}</span>
          <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.4)'}}>{rows.length} POSITIONS</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'48px 56px 30px 32px 60px 60px 52px 1fr',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['TICKET','SYMBOL','DIR','LOTS','OPEN','CURRENT','P&L','TAG'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.08em'}}>{h}</span>)}
      </div>
      <div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
        {rows.map((p,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'48px 56px 30px 32px 60px 60px 52px 1fr',padding:'2.5px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)',alignItems:'center',background:p.pnl>0?'rgba(0,208,132,0.04)':'rgba(255,26,107,0.04)'}}>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>{p.ticket}</span>
            <span className="font-mono" style={{fontSize:9,color:'#00e5ff',fontWeight:600}}>{p.symbol}</span>
            <span className="hud-label" style={{fontSize:8,color:p.type==='BUY'?'#00d084':'#ff1a6b',letterSpacing:'0.08em'}}>{p.type}</span>
            <span className="font-mono" style={{fontSize:9,color:'rgba(255,255,255,0.55)'}}>{p.lots.toFixed(2)}</span>
            <span className="font-mono" style={{fontSize:9,color:'rgba(255,255,255,0.45)'}}>{p.openPrice.toFixed(p.symbol.includes('USD')?2:5)}</span>
            <span className="font-mono" style={{fontSize:9,color:'rgba(255,255,255,0.7)'}}>{p.currentPrice.toFixed(p.symbol.includes('USD')?2:5)}</span>
            <span className="font-mono" style={{fontSize:10,color:p.pnl>=0?'#00d084':'#ff1a6b',fontWeight:700}}>{p.pnl>=0?'+':''}{p.pnl.toFixed(2)}</span>
            <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.3)'}}>{p.comment}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 19 — EQUITY CURVE + METRICS
   ══════════════════════════════════════════════════════════════════ */
function WEquityCurve({balance,equityArr}:{balance:number;equityArr:number[]}) {
  const ref=useRef<HTMLCanvasElement>(null);
  // Use real MT5 equity history when available; otherwise show single-point flat line
  const equity = equityArr.length > 1
    ? equityArr.map((v,i) => ({ d: `T-${equityArr.length-1-i}`, v }))
    : [{ d: 'NOW', v: balance > 1000 ? balance : 100000 }];
  useEffect(()=>{
    const cv=ref.current; if(!cv)return;
    const ctx=cv.getContext('2d')!;
    const W=cv.width,H=cv.height,PAD=8,LH=18;
    const vals=equity.map(e=>e.v);
    const lo=Math.min(...vals)*0.99, hi=Math.max(...vals)*1.01, rng=hi-lo;
    const toX=(i:number)=>PAD+(i/(equity.length-1))*(W-PAD*2);
    const toY=(v:number)=>PAD+(1-(v-lo)/rng)*(H-PAD*2-LH);
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#040c06'; ctx.fillRect(0,0,W,H);
    let peak=equity[0].v,maxDD=0;
    equity.forEach(e=>{ if(e.v>peak)peak=e.v; const dd=(peak-e.v)/peak; if(dd>maxDD)maxDD=dd; });
    // drawdown fill
    let pk2=equity[0].v;
    ctx.beginPath(); ctx.moveTo(toX(0),toY(equity[0].v));
    for(let i=1;i<equity.length;i++){ if(equity[i].v>pk2)pk2=equity[i].v; ctx.lineTo(toX(i),toY(equity[i].v)); }
    ctx.lineTo(toX(equity.length-1),H-LH); ctx.lineTo(toX(0),H-LH); ctx.closePath();
    ctx.fillStyle='rgba(0,208,132,0.08)'; ctx.fill();
    pk2=equity[0].v;
    for(let i=1;i<equity.length;i++){
      if(equity[i].v<pk2){
        const j=equity.findIndex((e,k)=>k>i&&e.v>=pk2)||equity.length-1;
        ctx.beginPath(); ctx.moveTo(toX(i-1),toY(equity[i-1].v));
        for(let k=i;k<=j&&k<equity.length;k++) ctx.lineTo(toX(k),toY(equity[k].v));
        ctx.lineTo(toX(Math.min(j,equity.length-1)),toY(pk2));
        ctx.closePath(); ctx.fillStyle='rgba(255,26,107,0.18)'; ctx.fill();
      } else pk2=equity[i].v;
    }
    // equity line
    const grad=ctx.createLinearGradient(0,0,W,0);
    grad.addColorStop(0,'#00d084'); grad.addColorStop(1,'#00e5ff');
    ctx.beginPath(); ctx.strokeStyle=grad; ctx.lineWidth=2;
    equity.forEach((e,i)=>{ if(i===0)ctx.moveTo(toX(i),toY(e.v)); else ctx.lineTo(toX(i),toY(e.v)); }); ctx.stroke();
    equity.forEach((e,i)=>{
      ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='6.5px monospace';
      ctx.fillText(e.d,toX(i)-8,H-4);
    });
  });
  const start=equity[0].v, end=balance>1000?balance:equity[equity.length-1].v;
  const ret=((end-start)/start*100).toFixed(1);
  const dd=Math.max(...equity.map((_,i)=>{ const p=Math.max(...equity.slice(0,i+1).map(e=>e.v)); return (p-equity[i].v)/p*100; })).toFixed(1);
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#040c06',border:'1px solid #00d08430'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid #00d08418',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'#00d084',letterSpacing:'0.22em'}}>EQUITY CURVE · ACCOUNT PERFORMANCE</span>
        <div style={{display:'flex',gap:10}}>
          <span className="font-mono" style={{fontSize:9,color:'#00d084',fontWeight:700}}>{+ret>0?'+':''}{ret}% total</span>
          <span className="font-mono" style={{fontSize:8,color:'#ff1a6b'}}>−{dd}% maxDD</span>
          <span className="font-mono" style={{fontSize:8,color:'#00e5ff'}}>Sharpe 1.84</span>
          <span className="font-mono" style={{fontSize:8,color:'#ffb300'}}>${end.toLocaleString()}</span>
        </div>
      </div>
      <canvas ref={ref} width={480} height={160} style={{width:'100%',flex:1,display:'block'}} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 20 — EXECUTION LOG + SLIPPAGE
   ══════════════════════════════════════════════════════════════════ */
function WExecutionLog() {
  const [rows]=useState(()=>[
    {t:'14:28:03',sym:'EURUSD',dir:'BUY', lots:0.50,req:1.08710,fill:1.08712,slip:+0.2,algo:'Zeus-L', imp:'LOW', lat:14},
    {t:'14:25:11',sym:'GBPUSD',dir:'SELL',lots:0.30,req:1.27420,fill:1.27418,slip:-0.2,algo:'Zeus-S', imp:'LOW', lat:18},
    {t:'14:22:44',sym:'XAUUSD',dir:'SELL',lots:0.10,req:2341.00,fill:2340.85,slip:-1.5,algo:'Manual', imp:'MED', lat:52},
    {t:'14:19:30',sym:'USDJPY',dir:'BUY', lots:0.40,req:151.420,fill:151.425,slip:+0.5,algo:'Zeus-L', imp:'LOW', lat:11},
    {t:'14:15:02',sym:'BTCUSD',dir:'BUY', lots:0.01,req:77800, fill:77804,  slip:+4.0,algo:'Manual', imp:'HIGH',lat:88},
    {t:'14:11:19',sym:'EURUSD',dir:'SELL',lots:1.00,req:1.08650,fill:1.08644,slip:-0.6,algo:'Zeus-S', imp:'MED', lat:22},
    {t:'14:08:55',sym:'GBPUSD',dir:'BUY', lots:0.50,req:1.27190,fill:1.27192,slip:+0.2,algo:'Zeus-L', imp:'LOW', lat:16},
    {t:'14:05:33',sym:'XAUUSD',dir:'BUY', lots:0.20,req:2338.50,fill:2338.65,slip:+1.5,algo:'Manual', imp:'MED', lat:44},
    {t:'14:02:10',sym:'USDJPY',dir:'SELL',lots:0.30,req:151.680,fill:151.675,slip:-0.5,algo:'Zeus-S', imp:'LOW', lat:19},
  ]);
  const impCol=(imp:string)=>imp==='HIGH'?'#ff1a6b':imp==='MED'?'#ffb300':'#00d08499';
  const avgSlip=(rows.reduce((s,r)=>s+Math.abs(r.slip),0)/rows.length).toFixed(1);
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#030e10',border:'1px solid rgba(0,229,255,0.18)'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'3px 7px',borderBottom:'1px solid rgba(0,229,255,0.1)',flexShrink:0}}>
        <span className="hud-label" style={{fontSize:8,color:'var(--cyan-dim)',letterSpacing:'0.22em'}}>EXECUTION LOG · SLIPPAGE + IMPACT</span>
        <div style={{display:'flex',gap:10}}>
          <span className="font-mono" style={{fontSize:8,color:'#ffb300'}}>AVG SLIP {avgSlip} pips</span>
          <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.35)'}}>LATENCY in ms</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'46px 52px 28px 28px 58px 58px 36px 44px 26px 26px',padding:'2px 7px',borderBottom:'1px solid rgba(255,255,255,0.04)',flexShrink:0}}>
        {['TIME','SYM','DIR','LOTS','REQ','FILL','SLIP','ALGO','IMP','LAT'].map(h=><span key={h} className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.08em'}}>{h}</span>)}
      </div>
      <div style={{flex:1,overflowY:'auto'}} className="nx-scroll">
        {rows.map((r,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'46px 52px 28px 28px 58px 58px 36px 44px 26px 26px',padding:'2.5px 7px',borderBottom:'1px dashed rgba(255,255,255,0.04)',alignItems:'center',background:i===0?'rgba(0,229,255,0.04)':'transparent'}}>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>{r.t}</span>
            <span className="font-mono" style={{fontSize:9,color:'#00e5ff'}}>{r.sym}</span>
            <span className="hud-label" style={{fontSize:8,color:r.dir==='BUY'?'#00d084':'#ff1a6b',letterSpacing:'0.06em'}}>{r.dir}</span>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.5)'}}>{r.lots}</span>
            <span className="font-mono" style={{fontSize:8,color:'rgba(255,255,255,0.4)'}}>{r.req}</span>
            <span className="font-mono" style={{fontSize:8.5,color:'rgba(255,255,255,0.75)'}}>{r.fill}</span>
            <span className="font-mono" style={{fontSize:9,color:Math.abs(r.slip)>2?'#ff1a6b':'rgba(255,255,255,0.45)'}}>{r.slip>0?'+':''}{r.slip.toFixed(1)}</span>
            <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)'}}>{r.algo}</span>
            <span className="hud-label" style={{fontSize:7,color:impCol(r.imp),letterSpacing:'0.06em'}}>{r.imp}</span>
            <span className="font-mono" style={{fontSize:8,color:r.lat>50?'#ffb300':'rgba(255,255,255,0.3)'}}>{r.lat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 21 — ORDER TICKET (live MT5 order placement)
   ══════════════════════════════════════════════════════════════════ */
function WOrderTicket({ connected, livePrice=0, activeSymbol='BTCUSD' }: { connected: boolean; livePrice?: number; activeSymbol?: string }) {
  const [side, setSide] = useState<'BUY'|'SELL'>('BUY');
  const [lots, setLots] = useState('0.01');
  const [slPips, setSlPips] = useState('50');
  const [tpPips, setTpPips] = useState('100');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const lotsNum = parseFloat(lots) || 0.01;
  const slNum = parseInt(slPips) || 50;
  const tpNum = parseInt(tpPips) || 100;
  const pipVal = activeSymbol.includes('JPY') ? 0.01 : activeSymbol.includes('XAU') ? 0.1 : activeSymbol.startsWith('BTC') ? 1 : 0.0001;
  const sl = side === 'BUY' ? livePrice - slNum * pipVal : livePrice + slNum * pipVal;
  const tp = side === 'BUY' ? livePrice + tpNum * pipVal : livePrice - tpNum * pipVal;
  const rr = slNum > 0 ? (tpNum / slNum).toFixed(1) : '—';

  async function placeOrder() {
    if (!connected) { setErr('MT5 bridge offline — connect first'); return; }
    setBusy(true); setMsg(''); setErr('');
    try {
      const cfg = await window.jarvisBridge.config?.getMt5?.().catch(() => ({ host: 'localhost', port: 1234 }));
      const { host, port } = cfg ?? { host: 'localhost', port: 1234 };
      const body = { symbol: activeSymbol, side, volume: lotsNum, sl: +sl.toFixed(5), tp: +tp.toFixed(5) };
      const r = await window.jarvisBridge.mt5({ host, port, endpoint: 'order', method: 'POST', body });
      if (r.ok) {
        setMsg(`✓ ORDER SENT — ${side} ${lotsNum} ${activeSymbol} @ market`);
      } else {
        setErr(r.err || `Error: ${r.status}`);
      }
    } catch (e: any) { setErr(String(e?.message || e)); }
    setBusy(false);
  }

  const borderColor = side === 'BUY' ? '#00d084' : '#ff1a6b';
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#030e10', border:`1px solid ${borderColor}33` }}>
      <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', borderBottom:`1px solid ${borderColor}22`, flexShrink:0 }}>
        <span className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)', letterSpacing:'0.22em' }}>ORDER TICKET · {activeSymbol}</span>
        {connected ? <span className="hud-label" style={{ fontSize:7, color:'#00d084' }}>● LIVE</span> : <span className="hud-label" style={{ fontSize:7, color:'#ff1a6b' }}>● OFFLINE</span>}
      </div>
      <div style={{ flex:1, padding:'8px 10px', display:'flex', flexDirection:'column', gap:8 }}>
        {/* Side */}
        <div style={{ display:'flex', gap:6 }}>
          {(['BUY','SELL'] as const).map(s => (
            <button key={s} onClick={() => setSide(s)} className="hud-label"
              style={{ flex:1, padding:'7px 0', fontSize:10, cursor:'pointer', letterSpacing:'0.22em',
                border:`1px solid ${s==='BUY'?'#00d084':'#ff1a6b'}${side===s?'':'44'}`,
                background: side===s ? (s==='BUY'?'rgba(0,208,132,0.12)':'rgba(255,26,107,0.12)') : 'transparent',
                color: s==='BUY' ? '#00d084' : '#ff1a6b' }}>
              {s}
            </button>
          ))}
        </div>
        {/* Price display */}
        <div style={{ textAlign:'center', padding:'4px 0' }}>
          <span className="font-mono" style={{ fontSize:18, color:'rgba(255,255,255,0.85)' }}>{livePrice > 0 ? livePrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:5}) : '—'}</span>
          <span className="hud-label" style={{ fontSize:8, color:'rgba(255,255,255,0.3)', marginLeft:6 }}>MARKET</span>
        </div>
        {/* Inputs */}
        {[
          { label:'LOTS', value: lots, set: setLots, step:'0.01', min:'0.01' },
          { label:'SL (pips)', value: slPips, set: setSlPips, step:'1', min:'1' },
          { label:'TP (pips)', value: tpPips, set: setTpPips, step:'1', min:'1' },
        ].map(row => (
          <div key={row.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.35)', letterSpacing:'0.14em', width:54, flexShrink:0 }}>{row.label}</span>
            <input type="number" value={row.value} onChange={e => row.set(e.target.value)} step={row.step} min={row.min}
              style={{ flex:1, padding:'3px 7px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.75)', fontFamily:'JetBrains Mono', fontSize:11, outline:'none' }} />
          </div>
        ))}
        {/* R:R display */}
        <div style={{ display:'flex', gap:16, padding:'4px 0' }}>
          <div><span className="hud-label" style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>SL </span><span className="font-mono" style={{ fontSize:9, color:'#ff1a6b' }}>{sl.toFixed(5)}</span></div>
          <div><span className="hud-label" style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>TP </span><span className="font-mono" style={{ fontSize:9, color:'#00d084' }}>{tp.toFixed(5)}</span></div>
          <div style={{ marginLeft:'auto' }}><span className="hud-label" style={{ fontSize:7, color:'rgba(255,255,255,0.3)' }}>R:R </span><span className="font-mono" style={{ fontSize:9, color:'#ffb300' }}>1:{rr}</span></div>
        </div>
        {/* Submit */}
        <button onClick={placeOrder} disabled={busy || !connected} className="hud-label"
          style={{ padding:'9px 0', fontSize:9.5, letterSpacing:'0.26em', cursor:busy||!connected?'not-allowed':'pointer',
            border:`1px solid ${borderColor}`, background:`${borderColor}14`,
            color: borderColor, opacity:busy||!connected?0.5:1 }}>
          {busy ? '◌ PLACING…' : `▶ PLACE ${side}`}
        </button>
        {msg && <span className="font-mono" style={{ fontSize:9, color:'#00d084', textAlign:'center' }}>{msg}</span>}
        {err && <span className="font-mono" style={{ fontSize:9, color:'#ff1a6b', textAlign:'center' }}>{err}</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET CELL RENDERER
   ══════════════════════════════════════════════════════════════════ */
function WidgetCell({id,connected,livePrice,posRows,balance,equityArr,onRemove,activeSymbol='BTCUSD'}:{
  id:WidgetId;connected:boolean;livePrice:number;posRows:PosRow[];balance:number;equityArr:number[];onRemove?:(id:WidgetId)=>void;activeSymbol?:string;
}) {
  const def=WIDGET_REGISTRY.find(w=>w.id===id);
  return (
    <div style={{position:'relative',height:'100%',minHeight:220,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {onRemove&&<button onClick={()=>onRemove(id)} style={{position:'absolute',top:3,right:3,zIndex:10,background:'rgba(255,26,107,0.15)',border:'1px solid rgba(255,26,107,0.4)',color:'#ff1a6b',width:14,height:14,borderRadius:2,cursor:'pointer',fontSize:9,display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>×</button>}
      <div style={{flex:1,overflow:'hidden'}}>
        {id==='PRICE_CHART'     &&<WPriceChart connected={connected} livePrice={livePrice} symbol={activeSymbol}/>}
        {id==='ORDER_BOOK'      &&<WOrderBook symbol={activeSymbol}/>}
        {id==='CVD'             &&<WCVD symbol={activeSymbol}/>}
        {id==='GAMMA_EXPOSURE'  &&<WGammaExposure/>}
        {id==='OPTIONS_FLOW'    &&<WOptionsFlow/>}
        {id==='DARK_POOL'       &&<WDarkPool/>}
        {id==='FUNDING_RATES'   &&<WFundingRates/>}
        {id==='CORRELATION'     &&<WCorrelation/>}
        {id==='YIELD_CURVE'     &&<WYieldCurve/>}
        {id==='COT_POSITIONING' &&<WCotPositioning/>}
        {id==='LIQUIDITY_MAP'   &&<WLiquidityMap symbol={activeSymbol}/>}
        {id==='SECTOR_ROTATION' &&<WSectorRotation/>}
        {id==='RISK_DASHBOARD'  &&<WRiskDashboard/>}
        {id==='CREDIT_SPREADS'  &&<WCreditSpreads/>}
        {id==='INST_FLOW'       &&<WInstFlow/>}
        {id==='VOL_SURFACE'     &&<WVolSurface/>}
        {id==='MACRO_POSITIONING'&&<WMacroPositioning/>}
        {id==='POSITIONS'       &&<WPositions connected={connected} posRows={posRows}/>}
        {id==='EQUITY_CURVE'    &&<WEquityCurve balance={balance} equityArr={equityArr}/>}
        {id==='EXECUTION_LOG'   &&<WExecutionLog/>}
        {id==='ORDER_TICKET'    &&<WOrderTicket connected={connected} livePrice={livePrice} activeSymbol={activeSymbol}/>}
        {!def&&<div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><span className="font-mono" style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>UNKNOWN WIDGET: {id}</span></div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SETTINGS PANEL MODAL
   ══════════════════════════════════════════════════════════════════ */
function SettingsPanel({onClose}:{onClose:()=>void}) {
  const [theme,setTheme]=useState<'DARK'|'DARKER'|'MIDNIGHT'>('MIDNIGHT');
  const [density,setDensity]=useState<'COMPACT'|'NORMAL'|'WIDE'>('COMPACT');
  const [refresh,setRefresh]=useState<'250ms'|'500ms'|'1s'|'5s'>('500ms');
  const [alerts,setAlerts]=useState(true);
  const [sound,setSound]=useState(false);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:'#0a0e14',border:'1px solid rgba(255,255,255,0.12)',padding:24,minWidth:360,maxWidth:480}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <span className="hud-label" style={{fontSize:11,color:'rgba(255,255,255,0.8)',letterSpacing:'0.22em'}}>TERMINAL SETTINGS</span>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:16}}>×</button>
        </div>
        {[
          {l:'THEME',opts:(['DARK','DARKER','MIDNIGHT'] as const),cur:theme,set:(v:any)=>setTheme(v)},
          {l:'DENSITY',opts:(['COMPACT','NORMAL','WIDE'] as const),cur:density,set:(v:any)=>setDensity(v)},
          {l:'REFRESH',opts:(['250ms','500ms','1s','5s'] as const),cur:refresh,set:(v:any)=>setRefresh(v)},
        ].map(row=>(
          <div key={row.l} style={{marginBottom:14}}>
            <div className="hud-label" style={{fontSize:8,color:'rgba(255,255,255,0.4)',letterSpacing:'0.15em',marginBottom:6}}>{row.l}</div>
            <div style={{display:'flex',gap:6}}>
              {row.opts.map((o:any)=>(
                <button key={o} onClick={()=>row.set(o)} className="hud-label" style={{padding:'4px 10px',fontSize:8,border:`1px solid ${row.cur===o?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.12)'}`,background:row.cur===o?'rgba(255,255,255,0.08)':'transparent',color:row.cur===o?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.35)',cursor:'pointer',letterSpacing:'0.1em'}}>{o}</button>
              ))}
            </div>
          </div>
        ))}
        {[{l:'PRICE ALERTS',v:alerts,s:setAlerts},{l:'AUDIO ALERTS',v:sound,s:setSound}].map(tog=>(
          <div key={tog.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <span className="hud-label" style={{fontSize:8,color:'rgba(255,255,255,0.4)',letterSpacing:'0.15em'}}>{tog.l}</span>
            <button onClick={()=>tog.s(!tog.v)} style={{width:40,height:20,borderRadius:10,background:tog.v?'#00d08433':'rgba(255,255,255,0.08)',border:`1px solid ${tog.v?'#00d084':'rgba(255,255,255,0.12)'}`,cursor:'pointer',position:'relative',transition:'background 0.2s'}}>
              <div style={{position:'absolute',top:3,left:tog.v?22:3,width:12,height:12,borderRadius:'50%',background:tog.v?'#00d084':'rgba(255,255,255,0.3)',transition:'left 0.2s'}} />
            </button>
          </div>
        ))}
        <button onClick={onClose} style={{width:'100%',marginTop:8,padding:'8px 0',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.6)',cursor:'pointer'}} className="hud-label">APPLY &amp; CLOSE</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET LIBRARY PANEL
   ══════════════════════════════════════════════════════════════════ */
const CATEGORY_COLORS: Record<string,string>={PRICE:'#ff1a6b',FLOW:'#00d084',RISK:'#ff1a6b',MACRO:'#ffb300',QUANT:'#00e5ff'};

function WidgetLibraryPanel({activeIds,onAdd,onRemove,onClose}:{
  activeIds:WidgetId[];onAdd:(id:WidgetId)=>void;onRemove:(id:WidgetId)=>void;onClose:()=>void;
}) {
  const [cat,setCat]=useState<string>('ALL');
  const cats=['ALL','PRICE','FLOW','RISK','MACRO','QUANT'];
  const filtered=WIDGET_REGISTRY.filter(w=>cat==='ALL'||w.category===cat);
  return (
    <div style={{position:'fixed',top:0,right:0,bottom:0,width:340,background:'#08090f',borderLeft:'1px solid rgba(255,255,255,0.1)',zIndex:999,display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <span className="hud-label" style={{fontSize:10,color:'rgba(255,255,255,0.7)',letterSpacing:'0.22em'}}>WIDGET LIBRARY</span>
        <button onClick={onClose} style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:18}}>×</button>
      </div>
      <div style={{display:'flex',gap:4,padding:'8px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCat(c)} className="hud-label" style={{padding:'3px 7px',fontSize:7.5,border:`1px solid ${cat===c?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.1)'}`,background:cat===c?'rgba(255,255,255,0.07)':'transparent',color:cat===c?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.3)',cursor:'pointer',letterSpacing:'0.08em'}}>{c}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'8px 16px'}} className="nx-scroll">
        {filtered.map(w=>{
          const active=activeIds.includes(w.id);
          return (
            <div key={w.id} style={{padding:'10px 12px',marginBottom:6,background:'rgba(255,255,255,0.03)',border:`1px solid ${active?w.color+'55':'rgba(255,255,255,0.06)'}`,position:'relative'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div className="font-mono" style={{fontSize:9.5,color:w.color,fontWeight:600,marginBottom:3}}>{w.label}</div>
                  <div className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.35)',lineHeight:1.5}}>{w.desc}</div>
                </div>
                <button
                  onClick={()=>active?onRemove(w.id):onAdd(w.id)}
                  style={{padding:'4px 10px',fontSize:8,border:`1px solid ${active?'#ff1a6b55':w.color+'55'}`,background:active?'rgba(255,26,107,0.08)':'rgba(255,255,255,0.04)',color:active?'#ff1a6b':w.color,cursor:'pointer',marginLeft:8,flexShrink:0}}
                  className="hud-label"
                >{active?'REMOVE':'ADD'}</button>
              </div>
              <div style={{marginTop:6,display:'flex',gap:4}}>
                <span className="hud-label" style={{fontSize:6.5,padding:'1px 5px',border:`1px solid ${CATEGORY_COLORS[w.category]||'rgba(255,255,255,0.15)'}22`,color:CATEGORY_COLORS[w.category]||'rgba(255,255,255,0.4)',letterSpacing:'0.08em'}}>{w.category}</span>
                {active&&<span className="hud-label" style={{fontSize:6.5,padding:'1px 5px',border:'1px solid rgba(0,208,132,0.3)',color:'#00d084',letterSpacing:'0.08em'}}>ACTIVE</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TRADING SCREEN — MAIN EXPORT
   ══════════════════════════════════════════════════════════════════ */
// TICKERS now served by useBinanceTickers() hook inside TradingScreen

/* ══════════════════════════════════════════════════════════════════
   MY SETUP — Custom layout builder with named presets
   ══════════════════════════════════════════════════════════════════ */
const LS_PRESETS_KEY = 'jarvis_trading_presets';
const LS_ACTIVE_KEY  = 'jarvis_trading_active_preset';

interface Preset { id: string; name: string; cols: number; layout: WidgetId[]; }

function loadPresets(): Preset[] {
  try { return JSON.parse(localStorage.getItem(LS_PRESETS_KEY)||'[]'); } catch { return []; }
}
function savePresets(p: Preset[]) {
  localStorage.setItem(LS_PRESETS_KEY, JSON.stringify(p));
}

const STARTER_PRESETS: Preset[] = [
  { id:'scalping',  name:'Scalping Desk',   cols:3, layout:['PRICE_CHART','ORDER_BOOK','CVD','ORDER_TICKET','LIQUIDITY_MAP','EXECUTION_LOG'] },
  { id:'macro',     name:'Macro View',      cols:3, layout:['YIELD_CURVE','CORRELATION','SECTOR_ROTATION','COT_POSITIONING','CREDIT_SPREADS','MACRO_POSITIONING'] },
  { id:'options',   name:'Options Flow',    cols:2, layout:['GAMMA_EXPOSURE','VOL_SURFACE','OPTIONS_FLOW','DARK_POOL'] },
  { id:'risk',      name:'Risk Monitor',    cols:2, layout:['RISK_DASHBOARD','EQUITY_CURVE','POSITIONS','ORDER_TICKET'] },
];

function MySetupTab({connected,posRows,balance,equityArr,livePrice,activeSymbol='BTCUSD'}:{connected:boolean;posRows:PosRow[];balance:number;equityArr:number[];livePrice:number;activeSymbol?:string}) {
  const [presets,  setPresets]  = useState<Preset[]>(()=>{ const p=loadPresets(); return p.length?p:STARTER_PRESETS; });
  const [activeId, setActiveId] = useState<string>(()=>localStorage.getItem(LS_ACTIVE_KEY)||'scalping');
  const [editMode, setEditMode] = useState(false);
  const [newName,  setNewName]  = useState('');
  const [newCols,  setNewCols]  = useState(3);
  const [pickOpen, setPickOpen] = useState(false);
  const [dragSrc,  setDragSrc]  = useState<number|null>(null);
  const [dragOver, setDragOver] = useState<number|null>(null);

  const activePreset = presets.find(p=>p.id===activeId) ?? presets[0];

  function persist(updated: Preset[]) { setPresets(updated); savePresets(updated); }

  function addPreset() {
    const name = newName.trim() || 'My Setup';
    const id   = 'custom_'+Date.now();
    const np: Preset = { id, name, cols: newCols, layout: ['PRICE_CHART','EQUITY_CURVE'] };
    const updated = [...presets, np];
    persist(updated); setActiveId(id); localStorage.setItem(LS_ACTIVE_KEY, id);
    setNewName(''); setEditMode(true);
  }

  function deletePreset(id: string) {
    const updated = presets.filter(p=>p.id!==id);
    persist(updated.length ? updated : STARTER_PRESETS);
    setActiveId(updated[0]?.id ?? 'scalping');
  }

  function patchActive(patch: Partial<Preset>) {
    const updated = presets.map(p=>p.id===activePreset.id ? {...p,...patch} : p);
    persist(updated);
  }

  function addWidget(wid: WidgetId) {
    if(activePreset.layout.includes(wid)) return;
    patchActive({ layout: [...activePreset.layout, wid] });
  }
  function removeWidget(wid: WidgetId) {
    patchActive({ layout: activePreset.layout.filter(w=>w!==wid) });
  }
  function moveWidget(from: number, to: number) {
    const l = [...activePreset.layout];
    const [item] = l.splice(from,1); l.splice(to,0,item);
    patchActive({ layout: l });
  }

  const catColors: Record<string,string> = CATEGORY_COLORS;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>

      {/* ── Preset tab strip ──────────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',gap:0,padding:'0 8px',height:32,background:'rgba(0,0,0,0.55)',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0,overflow:'hidden'}}>
        <span className="hud-label" style={{fontSize:7,color:'rgba(255,255,255,0.22)',letterSpacing:'0.2em',marginRight:8,whiteSpace:'nowrap'}}>SETUPS:</span>
        <div style={{flex:1,display:'flex',gap:3,overflowX:'auto',alignItems:'center'}} className="nx-scroll">
          {presets.map(p=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',flexShrink:0}}>
              <button
                onClick={()=>{ setActiveId(p.id); localStorage.setItem(LS_ACTIVE_KEY,p.id); setEditMode(false); }}
                className="hud-label"
                style={{padding:'3px 10px',fontSize:8,border:`1px solid ${p.id===activeId?'rgba(255,179,0,0.7)':'rgba(255,255,255,0.1)'}`,background:p.id===activeId?'rgba(255,179,0,0.09)':'transparent',color:p.id===activeId?'#ffb300':'rgba(255,255,255,0.4)',cursor:'pointer',letterSpacing:'0.1em',whiteSpace:'nowrap'}}
              >{p.name}</button>
              {p.id===activeId && presets.length>1 &&
                <button onClick={()=>deletePreset(p.id)} style={{width:14,height:14,background:'transparent',border:'none',color:'rgba(255,100,100,0.5)',cursor:'pointer',fontSize:10,padding:0,marginLeft:1}}>×</button>
              }
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:4,marginLeft:8,alignItems:'center',flexShrink:0}}>
          <input
            value={newName} onChange={e=>setNewName(e.target.value)}
            placeholder="New setup name…"
            className="font-mono"
            style={{padding:'2px 7px',fontSize:8,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.7)',outline:'none',width:120,height:20}}
          />
          <button onClick={addPreset} className="hud-label" style={{padding:'2px 8px',fontSize:8,border:'1px solid rgba(255,179,0,0.4)',background:'rgba(255,179,0,0.08)',color:'#ffb300',cursor:'pointer',letterSpacing:'0.1em',height:20}}>+ ADD</button>
          <button onClick={()=>setEditMode(v=>!v)} className="hud-label" style={{padding:'2px 8px',fontSize:8,border:`1px solid ${editMode?'rgba(0,229,255,0.6)':'rgba(255,255,255,0.15)'}`,background:editMode?'rgba(0,229,255,0.08)':'transparent',color:editMode?'#00e5ff':'rgba(255,255,255,0.45)',cursor:'pointer',letterSpacing:'0.1em',height:20}}>{editMode?'DONE':'EDIT'}</button>
        </div>
      </div>

      {/* ── Editor toolbar (only in edit mode) ────────────────────── */}
      {editMode && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'5px 10px',background:'rgba(0,229,255,0.04)',borderBottom:'1px solid rgba(0,229,255,0.1)',flexShrink:0,flexWrap:'wrap'}}>
          <span className="hud-label" style={{fontSize:7.5,color:'#00e5ff',letterSpacing:'0.18em'}}>EDIT: {activePreset.name}</span>
          {/* rename */}
          <input
            defaultValue={activePreset.name}
            className="font-mono"
            onBlur={e=>patchActive({name:e.target.value.trim()||activePreset.name})}
            style={{padding:'2px 7px',fontSize:8,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(0,229,255,0.3)',color:'rgba(255,255,255,0.8)',outline:'none',width:160}}
          />
          {/* columns */}
          <div style={{display:'flex',gap:3,alignItems:'center'}}>
            <span className="hud-label" style={{fontSize:7,color:'rgba(255,255,255,0.35)',letterSpacing:'0.1em'}}>COLS:</span>
            {[1,2,3,4].map(n=>(
              <button key={n} onClick={()=>patchActive({cols:n})} className="hud-label"
                style={{width:18,height:18,fontSize:8,border:`1px solid ${activePreset.cols===n?'#00e5ff':'rgba(255,255,255,0.15)'}`,background:activePreset.cols===n?'rgba(0,229,255,0.1)':'transparent',color:activePreset.cols===n?'#00e5ff':'rgba(255,255,255,0.4)',cursor:'pointer',padding:0}}
              >{n}</button>
            ))}
          </div>
          {/* add widgets */}
          <button onClick={()=>setPickOpen(v=>!v)} className="hud-label"
            style={{padding:'2px 10px',fontSize:8,border:`1px solid ${pickOpen?'#00e5ff80':'rgba(255,255,255,0.18)'}`,background:pickOpen?'rgba(0,229,255,0.07)':'transparent',color:pickOpen?'#00e5ff':'rgba(255,255,255,0.55)',cursor:'pointer',letterSpacing:'0.12em'}}
          >+ WIDGET</button>
          <span className="font-mono" style={{fontSize:7.5,color:'rgba(255,255,255,0.25)',marginLeft:'auto'}}>drag to reorder · × to remove</span>
        </div>
      )}

      {/* ── Widget picker (edit mode + pickOpen) ──────────────────── */}
      {editMode && pickOpen && (
        <div style={{padding:'6px 10px',background:'rgba(0,0,0,0.5)',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,display:'flex',flexWrap:'wrap',gap:4}}>
          {WIDGET_REGISTRY.map(w=>{
            const active=activePreset.layout.includes(w.id);
            return (
              <button key={w.id} onClick={()=>active?removeWidget(w.id):addWidget(w.id)} className="hud-label"
                style={{padding:'2px 8px',fontSize:7,border:`1px solid ${active?w.color+'88':w.color+'33'}`,background:active?w.color+'18':'transparent',color:active?w.color:w.color+'88',cursor:'pointer',letterSpacing:'0.07em'}}
              >{active?'✓ ':''}{w.label}</button>
            );
          })}
        </div>
      )}

      {/* ── Custom layout grid ────────────────────────────────────── */}
      <div style={{flex:1,overflow:'auto',padding:6}} className="nx-scroll">
        {activePreset.layout.length===0 ? (
          <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
            <span className="hud-label" style={{fontSize:10,color:'rgba(255,255,255,0.2)',letterSpacing:'0.28em'}}>SETUP LEER</span>
            <span className="font-mono" style={{fontSize:9,color:'rgba(255,255,255,0.18)'}}>Drücke EDIT → + WIDGET um Widgets hinzuzufügen</span>
            <button onClick={()=>{ setEditMode(true); setPickOpen(true); }} className="hud-label"
              style={{padding:'6px 18px',fontSize:9,border:'1px solid rgba(255,179,0,0.5)',background:'rgba(255,179,0,0.07)',color:'#ffb300',cursor:'pointer',letterSpacing:'0.15em',marginTop:6}}
            >SETUP BAUEN</button>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:`repeat(${activePreset.cols},1fr)`,gap:5}}>
            {activePreset.layout.map((wid,idx)=>(
              <div
                key={wid}
                draggable={editMode}
                onDragStart={()=>setDragSrc(idx)}
                onDragOver={e=>{ e.preventDefault(); setDragOver(idx); }}
                onDragLeave={()=>setDragOver(null)}
                onDrop={()=>{ if(dragSrc!==null&&dragSrc!==idx)moveWidget(dragSrc,idx); setDragSrc(null); setDragOver(null); }}
                style={{
                  minHeight:260, position:'relative',
                  cursor: editMode?'grab':'default',
                  outline: dragOver===idx?'2px solid rgba(0,229,255,0.6)':'none',
                  opacity: dragSrc===idx?0.4:1,
                  transition:'opacity 0.12s',
                }}
              >
                {/* remove button in edit mode */}
                {editMode && (
                  <button onClick={()=>removeWidget(wid)} style={{position:'absolute',top:5,right:5,zIndex:20,width:18,height:18,background:'rgba(255,26,107,0.2)',border:'1px solid rgba(255,26,107,0.5)',color:'#ff1a6b',cursor:'pointer',fontSize:11,borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>×</button>
                )}
                {/* widget label chip in edit mode */}
                {editMode && (
                  <div style={{position:'absolute',top:5,left:5,zIndex:20,padding:'1px 6px',background:'rgba(0,0,0,0.7)',border:'1px solid rgba(255,255,255,0.1)',pointerEvents:'none'}}>
                    <span className="hud-label" style={{fontSize:6.5,color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em'}}>⠿ DRAG</span>
                  </div>
                )}
                <WidgetCell id={wid} connected={connected} livePrice={livePrice} posRows={posRows} balance={balance} equityArr={equityArr} activeSymbol={activeSymbol}/>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   GODMODE TRADING AGENT TEAM — institutional signals + news + entry
   ══════════════════════════════════════════════════════════════════ */
interface TradingSignal {
  id: string; sym: string; side: 'LONG'|'SHORT'|'NEUTRAL'; confidence: number;
  entry: string; tp: string; sl: string; tf: string; reason: string;
  source: 'FLOW'|'NEWS'|'TECH'|'MACRO'|'SENTIMENT'; ts: string;
}
interface EconEvent {
  time: string; event: string; country: string; impact: 'HIGH'|'MED'|'LOW'; forecast: string; prev: string; actual: string;
}

const GODMODE_AGENTS = [
  {
    id:'GA-01', name:'NewsAlpha', role:'Scans financial news + press releases for tradeable catalysts', color:'#c8fb4e', icon:'◎', status:'LIVE',
    prompt: `# NewsAlpha — Agent Prompt

## Role
You are a real-time financial news analyst. Your primary objective is to identify **high-conviction tradeable catalysts** from news flow before they are priced in.

## Data Sources
- Financial newswires (Reuters, Bloomberg Terminal feed)
- Company press releases & SEC 8-K / earnings calls
- Central bank communiqués & FOMC statements
- Macroeconomic data releases calendar

## Signal Generation Rules
1. **Catalyst Strength** — classify each event: TIER-1 (market-moving), TIER-2 (sector-moving), TIER-3 (noise)
2. **Reaction Window** — estimate price impact window: immediate (0–15 min), short (15 min–4h), swing (4h–3d)
3. **Corroboration** — cross-reference with FlowDetect agent for volume confirmation before issuing LONG/SHORT signal
4. **Fade Candidates** — flag over-hyped events where initial spike is likely to reverse

## Output Format
\`\`\`
SYM: XAUUSD
BIAS: LONG
CATALYST: Fed Chair dovish pivot signal
TIER: 1
WINDOW: swing (4h–2d)
CONFIDENCE: 78%
NOTES: Watch for DXY reaction confirmation
\`\`\`

## Risk Rules
- Ignore news within 30min of major scheduled data releases
- Minimum confidence threshold: **65%** before issuing signal
- Conflicting tier-1 events → emit NEUTRAL, defer to MacroPulse`,
  },
  {
    id:'GA-02', name:'FlowDetect', role:'Monitors dark pool prints + options flow imbalances', color: CYAN_BRIGHT, icon:'◉', status:'LIVE',
    prompt: `# FlowDetect — Agent Prompt

## Role
You are an institutional order flow specialist. Detect and interpret **dark pool prints**, options sweep activity, and futures open interest shifts to infer institutional positioning.

## Data Sources
- Dark pool print feed (level 2 off-exchange)
- Options flow scanner (unusual sweep / block activity)
- CME futures open interest delta
- Exchange volume imbalance at bid/ask

## Detection Criteria
| Signal Type | Threshold |
|---|---|
| Dark pool block | > 3× average block size |
| Options sweep | > $500K premium, OTM, < 5 DTE |
| OI shift | > 8% change in single session |
| Bid/Ask Imbalance | > 4:1 ratio sustained 15min |

## Signal Logic
- **Bullish Flow**: Large call sweeps + dark pool on bid → LONG bias
- **Bearish Flow**: Put sweeps + dark pool on ask + OI decline → SHORT bias
- **Conflicted Flow**: Mixed signals → hold, report raw data only

## Corroboration
Always cross-validate with **TechOracle** for entry price confirmation before final signal output.

## Output Format
\`\`\`
SYM: BTCUSD
FLOW_BIAS: LONG
DP_SIZE: 4.2× avg
OPT_SWEEP: Call $820K 42d OTM
OI_DELTA: +11.4%
CONFIDENCE: 81%
\`\`\``,
  },
  {
    id:'GA-03', name:'MacroPulse', role:'Tracks Fed/ECB/BoJ signals + macro regime shifts', color: AMBER, icon:'◆', status:'LIVE',
    prompt: `# MacroPulse — Agent Prompt

## Role
You are a macro regime analyst. Monitor global central bank policy, yield curves, and cross-asset flows to identify **regime shifts** that define the primary trend for all asset classes.

## Macro Regime Framework

### Current Regimes
| Regime | Risk | Primary Long | Primary Short |
|---|---|---|---|
| Risk-On | Low | Equities, Crypto | USD, Bonds |
| Risk-Off | High | Gold, JPY, Bonds | Equities, EM |
| Stagflation | Mixed | Gold, Energy | Tech, EM |
| Reflation | Moderate | Commodities, Value | Bonds |

## Monitored Signals
1. **Fed** — Dot plot evolution, balance sheet trajectory, real rate
2. **ECB** — APP/PEPP status, inflation mandate breach
3. **BoJ** — YCC band shifts (critical for JPY + global bond spillover)
4. **DXY** — Primary USD regime indicator
5. **2Y/10Y Spread** — Recession probability curve

## Output
Emit a **Regime Score Card** on each significant macro event:
\`\`\`
REGIME: RISK-OFF transitioning
FED_STANCE: Hawkish (hold)
REAL_RATE: +1.82%
PRIMARY_BIAS: LONG XAUUSD, SHORT USDJPY
SECONDARY: NEUTRAL equities pending CPI print
\`\`\``,
  },
  {
    id:'GA-04', name:'TechOracle', role:'Multi-TF technical confluence: S/R · EMA · Pivots · VWAP', color: JADE, icon:'◈', status:'LIVE',
    prompt: `# TechOracle — Agent Prompt

## Role
You are a multi-timeframe technical analyst. Identify high-probability entry zones through **structural confluence** — price must validate across at minimum 3 independent technical factors before a signal is issued.

## Confluence Stack (minimum 3/5 required)

| Factor | Bullish Condition | Bearish Condition |
|---|---|---|
| EMA Stack | 20 > 50 > 200, price above | Price below, death cross |
| S/R Level | Price at major support | Price at major resistance |
| VWAP | Price reclaiming VWAP | Rejection below VWAP |
| Pivot Points | Bounce off S1/S2 | Rejection at R1/R2 |
| Divergence | Bullish RSI/MACD div | Bearish divergence |

## Timeframe Hierarchy
- **Primary TF**: Weekly / Daily → defines trend direction
- **Intermediate TF**: 4H → identifies structure
- **Entry TF**: 1H / 15min → precise entry trigger

## Entry Precision Rules
- Entry within 0.3% of confluence zone
- SL below structure (not arbitrary distance)
- Minimum R:R = 2.5:1

## Output
\`\`\`
SYM: EURUSD | TF: 4H → 1H
ENTRY: 1.0842 (S1 + 200 EMA + VWAP)
SL: 1.0798 (below structure)
TP1: 1.0920 | TP2: 1.0974
CONFLUENCE: 4/5
CONFIDENCE: 74%
\`\`\``,
  },
  {
    id:'GA-05', name:'SentimentScan', role:'Aggregates social volume, Fear/Greed, funding rates', color: VIOLET, icon:'⬡', status:'SCANNING',
    prompt: `# SentimentScan — Agent Prompt

## Role
You are a market sentiment aggregator. Synthesize **crowd psychology signals** from multiple sources to identify extremes — both as contrarian fading opportunities and as momentum confirmation.

## Data Sources
- **Fear & Greed Index** (CNN / alternative.me) — 0–100
- **Funding Rates** (Binance perpetuals) — annualized %
- **Long/Short Ratio** — exchange-level leverage data
- **Social Volume** (LunarCrush / Santiment) — spike detection
- **Put/Call Ratio** — options market sentiment

## Sentiment Thresholds

| Metric | Extreme Fear | Neutral | Extreme Greed |
|---|---|---|---|
| F&G Index | < 20 | 40–60 | > 80 |
| Funding Rate | < −0.05%/8h | ±0.01% | > 0.08%/8h |
| L/S Ratio | < 0.6 | 0.9–1.1 | > 1.8 |
| P/C Ratio | > 1.4 | 0.9–1.1 | < 0.6 |

## Signal Logic
- **Contrarian Long**: F&G Extreme Fear + Funding negative + High P/C
- **Contrarian Short**: F&G Extreme Greed + Funding spike + High social vol
- **Trend Confirmation**: Moderate sentiment aligned with price momentum

## Output
\`\`\`
ASSET: BTCUSD
FG_INDEX: 18 (EXTREME FEAR)
FUNDING: -0.038%/8h
L_S_RATIO: 0.72
SENTIMENT_BIAS: CONTRARIAN LONG
CONFIDENCE: 69%
\`\`\``,
  },
  {
    id:'GA-06', name:'InstitTrack', role:'Tracks COT data, 13F filings, futures commitment of traders', color: '#fb923c', icon:'◇', status:'LIVE',
    prompt: `# InstitTrack — Agent Prompt

## Role
You are an institutional positioning tracker. Monitor **smart money** movements via regulatory filings, commitment of traders reports, and prime brokerage flow data.

## Data Sources
1. **CFTC COT Report** — Futures: Non-commercial (speculative) vs Commercial (hedge) positioning
2. **SEC 13F Filings** — Quarterly institutional equity holdings changes
3. **Prime Broker Flow** — Gross/net leverage changes at hedge fund level
4. **ETF Flow Data** — Net inflows/outflows for major vehicles (GLD, SLV, SPY, QQQ, crypto ETFs)

## COT Signal Rules
- **Extreme Net Long** (> 90th percentile): Contrarian SHORT warning
- **Extreme Net Short** (< 10th percentile): Contrarian LONG setup
- **Commercial Hedge Reversal**: Strongest signal — commercials turning net long = major bottom

## 13F Interpretation
- Track 10 largest funds' position changes vs prior quarter
- Flag new positions > $500M as institutional conviction buys
- Flag complete exits as institutional distribution

## Output
\`\`\`
SYM: XAUUSD
COT_NET_SPEC: -127,400 contracts (8th percentile BEARISH)
COMMERCIAL: Net Long +89,200 (CONTRARIAN LONG signal)
ETF_FLOW_7D: GLD +$2.1B net inflow
INSTIT_BIAS: LONG (strong)
CONFIDENCE: 77%
\`\`\``,
  },
  {
    id:'GA-07', name:'EntrySniper', role:'Synthesizes all agents — fires high-prob entry alerts', color: ROSE, icon:'▶', status:'READY',
    prompt: `# EntrySniper — Agent Prompt

## Role
You are the **final synthesis layer** of the GodMode trading system. Aggregate outputs from all upstream agents and fire a unified, high-conviction trade alert only when multi-agent confluence is achieved.

## Scoring System

Each upstream agent contributes a weighted vote:

| Agent | Weight | Max Score |
|---|---|---|
| NewsAlpha | 15% | 15 pts |
| FlowDetect | 25% | 25 pts |
| MacroPulse | 20% | 20 pts |
| TechOracle | 25% | 25 pts |
| SentimentScan | 10% | 10 pts |
| InstitTrack | 5% | 5 pts |

## Firing Thresholds
- **FIRE LONG/SHORT**: Composite score ≥ 72, all top-3 agents aligned
- **STANDBY**: Score 55–71, await confirmation tick
- **NO TRADE**: Score < 55 or conflicting top-3 signals

## Alert Format
\`\`\`
⚡ ENTRY SIGNAL — [LONG | SHORT]
━━━━━━━━━━━━━━━━━━━━━━━━━━
SYMBOL:    BTCUSD
TF:        4H entry / 1D trend
SCORE:     84 / 100
ENTRY:     78,450
SL:        76,900   (RR distance: 1.97%)
TP1:       81,800   (RR: 2.09× )
TP2:       83,200   (RR: 3.05× )
CONFIDENCE: 84%
━━━━━━━━━━━━━━━━━━━━━━━━━━
AGENT VOTES:
  FlowDetect  ◉ LONG  · 22/25
  TechOracle  ◈ LONG  · 21/25
  MacroPulse  ◆ LONG  · 16/20
  NewsAlpha   ◎ LONG  · 11/15
\`\`\`

## Hard Stop Rules
- Never fire within 15min of scheduled tier-1 data release
- Max 3 concurrent open signals
- Scale position size inversely with VIX level`,
  },
];

// All assets scanned by GodMode — crypto + metals + equity indices + fx
const GODMODE_SYMBOLS = [
  'BTCUSD','ETHUSD','XRPUSD',   // crypto
  'XAUUSD','XAGUSD',             // metals
  'US500','US30',                 // equity indices (ES / Dow)
  'EURUSD','GBPUSD','USDJPY',    // major FX
];

const SEED_SIGNALS: TradingSignal[] = [
  { id:'S1', sym:'BTCUSD', side:'LONG',    confidence:82, entry:'78,450', tp:'81,800', sl:'76,900', tf:'4H', reason:'ETF inflows + halving supply compression. FlowDetect: large OI build on CME. TechOracle: 4H demand zone holding.', source:'FLOW',      ts: new Date(Date.now()-240000).toISOString() },
  { id:'S2', sym:'XAUUSD', side:'LONG',    confidence:76, entry:'3,312',  tp:'3,390',  sl:'3,270',  tf:'1H', reason:'Real yield decline + risk-off bid. MacroPulse: BoJ hawkish pivot risk. Central bank demand elevated.', source:'MACRO',     ts: new Date(Date.now()-720000).toISOString() },
  { id:'S3', sym:'XAGUSD', side:'LONG',    confidence:68, entry:'32.40',  tp:'33.80',  sl:'31.60',  tf:'4H', reason:'Gold/Silver ratio extended. Industrial demand + solar sector tailwind. Macro risk-off supports metals.', source:'MACRO',     ts: new Date(Date.now()-900000).toISOString() },
  { id:'S4', sym:'US500',  side:'NEUTRAL', confidence:52, entry:'5,280',  tp:'5,380',  sl:'5,180',  tf:'1D', reason:'Mixed earnings season. AAPL beat vs META miss. Await CPI data 14:30. InstitTrack: sector rotation in progress.', source:'NEWS',  ts: new Date(Date.now()-1500000).toISOString() },
  { id:'S5', sym:'US30',   side:'LONG',    confidence:61, entry:'39,800', tp:'40,500', sl:'39,100', tf:'1D', reason:'Industrials + energy outperforming. Dow breakout above 200 EMA. Breadth improving.', source:'TECH',     ts: new Date(Date.now()-1800000).toISOString() },
  { id:'S6', sym:'ETHUSD', side:'LONG',    confidence:71, entry:'3,100',  tp:'3,280',  sl:'2,980',  tf:'4H', reason:'ETH ETF net inflows 5-day streak. Layer-2 fee burn accelerating. Follows BTC momentum.', source:'FLOW',     ts: new Date(Date.now()-2200000).toISOString() },
  { id:'S7', sym:'XRPUSD', side:'LONG',    confidence:63, entry:'0.5820', tp:'0.6200', sl:'0.5600', tf:'4H', reason:'Regulatory clarity post-SEC ruling. Ripple ODL volume up. Break above range resistance.', source:'NEWS',     ts: new Date(Date.now()-2800000).toISOString() },
  { id:'S8', sym:'EURUSD', side:'SHORT',   confidence:69, entry:'1.0894', tp:'1.0800', sl:'1.0950', tf:'4H', reason:'DXY strength + ECB dovish guidance. NewsAlpha: German PMI miss. InstitTrack: large EUR spec short.', source:'NEWS',  ts: new Date(Date.now()-3200000).toISOString() },
  { id:'S9', sym:'USDJPY', side:'SHORT',   confidence:71, entry:'154.30', tp:'150.80', sl:'156.10', tf:'1H', reason:'BoJ intervention risk above 155. SentimentScan: extreme greed on JPY carry unwind. Caution zone.', source:'TECH', ts: new Date(Date.now()-3600000).toISOString() },
  { id:'S10',sym:'GBPUSD', side:'NEUTRAL', confidence:50, entry:'1.2640', tp:'—',      sl:'—',      tf:'1D', reason:'UK CPI in-line with forecast. BoE on hold. Range-bound between 1.255–1.280 support/resistance.', source:'MACRO', ts: new Date(Date.now()-4200000).toISOString() },
];

const SEED_ECON: EconEvent[] = [
  { time:'08:30', event:'US Non-Farm Payrolls',     country:'USD', impact:'HIGH', forecast:'+185K', prev:'+175K', actual:'+203K' },
  { time:'09:00', event:'EU CPI Flash Estimate',    country:'EUR', impact:'HIGH', forecast:'2.3%',  prev:'2.5%',  actual:''      },
  { time:'10:00', event:'ISM Manufacturing PMI',    country:'USD', impact:'MED',  forecast:'49.8',  prev:'48.7',  actual:''      },
  { time:'11:30', event:'BoC Rate Decision',        country:'CAD', impact:'HIGH', forecast:'4.25%', prev:'4.25%', actual:''      },
  { time:'14:30', event:'US CPI YoY',               country:'USD', impact:'HIGH', forecast:'3.1%',  prev:'3.2%',  actual:''      },
  { time:'15:00', event:'Fed Chair Powell Speech',  country:'USD', impact:'HIGH', forecast:'—',     prev:'—',     actual:''      },
  { time:'16:30', event:'Crude Oil Inventories',    country:'USD', impact:'MED',  forecast:'-1.8M', prev:'+2.1M', actual:''      },
  { time:'20:00', event:'FOMC Meeting Minutes',     country:'USD', impact:'HIGH', forecast:'—',     prev:'—',     actual:''      },
];

function GodModeTab({ connected, onNavigate, onSymbolSelect }: { connected: boolean; onNavigate?: (tab: TradingTab) => void; onSymbolSelect?: (sym: string) => void; }) {
  const { tickers } = useZeusTickers(GODMODE_SYMBOLS);
  const { rows: fundingRows } = useZeusSwaps(['BTCUSD','ETHUSD','XRPUSD','XAUUSD','XAGUSD','US500','US30','EURUSD','GBPUSD','USDJPY']);
  const fgData = useFearGreed();

  // Derive live signals — always emits one per asset, never falls back to seed
  const liveSignals = useMemo((): TradingSignal[] => {
    if (tickers.length === 0) return [];
    const fundMap = Object.fromEntries(fundingRows.map(r => [r.symbol, r.rate]));
    const fg = fgData?.value ?? 50;

    return tickers.map((tk): TradingSignal => {
      const chg    = tk.change24h;
      const price  = tk.price;
      const sym    = tk.symbol;
      const fundRate = fundMap[sym] ?? 0; // annualised %

      // ── Confidence score (0–100) built from multiple factors ──────────
      let score = 50;
      // 1. Momentum: ±2 pts per % (capped ±30)
      score += Math.min(30, Math.max(-30, chg * 2));
      // 2. Extreme momentum bonus: large moves signal continuation
      if (chg >  5) score += 8;
      if (chg < -5) score -= 8;
      // 3. Fear & Greed overlay
      if (fg < 20)       score += 12;  // extreme fear → buy signal
      else if (fg < 35)  score +=  6;
      else if (fg > 85)  score -= 12;  // extreme greed → fade
      else if (fg > 70)  score -=  6;
      // 4. Funding/swap overlay: negative swap = bearish carry, positive = bullish
      if (fundRate < -30) score -= 8;
      else if (fundRate > 80)  score -= 6;  // overheated longs
      else if (fundRate > 40)  score += 3;
      // 5. Volatility bonus for high-confidence signals
      const dailyRange = tk.high > 0 && tk.low > 0 ? (tk.high - tk.low) / price * 100 : Math.abs(chg) * 1.4;
      if (dailyRange > 4) score += 4;  // high-vol day = stronger signal

      score = Math.round(Math.max(16, Math.min(93, score)));

      const side: TradingSignal['side'] = score >= 57 ? 'LONG' : score <= 43 ? 'SHORT' : 'NEUTRAL';

      // ── Source classification ──────────────────────────────────────────
      let source: TradingSignal['source'];
      if (Math.abs(chg) > 3.5)            source = 'FLOW';
      else if (fg < 30 || fg > 75)        source = 'SENTIMENT';
      else if (Math.abs(fundRate) > 40)   source = 'MACRO';
      else if (Math.abs(chg) > 1.5)       source = 'TECH';
      else                                 source = 'MACRO';

      // ── Reason string ─────────────────────────────────────────────────
      const chgStr   = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}% 24h`;
      const trendStr = Math.abs(chg) > 4  ? (chg > 0 ? 'Strong bullish momentum.' : 'Strong bearish momentum.') :
                       Math.abs(chg) > 1.5 ? (chg > 0 ? 'Bullish bias.' : 'Bearish bias.') :
                       'Consolidating range.';
      const fgStr    = fg < 25 ? `Extreme Fear F&G=${fg} — contrarian buy.` :
                       fg > 80 ? `Extreme Greed F&G=${fg} — fade risk.` :
                       fg < 40 ? `Fear bias F&G=${fg}.` : '';
      const fundStr  = Math.abs(fundRate) > 25 ? `Swap ${fundRate > 0 ? '+' : ''}${fundRate.toFixed(0)}% ann ${fundRate < 0 ? '(bearish carry).' : '(bullish carry).'}` : '';
      const agentStr = source === 'FLOW'      ? 'FlowDetect: volume impulse detected.' :
                       source === 'SENTIMENT' ? 'SentimentScan: crowd signal.' :
                       source === 'MACRO'     ? 'MacroPulse: regime context.' : 'TechOracle: confluence zone.';
      const reason   = [chgStr, trendStr, fgStr, fundStr, agentStr].filter(Boolean).join(' ');

      // ── Price targets ─────────────────────────────────────────────────
      const riskPct = Math.abs(chg) > 3 ? 0.022 : 0.013;
      const tpPct   = riskPct * 2.2;
      const digs    = price >= 10000 ? 0 : price >= 1000 ? 1 : price >= 100 ? 2 : price >= 10 ? 3 : price >= 1 ? 4 : 5;
      const fmt     = (p: number) => p >= 1000
        ? p.toLocaleString('en-US', { maximumFractionDigits: digs })
        : p.toFixed(digs);

      return {
        id:         `LIVE-${sym}`,
        sym,
        side,
        confidence: score,
        entry:      fmt(price),
        tp:         side === 'NEUTRAL' ? '—' : fmt(price * (side === 'LONG' ? 1 + tpPct : 1 - tpPct)),
        sl:         side === 'NEUTRAL' ? '—' : fmt(price * (side === 'LONG' ? 1 - riskPct : 1 + riskPct)),
        tf:         '4H',
        reason,
        source,
        ts:         new Date().toISOString(),
      };
    })
    // Sort: directional first (LONG/SHORT), then by confidence desc
    .sort((a, b) => {
      const rank = (s: TradingSignal) => s.side === 'NEUTRAL' ? 0 : 1;
      if (rank(b) !== rank(a)) return rank(b) - rank(a);
      return b.confidence - a.confidence;
    });
  }, [tickers, fundingRows, fgData]);

  const activeSignals = liveSignals.length > 0 ? liveSignals : SEED_SIGNALS;
  const isLive        = liveSignals.length > 0;
  const [econ]        = useState<EconEvent[]>(SEED_ECON);
  const [selSig, setSelSig] = useState<TradingSignal|null>(null);
  const [agentFilter, setAgentFilter] = useState<string|null>(null);
  const [scanning, setScanning] = useState(false);
  const [agentDefs, setAgentDefs] = useState(() =>
    GODMODE_AGENTS.map(ag => ({ ...ag, enabled: true as boolean }))
  );
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [expandedPromptId, setExpandedPromptId] = useState<string|null>(null);
  const enabledAgents = agentDefs.filter(a => a.enabled);
  function updateAgent(id: string, patch: Partial<{name:string; role:string; prompt:string; icon:string; status:string; enabled:boolean; color:string}>) {
    setAgentDefs(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }
  function addAgent() {
    const newId = `GA-${String(agentDefs.length + 1).padStart(2,'0')}`;
    setAgentDefs(prev => [...prev, {
      id: newId, name: 'NewAgent', role: 'Define this agent\'s role...', prompt: `# ${newId} — Agent Prompt\n\n## Role\nDescribe what this agent does.\n\n## Instructions\n- Rule 1\n- Rule 2\n\n## Output Format\n\`\`\`\nSYM: ...\nBIAS: ...\nCONFIDENCE: ...\n\`\`\``, color: CYAN, icon: '◎', status: 'READY', enabled: true,
    }]);
  }
  function removeAgent(id: string) {
    setAgentDefs(prev => prev.filter(a => a.id !== id));
  }

  // Auto-select top signal
  useEffect(() => {
    if (activeSignals.length > 0 && !selSig) setSelSig(activeSignals[0]);
  }, [activeSignals]);
  useEffect(() => {
    if (isLive && !selSig?.id.startsWith('LIVE')) setSelSig(liveSignals[0] ?? null);
  }, [isLive]);

  function triggerScan() {
    setScanning(true);
    setTimeout(() => setScanning(false), 2800);
  }

  const srcColor  = (s: TradingSignal['source']) => ({ FLOW: CYAN_BRIGHT, NEWS:'#c8fb4e', TECH: JADE, MACRO: AMBER, SENTIMENT: VIOLET }[s]);
  const impColor  = (i: EconEvent['impact'])      => ({ HIGH: ROSE, MED: AMBER, LOW: JADE }[i]);
  const sideColor = (s: TradingSignal['side'])    => s === 'LONG' ? JADE : s === 'SHORT' ? ROSE : AMBER;

  // Build chart setup from selected signal
  const chartSetup: GodModeTradeSetup | undefined = selSig && selSig.side !== 'NEUTRAL' ? {
    entry: parseFloat(selSig.entry.replace(/,/g, '')) || null,
    sl:    parseFloat(selSig.sl.replace(/,/g, ''))    || null,
    tp1:   parseFloat(selSig.tp.replace(/,/g, ''))    || null,
    tp2:   parseFloat(selSig.tp.replace(/,/g, '')) * (selSig.side === 'LONG' ? 1.012 : 0.988) || null,
    bias:  selSig.side === 'LONG' ? 'long' : 'short',
  } : undefined;

  return (
    <div style={{ flex:1, overflow:'hidden', padding:8, display:'grid', gridTemplateRows:'auto 1fr', gap:8 }}>

      {/* ── Agent Team Header ── */}
      <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'stretch' }}>
        <div style={{ flex:1, display:'grid', gridTemplateColumns:`repeat(${Math.max(1, enabledAgents.length)},1fr)`, gap:6 }}>
          {enabledAgents.map(ag => {
            const active = agentFilter === ag.id;
            return (
              <div key={ag.id} onClick={() => setAgentFilter(active ? null : ag.id)}
                style={{ padding:'8px 10px', border:`1px solid ${ag.color}${active?'99':'33'}`, background:`${ag.color}${active?'15':'07'}`, cursor:'pointer', transition:'all 0.15s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:16, color:ag.color, lineHeight:1 }}>{ag.icon}</span>
                  <span className="hud-label" style={{ fontSize:6.5, color: ag.status==='LIVE' ? JADE : ag.status==='SCANNING' ? AMBER : ag.color, border:`1px solid currentColor`, padding:'1px 3px' }}>{ag.status}</span>
                </div>
                <div className="hud-label" style={{ fontSize:9, color:ag.color, letterSpacing:'0.12em', marginBottom:2 }}>{ag.name}</div>
                <div className="font-mono" style={{ fontSize:7.5, color:'rgba(255,255,255,0.35)', lineHeight:1.4 }}>{ag.role.slice(0,40)}…</div>
              </div>
            );
          })}
        </div>
        <button onClick={() => setShowAgentSettings(v => !v)} className="hud-label"
          style={{ padding:'0 16px', fontSize:8, color: showAgentSettings ? AMBER : 'rgba(255,255,255,0.5)', border:`1px solid ${showAgentSettings ? AMBER+'80' : 'rgba(255,255,255,0.15)'}`, cursor:'pointer', background: showAgentSettings ? `${AMBER}12` : 'rgba(255,255,255,0.03)', letterSpacing:'0.2em', flexShrink:0 }}>
          ⚙ AGENTS
        </button>
      </div>

      {/* ── Main content ── */}
      {showAgentSettings ? (
        <div style={{ minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column', gap:8 }}>
          {/* Settings toolbar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, padding:'0 2px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span className="hud-label" style={{ fontSize:7, color:'rgba(255,255,255,0.2)', letterSpacing:'0.3em' }}>CFG-01</span>
              <span className="hud-label" style={{ fontSize:9, color: AMBER, letterSpacing:'0.22em' }}>AGENT TEAM CONFIGURATION</span>
              <span className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.25)', border:'1px solid rgba(255,255,255,0.1)', padding:'1px 6px' }}>{agentDefs.length} AGENTS · {enabledAgents.length} ACTIVE</span>
            </div>
            <button onClick={addAgent} className="hud-label"
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 14px', fontSize:8, color:JADE, border:`1px solid ${JADE}50`, cursor:'pointer', background:`${JADE}0d`, letterSpacing:'0.2em', transition:'all 0.15s' }}>
              <span style={{ fontSize:12, lineHeight:1 }}>+</span> ADD AGENT
            </button>
          </div>

          {/* Column headers */}
          <div style={{ display:'grid', gridTemplateColumns:'48px 52px 1fr 2fr 110px 38px', gap:0, padding:'0 0 6px 0', borderBottom:`1px solid rgba(255,255,255,0.07)` }}>
            {[['48px',''],['52px','ICON'],['1fr','NAME'],['2fr','ROLE DESCRIPTION'],['110px','STATUS'],['38px','']].map(([,h],i) => (
              <span key={i} className="hud-label" style={{ fontSize:7, color:'rgba(255,255,255,0.22)', letterSpacing:'0.18em', paddingLeft: i===0?0:12 }}>{h}</span>
            ))}
          </div>

          {/* Agent rows */}
          <div className="nx-scroll" style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:0 }}>
            {agentDefs.map((ag, idx) => {
              const statusColor = ag.status==='LIVE' ? JADE : ag.status==='SCANNING' ? AMBER : ag.status==='OFFLINE' ? 'rgba(255,255,255,0.2)' : ag.color;
              const STATUS_CYCLE = ['LIVE','SCANNING','READY','OFFLINE'] as const;
              const nextStatus = () => {
                const i = STATUS_CYCLE.indexOf(ag.status as typeof STATUS_CYCLE[number]);
                updateAgent(ag.id, { status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] });
              };
              const isExpanded = expandedPromptId === ag.id;
              const promptLineCount = (ag.prompt || '').split('\n').length;
              return (
                <div key={ag.id} style={{ display:'flex', flexDirection:'column', borderBottom:`1px solid rgba(255,255,255,0.05)`, marginBottom:2 }}>
                  {/* ── Main row ── */}
                  <div style={{ display:'grid', gridTemplateColumns:'48px 52px 1fr 2fr 110px 38px', gap:0, alignItems:'center', padding:'8px 0', borderLeft:`2px solid ${ag.enabled ? ag.color+'80' : 'rgba(255,255,255,0.06)'}`, background: ag.enabled ? `${ag.color}06` : 'rgba(255,255,255,0.015)', transition:'all 0.15s', opacity: ag.enabled ? 1 : 0.45 }}>

                    {/* Toggle */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <button onClick={() => updateAgent(ag.id, { enabled: !ag.enabled })}
                        style={{ width:32, height:16, borderRadius:8, border:`1px solid ${ag.enabled ? ag.color+'60' : 'rgba(255,255,255,0.15)'}`, background: ag.enabled ? `${ag.color}30` : 'rgba(255,255,255,0.04)', cursor:'pointer', position:'relative', transition:'all 0.2s', padding:0 }}>
                        <span style={{ position:'absolute', top:2, left: ag.enabled ? 16 : 2, width:10, height:10, borderRadius:'50%', background: ag.enabled ? ag.color : 'rgba(255,255,255,0.25)', transition:'all 0.2s', display:'block' }} />
                      </button>
                    </div>

                    {/* Icon */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', paddingLeft:4 }}>
                      <div style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${ag.color}30`, background:`${ag.color}10`, position:'relative' }}>
                        <span style={{ fontSize:16, color:ag.color, lineHeight:1, userSelect:'none' }}>{ag.icon}</span>
                        <span className="hud-label" style={{ position:'absolute', bottom:1, right:2, fontSize:5.5, color:`${ag.color}80`, letterSpacing:'0.05em' }}>{String(idx+1).padStart(2,'0')}</span>
                      </div>
                    </div>

                    {/* Name */}
                    <div style={{ paddingLeft:12, paddingRight:8 }}>
                      <input value={ag.name} onChange={e => updateAgent(ag.id, { name: e.target.value })}
                        style={{ width:'100%', background:'transparent', border:'none', borderBottom:`1px solid ${ag.color}30`, color:ag.color, fontSize:11, fontFamily:'monospace', fontWeight:600, padding:'2px 0', letterSpacing:'0.08em', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }}
                        onFocus={e => (e.target.style.borderBottomColor = ag.color+'90')}
                        onBlur={e => (e.target.style.borderBottomColor = ag.color+'30')} />
                      <div className="hud-label" style={{ fontSize:6.5, color:'rgba(255,255,255,0.2)', marginTop:2, letterSpacing:'0.15em' }}>{ag.id}</div>
                    </div>

                    {/* Role + MD toggle */}
                    <div style={{ paddingLeft:12, paddingRight:8, display:'flex', flexDirection:'column', gap:4 }}>
                      <input value={ag.role} onChange={e => updateAgent(ag.id, { role: e.target.value })}
                        style={{ width:'100%', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', fontSize:10, fontFamily:'monospace', padding:'2px 0', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' }}
                        onFocus={e => (e.target.style.borderBottomColor = 'rgba(255,255,255,0.35)')}
                        onBlur={e => (e.target.style.borderBottomColor = 'rgba(255,255,255,0.1)')} />
                      <button onClick={() => setExpandedPromptId(isExpanded ? null : ag.id)} className="hud-label"
                        style={{ display:'inline-flex', alignItems:'center', gap:5, alignSelf:'flex-start', padding:'2px 8px', fontSize:7.5, color: isExpanded ? ag.color : 'rgba(255,255,255,0.3)', border:`1px solid ${isExpanded ? ag.color+'50' : 'rgba(255,255,255,0.1)'}`, background: isExpanded ? `${ag.color}12` : 'transparent', cursor:'pointer', letterSpacing:'0.14em', transition:'all 0.15s' }}>
                        <span style={{ fontSize:9, lineHeight:1 }}>{isExpanded ? '▾' : '▸'}</span>
                        PROMPT · MD
                        <span style={{ fontSize:6.5, color:'rgba(255,255,255,0.25)', marginLeft:2 }}>{promptLineCount}L</span>
                      </button>
                    </div>

                    {/* Status — click to cycle */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', paddingLeft:8 }}>
                      <button onClick={nextStatus} className="hud-label"
                        style={{ padding:'4px 10px', fontSize:8, color:statusColor, border:`1px solid ${statusColor}50`, background:`${statusColor}0f`, cursor:'pointer', letterSpacing:'0.18em', minWidth:88, textAlign:'center', transition:'all 0.15s' }}>
                        {ag.status==='LIVE' ? '◉ LIVE' : ag.status==='SCANNING' ? '◌ SCANNING' : ag.status==='READY' ? '◎ READY' : '○ OFFLINE'}
                      </button>
                    </div>

                    {/* Delete */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <button onClick={() => removeAgent(ag.id)}
                        style={{ width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.08)', background:'transparent', cursor:'pointer', fontSize:11, transition:'all 0.15s', borderRadius:0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color=ROSE; (e.currentTarget as HTMLButtonElement).style.borderColor=ROSE+'60'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color='rgba(255,255,255,0.2)'; (e.currentTarget as HTMLButtonElement).style.borderColor='rgba(255,255,255,0.08)'; }}>
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* ── Inline Markdown Editor (expands below row) ── */}
                  {isExpanded && (
                    <div style={{ borderLeft:`2px solid ${ag.color}40`, background:`${ag.color}04`, padding:'0 0 0 0' }}>
                      {/* Editor header */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 14px 6px', borderBottom:`1px solid ${ag.color}18` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ fontSize:13, color:ag.color }}>{ag.icon}</span>
                          <span className="hud-label" style={{ fontSize:8, color:ag.color, letterSpacing:'0.22em' }}>{ag.name} \u00b7 AGENT PROMPT</span>
                          <span className="hud-label" style={{ fontSize:7, color:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.08)', padding:'1px 5px' }}>MARKDOWN</span>
                          <span className="hud-label" style={{ fontSize:7, color:'rgba(255,255,255,0.2)' }}>{promptLineCount} LINES · {(ag.prompt||'').length} CHARS</span>
                        </div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span className="hud-label" style={{ fontSize:7, color:'rgba(255,255,255,0.2)', letterSpacing:'0.15em' }}>## H2  **bold**  *italic*  \`code\`  | table |</span>
                          <button onClick={() => setExpandedPromptId(null)} className="hud-label"
                            style={{ padding:'2px 8px', fontSize:7.5, color:'rgba(255,255,255,0.3)', border:'1px solid rgba(255,255,255,0.1)', background:'transparent', cursor:'pointer', letterSpacing:'0.14em' }}>
                            ▴ COLLAPSE
                          </button>
                        </div>
                      </div>
                      {/* Line-numbered textarea wrapper */}
                      <div style={{ display:'flex', maxHeight:320, overflow:'hidden' }}>
                        {/* Line numbers */}
                        <div style={{ padding:'10px 0', background:`${ag.color}08`, borderRight:`1px solid ${ag.color}15`, minWidth:36, flexShrink:0, overflowY:'hidden', userSelect:'none' }}>
                          {(ag.prompt||'').split('\n').map((_,i) => (
                            <div key={i} className="font-mono" style={{ fontSize:9, color:`${ag.color}40`, textAlign:'right', paddingRight:8, lineHeight:'1.6', height:16 }}>{i+1}</div>
                          ))}
                        </div>
                        {/* Editor */}
                        <textarea
                          value={ag.prompt || ''}
                          onChange={e => updateAgent(ag.id, { prompt: e.target.value })}
                          spellCheck={false}
                          style={{ flex:1, minHeight: Math.min(Math.max(promptLineCount * 16, 120), 300), maxHeight:300, background:'transparent', border:'none', outline:'none', resize:'none', color:'rgba(255,255,255,0.75)', fontSize:11.5, fontFamily:'"JetBrains Mono","Courier New",monospace', lineHeight:'1.6', padding:'10px 14px', boxSizing:'border-box', overflowY:'auto', whiteSpace:'pre', tabSize:2 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr 280px', gap:8, minHeight:0, overflow:'hidden' }}>

        {/* LEFT — Signals list */}
        <HoloPanel label="LIVE SIGNALS" code={`SIG · ${activeSignals.length}${isLive?' · LIVE':' · SEED'}`} status={isLive?'live':'warn'} accent="cyan"
          style={{ minHeight:0, display:'flex', flexDirection:'column' }}
          bodyClassName="nx-scroll"
          bodyStyle={{ display:'flex', flexDirection:'column', gap:6, padding:'8px 10px', flex:1, overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:2 }}>
            <button onClick={triggerScan} className="hud-label"
              style={{ padding:'3px 10px', fontSize:7.5, color:scanning?AMBER:JADE, border:`1px solid ${scanning?AMBER:JADE}50`, cursor:'pointer', background:'transparent', letterSpacing:'0.16em' }}>
              {scanning ? '◌ SCANNING…' : '▶ SCAN NOW'}
            </button>
          </div>
          {activeSignals.map(s => (
            <div key={s.id} onClick={() => setSelSig(s)}
              style={{ padding:'9px 11px', borderTop:`1px solid ${selSig?.id===s.id ? sideColor(s.side) : 'rgba(255,255,255,0.08)'}`, borderRight:`1px solid ${selSig?.id===s.id ? sideColor(s.side) : 'rgba(255,255,255,0.08)'}`, borderBottom:`1px solid ${selSig?.id===s.id ? sideColor(s.side) : 'rgba(255,255,255,0.08)'}`, borderLeft:`2px solid ${sideColor(s.side)}`, background: selSig?.id===s.id ? `${sideColor(s.side)}10` : 'rgba(255,255,255,0.02)', cursor:'pointer', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span className="hud-label"
                  onClick={e => { e.stopPropagation(); onSymbolSelect?.(s.sym); onNavigate?.('TERMINAL'); }}
                  style={{ fontSize:10, color:sideColor(s.side), letterSpacing:'0.14em', cursor:'pointer', textDecoration:'underline dotted' }}
                  title={`Open ${s.sym} in Terminal`}
                >{s.sym}</span>
                <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                  <span className="hud-label" style={{ fontSize:7.5, color:srcColor(s.source), border:`1px solid ${srcColor(s.source)}40`, padding:'1px 4px' }}>{s.source}</span>
                  <span className="font-mono" style={{ fontSize:8, color: s.confidence>75 ? JADE : s.confidence>55 ? AMBER : ROSE }}>{s.confidence}%</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span className="hud-label" style={{ fontSize:9, color:sideColor(s.side), border:`1px solid ${sideColor(s.side)}50`, padding:'2px 7px' }}>{s.side}</span>
                <span className="font-mono" style={{ fontSize:8.5, color:'rgba(255,255,255,0.5)' }}>{s.tf} · {s.entry}</span>
              </div>
              <div className="font-mono" style={{ fontSize:8, color:'rgba(255,255,255,0.35)', marginTop:4, lineHeight:1.4 }}>{s.reason.slice(0,60)}…</div>
            </div>
          ))}
        </HoloPanel>

        {/* CENTER — Candlestick Chart */}
        <HoloPanel
          label={selSig ? `FLOW SOURCE · ${selSig.sym}` : 'FLOW SOURCE · BTCUSD'}
          code="FS-001"
          status="live"
          accent="cyan"
          style={{ minHeight:0, display:'flex', flexDirection:'column' }}
          bodyStyle={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', padding:'4px 8px 8px' }}>
          <GodModeChart
            key={selSig?.sym ?? 'BTCUSD'}
            symbol={selSig?.sym ?? 'BTCUSD'}
            interval={selSig?.tf === '4H' ? '4h' : selSig?.tf === '1H' ? '1h' : '4h'}
            setup={chartSetup}
          />
        </HoloPanel>

        {/* RIGHT — Econ Calendar (top) + Signal Detail (bottom) */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, minHeight:0, overflow:'hidden' }}>

          {/* Economic Calendar */}
          <HoloPanel label="ECONOMIC CALENDAR" code="ECO-CAL" accent="amber"
            style={{ flex:'1.4', minHeight:0, display:'flex', flexDirection:'column' }}
            bodyClassName="nx-scroll"
            bodyStyle={{ flex:1, overflowY:'auto', padding:'6px 10px' }}>
            {econ.map((e, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'36px 1fr 32px', gap:6, alignItems:'center', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span className="font-mono" style={{ fontSize:8, color:'rgba(255,255,255,0.4)' }}>{e.time}</span>
                <div>
                  <div className="font-mono" style={{ fontSize:9, color: e.actual ? (e.actual > e.forecast ? JADE : ROSE) : 'rgba(255,255,255,0.75)', lineHeight:1.2 }}>{e.event}</div>
                  <div className="font-mono" style={{ fontSize:7.5, color:'rgba(255,255,255,0.3)' }}>{e.country} · prev {e.prev} · fcst {e.forecast}{e.actual ? ` · act ${e.actual}` : ''}</div>
                </div>
                <span className="hud-label" style={{ fontSize:7, color:impColor(e.impact), border:`1px solid ${impColor(e.impact)}40`, padding:'1px 3px', textAlign:'center' }}>{e.impact}</span>
              </div>
            ))}
          </HoloPanel>

          {/* Signal Detail */}
          <HoloPanel label="FLOW SOURCE" code="FS-DET" accent="cyan"
            style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}
            bodyStyle={{ flex:1, overflow:'hidden', padding:'8px 10px', display:'flex', flexDirection:'column', gap:8 }}>
            {selSig ? (
              <>
                <div>
                  <span className="hud-label" style={{ fontSize:7.5, color:srcColor(selSig.source), letterSpacing:'0.22em' }}>{selSig.source} · {new Date(selSig.ts).toLocaleTimeString()}</span>
                  <div className="hud-label" style={{ fontSize:17, color:sideColor(selSig.side), letterSpacing:'0.12em', marginTop:3 }}>{selSig.sym} · {selSig.side}</div>
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.4)' }}>CONFIDENCE</span>
                    <span className="font-mono" style={{ fontSize:10, color: selSig.confidence>75 ? JADE : selSig.confidence>55 ? AMBER : ROSE }}>{selSig.confidence}%</span>
                  </div>
                  <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:1 }}>
                    <div style={{ height:'100%', width:`${selSig.confidence}%`, background: selSig.confidence>75 ? JADE : selSig.confidence>55 ? AMBER : ROSE }} />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {[['ENTRY', selSig.entry, CYAN_BRIGHT],['TP', selSig.tp, JADE],['SL', selSig.sl, ROSE]].map(([l,v,c]) => (
                    <div key={l} style={{ padding:'6px 8px', border:`1px solid ${c}30`, background:`${c}08` }}>
                      <div className="hud-label" style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:2 }}>{l}</div>
                      <div className="font-mono" style={{ fontSize:11, color: c as string }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:5, marginTop:'auto' }}>
                  <button className="hud-label" style={{ flex:1, padding:'7px', fontSize:8, color:JADE, border:`1px solid ${JADE}`, cursor:'pointer', letterSpacing:'0.18em', background:`${JADE}12` }}>⚡ ALERT</button>
                  <button className="hud-label"
                    onClick={() => { onSymbolSelect?.(selSig.sym); onNavigate?.('TERMINAL'); }}
                    style={{ flex:1, padding:'7px', fontSize:8, color:sideColor(selSig.side), border:`1px solid ${sideColor(selSig.side)}`, cursor:'pointer', letterSpacing:'0.18em', background:`${sideColor(selSig.side)}12` }}>▶ CHART</button>
                </div>
              </>
            ) : (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, color:'rgba(255,255,255,0.15)', fontSize:10, fontFamily:'monospace' }}>
                SELECT SIGNAL
              </div>
            )}
          </HoloPanel>
        </div>
      </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TRADING SCREEN — MAIN EXPORT (tabbed)
   ══════════════════════════════════════════════════════════════════ */
type TradingTab = 'TERMINAL' | 'MY_SETUP' | 'GODMODE';

export function TradingScreen() {
  const {connected,positions: posRows,equity: equityArr,lastErr: mt5Err}=useMt5LiveData();
  const { tickers: liveTickers } = useZeusTickers(GODMODE_SYMBOLS);
  const btcTicker = liveTickers.find(t=>t.symbol==='BTCUSD');
  const livePrice = btcTicker?.price ?? 0;
  const balance = equityArr.length>0 ? equityArr[equityArr.length-1] : 100000;

  const [tab,          setTab]          = useState<TradingTab>('TERMINAL');
  const [activeSymbol, setActiveSymbol] = useState<string>('BTCUSD');
  const [mt5Open,      setMt5Open]      = useState<boolean>(()=>localStorage.getItem('zeus.connector.open')!=='0');
  const [layout,   setLayout]   = useState<WidgetId[][]>(DEFAULT_LAYOUT);
  const [showSettings,setShowSettings]=useState(false);
  const [showLibrary, setShowLibrary] =useState(false);
  const [dragSrc,  setDragSrc]  = useState<[number,number]|null>(null);
  const activeIds=layout.flat();

  function toggleMt5() { setMt5Open(v => { const next=!v; localStorage.setItem('zeus.connector.open', next?'1':'0'); return next; }); }
  function selectSymbol(sym: string) { setActiveSymbol(sym); }
  function goTerminalWithSymbol(sym: string) { setActiveSymbol(sym); setTab('TERMINAL'); }

  function swapWidgets(r1:number,c1:number,r2:number,c2:number){
    const nl=layout.map(row=>[...row]);
    const tmp=nl[r1][c1]; nl[r1][c1]=nl[r2][c2]; nl[r2][c2]=tmp;
    setLayout(nl);
  }
  function addWidget(id:WidgetId){
    const nl=layout.map(row=>[...row]);
    const lastRow=nl[nl.length-1];
    if(lastRow.length<4) lastRow.push(id); else nl.push([id]);
    setLayout(nl);
  }
  function removeWidget(id:WidgetId){
    const nl=layout.map(row=>row.filter(w=>w!==id)).filter(row=>row.length>0);
    setLayout(nl.length>0?nl:[['EQUITY_CURVE']]);
  }

  const TABS: {id:TradingTab;label:string;color:string}[] = [
    {id:'TERMINAL', label:'TERMINAL',  color:'#00e5ff'},
    {id:'MY_SETUP', label:'MY SETUP',  color:'#ffb300'},
    {id:'GODMODE',  label:'⚡ GODMODE', color:ROSE},
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#030509',overflow:'hidden',fontFamily:'var(--font-mono)'}}>

      {/* ── Bloomberg ticker bar ──────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',gap:0,padding:'0 8px',height:30,background:'rgba(0,0,0,0.6)',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,overflow:'hidden'}}>
        <span className="hud-label" style={{fontSize:8,color:'rgba(255,255,255,0.28)',letterSpacing:'0.18em',marginRight:10,whiteSpace:'nowrap'}}>JARVIS PRO</span>
        <div style={{flex:1,display:'flex',gap:0,overflow:'hidden'}}>
          {liveTickers.length===0&&[{symbol:'BTC/USD',price:0,change24h:0},{symbol:'ETH/USD',price:0,change24h:0}].map(t=>(
            <div key={t.symbol} style={{display:'flex',alignItems:'center',gap:5,padding:'0 10px',borderRight:'1px solid rgba(255,255,255,0.04)',whiteSpace:'nowrap'}}>
              <span className="hud-label" style={{fontSize:7.5,color:'rgba(255,255,255,0.4)',letterSpacing:'0.08em'}}>{t.symbol}</span>
              <span className="font-mono" style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>...</span>
            </div>
          ))}
          {liveTickers.map(t=>{
            const sym=t.symbol.replace('USDT','/USD').replace(/^([A-Z]{2,5})(USD)$/,'$1/$2');
            const pos=t.change24h>=0;
            const isActive=t.symbol===activeSymbol;
            return (
              <div key={t.symbol}
                onClick={()=>selectSymbol(t.symbol)}
                style={{display:'flex',alignItems:'center',gap:5,padding:'0 10px',borderRight:'1px solid rgba(255,255,255,0.04)',whiteSpace:'nowrap',cursor:'pointer',background:isActive?'rgba(0,229,255,0.08)':'transparent',borderBottom:isActive?`1px solid ${CYAN_BRIGHT}`:'1px solid transparent',transition:'background 0.15s'}}
                title={`Set active: ${t.symbol}`}
              >
                <span className="hud-label" style={{fontSize:7.5,color:isActive?CYAN_BRIGHT:'rgba(255,255,255,0.4)',letterSpacing:'0.08em'}}>{sym}</span>
                <span className="font-mono" style={{fontSize:9,color:isActive?'#fff':'rgba(255,255,255,0.8)'}}>{'$'+t.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                <span className="font-mono" style={{fontSize:8.5,color:pos?'#00d084':'#ff1a6b'}}>{pos?'+':''}{t.change24h.toFixed(2)}%</span>
              </div>
            );
          })}
        </div>
        <div style={{display:'flex',gap:4,marginLeft:8,alignItems:'center',flexShrink:0}}>
          {/* Active symbol indicator */}
          {activeSymbol!=='BTCUSD'&&<span className="hud-label" style={{fontSize:7.5,color:CYAN_BRIGHT,border:`1px solid ${CYAN_BRIGHT}55`,padding:'1px 6px',letterSpacing:'0.12em'}}>{activeSymbol}</span>}
          {tab==='TERMINAL'&&[{l:'WIDGETS',fn:()=>setShowLibrary(v=>!v)},{l:'SETTINGS',fn:()=>setShowSettings(v=>!v)}].map(btn=>(
            <button key={btn.l} onClick={btn.fn} className="hud-label" style={{padding:'3px 9px',fontSize:7.5,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.55)',cursor:'pointer',letterSpacing:'0.12em'}}>{btn.l}</button>
          ))}
          <button onClick={toggleMt5} className="hud-label" style={{padding:'3px 7px',fontSize:7.5,border:`1px solid ${mt5Open?'rgba(0,229,255,0.35)':'rgba(255,255,255,0.12)'}`,background:mt5Open?'rgba(0,229,255,0.06)':'rgba(255,255,255,0.03)',color:mt5Open?CYAN_BRIGHT:'rgba(255,255,255,0.3)',cursor:'pointer',letterSpacing:'0.12em'}} title="Toggle MT5 connector">MT5 {mt5Open?'▲':'▼'}</button>
        </div>
      </div>

      {/* ── MT5 connector strip (collapsible) ─────────────────────── */}
      {mt5Open && <ZeusBotMiniPlayer/>}

      {/* ── MT5 error banner ─────────────────────────────────────────── */}
      {mt5Err && !connected && (
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 12px',background:'rgba(255,26,107,0.08)',borderBottom:'1px solid rgba(255,26,107,0.35)',flexShrink:0}}>
          <span style={{fontSize:9,color:'#ff1a6b',fontFamily:'JetBrains Mono',letterSpacing:'0.12em'}}>⚠ MT5 BRIDGE OFFLINE — {mt5Err}</span>
          <span style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontFamily:'JetBrains Mono',marginLeft:'auto'}}>Start ZeusBot bridge on port 1234 to activate live trading</span>
        </div>
      )}

      {/* ── Tab strip ─────────────────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'flex-end',padding:'0 8px',height:28,background:'rgba(0,0,0,0.4)',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,gap:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className="hud-label"
            style={{
              padding:'4px 16px', fontSize:8, cursor:'pointer', letterSpacing:'0.18em',
              border:`1px solid ${tab===t.id?t.color+'88':'rgba(255,255,255,0.08)'}`,
              borderBottom: tab===t.id?'1px solid transparent':'1px solid rgba(255,255,255,0.08)',
              background: tab===t.id?t.color+'12':'transparent',
              color: tab===t.id?t.color:'rgba(255,255,255,0.3)',
              position:'relative', top:1,
              transition:'color 0.15s, background 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── TERMINAL tab ──────────────────────────────────────────── */}
      {tab==='TERMINAL' && (
        <div style={{flex:1,overflow:'auto',padding:6}} className="nx-scroll">
          {layout.map((row,ri)=>(
            <div key={ri} style={{display:'grid',gridTemplateColumns:`repeat(${row.length},1fr)`,gap:5,marginBottom:5}}>
              {row.map((wid,ci)=>(
                <div
                  key={wid}
                  draggable
                  onDragStart={()=>setDragSrc([ri,ci])}
                  onDragOver={e=>e.preventDefault()}
                  onDrop={()=>{ if(dragSrc)swapWidgets(dragSrc[0],dragSrc[1],ri,ci); setDragSrc(null); }}
                  style={{minHeight:260,cursor:'grab',position:'relative'}}
                >
                  <WidgetCell id={wid} connected={connected} livePrice={livePrice} posRows={posRows} balance={balance} equityArr={equityArr} onRemove={removeWidget} activeSymbol={activeSymbol}/>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── MY SETUP tab ──────────────────────────────────────────── */}
      {tab==='MY_SETUP' && (
        <MySetupTab connected={connected} posRows={posRows} balance={balance} equityArr={equityArr} livePrice={livePrice} activeSymbol={activeSymbol}/>
      )}

      {/* ── GODMODE tab ───────────────────────────────────────────── */}
      {tab==='GODMODE' && <GodModeTab connected={connected} onNavigate={setTab} onSymbolSelect={selectSymbol}/>}

      {showSettings&&<SettingsPanel onClose={()=>setShowSettings(false)}/>}
      {showLibrary&&tab==='TERMINAL'&&<WidgetLibraryPanel activeIds={activeIds} onAdd={addWidget} onRemove={removeWidget} onClose={()=>setShowLibrary(false)}/>}
    </div>
  );
}

/* ── Content module — AI-powered workflows ───────────────────────────────── */

const CONTENT_CHANNELS = [
  { id: 'YT',  name: 'YouTube',    color: ROSE,    accent: 'VIDEO · LONG-FORM · DEEP DIVE',   brief: 'Explain ZeusBot strategy or AI trading system in depth, engaging, with clear steps and numbers.' },
  { id: 'X',   name: 'X / Twitter', color: 'var(--fg)', accent: 'THREAD · VIRAL HOOK',       brief: 'Write a viral trading/AI thread. Hook + 7 substantive tweets + CTA. Include numbers and insight.' },
  { id: 'IG',  name: 'Instagram',  color: '#e879f9', accent: 'REEL · CAPTION · HOOK',         brief: 'Punchy IG caption + 5 strong hooks for reel about AI trading or portfolio. Include emojis.' },
  { id: 'NWS', name: 'Newsletter', color: AMBER,   accent: 'EMAIL · ANALYSIS · ALPHA',        brief: 'Weekly newsletter: markets update, ZeusBot P&L, 3 trade ideas, one chart insight. 400 words.' },
  { id: 'TW',  name: 'Twitch',     color: VIOLET,  accent: 'STREAM · TITLE · ANNOUNCE',       brief: 'Write a Twitch stream title, description, and chat announcement for a live AI trading session.' },
];

const RESEARCH_TOPICS = [
  'Carry trade unwinding and JPY volatility impact',
  'Fed rate path probability after latest CPI print',
  'AI agent orchestration in quant trading systems',
  'DXY correlation with gold and risk-off assets 2025',
  'Institutional options flow — put/call imbalance signals',
  'Liquidity sweeps and smart money concepts — practical guide',
  'ZeusBot v0.41 — strategy performance breakdown',
  'Multi-asset momentum vs mean-reversion regimes',
];

const MARKET_SCANNERS = [
  { sym: 'EURUSD', type: 'FX',     signal: 'BIAS SHORT', reason: 'DXY strength + ECB dovish pivot risk', str: 87 },
  { sym: 'XAUUSD', type: 'COMMOD', signal: 'BIAS LONG',  reason: 'Risk-off flows + real yield decline',  str: 74 },
  { sym: 'NAS100', type: 'INDEX',  signal: 'NEUTRAL',    reason: 'Mixed earnings, AI stocks vs yields',   str: 52 },
  { sym: 'BTCUSD', type: 'CRYPTO', signal: 'BIAS LONG',  reason: 'ETF inflows + halving supply shock',   str: 68 },
  { sym: 'GBPUSD', type: 'FX',     signal: 'BIAS SHORT', reason: 'UK growth stagnation + BoE on hold',   str: 61 },
  { sym: 'USDJPY', type: 'FX',     signal: 'VOLATILE',   reason: 'BoJ intervention risk + carry unwind', str: 39 },
  { sym: 'USOIL',  type: 'COMMOD', signal: 'NEUTRAL',    reason: 'OPEC+ cuts offset by demand fears',    str: 55 },
  { sym: 'SP500',  type: 'INDEX',  signal: 'BIAS LONG',  reason: 'Earnings season beat + buybacks',      str: 71 },
];

const RISK_PRESETS = [
  { label: '1% Risk',  factor: 0.01 },
  { label: '2% Risk',  factor: 0.02 },
  { label: '0.5% Risk', factor: 0.005 },
];

function signalColor(s: string) {
  return s === 'BIAS LONG' ? JADE : s === 'BIAS SHORT' ? ROSE : s === 'VOLATILE' ? AMBER : 'var(--cyan-dim)';
}

type ContentTab = 'MARKET SCANNER' | 'AI CONTENT' | 'RISK CALC' | 'ALPHA RESEARCH';

export function ContentScreen({ onNav }: ScreenProps) {
  const [tab, setTab] = useState<ContentTab>('MARKET SCANNER');

  // AI Content state
  const [selectedChannel, setSelectedChannel] = useState(CONTENT_CHANNELS[0]);
  const [customBrief, setCustomBrief] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Research state
  const [researchTopic, setResearchTopic] = useState('');
  const [researching, setResearching] = useState(false);
  const [researchResult, setResearchResult] = useState('');

  // Risk Calc state
  const [accountBalance, setAccountBalance] = useState('10000');
  const [riskPct, setRiskPct] = useState('1');
  const [entryPrice, setEntryPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [posSize, setPosSize] = useState<string | null>(null);

  async function generateContent() {
    setGenerating(true);
    setDraft('');
    setCopiedDraft(false);
    try {
      const brief = customBrief || selectedChannel.brief;
      const result = await runContent(brief, selectedChannel.name);
      setDraft(result);
    } catch (e) {
      setDraft(`Error: ${String(e)}`);
    }
    setGenerating(false);
  }

  async function runResearchQuery() {
    if (!researchTopic.trim()) return;
    setResearching(true);
    setResearchResult('');
    try {
      const result = await runResearch(researchTopic.trim());
      setResearchResult(result);
    } catch (e) {
      setResearchResult(`Error: ${String(e)}`);
    }
    setResearching(false);
  }

  function calcPosition() {
    const bal = parseFloat(accountBalance);
    const rPct = parseFloat(riskPct) / 100;
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(slPrice);
    if (!bal || !rPct || !entry || !sl || entry === sl) { setPosSize('Invalid inputs'); return; }
    const riskAmount = bal * rPct;
    const pips = Math.abs(entry - sl);
    const units = riskAmount / pips;
    setPosSize(`${units.toFixed(2)} units  ·  Risk $${riskAmount.toFixed(2)}`);
  }

  function copyDraft() {
    navigator.clipboard?.writeText(draft);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  }

  function openPlatform() {
    const urls: Record<string, string> = {
      YT: 'https://studio.youtube.com',
      X: 'https://twitter.com/compose/tweet',
      IG: 'https://www.instagram.com',
      NWS: 'https://app.mailchimp.com',
      TW: 'https://www.twitch.tv/dashboard',
    };
    const url = urls[selectedChannel.id];
    if (url) window.open(url, '_blank');
  }

  const tabs: ContentTab[] = ['MARKET SCANNER', 'AI CONTENT', 'RISK CALC', 'ALPHA RESEARCH'];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ScreenHeader
        tag="TRADING INTELLIGENCE"
        title="MARKET SCANNER · AI CONTENT · RISK · RESEARCH"
        subtitle="Live signal scanner + AI-powered content studio + position size calculator + deep research engine."
        right={
          <button onClick={() => onNav('workflows')} className="hud-label"
            style={{ padding: '8px 14px', fontSize: 10, color: AMBER, border: `1px solid ${AMBER}80`, letterSpacing: '0.32em', cursor: 'pointer' }}>
            ▶ WORKFLOWS →
          </button>
        }
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--line)', paddingBottom: 0, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className="hud-label"
            style={{
              padding: '8px 14px', fontSize: 9, cursor: 'pointer', letterSpacing: '0.22em',
              color: tab === t ? CYAN_BRIGHT : 'var(--cyan-dim)',
              borderBottom: tab === t ? `2px solid ${CYAN_BRIGHT}` : '2px solid transparent',
              background: 'none',
            }}>
            {t}
          </button>
        ))}
      </div>

      <div className="nx-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

        {/* ── MARKET SCANNER ── */}
        {tab === 'MARKET SCANNER' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <HoloPanel label="SIGNAL SCANNER · AI BIAS" code="SCAN-Σ" status="live">
              <div style={{ display: 'grid', gridTemplateColumns: '80px 56px 100px 1fr 80px', gap: 0, padding: '0 0 6px', borderBottom: '1px solid var(--line)' }} className="hud-label">
                <span style={{ fontSize: 8 }}>SYMBOL</span>
                <span style={{ fontSize: 8 }}>TYPE</span>
                <span style={{ fontSize: 8 }}>SIGNAL</span>
                <span style={{ fontSize: 8, paddingLeft: 8 }}>AI CONTEXT</span>
                <span style={{ fontSize: 8, textAlign: 'right' }}>STRENGTH</span>
              </div>
              {MARKET_SCANNERS.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 56px 100px 1fr 80px', alignItems: 'center', padding: '9px 0', borderBottom: '1px dashed var(--line-soft)' }}>
                  <span className="font-mono glow-cyan-sm" style={{ fontSize: 11, color: CYAN_BRIGHT }}>{s.sym}</span>
                  <span className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.16em' }}>{s.type}</span>
                  <span className="hud-label" style={{ fontSize: 8.5, color: signalColor(s.signal), letterSpacing: '0.1em' }}>{s.signal}</span>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg-dim)', paddingLeft: 8, paddingRight: 12, lineHeight: 1.4 }}>{s.reason}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 48, height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${s.str}%`, height: '100%', background: signalColor(s.signal), borderRadius: 2 }} />
                      </div>
                      <span className="font-mono" style={{ fontSize: 9, color: signalColor(s.signal) }}>{s.str}</span>
                    </div>
                  </div>
                </div>
              ))}
            </HoloPanel>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <HoloPanel label="LONGS · CONVICTION" code="LNG-Σ" status="live">
                {MARKET_SCANNERS.filter(s => s.signal === 'BIAS LONG').map((s, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="font-mono glow-cyan-sm" style={{ fontSize: 12, color: JADE }}>{s.sym}</div>
                      <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', marginTop: 2 }}>{s.reason}</div>
                    </div>
                    <div className="hud-label" style={{ fontSize: 9, color: JADE, letterSpacing: '0.2em' }}>{s.str}%</div>
                  </div>
                ))}
              </HoloPanel>
              <HoloPanel label="SHORTS · CONVICTION" code="SHT-Σ" status="warn">
                {MARKET_SCANNERS.filter(s => s.signal === 'BIAS SHORT').map((s, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="font-mono" style={{ fontSize: 12, color: ROSE }}>{s.sym}</div>
                      <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', marginTop: 2 }}>{s.reason}</div>
                    </div>
                    <div className="hud-label" style={{ fontSize: 9, color: ROSE, letterSpacing: '0.2em' }}>{s.str}%</div>
                  </div>
                ))}
              </HoloPanel>
            </div>
          </div>
        )}

        {/* ── AI CONTENT STUDIO ── */}
        {tab === 'AI CONTENT' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <HoloPanel label="AI CONTENT STUDIO · CLAUDE" code="CNT-AI" status="live">
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                Select a channel → customize the brief → generate AI-powered content → copy to clipboard or open platform directly.
              </div>

              {/* Channel selector */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {CONTENT_CHANNELS.map(ch => (
                  <button key={ch.id} onClick={() => { setSelectedChannel(ch); setDraft(''); setCustomBrief(''); }} className="hud-label"
                    style={{
                      padding: '6px 14px', fontSize: 9, cursor: 'pointer', letterSpacing: '0.22em',
                      color: selectedChannel.id === ch.id ? '#0d1117' : ch.color,
                      background: selectedChannel.id === ch.id ? ch.color : 'transparent',
                      border: `1px solid ${ch.color}60`,
                    }}>
                    {ch.id}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 6 }}>CHANNEL: {selectedChannel.name.toUpperCase()}</div>
                <div className="font-mono" style={{ fontSize: 9.5, color: selectedChannel.color, marginBottom: 10 }}>{selectedChannel.accent}</div>
                <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4 }}>CONTENT BRIEF (edit to customize)</div>
                <textarea
                  value={customBrief || selectedChannel.brief}
                  onChange={e => setCustomBrief(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 10.5, background: 'oklch(0.05 0.01 240 / 0.8)', border: '1px solid var(--line)', color: 'var(--fg)', outline: 'none', fontFamily: 'var(--font-mono)', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button onClick={generateContent} disabled={generating} className="hud-label"
                  style={{ padding: '8px 18px', fontSize: 9.5, color: generating ? 'var(--cyan-dim)' : CYAN_BRIGHT, border: `1px solid ${CYAN}60`, cursor: generating ? 'not-allowed' : 'pointer', letterSpacing: '0.22em', background: generating ? 'transparent' : `${CYAN}0a` }}>
                  {generating ? '◌ GENERATING…' : '◆ GENERATE WITH CLAUDE'}
                </button>
              </div>

              {draft && (
                <div className="anim-fade-in" style={{ border: `1px solid ${selectedChannel.color}40`, background: `oklch(0.07 0.012 240 / 0.6)`, padding: 14, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div className="hud-label" style={{ fontSize: 8.5, color: selectedChannel.color, letterSpacing: '0.24em' }}>◆ {selectedChannel.name.toUpperCase()} DRAFT</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={copyDraft} className="hud-label"
                        style={{ padding: '4px 10px', fontSize: 8, color: copiedDraft ? JADE : CYAN_BRIGHT, border: `1px solid ${copiedDraft ? JADE : CYAN}60`, cursor: 'pointer', letterSpacing: '0.16em' }}>
                        {copiedDraft ? '✓ COPIED' : '⎘ COPY'}
                      </button>
                      <button onClick={openPlatform} className="hud-label"
                        style={{ padding: '4px 10px', fontSize: 8, color: selectedChannel.color, border: `1px solid ${selectedChannel.color}60`, cursor: 'pointer', letterSpacing: '0.16em' }}>
                        ↗ OPEN {selectedChannel.id}
                      </button>
                    </div>
                  </div>
                  <pre className="font-mono" style={{ fontSize: 10.5, color: 'var(--fg)', whiteSpace: 'pre-wrap', lineHeight: 1.65, margin: 0 }}>{draft}</pre>
                </div>
              )}
            </HoloPanel>
          </div>
        )}

        {/* ── RISK CALCULATOR ── */}
        {tab === 'RISK CALC' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <HoloPanel label="POSITION SIZE CALCULATOR" code="RISK-Ψ" status="live">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'ACCOUNT BALANCE ($)', val: accountBalance, set: setAccountBalance, placeholder: '10000' },
                  { label: 'RISK % PER TRADE', val: riskPct, set: setRiskPct, placeholder: '1' },
                  { label: 'ENTRY PRICE', val: entryPrice, set: setEntryPrice, placeholder: '1.0850' },
                  { label: 'STOP LOSS PRICE', val: slPrice, set: setSlPrice, placeholder: '1.0800' },
                ].map(({ label, val, set, placeholder }) => (
                  <div key={label}>
                    <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4 }}>{label}</div>
                    <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                      style={{ width: '100%', padding: '7px 10px', fontSize: 11, background: 'oklch(0.05 0.01 240 / 0.8)', border: '1px solid var(--line)', color: 'var(--fg)', outline: 'none', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }} />
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {RISK_PRESETS.map(p => (
                    <button key={p.label} onClick={() => setRiskPct(String(p.factor * 100))} className="hud-label"
                      style={{ padding: '4px 10px', fontSize: 8, color: CYAN_BRIGHT, border: `1px solid ${CYAN}40`, cursor: 'pointer', letterSpacing: '0.16em' }}>
                      {p.label}
                    </button>
                  ))}
                </div>

                <button onClick={calcPosition} className="hud-label"
                  style={{ padding: '8px 18px', fontSize: 9.5, color: JADE, border: `1px solid ${JADE}60`, cursor: 'pointer', letterSpacing: '0.22em', background: `${JADE}0a` }}>
                  ◆ CALCULATE POSITION
                </button>

                {posSize && (
                  <div className="anim-fade-in" style={{ padding: '12px 14px', border: `1px solid ${JADE}60`, background: `${JADE}0a` }}>
                    <div className="hud-label" style={{ fontSize: 8.5, color: JADE, letterSpacing: '0.24em', marginBottom: 4 }}>RESULT</div>
                    <div className="font-mono glow-cyan" style={{ fontSize: 14, color: JADE }}>{posSize}</div>
                  </div>
                )}
              </div>
            </HoloPanel>

            <HoloPanel label="RISK GUIDELINES · ZeusBot RULES" code="RISK-Δ">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['MAX RISK / TRADE', '1–2% of account'],
                  ['MAX DAILY DRAWDOWN', '5% hard stop'],
                  ['MAX OPEN POSITIONS', '8 concurrent'],
                  ['R:R MINIMUM', '1:1.5 or higher'],
                  ['CORR. LIMIT', 'No >3 correlated pairs'],
                  ['VOLATILITY FILTER', 'ATR > threshold to trade'],
                  ['NEWS BLACKOUT', '±30 min major releases'],
                  ['SESSION PRIORITY', 'London + NY overlap'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px dashed var(--line-soft)', paddingBottom: 6 }}>
                    <span className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.18em' }}>{k}</span>
                    <span className="font-mono" style={{ fontSize: 10.5, color: CYAN_BRIGHT }}>{v}</span>
                  </div>
                ))}
              </div>
            </HoloPanel>
          </div>
        )}

        {/* ── ALPHA RESEARCH ── */}
        {tab === 'ALPHA RESEARCH' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <HoloPanel label="DEEP RESEARCH ENGINE · CLAUDE" code="RSC-Ω" status="live">
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                Type any market / trading topic and Claude will deliver institutional-level analysis.
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {RESEARCH_TOPICS.map((t, i) => (
                  <button key={i} onClick={() => setResearchTopic(t)} className="font-mono"
                    style={{ padding: '4px 10px', fontSize: 9, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', cursor: 'pointer', background: 'transparent', textAlign: 'left' }}>
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input type="text" value={researchTopic} onChange={e => setResearchTopic(e.target.value)}
                  placeholder="Enter any market research topic…"
                  onKeyDown={e => e.key === 'Enter' && runResearchQuery()}
                  style={{ flex: 1, padding: '8px 12px', fontSize: 11, background: 'oklch(0.05 0.01 240 / 0.8)', border: '1px solid var(--line)', color: 'var(--fg)', outline: 'none', fontFamily: 'var(--font-mono)' }} />
                <button onClick={runResearchQuery} disabled={researching || !researchTopic.trim()} className="hud-label"
                  style={{ padding: '8px 18px', fontSize: 9.5, color: researching ? 'var(--cyan-dim)' : AMBER, border: `1px solid ${AMBER}60`, cursor: researching ? 'not-allowed' : 'pointer', letterSpacing: '0.22em', whiteSpace: 'nowrap' }}>
                  {researching ? '◌ RESEARCHING…' : '◆ RUN RESEARCH'}
                </button>
              </div>

              {researchResult && (
                <div className="anim-fade-in" style={{ border: `1px solid ${AMBER}40`, background: 'oklch(0.07 0.012 240 / 0.6)', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div className="hud-label" style={{ fontSize: 8.5, color: AMBER, letterSpacing: '0.24em' }}>◆ RESEARCH RESULT</div>
                    <button onClick={() => navigator.clipboard?.writeText(researchResult)} className="hud-label"
                      style={{ padding: '3px 8px', fontSize: 8, color: CYAN_BRIGHT, border: `1px solid ${CYAN}40`, cursor: 'pointer', letterSpacing: '0.12em' }}>
                      ⎘ COPY
                    </button>
                  </div>
                  <pre className="font-mono" style={{ fontSize: 10.5, color: 'var(--fg)', whiteSpace: 'pre-wrap', lineHeight: 1.65, margin: 0 }}>{researchResult}</pre>
                </div>
              )}
            </HoloPanel>
          </div>
        )}

      </div>
    </div>
  );
}
