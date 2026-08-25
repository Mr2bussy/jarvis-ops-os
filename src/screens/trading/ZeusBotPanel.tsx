// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET } from '../../theme';
import { HoloPanel, Sparkline } from '../../components/primitives';

/* ── ZeusBot strategies ────────────────────────────────────────────────── */
type StratStatus = 'live' | 'paused' | 'testing' | 'disabled';

interface ZeusStrategy {
  id: string;
  name: string;
  desc: string;
  markets: string;
  risk: string;
  winRate: string;
  avgReturn: string;
  color: string;
  status: StratStatus;
}

const ZEUS_STRATEGIES: ZeusStrategy[] = [
  {
    id: 'ZS-01',
    name: 'Mean Reversion',
    desc: 'Fades overextended moves on 1h-4h timeframe. Uses Bollinger + RSI divergence.',
    markets: 'BTC ETH SOL',
    risk: '1.2%',
    winRate: '64%',
    avgReturn: '+0.8%/trade',
    color: JADE,
    status: 'live',
  },
  {
    id: 'ZS-02',
    name: 'Momentum Rider',
    desc: 'Rides strong trends via EMA crossover + volume confirmation. ATR-based stops.',
    markets: 'ALL PAIRS',
    risk: '1.8%',
    winRate: '58%',
    avgReturn: '+1.4%/trade',
    color: CYAN_BRIGHT,
    status: 'live',
  },
  {
    id: 'ZS-03',
    name: 'Funding-Rate Arb',
    desc: 'Exploits funding-rate differentials between perp and spot on major CEXs.',
    markets: 'BTC ETH',
    risk: '0.6%',
    winRate: '72%',
    avgReturn: '+0.3%/trade',
    color: AMBER,
    status: 'live',
  },
  {
    id: 'ZS-04',
    name: 'Breakout Hunter',
    desc: 'Captures range breakouts with volume surge confirmation. Pyramids on strength.',
    markets: 'ALTCOINS',
    risk: '2.0%',
    winRate: '51%',
    avgReturn: '+2.1%/trade',
    color: VIOLET,
    status: 'testing',
  },
  {
    id: 'ZS-05',
    name: 'Grid Scalper',
    desc: 'High-frequency grid on tight BTC/USD range. 14ms tick. Hundreds of fills/day.',
    markets: 'BTC/USD',
    risk: '0.4%',
    winRate: '80%',
    avgReturn: '+0.12%/fill',
    color: '#00e5ff',
    status: 'live',
  },
  {
    id: 'ZS-06',
    name: 'Delta-Neutral MM',
    desc: 'Options-style market-making: long gamma, hedges delta every 60s via perp.',
    markets: 'BTC ETH OPTIONS',
    risk: '0.8%',
    winRate: '—',
    avgReturn: '+Theta/day',
    color: '#e879f9',
    status: 'paused',
  },
  {
    id: 'ZS-07',
    name: 'Sentiment Overlay',
    desc: 'Derives net-bias from Fear/Greed + social volume. Adjusts all strategy sizing.',
    markets: 'GLOBAL BIAS',
    risk: '—',
    winRate: '—',
    avgReturn: 'Multiplier',
    color: AMBER,
    status: 'live',
  },
  {
    id: 'ZS-08',
    name: 'VWAP Band Fade',
    desc: 'Fades intraday deviations from VWAP ±2σ. 15min chart. Targets reversion.',
    markets: 'EURUSD DAX',
    risk: '1.0%',
    winRate: '67%',
    avgReturn: '+0.6%/trade',
    color: JADE,
    status: 'testing',
  },
  {
    id: 'ZS-09',
    name: 'News Alpha Bot',
    desc: 'Scans headlines via JARVIS news feed. Enters immediately on key catalysts.',
    markets: 'CRYPTO MACRO',
    risk: '1.5%',
    winRate: '55%',
    avgReturn: '+1.8%/event',
    color: '#c8fb4e',
    status: 'disabled',
  },
];

// ── Real-time MT5 data hook ─────────────────────────────────────────────────
type PosRow = {
  sym: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entry: string;
  mark: string;
  pnl: string;
  pct: string;
  up: boolean;
  bot: string;
};
type LogRow = [string, string, string, string, string];

/** Module-level event bus: ZeusBotMiniPlayer fires this after a successful connect */
const MT5_CONNECTED_EVENT = 'mt5:connected';

function useMt5LiveData() {
  const [positions, setPositions] = useState<PosRow[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [equity, setEquity] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastErr, setLastErr] = useState('');

  useEffect(() => {
    let alive = true;
    let ivId: number;

    async function poll() {
      // Read MT5 config from safeStorage (falls back to defaults)
      let host = 'localhost',
        port = 1234;
      try {
        const cfg = await window.jarvisBridge.config?.getMt5?.();
        if (cfg) {
          host = cfg.host;
          port = cfg.port;
        }
      } catch {
        host = 'localhost';
        port = 1234;
      }
      // allow polling regardless of zeus.mode so TradingScreen stays in sync
      try {
        const r = await window.jarvisBridge.mt5({ host, port, endpoint: 'positions' });
        if (!alive) return;
        if (r.ok && Array.isArray(r.data)) {
          const mapped: PosRow[] = (r.data as any[]).map((p) => {
            const profit: number = typeof p.profit === 'number' ? p.profit : 0;
            const openP: number = typeof p.price_open === 'number' ? p.price_open : 1;
            const vol: number = p.volume ?? 1;
            const pctVal = openP > 0 ? (profit / (openP * vol)) * 100 : 0;
            const dec = openP > 100 ? 2 : 5;
            return {
              sym: p.symbol || '—',
              side: p.type === 0 ? 'LONG' : 'SHORT',
              size: String(vol),
              entry: openP.toFixed(dec),
              mark: ((p.price_current ?? openP) as number).toFixed(dec),
              pnl: (profit >= 0 ? '+' : '') + profit.toFixed(2),
              pct: (pctVal >= 0 ? '+' : '') + pctVal.toFixed(2) + '%',
              up: profit >= 0,
              bot: 'ZeusBot',
            };
          });
          setPositions(mapped);
          setConnected(true);
          setLastErr('');
        } else {
          if (alive) {
            setConnected(false);
            setPositions([]);
            setLastErr(r.err || `HTTP ${r.status}`);
          }
          return;
        }
      } catch (e: any) {
        if (alive) {
          setConnected(false);
          setPositions([]);
          setLastErr(String(e?.message || e));
        }
        return;
      }
      try {
        const a = await window.jarvisBridge.mt5({ host, port, endpoint: 'account' });
        if (!alive) return;
        if (a.ok && a.data && typeof (a.data as any).equity === 'number') {
          setEquity((prev) => {
            const arr = [...prev, (a.data as any).equity as number];
            return arr.length > 80 ? arr.slice(-80) : arr;
          });
        }
      } catch {
        /* skip */
      }
      try {
        const h = await window.jarvisBridge.mt5({ host, port, endpoint: 'history' });
        if (!alive) return;
        if (h.ok && Array.isArray(h.data)) {
          setLog(
            (h.data as any[]).slice(0, 12).map((d: any) => {
              const ts = d.time ? new Date(d.time * 1000).toTimeString().slice(0, 8) : '—';
              return [
                ts,
                d.entry === 0 ? 'ENTRY' : 'EXIT',
                d.symbol || '—',
                `${d.type === 0 ? 'BUY' : 'SELL'} ${d.volume ?? ''} @ ${d.price ?? '—'}`,
                'ZeusBot',
              ] as LogRow;
            }),
          );
        }
      } catch {
        /* history endpoint may not exist */
      }
    }

    function onConnected() {
      poll();
    }

    poll();
    ivId = window.setInterval(poll, 5000);
    window.addEventListener(MT5_CONNECTED_EVENT, onConnected);
    return () => {
      alive = false;
      window.clearInterval(ivId);
      window.removeEventListener(MT5_CONNECTED_EVENT, onConnected);
    };
  }, []);
  return { positions, log, equity, connected, lastErr };
}

function StrategiesPanel() {
  const [active, setActive] = useState<Set<string>>(
    () => new Set(ZEUS_STRATEGIES.filter((s) => s.status === 'live').map((s) => s.id)),
  );
  const [selected, setSelected] = useState<ZeusStrategy | null>(null);

  function toggle(id: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const statusColor = (s: StratStatus) =>
    s === 'live' ? JADE : s === 'testing' ? AMBER : s === 'paused' ? VIOLET : 'var(--cyan-dim)';

  return (
    <HoloPanel
      label="ZEUSBOT · ALL STRATEGIES"
      code="STR-Σ"
      status="live"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ padding: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 7.5,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.22em',
            color: AMBER,
            background: `${AMBER}18`,
            border: `1px solid ${AMBER}44`,
            padding: '2px 7px',
          }}
        >
          CATALOG · NOT CONNECTED TO MT5
        </span>
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--cyan-dim)' }}>
          Toggles are local until ZEUS bot is connected via CONNECT
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1, minHeight: 0 }}>
        {/* strategy list */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}
          className="nx-scroll"
        >
          {ZEUS_STRATEGIES.map((s) => {
            const on = active.has(s.id);
            const isSel = selected?.id === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setSelected(isSel ? null : s)}
                style={{
                  padding: '8px 10px',
                  cursor: 'pointer',
                  border: `1px solid ${isSel ? s.color : 'var(--line-soft)'}`,
                  background: isSel ? `oklch(0.09 0.018 240 / 0.9)` : 'oklch(0.07 0.012 240 / 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'border-color 0.15s',
                }}
              >
                {/* toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(s.id);
                  }}
                  disabled={s.status === 'disabled'}
                  style={{
                    width: 28,
                    height: 14,
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    background: on && s.status !== 'disabled' ? s.color : 'oklch(0.3 0.04 215)',
                    flexShrink: 0,
                    transition: 'background 0.2s',
                    opacity: s.status === 'disabled' ? 0.4 : 1,
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: on ? 16 : 2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'white',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      className="hud-label"
                      style={{
                        fontSize: 9.5,
                        color: on ? s.color : 'var(--cyan-dim)',
                        letterSpacing: '0.12em',
                      }}
                    >
                      {s.name}
                    </span>
                    <span
                      className="font-mono"
                      style={{ fontSize: 8, color: statusColor(s.status), marginLeft: 4 }}
                    >
                      {s.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)', marginTop: 1 }}>
                    {s.markets} · WR {s.winRate}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* detail pane */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selected ? (
            <div className="anim-fade-up">
              <div
                className="hud-label"
                style={{ fontSize: 9, color: selected.color, letterSpacing: '0.28em', marginBottom: 6 }}
              >
                {selected.id}
              </div>
              <div className="hud-label" style={{ fontSize: 13, color: 'var(--fg)', marginBottom: 6 }}>
                {selected.name}
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 9.5, color: 'var(--cyan-dim)', lineHeight: 1.55, marginBottom: 10 }}
              >
                {selected.desc}
              </div>
              {[
                ['MARKETS', selected.markets],
                ['RISK/TRADE', selected.risk],
                ['WIN RATE', selected.winRate],
                ['AVG RETURN', selected.avgReturn],
                ['STATUS', selected.status.toUpperCase()],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '5px 0',
                    borderBottom: '1px dashed var(--line-soft)',
                  }}
                >
                  <span className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)' }}>
                    {k}
                  </span>
                  <span className="font-mono" style={{ fontSize: 9.5, color: selected.color }}>
                    {v}
                  </span>
                </div>
              ))}
              <button
                onClick={() => setSelected(null)}
                className="hud-label"
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '6px',
                  fontSize: 8.5,
                  color: 'var(--cyan-dim)',
                  border: '1px solid var(--line-soft)',
                  background: 'transparent',
                  letterSpacing: '0.2em',
                  cursor: 'pointer',
                }}
              >
                CLOSE
              </button>
            </div>
          ) : (
            <div>
              <div
                className="hud-label"
                style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.22em', marginBottom: 10 }}
              >
                STRATEGY SUMMARY
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div className="holo" style={{ padding: '10px 12px' }}>
                  <div className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)' }}>
                    LIVE
                  </div>
                  <div className="font-mono" style={{ fontSize: 18, color: JADE }}>
                    {ZEUS_STRATEGIES.filter((s) => s.status === 'live').length}
                  </div>
                </div>
                <div className="holo" style={{ padding: '10px 12px' }}>
                  <div className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)' }}>
                    TESTING
                  </div>
                  <div className="font-mono" style={{ fontSize: 18, color: AMBER }}>
                    {ZEUS_STRATEGIES.filter((s) => s.status === 'testing').length}
                  </div>
                </div>
                <div className="holo" style={{ padding: '10px 12px' }}>
                  <div className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)' }}>
                    ACTIVE NOW
                  </div>
                  <div className="font-mono" style={{ fontSize: 18, color: CYAN_BRIGHT }}>
                    {active.size}
                  </div>
                </div>
                <div className="holo" style={{ padding: '10px 12px' }}>
                  <div className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)' }}>
                    STRATS TOTAL
                  </div>
                  <div className="font-mono" style={{ fontSize: 18, color: 'var(--fg)' }}>
                    {ZEUS_STRATEGIES.length}
                  </div>
                </div>
              </div>
              <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', lineHeight: 1.55 }}>
                Click a strategy to inspect. Toggle to arm/disarm.
                <br />
                Changes are local — connect ZEUS bot to activate live execution.
              </div>
            </div>
          )}
        </div>
      </div>
    </HoloPanel>
  );
}

interface Mt5Acct {
  login: number;
  name: string;
  balance: number;
  equity: number;
  profit: number;
  margin: number;
  free_margin: number;
  leverage: number;
  currency: string;
}

export function ZeusBotMiniPlayer() {
  // ── Refs for stable closures in intervals/timeouts ──
  const hostRef = useRef('localhost');
  const portRef = useRef(1234);
  const runRef = useRef(false); // mirrors running state for interval closures
  const dbRef = useRef(localStorage.getItem('zeus.dauerbetrieb') === '1'); // dauerbetrieb ref

  const [host, setHostState] = useState('localhost');
  const [port, setPortState] = useState(1234);
  const [mode, setMode] = useState<'mt5' | 'url'>(() =>
    localStorage.getItem('zeus.mode') === 'url' ? 'url' : 'mt5',
  );
  const [url, setUrl] = useState(() => localStorage.getItem('zeus.url') || '');

  // Load MT5 config from safeStorage on mount
  useEffect(() => {
    window.jarvisBridge.config
      ?.getMt5?.()
      .then((cfg) => {
        if (cfg) {
          hostRef.current = cfg.host;
          portRef.current = cfg.port;
          setHostState(cfg.host);
          setPortState(cfg.port);
        }
      })
      .catch(() => {});
  }, []);

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error' | 'demo'>(
    'disconnected',
  );
  const [info, setInfo] = useState('Connecting to MT5 bridge…');
  const [account, setAccount] = useState<Mt5Acct | null>(null);
  const [running, setRunning] = useState(false);
  const [dauerbetrieb, setDauerbetrieb] = useState(dbRef.current);
  const [equity, setEquity] = useState<number[]>([100, 100]);
  const [retryIn, setRetryIn] = useState(0); // seconds until next reconnect

  const tickRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const reconnRef = useRef<number | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<number | null>(null);

  function setHost(v: string) {
    hostRef.current = v;
    setHostState(v);
  }
  function setPort(v: number) {
    portRef.current = v;
    setPortState(v);
  }
  function toggleDauerbetrieb() {
    const next = !dbRef.current;
    dbRef.current = next;
    setDauerbetrieb(next);
    localStorage.setItem('zeus.dauerbetrieb', next ? '1' : '0');
  }

  // ── Arm / Safe ──
  function arm() {
    runRef.current = true;
    setRunning(true);
    setInfo('▶ ZeusBot ARMED · DAUERBETRIEB active');
    if (tickRef.current) window.clearInterval(tickRef.current);
    window.jarvisBridge
      .mt5({
        host: hostRef.current,
        port: portRef.current,
        endpoint: 'expert/toggle',
        method: 'POST',
        body: { enabled: true },
      })
      .catch(() => {});
  }
  function safe() {
    runRef.current = false;
    setRunning(false);
    setInfo('◼ SAFED · positions held');
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    window.jarvisBridge
      .mt5({
        host: hostRef.current,
        port: portRef.current,
        endpoint: 'expert/toggle',
        method: 'POST',
        body: { enabled: false },
      })
      .catch(() => {});
  }
  async function panic() {
    runRef.current = false;
    setRunning(false);
    setInfo('⚠ PANIC · flattening all positions…');
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    try {
      const r = await window.jarvisBridge.mt5({
        host: hostRef.current,
        port: portRef.current,
        endpoint: 'positions/close_all',
        method: 'POST',
      });
      setInfo(r.ok ? '⚡ ALL POSITIONS CLOSED' : `PANIC error: ${r.err}`);
    } catch (e: any) {
      setInfo(`PANIC error: ${e?.message || e}`);
    }
  }

  // ── Stop all timers ──
  function clearAll() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (reconnRef.current) {
      window.clearTimeout(reconnRef.current);
      reconnRef.current = null;
    }
    if (retryTimer.current) {
      window.clearInterval(retryTimer.current);
      retryTimer.current = null;
    }
  }

  // ── Reconnect countdown ──
  function startCountdown(delaySec: number) {
    setRetryIn(delaySec);
    if (retryTimer.current) window.clearInterval(retryTimer.current);
    retryTimer.current = window.setInterval(() => {
      setRetryIn((prev) => {
        if (prev <= 1) {
          window.clearInterval(retryTimer.current!);
          retryTimer.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Auto-reconnect scheduler ──
  function scheduleReconnect(silent = false) {
    if (reconnRef.current) return;
    const delaySec = Math.min(5 * Math.pow(1.5, retryCount.current), 60);
    retryCount.current++;
    if (!silent)
      setInfo(`⟳ MT5 offline — reconnect in ${Math.round(delaySec)}s (attempt ${retryCount.current})`);
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
        const p = await window.jarvisBridge.mt5({
          host: hostRef.current,
          port: portRef.current,
          endpoint: 'account',
        });
        if (p.ok && p.data && typeof p.data === 'object') {
          const a = p.data as Mt5Acct;
          setAccount(a);
          setEquity((prev) => {
            const arr = [...prev, a.equity];
            return arr.length > 80 ? arr.slice(-80) : arr;
          });
        } else {
          // connection dropped
          window.clearInterval(pollRef.current!);
          pollRef.current = null;
          setStatus('error');
          setAccount(null);
          if (runRef.current) {
            runRef.current = false;
            setRunning(false);
          }
          scheduleReconnect();
        }
      } catch {
        window.clearInterval(pollRef.current!);
        pollRef.current = null;
        setStatus('error');
        setAccount(null);
        if (runRef.current) {
          runRef.current = false;
          setRunning(false);
        }
        scheduleReconnect();
      }
    }, 3000);
  }

  // ── Core MT5 connect ──
  async function connectMt5(silent = false) {
    if (reconnRef.current) {
      window.clearTimeout(reconnRef.current);
      reconnRef.current = null;
    }
    if (retryTimer.current) {
      window.clearInterval(retryTimer.current);
      retryTimer.current = null;
      setRetryIn(0);
    }
    setStatus('connecting');
    setInfo(`connecting → http://${hostRef.current}:${portRef.current}/api/v1/account …`);
    try {
      const r = await window.jarvisBridge.mt5({
        host: hostRef.current,
        port: portRef.current,
        endpoint: 'account',
      });
      if (r.ok && r.data && typeof r.data === 'object') {
        const acc = r.data as Mt5Acct;
        retryCount.current = 0;
        setAccount(acc);
        setStatus('connected');
        setInfo(
          `◉ ${acc.name} · #${acc.login} · ${acc.currency} · lev 1:${acc.leverage}${dbRef.current ? ' · DAUERBETRIEB' : ''}`,
        );
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
    setStatus('connecting');
    setInfo('auto-probing common ports…');
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
    if (!url.trim()) {
      setStatus('demo');
      setInfo('◉ DEMO MODE · ZeusBot simulated');
      return;
    }
    setStatus('connecting');
    setInfo('pinging endpoint…');
    const r = await window.jarvisBridge.zeusPing(url);
    if (r.ok) {
      setStatus('connected');
      setInfo(`◉ connected · HTTP ${r.status}`);
      localStorage.setItem('zeus.url', url);
      localStorage.setItem('zeus.mode', 'url');
    } else {
      setStatus('error');
      setInfo(`✕ ${r.err || 'HTTP ' + r.status}`);
    }
  }

  function connect() {
    mode === 'mt5' ? connectMt5() : connectUrl();
  }

  // ── Auto-connect on mount ──
  useEffect(() => {
    connectMt5(true);
    return clearAll;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dotColor =
    status === 'connected'
      ? JADE
      : status === 'demo'
        ? '#c8fb4e'
        : status === 'connecting'
          ? AMBER
          : status === 'error'
            ? ROSE
            : 'oklch(0.5 0.04 215)';
  const isOnline = status === 'connected' || status === 'demo';
  const pnl = account?.profit ?? (isOnline ? equity[equity.length - 1] - equity[0] : 0);

  return (
    <HoloPanel label="ZEUSBOT · MT5 CONNECTOR" code="ZEUS-Δ" status={isOnline ? 'live' : 'queue'}>
      {/* status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          className={isOnline ? 'anim-pulse-soft' : status === 'connecting' ? 'anim-pulse-soft' : ''}
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: dotColor,
            boxShadow: `0 0 8px ${dotColor}`,
          }}
        />
        <span className="hud-label" style={{ fontSize: 9, color: dotColor, letterSpacing: '0.22em' }}>
          {status === 'error' && retryIn > 0 ? `ERROR · RETRY IN ${retryIn}s` : status.toUpperCase()}
        </span>
        {/* DAUERBETRIEB toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="hud-label"
            style={{ fontSize: 7.5, color: dauerbetrieb ? JADE : 'var(--cyan-dim)', letterSpacing: '0.18em' }}
          >
            DAUERBETRIEB
          </span>
          <button
            onClick={toggleDauerbetrieb}
            style={{
              width: 30,
              height: 15,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: dauerbetrieb ? JADE : 'oklch(0.25 0.04 215)',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2.5,
                left: dauerbetrieb ? 16 : 2.5,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'white',
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>
      </div>

      {/* mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['mt5', 'url'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setStatus('disconnected');
              setAccount(null);
              clearAll();
            }}
            className="hud-label"
            style={{
              flex: 1,
              padding: '4px',
              fontSize: 8.5,
              letterSpacing: '0.18em',
              cursor: 'pointer',
              color: mode === m ? '#0d1117' : CYAN_BRIGHT,
              background: mode === m ? CYAN_BRIGHT : 'transparent',
              border: `1px solid ${CYAN}60`,
            }}
          >
            {m === 'mt5' ? '◆ MT5 REAL' : '◇ CUSTOM URL'}
          </button>
        ))}
      </div>

      {/* inputs */}
      {mode === 'mt5' ? (
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="localhost"
            className="font-mono"
            style={{
              flex: 2,
              padding: '6px 8px',
              fontSize: 10.5,
              color: 'var(--fg)',
              background: 'oklch(0.07 0.014 240 / 0.7)',
              border: `1px solid ${CYAN}55`,
              outline: 'none',
              minWidth: 0,
            }}
          />
          <input
            value={String(port)}
            onChange={(e) => setPort(Number(e.target.value) || 1234)}
            type="number"
            className="font-mono"
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: 10.5,
              color: 'var(--fg)',
              background: 'oklch(0.07 0.014 240 / 0.7)',
              border: `1px solid ${CYAN}55`,
              outline: 'none',
              minWidth: 0,
            }}
          />
          <button
            onClick={connect}
            disabled={status === 'connecting'}
            className="hud-label"
            style={{
              padding: '0 10px',
              fontSize: 9,
              color: CYAN_BRIGHT,
              border: `1px solid ${CYAN}`,
              background: `${CYAN}12`,
              letterSpacing: '0.24em',
              cursor: 'pointer',
              opacity: status === 'connecting' ? 0.5 : 1,
            }}
          >
            ◆ CONNECT
          </button>
          <button
            onClick={probe}
            disabled={status === 'connecting'}
            className="hud-label"
            title="Auto-probe ports 1234 8080 8081 5000 3000"
            style={{
              padding: '0 8px',
              fontSize: 9,
              color: AMBER,
              border: `1px solid ${AMBER}60`,
              background: `${AMBER}10`,
              cursor: 'pointer',
              opacity: status === 'connecting' ? 0.5 : 1,
            }}
          >
            ⊕
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://bot.local/api  or  empty → DEMO"
            className="font-mono"
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: 10.5,
              color: 'var(--fg)',
              background: 'oklch(0.07 0.014 240 / 0.7)',
              border: `1px solid ${CYAN}55`,
              outline: 'none',
            }}
          />
          <button
            onClick={connect}
            className="hud-label"
            style={{
              padding: '0 10px',
              fontSize: 9,
              color: CYAN_BRIGHT,
              border: `1px solid ${CYAN}`,
              background: `${CYAN}12`,
              letterSpacing: '0.24em',
              cursor: 'pointer',
            }}
          >
            {url.trim() ? '◆ CONNECT' : '▷ DEMO'}
          </button>
        </div>
      )}

      {/* MT5 account strip */}
      {account && (
        <div
          className="anim-fade-up"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 8 }}
        >
          {(
            [
              ['BALANCE', account.balance.toFixed(2), JADE],
              ['EQUITY', account.equity.toFixed(2), account.equity >= account.balance ? JADE : ROSE],
              [
                'P&L',
                (account.profit >= 0 ? '+' : '') + account.profit.toFixed(2),
                account.profit >= 0 ? JADE : ROSE,
              ],
              ['MARGIN', account.margin.toFixed(2), AMBER],
              ['FREE-M', account.free_margin.toFixed(2), 'var(--fg)'],
              ['LEVERAGE', `1:${account.leverage}`, 'var(--cyan-dim)'],
            ] as [string, string, string][]
          ).map(([k, v, c]) => (
            <div
              key={k}
              style={{
                padding: '5px 7px',
                background: 'oklch(0.08 0.012 240 / 0.5)',
                border: '1px solid var(--line-soft)',
              }}
            >
              <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>
                {k}
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: c, fontWeight: 600 }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* equity chart */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
          marginBottom: 8,
        }}
      >
        <div>
          <div className="hud-label" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>
            {mode === 'mt5' && account ? 'LIVE P&L' : 'SESSION P&L'}
          </div>
          <div className="font-display glow-cyan" style={{ fontSize: 20, color: pnl >= 0 ? JADE : ROSE }}>
            {pnl >= 0 ? '+' : ''}
            {pnl.toFixed(2)}{' '}
            <span style={{ fontSize: 10, color: 'var(--cyan-dim)' }}>{account?.currency ?? 'USD'}</span>
          </div>
        </div>
        <div style={{ width: 130 }}>
          <Sparkline data={equity} height={36} color={pnl >= 0 ? JADE : ROSE} />
        </div>
      </div>

      {/* buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={arm}
          disabled={!isOnline || running}
          className="hud-label"
          style={{
            flex: 1,
            padding: '8px',
            fontSize: 10,
            color: JADE,
            border: `1px solid ${JADE}80`,
            background: running ? `${JADE}14` : 'oklch(0.74 0.16 145 / 0.06)',
            letterSpacing: '0.28em',
            opacity: !isOnline || running ? 0.45 : 1,
            cursor: !isOnline || running ? 'default' : 'pointer',
          }}
        >
          {running ? '▶ ARMED' : '▶ ARM'}
        </button>
        <button
          onClick={safe}
          disabled={!running}
          className="hud-label"
          style={{
            flex: 1,
            padding: '8px',
            fontSize: 10,
            color: AMBER,
            border: `1px solid ${AMBER}80`,
            background: 'oklch(0.78 0.15 75 / 0.06)',
            letterSpacing: '0.28em',
            opacity: !running ? 0.4 : 1,
            cursor: !running ? 'default' : 'pointer',
          }}
        >
          ◼ SAFE
        </button>
        <button
          onClick={panic}
          className="hud-label"
          style={{
            flex: 1,
            padding: '8px',
            fontSize: 10,
            color: ROSE,
            border: `1px solid ${ROSE}80`,
            background: 'oklch(0.66 0.20 22 / 0.06)',
            letterSpacing: '0.28em',
            cursor: 'pointer',
          }}
        >
          ⚠ PANIC
        </button>
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          color: status === 'error' ? ROSE + 'cc' : 'var(--cyan-dim)',
          marginTop: 8,
          lineHeight: 1.4,
        }}
      >
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
  | 'PRICE_CHART'
  | 'ORDER_BOOK'
  | 'CVD'
  | 'GAMMA_EXPOSURE'
  | 'OPTIONS_FLOW'
  | 'DARK_POOL'
  | 'FUNDING_RATES'
  | 'CORRELATION'
  | 'YIELD_CURVE'
  | 'COT_POSITIONING'
  | 'LIQUIDITY_MAP'
  | 'SECTOR_ROTATION'
  | 'RISK_DASHBOARD'
  | 'CREDIT_SPREADS'
  | 'INST_FLOW'
  | 'VOL_SURFACE'
  | 'MACRO_POSITIONING'
  | 'POSITIONS'
  | 'EQUITY_CURVE'
  | 'EXECUTION_LOG'
  | 'ORDER_TICKET';

interface WidgetDef {
  id: WidgetId;
  label: string;
  desc: string;
  category: 'PRICE' | 'FLOW' | 'RISK' | 'MACRO' | 'QUANT';
  color: string;
}

const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: 'PRICE_CHART',
    label: 'Price Chart',
    desc: 'OHLCV candlestick · EMA 9/21 · VWAP · Bollinger Bands · volume bars',
    category: 'PRICE',
    color: '#ff1a6b',
  },
  {
    id: 'ORDER_BOOK',
    label: 'Order Book L2',
    desc: 'Bid/ask depth map · cumulative imbalance · large order detection',
    category: 'FLOW',
    color: '#00d084',
  },
  {
    id: 'CVD',
    label: 'CVD · Delta Flow',
    desc: 'Cumulative volume delta · buy vs sell pressure · aggressive order tracking',
    category: 'FLOW',
    color: '#00e5ff',
  },
  {
    id: 'GAMMA_EXPOSURE',
    label: 'Gamma Exposure (GEX)',
    desc: 'Dealer net gamma by strike · flip level · pin/magnet risk analysis',
    category: 'RISK',
    color: '#ffb300',
  },
  {
    id: 'OPTIONS_FLOW',
    label: 'Options Unusual Flow',
    desc: 'Large unusual options prints · sentiment score · whale activity radar',
    category: 'FLOW',
    color: '#e879f9',
  },
  {
    id: 'DARK_POOL',
    label: 'Dark Pool Prints',
    desc: 'Institutional block trades · ATS volume · dark vs lit ratio by symbol',
    category: 'FLOW',
    color: '#c8fb4e',
  },
  {
    id: 'FUNDING_RATES',
    label: 'Funding Rates',
    desc: '8h perpetual funding across Binance/Bybit/OKX · annualised carry cost',
    category: 'FLOW',
    color: '#e879f9',
  },
  {
    id: 'CORRELATION',
    label: 'Correlation Matrix',
    desc: '30d rolling cross-asset correlation · regime shift detector',
    category: 'QUANT',
    color: '#00e5ff',
  },
  {
    id: 'YIELD_CURVE',
    label: 'Yield Curve',
    desc: 'US Treasury 2Y/5Y/10Y/30Y · inversion signal · real yield vs breakeven',
    category: 'MACRO',
    color: '#ffb300',
  },
  {
    id: 'COT_POSITIONING',
    label: 'COT Positioning',
    desc: 'CFTC Commitments of Traders · net spec vs commercial · extremes highlighted',
    category: 'MACRO',
    color: '#c8fb4e',
  },
  {
    id: 'LIQUIDITY_MAP',
    label: 'Liquidity Map',
    desc: 'Stop cluster heatmap · liquidation levels · equal highs/lows',
    category: 'FLOW',
    color: '#00e5ff',
  },
  {
    id: 'SECTOR_ROTATION',
    label: 'Sector Rotation',
    desc: 'GICS sector relative strength vs SPX · risk-on/off flow · rotation speed',
    category: 'MACRO',
    color: '#00d084',
  },
  {
    id: 'RISK_DASHBOARD',
    label: 'Risk Dashboard',
    desc: 'Portfolio VaR (95/99%) · Sharpe · Sortino · max DD · beta vs SPX',
    category: 'QUANT',
    color: '#ff1a6b',
  },
  {
    id: 'CREDIT_SPREADS',
    label: 'Credit Spreads',
    desc: 'HY/IG OAS spreads · CDS 5Y · swap spreads · credit cycle indicator',
    category: 'MACRO',
    color: '#ffb300',
  },
  {
    id: 'INST_FLOW',
    label: 'Institutional Flow',
    desc: 'Net institutional buy/sell by asset · 13F delta · smart money tracker',
    category: 'FLOW',
    color: '#00d084',
  },
  {
    id: 'VOL_SURFACE',
    label: 'Vol Surface',
    desc: 'Implied vol term structure · put/call skew · 25d RR · DVOL index',
    category: 'RISK',
    color: '#e879f9',
  },
  {
    id: 'MACRO_POSITIONING',
    label: 'Macro Positioning',
    desc: 'G10 FX COT net specs · commodity net longs · hedge fund beta exposure',
    category: 'MACRO',
    color: '#c8fb4e',
  },
  {
    id: 'POSITIONS',
    label: 'Open Positions',
    desc: 'Live MT5 positions · real-time PnL · risk per trade · margin used',
    category: 'PRICE',
    color: '#00d084',
  },
  {
    id: 'EQUITY_CURVE',
    label: 'Equity Curve',
    desc: 'Account equity timeline · drawdown overlay · Sharpe / Calmar metrics',
    category: 'QUANT',
    color: '#00d084',
  },
  {
    id: 'EXECUTION_LOG',
    label: 'Execution Log',
    desc: 'Order fills · slippage · algo attribution · market impact analysis',
    category: 'PRICE',
    color: 'var(--cyan-dim)',
  },
  {
    id: 'ORDER_TICKET',
    label: 'Order Ticket',
    desc: 'Live MT5 order placement · market orders · SL/TP auto-calc · R:R display',
    category: 'PRICE',
    color: '#00d084',
  },
];

const DEFAULT_LAYOUT: WidgetId[][] = [
  ['PRICE_CHART', 'ORDER_BOOK', 'CVD'],
  ['GAMMA_EXPOSURE', 'OPTIONS_FLOW', 'DARK_POOL'],
  ['RISK_DASHBOARD', 'EQUITY_CURVE', 'EXECUTION_LOG'],
];

export type { PosRow, WidgetId };
export { StrategiesPanel, useMt5LiveData, WIDGET_REGISTRY, DEFAULT_LAYOUT };
