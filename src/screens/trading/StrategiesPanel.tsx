// @ts-nocheck
/**
 * ZeusBot strategies panel — extracted from ZeusBotPanel (D6).
 */
import { useState } from 'react';
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
export function StrategiesPanel() {
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
