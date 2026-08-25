// @ts-nocheck
/**
 * GodMode trading agent team — extracted from TradingContent (D6 / ADR 0006 follow-up).
 */
import { useEffect, useMemo, useState } from 'react';
import { HoloPanel, Sparkline, Stat } from '../../components/primitives';
import { CYAN, CYAN_BRIGHT, AMBER, ROSE, JADE, VIOLET } from '../../theme';
import GodModeChart, { type GodModeTradeSetup } from '../../components/GodModeChart';
import { useZeusTickers, useZeusSwaps, useFearGreed, statusColor, statusLabel } from '../../lib/trading-data';

export type TradingTab = 'TERMINAL' | 'MY_SETUP' | 'GODMODE';

/* ══════════════════════════════════════════════════════════════════
   GODMODE TRADING AGENT TEAM — institutional signals + news + entry
   ══════════════════════════════════════════════════════════════════ */
interface TradingSignal {
  id: string;
  sym: string;
  side: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  entry: string;
  tp: string;
  sl: string;
  tf: string;
  reason: string;
  source: 'FLOW' | 'NEWS' | 'TECH' | 'MACRO' | 'SENTIMENT';
  ts: string;
}
interface EconEvent {
  time: string;
  event: string;
  country: string;
  impact: 'HIGH' | 'MED' | 'LOW';
  forecast: string;
  prev: string;
  actual: string;
}

const GODMODE_AGENTS = [
  {
    id: 'GA-01',
    name: 'NewsAlpha',
    role: 'Scans financial news + press releases for tradeable catalysts',
    color: '#c8fb4e',
    icon: '◎',
    status: 'LIVE',
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
    id: 'GA-02',
    name: 'FlowDetect',
    role: 'Monitors dark pool prints + options flow imbalances',
    color: CYAN_BRIGHT,
    icon: '◉',
    status: 'LIVE',
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
    id: 'GA-03',
    name: 'MacroPulse',
    role: 'Tracks Fed/ECB/BoJ signals + macro regime shifts',
    color: AMBER,
    icon: '◆',
    status: 'LIVE',
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
    id: 'GA-04',
    name: 'TechOracle',
    role: 'Multi-TF technical confluence: S/R · EMA · Pivots · VWAP',
    color: JADE,
    icon: '◈',
    status: 'LIVE',
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
    id: 'GA-05',
    name: 'SentimentScan',
    role: 'Aggregates social volume, Fear/Greed, funding rates',
    color: VIOLET,
    icon: '⬡',
    status: 'SCANNING',
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
    id: 'GA-06',
    name: 'InstitTrack',
    role: 'Tracks COT data, 13F filings, futures commitment of traders',
    color: '#fb923c',
    icon: '◇',
    status: 'LIVE',
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
    id: 'GA-07',
    name: 'EntrySniper',
    role: 'Synthesizes all agents — fires high-prob entry alerts',
    color: ROSE,
    icon: '▶',
    status: 'READY',
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
export const GODMODE_SYMBOLS = [
  'BTCUSD',
  'ETHUSD',
  'XRPUSD', // crypto
  'XAUUSD',
  'XAGUSD', // metals
  'US500',
  'US30', // equity indices (ES / Dow)
  'EURUSD',
  'GBPUSD',
  'USDJPY', // major FX
];

const SEED_SIGNALS: TradingSignal[] = [
  {
    id: 'S1',
    sym: 'BTCUSD',
    side: 'LONG',
    confidence: 82,
    entry: '78,450',
    tp: '81,800',
    sl: '76,900',
    tf: '4H',
    reason:
      'ETF inflows + halving supply compression. FlowDetect: large OI build on CME. TechOracle: 4H demand zone holding.',
    source: 'FLOW',
    ts: new Date(Date.now() - 240000).toISOString(),
  },
  {
    id: 'S2',
    sym: 'XAUUSD',
    side: 'LONG',
    confidence: 76,
    entry: '3,312',
    tp: '3,390',
    sl: '3,270',
    tf: '1H',
    reason:
      'Real yield decline + risk-off bid. MacroPulse: BoJ hawkish pivot risk. Central bank demand elevated.',
    source: 'MACRO',
    ts: new Date(Date.now() - 720000).toISOString(),
  },
  {
    id: 'S3',
    sym: 'XAGUSD',
    side: 'LONG',
    confidence: 68,
    entry: '32.40',
    tp: '33.80',
    sl: '31.60',
    tf: '4H',
    reason:
      'Gold/Silver ratio extended. Industrial demand + solar sector tailwind. Macro risk-off supports metals.',
    source: 'MACRO',
    ts: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'S4',
    sym: 'US500',
    side: 'NEUTRAL',
    confidence: 52,
    entry: '5,280',
    tp: '5,380',
    sl: '5,180',
    tf: '1D',
    reason:
      'Mixed earnings season. AAPL beat vs META miss. Await CPI data 14:30. InstitTrack: sector rotation in progress.',
    source: 'NEWS',
    ts: new Date(Date.now() - 1500000).toISOString(),
  },
  {
    id: 'S5',
    sym: 'US30',
    side: 'LONG',
    confidence: 61,
    entry: '39,800',
    tp: '40,500',
    sl: '39,100',
    tf: '1D',
    reason: 'Industrials + energy outperforming. Dow breakout above 200 EMA. Breadth improving.',
    source: 'TECH',
    ts: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'S6',
    sym: 'ETHUSD',
    side: 'LONG',
    confidence: 71,
    entry: '3,100',
    tp: '3,280',
    sl: '2,980',
    tf: '4H',
    reason: 'ETH ETF net inflows 5-day streak. Layer-2 fee burn accelerating. Follows BTC momentum.',
    source: 'FLOW',
    ts: new Date(Date.now() - 2200000).toISOString(),
  },
  {
    id: 'S7',
    sym: 'XRPUSD',
    side: 'LONG',
    confidence: 63,
    entry: '0.5820',
    tp: '0.6200',
    sl: '0.5600',
    tf: '4H',
    reason: 'Regulatory clarity post-SEC ruling. Ripple ODL volume up. Break above range resistance.',
    source: 'NEWS',
    ts: new Date(Date.now() - 2800000).toISOString(),
  },
  {
    id: 'S8',
    sym: 'EURUSD',
    side: 'SHORT',
    confidence: 69,
    entry: '1.0894',
    tp: '1.0800',
    sl: '1.0950',
    tf: '4H',
    reason:
      'DXY strength + ECB dovish guidance. NewsAlpha: German PMI miss. InstitTrack: large EUR spec short.',
    source: 'NEWS',
    ts: new Date(Date.now() - 3200000).toISOString(),
  },
  {
    id: 'S9',
    sym: 'USDJPY',
    side: 'SHORT',
    confidence: 71,
    entry: '154.30',
    tp: '150.80',
    sl: '156.10',
    tf: '1H',
    reason:
      'BoJ intervention risk above 155. SentimentScan: extreme greed on JPY carry unwind. Caution zone.',
    source: 'TECH',
    ts: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'S10',
    sym: 'GBPUSD',
    side: 'NEUTRAL',
    confidence: 50,
    entry: '1.2640',
    tp: '—',
    sl: '—',
    tf: '1D',
    reason: 'UK CPI in-line with forecast. BoE on hold. Range-bound between 1.255–1.280 support/resistance.',
    source: 'MACRO',
    ts: new Date(Date.now() - 4200000).toISOString(),
  },
];

const SEED_ECON: EconEvent[] = [
  {
    time: '08:30',
    event: 'US Non-Farm Payrolls',
    country: 'USD',
    impact: 'HIGH',
    forecast: '+185K',
    prev: '+175K',
    actual: '+203K',
  },
  {
    time: '09:00',
    event: 'EU CPI Flash Estimate',
    country: 'EUR',
    impact: 'HIGH',
    forecast: '2.3%',
    prev: '2.5%',
    actual: '',
  },
  {
    time: '10:00',
    event: 'ISM Manufacturing PMI',
    country: 'USD',
    impact: 'MED',
    forecast: '49.8',
    prev: '48.7',
    actual: '',
  },
  {
    time: '11:30',
    event: 'BoC Rate Decision',
    country: 'CAD',
    impact: 'HIGH',
    forecast: '4.25%',
    prev: '4.25%',
    actual: '',
  },
  {
    time: '14:30',
    event: 'US CPI YoY',
    country: 'USD',
    impact: 'HIGH',
    forecast: '3.1%',
    prev: '3.2%',
    actual: '',
  },
  {
    time: '15:00',
    event: 'Fed Chair Powell Speech',
    country: 'USD',
    impact: 'HIGH',
    forecast: '—',
    prev: '—',
    actual: '',
  },
  {
    time: '16:30',
    event: 'Crude Oil Inventories',
    country: 'USD',
    impact: 'MED',
    forecast: '-1.8M',
    prev: '+2.1M',
    actual: '',
  },
  {
    time: '20:00',
    event: 'FOMC Meeting Minutes',
    country: 'USD',
    impact: 'HIGH',
    forecast: '—',
    prev: '—',
    actual: '',
  },
];

export function GodModeTab({
  connected,
  onNavigate,
  onSymbolSelect,
}: {
  connected: boolean;
  onNavigate?: (tab: TradingTab) => void;
  onSymbolSelect?: (sym: string) => void;
}) {
  const { tickers } = useZeusTickers(GODMODE_SYMBOLS);
  const { rows: fundingRows } = useZeusSwaps([
    'BTCUSD',
    'ETHUSD',
    'XRPUSD',
    'XAUUSD',
    'XAGUSD',
    'US500',
    'US30',
    'EURUSD',
    'GBPUSD',
    'USDJPY',
  ]);
  const fgData = useFearGreed();

  // Derive live signals — always emits one per asset, never falls back to seed
  const liveSignals = useMemo((): TradingSignal[] => {
    if (tickers.length === 0) return [];
    const fundMap = Object.fromEntries(fundingRows.map((r) => [r.symbol, r.rate]));
    const fg = fgData?.value ?? 50;

    return (
      tickers
        .map((tk): TradingSignal => {
          const chg = tk.change24h;
          const price = tk.price;
          const sym = tk.symbol;
          const fundRate = fundMap[sym] ?? 0; // annualised %

          // ── Confidence score (0–100) built from multiple factors ──────────
          let score = 50;
          // 1. Momentum: ±2 pts per % (capped ±30)
          score += Math.min(30, Math.max(-30, chg * 2));
          // 2. Extreme momentum bonus: large moves signal continuation
          if (chg > 5) score += 8;
          if (chg < -5) score -= 8;
          // 3. Fear & Greed overlay
          if (fg < 20)
            score += 12; // extreme fear → buy signal
          else if (fg < 35) score += 6;
          else if (fg > 85)
            score -= 12; // extreme greed → fade
          else if (fg > 70) score -= 6;
          // 4. Funding/swap overlay: negative swap = bearish carry, positive = bullish
          if (fundRate < -30) score -= 8;
          else if (fundRate > 80)
            score -= 6; // overheated longs
          else if (fundRate > 40) score += 3;
          // 5. Volatility bonus for high-confidence signals
          const dailyRange =
            tk.high > 0 && tk.low > 0 ? ((tk.high - tk.low) / price) * 100 : Math.abs(chg) * 1.4;
          if (dailyRange > 4) score += 4; // high-vol day = stronger signal

          score = Math.round(Math.max(16, Math.min(93, score)));

          const side: TradingSignal['side'] = score >= 57 ? 'LONG' : score <= 43 ? 'SHORT' : 'NEUTRAL';

          // ── Source classification ──────────────────────────────────────────
          let source: TradingSignal['source'];
          if (Math.abs(chg) > 3.5) source = 'FLOW';
          else if (fg < 30 || fg > 75) source = 'SENTIMENT';
          else if (Math.abs(fundRate) > 40) source = 'MACRO';
          else if (Math.abs(chg) > 1.5) source = 'TECH';
          else source = 'MACRO';

          // ── Reason string ─────────────────────────────────────────────────
          const chgStr = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}% 24h`;
          const trendStr =
            Math.abs(chg) > 4
              ? chg > 0
                ? 'Strong bullish momentum.'
                : 'Strong bearish momentum.'
              : Math.abs(chg) > 1.5
                ? chg > 0
                  ? 'Bullish bias.'
                  : 'Bearish bias.'
                : 'Consolidating range.';
          const fgStr =
            fg < 25
              ? `Extreme Fear F&G=${fg} — contrarian buy.`
              : fg > 80
                ? `Extreme Greed F&G=${fg} — fade risk.`
                : fg < 40
                  ? `Fear bias F&G=${fg}.`
                  : '';
          const fundStr =
            Math.abs(fundRate) > 25
              ? `Swap ${fundRate > 0 ? '+' : ''}${fundRate.toFixed(0)}% ann ${fundRate < 0 ? '(bearish carry).' : '(bullish carry).'}`
              : '';
          const agentStr =
            source === 'FLOW'
              ? 'FlowDetect: volume impulse detected.'
              : source === 'SENTIMENT'
                ? 'SentimentScan: crowd signal.'
                : source === 'MACRO'
                  ? 'MacroPulse: regime context.'
                  : 'TechOracle: confluence zone.';
          const reason = [chgStr, trendStr, fgStr, fundStr, agentStr].filter(Boolean).join(' ');

          // ── Price targets ─────────────────────────────────────────────────
          const riskPct = Math.abs(chg) > 3 ? 0.022 : 0.013;
          const tpPct = riskPct * 2.2;
          const digs =
            price >= 10000 ? 0 : price >= 1000 ? 1 : price >= 100 ? 2 : price >= 10 ? 3 : price >= 1 ? 4 : 5;
          const fmt = (p: number) =>
            p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: digs }) : p.toFixed(digs);

          return {
            id: `LIVE-${sym}`,
            sym,
            side,
            confidence: score,
            entry: fmt(price),
            tp: side === 'NEUTRAL' ? '—' : fmt(price * (side === 'LONG' ? 1 + tpPct : 1 - tpPct)),
            sl: side === 'NEUTRAL' ? '—' : fmt(price * (side === 'LONG' ? 1 - riskPct : 1 + riskPct)),
            tf: '4H',
            reason,
            source,
            ts: new Date().toISOString(),
          };
        })
        // Sort: directional first (LONG/SHORT), then by confidence desc
        .sort((a, b) => {
          const rank = (s: TradingSignal) => (s.side === 'NEUTRAL' ? 0 : 1);
          if (rank(b) !== rank(a)) return rank(b) - rank(a);
          return b.confidence - a.confidence;
        })
    );
  }, [tickers, fundingRows, fgData]);

  const activeSignals = liveSignals.length > 0 ? liveSignals : SEED_SIGNALS;
  const isLive = liveSignals.length > 0;
  const [econ] = useState<EconEvent[]>(SEED_ECON);
  const [selSig, setSelSig] = useState<TradingSignal | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [agentDefs, setAgentDefs] = useState(() =>
    GODMODE_AGENTS.map((ag) => ({ ...ag, enabled: true as boolean })),
  );
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const enabledAgents = agentDefs.filter((a) => a.enabled);
  function updateAgent(
    id: string,
    patch: Partial<{
      name: string;
      role: string;
      prompt: string;
      icon: string;
      status: string;
      enabled: boolean;
      color: string;
    }>,
  ) {
    setAgentDefs((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function addAgent() {
    const newId = `GA-${String(agentDefs.length + 1).padStart(2, '0')}`;
    setAgentDefs((prev) => [
      ...prev,
      {
        id: newId,
        name: 'NewAgent',
        role: "Define this agent's role...",
        prompt: `# ${newId} — Agent Prompt\n\n## Role\nDescribe what this agent does.\n\n## Instructions\n- Rule 1\n- Rule 2\n\n## Output Format\n\`\`\`\nSYM: ...\nBIAS: ...\nCONFIDENCE: ...\n\`\`\``,
        color: CYAN,
        icon: '◎',
        status: 'READY',
        enabled: true,
      },
    ]);
  }
  function removeAgent(id: string) {
    setAgentDefs((prev) => prev.filter((a) => a.id !== id));
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

  const srcColor = (s: TradingSignal['source']) =>
    ({ FLOW: CYAN_BRIGHT, NEWS: '#c8fb4e', TECH: JADE, MACRO: AMBER, SENTIMENT: VIOLET })[s];
  const impColor = (i: EconEvent['impact']) => ({ HIGH: ROSE, MED: AMBER, LOW: JADE })[i];
  const sideColor = (s: TradingSignal['side']) => (s === 'LONG' ? JADE : s === 'SHORT' ? ROSE : AMBER);

  // Build chart setup from selected signal
  const chartSetup: GodModeTradeSetup | undefined =
    selSig && selSig.side !== 'NEUTRAL'
      ? {
          entry: parseFloat(selSig.entry.replace(/,/g, '')) || null,
          sl: parseFloat(selSig.sl.replace(/,/g, '')) || null,
          tp1: parseFloat(selSig.tp.replace(/,/g, '')) || null,
          tp2: parseFloat(selSig.tp.replace(/,/g, '')) * (selSig.side === 'LONG' ? 1.012 : 0.988) || null,
          bias: selSig.side === 'LONG' ? 'long' : 'short',
        }
      : undefined;

  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        padding: 8,
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gap: 8,
      }}
    >
      {/* ── Agent Team Header ── */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'stretch' }}>
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, enabledAgents.length)},1fr)`,
            gap: 6,
          }}
        >
          {enabledAgents.map((ag) => {
            const active = agentFilter === ag.id;
            return (
              <div
                key={ag.id}
                onClick={() => setAgentFilter(active ? null : ag.id)}
                style={{
                  padding: '8px 10px',
                  border: `1px solid ${ag.color}${active ? '99' : '33'}`,
                  background: `${ag.color}${active ? '15' : '07'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 16, color: ag.color, lineHeight: 1 }}>{ag.icon}</span>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 6.5,
                      color: ag.status === 'LIVE' ? JADE : ag.status === 'SCANNING' ? AMBER : ag.color,
                      border: `1px solid currentColor`,
                      padding: '1px 3px',
                    }}
                  >
                    {ag.status}
                  </span>
                </div>
                <div
                  className="hud-label"
                  style={{ fontSize: 9, color: ag.color, letterSpacing: '0.12em', marginBottom: 2 }}
                >
                  {ag.name}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}
                >
                  {ag.role.slice(0, 40)}…
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => setShowAgentSettings((v) => !v)}
          className="hud-label"
          style={{
            padding: '0 16px',
            fontSize: 8,
            color: showAgentSettings ? AMBER : 'rgba(255,255,255,0.5)',
            border: `1px solid ${showAgentSettings ? AMBER + '80' : 'rgba(255,255,255,0.15)'}`,
            cursor: 'pointer',
            background: showAgentSettings ? `${AMBER}12` : 'rgba(255,255,255,0.03)',
            letterSpacing: '0.2em',
            flexShrink: 0,
          }}
        >
          ⚙ AGENTS
        </button>
      </div>

      {/* ── Main content ── */}
      {showAgentSettings ? (
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Settings toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              padding: '0 2px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                className="hud-label"
                style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3em' }}
              >
                CFG-01
              </span>
              <span className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.22em' }}>
                AGENT TEAM CONFIGURATION
              </span>
              <span
                className="hud-label"
                style={{
                  fontSize: 7.5,
                  color: 'rgba(255,255,255,0.25)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '1px 6px',
                }}
              >
                {agentDefs.length} AGENTS · {enabledAgents.length} ACTIVE
              </span>
            </div>
            <button
              onClick={addAgent}
              className="hud-label"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 14px',
                fontSize: 8,
                color: JADE,
                border: `1px solid ${JADE}50`,
                cursor: 'pointer',
                background: `${JADE}0d`,
                letterSpacing: '0.2em',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1 }}>+</span> ADD AGENT
            </button>
          </div>

          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 52px 1fr 2fr 110px 38px',
              gap: 0,
              padding: '0 0 6px 0',
              borderBottom: `1px solid rgba(255,255,255,0.07)`,
            }}
          >
            {[
              ['48px', ''],
              ['52px', 'ICON'],
              ['1fr', 'NAME'],
              ['2fr', 'ROLE DESCRIPTION'],
              ['110px', 'STATUS'],
              ['38px', ''],
            ].map(([, h], i) => (
              <span
                key={i}
                className="hud-label"
                style={{
                  fontSize: 7,
                  color: 'rgba(255,255,255,0.22)',
                  letterSpacing: '0.18em',
                  paddingLeft: i === 0 ? 0 : 12,
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Agent rows */}
          <div
            className="nx-scroll"
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}
          >
            {agentDefs.map((ag, idx) => {
              const statusColor =
                ag.status === 'LIVE'
                  ? JADE
                  : ag.status === 'SCANNING'
                    ? AMBER
                    : ag.status === 'OFFLINE'
                      ? 'rgba(255,255,255,0.2)'
                      : ag.color;
              const STATUS_CYCLE = ['LIVE', 'SCANNING', 'READY', 'OFFLINE'] as const;
              const nextStatus = () => {
                const i = STATUS_CYCLE.indexOf(ag.status as (typeof STATUS_CYCLE)[number]);
                updateAgent(ag.id, { status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] });
              };
              const isExpanded = expandedPromptId === ag.id;
              const promptLineCount = (ag.prompt || '').split('\n').length;
              return (
                <div
                  key={ag.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderBottom: `1px solid rgba(255,255,255,0.05)`,
                    marginBottom: 2,
                  }}
                >
                  {/* ── Main row ── */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '48px 52px 1fr 2fr 110px 38px',
                      gap: 0,
                      alignItems: 'center',
                      padding: '8px 0',
                      borderLeft: `2px solid ${ag.enabled ? ag.color + '80' : 'rgba(255,255,255,0.06)'}`,
                      background: ag.enabled ? `${ag.color}06` : 'rgba(255,255,255,0.015)',
                      transition: 'all 0.15s',
                      opacity: ag.enabled ? 1 : 0.45,
                    }}
                  >
                    {/* Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        onClick={() => updateAgent(ag.id, { enabled: !ag.enabled })}
                        style={{
                          width: 32,
                          height: 16,
                          borderRadius: 8,
                          border: `1px solid ${ag.enabled ? ag.color + '60' : 'rgba(255,255,255,0.15)'}`,
                          background: ag.enabled ? `${ag.color}30` : 'rgba(255,255,255,0.04)',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s',
                          padding: 0,
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: ag.enabled ? 16 : 2,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: ag.enabled ? ag.color : 'rgba(255,255,255,0.25)',
                            transition: 'all 0.2s',
                            display: 'block',
                          }}
                        />
                      </button>
                    </div>

                    {/* Icon */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingLeft: 4,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1px solid ${ag.color}30`,
                          background: `${ag.color}10`,
                          position: 'relative',
                        }}
                      >
                        <span style={{ fontSize: 16, color: ag.color, lineHeight: 1, userSelect: 'none' }}>
                          {ag.icon}
                        </span>
                        <span
                          className="hud-label"
                          style={{
                            position: 'absolute',
                            bottom: 1,
                            right: 2,
                            fontSize: 5.5,
                            color: `${ag.color}80`,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>
                    </div>

                    {/* Name */}
                    <div style={{ paddingLeft: 12, paddingRight: 8 }}>
                      <input
                        value={ag.name}
                        onChange={(e) => updateAgent(ag.id, { name: e.target.value })}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${ag.color}30`,
                          color: ag.color,
                          fontSize: 11,
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          padding: '2px 0',
                          letterSpacing: '0.08em',
                          outline: 'none',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={(e) => (e.target.style.borderBottomColor = ag.color + '90')}
                        onBlur={(e) => (e.target.style.borderBottomColor = ag.color + '30')}
                      />
                      <div
                        className="hud-label"
                        style={{
                          fontSize: 6.5,
                          color: 'rgba(255,255,255,0.2)',
                          marginTop: 2,
                          letterSpacing: '0.15em',
                        }}
                      >
                        {ag.id}
                      </div>
                    </div>

                    {/* Role + MD toggle */}
                    <div
                      style={{
                        paddingLeft: 12,
                        paddingRight: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <input
                        value={ag.role}
                        onChange={(e) => updateAgent(ag.id, { role: e.target.value })}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.6)',
                          fontSize: 10,
                          fontFamily: 'monospace',
                          padding: '2px 0',
                          outline: 'none',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={(e) => (e.target.style.borderBottomColor = 'rgba(255,255,255,0.35)')}
                        onBlur={(e) => (e.target.style.borderBottomColor = 'rgba(255,255,255,0.1)')}
                      />
                      <button
                        onClick={() => setExpandedPromptId(isExpanded ? null : ag.id)}
                        className="hud-label"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          alignSelf: 'flex-start',
                          padding: '2px 8px',
                          fontSize: 7.5,
                          color: isExpanded ? ag.color : 'rgba(255,255,255,0.3)',
                          border: `1px solid ${isExpanded ? ag.color + '50' : 'rgba(255,255,255,0.1)'}`,
                          background: isExpanded ? `${ag.color}12` : 'transparent',
                          cursor: 'pointer',
                          letterSpacing: '0.14em',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 9, lineHeight: 1 }}>{isExpanded ? '▾' : '▸'}</span>
                        PROMPT · MD
                        <span style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.25)', marginLeft: 2 }}>
                          {promptLineCount}L
                        </span>
                      </button>
                    </div>

                    {/* Status — click to cycle */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingLeft: 8,
                      }}
                    >
                      <button
                        onClick={nextStatus}
                        className="hud-label"
                        style={{
                          padding: '4px 10px',
                          fontSize: 8,
                          color: statusColor,
                          border: `1px solid ${statusColor}50`,
                          background: `${statusColor}0f`,
                          cursor: 'pointer',
                          letterSpacing: '0.18em',
                          minWidth: 88,
                          textAlign: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        {ag.status === 'LIVE'
                          ? '◉ LIVE'
                          : ag.status === 'SCANNING'
                            ? '◌ SCANNING'
                            : ag.status === 'READY'
                              ? '◎ READY'
                              : '○ OFFLINE'}
                      </button>
                    </div>

                    {/* Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        onClick={() => removeAgent(ag.id)}
                        style={{
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(255,255,255,0.2)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: 11,
                          transition: 'all 0.15s',
                          borderRadius: 0,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = ROSE;
                          (e.currentTarget as HTMLButtonElement).style.borderColor = ROSE + '60';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* ── Inline Markdown Editor (expands below row) ── */}
                  {isExpanded && (
                    <div
                      style={{
                        borderLeft: `2px solid ${ag.color}40`,
                        background: `${ag.color}04`,
                        padding: '0 0 0 0',
                      }}
                    >
                      {/* Editor header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 14px 6px',
                          borderBottom: `1px solid ${ag.color}18`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 13, color: ag.color }}>{ag.icon}</span>
                          <span
                            className="hud-label"
                            style={{ fontSize: 8, color: ag.color, letterSpacing: '0.22em' }}
                          >
                            {ag.name} \u00b7 AGENT PROMPT
                          </span>
                          <span
                            className="hud-label"
                            style={{
                              fontSize: 7,
                              color: 'rgba(255,255,255,0.2)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              padding: '1px 5px',
                            }}
                          >
                            MARKDOWN
                          </span>
                          <span className="hud-label" style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>
                            {promptLineCount} LINES · {(ag.prompt || '').length} CHARS
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span
                            className="hud-label"
                            style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em' }}
                          >
                            ## H2 **bold** *italic* \`code\` | table |
                          </span>
                          <button
                            onClick={() => setExpandedPromptId(null)}
                            className="hud-label"
                            style={{
                              padding: '2px 8px',
                              fontSize: 7.5,
                              color: 'rgba(255,255,255,0.3)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: 'transparent',
                              cursor: 'pointer',
                              letterSpacing: '0.14em',
                            }}
                          >
                            ▴ COLLAPSE
                          </button>
                        </div>
                      </div>
                      {/* Line-numbered textarea wrapper */}
                      <div style={{ display: 'flex', maxHeight: 320, overflow: 'hidden' }}>
                        {/* Line numbers */}
                        <div
                          style={{
                            padding: '10px 0',
                            background: `${ag.color}08`,
                            borderRight: `1px solid ${ag.color}15`,
                            minWidth: 36,
                            flexShrink: 0,
                            overflowY: 'hidden',
                            userSelect: 'none',
                          }}
                        >
                          {(ag.prompt || '').split('\n').map((_, i) => (
                            <div
                              key={i}
                              className="font-mono"
                              style={{
                                fontSize: 9,
                                color: `${ag.color}40`,
                                textAlign: 'right',
                                paddingRight: 8,
                                lineHeight: '1.6',
                                height: 16,
                              }}
                            >
                              {i + 1}
                            </div>
                          ))}
                        </div>
                        {/* Editor */}
                        <textarea
                          value={ag.prompt || ''}
                          onChange={(e) => updateAgent(ag.id, { prompt: e.target.value })}
                          spellCheck={false}
                          style={{
                            flex: 1,
                            minHeight: Math.min(Math.max(promptLineCount * 16, 120), 300),
                            maxHeight: 300,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            color: 'rgba(255,255,255,0.75)',
                            fontSize: 11.5,
                            fontFamily: '"JetBrains Mono","Courier New",monospace',
                            lineHeight: '1.6',
                            padding: '10px 14px',
                            boxSizing: 'border-box',
                            overflowY: 'auto',
                            whiteSpace: 'pre',
                            tabSize: 2,
                          }}
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr 280px',
            gap: 8,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* LEFT — Signals list */}
          <HoloPanel
            label="LIVE SIGNALS"
            code={`SIG · ${activeSignals.length}${isLive ? ' · LIVE' : ' · SEED'}`}
            status={isLive ? 'live' : 'warn'}
            accent="cyan"
            style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
            bodyClassName="nx-scroll"
            bodyStyle={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '8px 10px',
              flex: 1,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
              <button
                onClick={triggerScan}
                className="hud-label"
                style={{
                  padding: '3px 10px',
                  fontSize: 7.5,
                  color: scanning ? AMBER : JADE,
                  border: `1px solid ${scanning ? AMBER : JADE}50`,
                  cursor: 'pointer',
                  background: 'transparent',
                  letterSpacing: '0.16em',
                }}
              >
                {scanning ? '◌ SCANNING…' : '▶ SCAN NOW'}
              </button>
            </div>
            {activeSignals.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelSig(s)}
                style={{
                  padding: '9px 11px',
                  borderTop: `1px solid ${selSig?.id === s.id ? sideColor(s.side) : 'rgba(255,255,255,0.08)'}`,
                  borderRight: `1px solid ${selSig?.id === s.id ? sideColor(s.side) : 'rgba(255,255,255,0.08)'}`,
                  borderBottom: `1px solid ${selSig?.id === s.id ? sideColor(s.side) : 'rgba(255,255,255,0.08)'}`,
                  borderLeft: `2px solid ${sideColor(s.side)}`,
                  background: selSig?.id === s.id ? `${sideColor(s.side)}10` : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span
                    className="hud-label"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSymbolSelect?.(s.sym);
                      onNavigate?.('TERMINAL');
                    }}
                    style={{
                      fontSize: 10,
                      color: sideColor(s.side),
                      letterSpacing: '0.14em',
                      cursor: 'pointer',
                      textDecoration: 'underline dotted',
                    }}
                    title={`Open ${s.sym} in Terminal`}
                  >
                    {s.sym}
                  </span>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span
                      className="hud-label"
                      style={{
                        fontSize: 7.5,
                        color: srcColor(s.source),
                        border: `1px solid ${srcColor(s.source)}40`,
                        padding: '1px 4px',
                      }}
                    >
                      {s.source}
                    </span>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 8,
                        color: s.confidence > 75 ? JADE : s.confidence > 55 ? AMBER : ROSE,
                      }}
                    >
                      {s.confidence}%
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 9,
                      color: sideColor(s.side),
                      border: `1px solid ${sideColor(s.side)}50`,
                      padding: '2px 7px',
                    }}
                  >
                    {s.side}
                  </span>
                  <span className="font-mono" style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)' }}>
                    {s.tf} · {s.entry}
                  </span>
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.4 }}
                >
                  {s.reason.slice(0, 60)}…
                </div>
              </div>
            ))}
          </HoloPanel>

          {/* CENTER — Candlestick Chart */}
          <HoloPanel
            label={selSig ? `FLOW SOURCE · ${selSig.sym}` : 'FLOW SOURCE · BTCUSD'}
            code="FS-001"
            status="live"
            accent="cyan"
            style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '4px 8px 8px',
            }}
          >
            <GodModeChart
              key={selSig?.sym ?? 'BTCUSD'}
              symbol={selSig?.sym ?? 'BTCUSD'}
              interval={selSig?.tf === '4H' ? '4h' : selSig?.tf === '1H' ? '1h' : '4h'}
              setup={chartSetup}
            />
          </HoloPanel>

          {/* RIGHT — Econ Calendar (top) + Signal Detail (bottom) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'hidden' }}>
            {/* Economic Calendar */}
            <HoloPanel
              label="ECONOMIC CALENDAR"
              code="ECO-CAL"
              accent="amber"
              style={{ flex: '1.4', minHeight: 0, display: 'flex', flexDirection: 'column' }}
              bodyClassName="nx-scroll"
              bodyStyle={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}
            >
              {econ.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 32px',
                    gap: 6,
                    alignItems: 'center',
                    padding: '5px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                    {e.time}
                  </span>
                  <div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        color: e.actual ? (e.actual > e.forecast ? JADE : ROSE) : 'rgba(255,255,255,0.75)',
                        lineHeight: 1.2,
                      }}
                    >
                      {e.event}
                    </div>
                    <div className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.3)' }}>
                      {e.country} · prev {e.prev} · fcst {e.forecast}
                      {e.actual ? ` · act ${e.actual}` : ''}
                    </div>
                  </div>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 7,
                      color: impColor(e.impact),
                      border: `1px solid ${impColor(e.impact)}40`,
                      padding: '1px 3px',
                      textAlign: 'center',
                    }}
                  >
                    {e.impact}
                  </span>
                </div>
              ))}
            </HoloPanel>

            {/* Signal Detail */}
            <HoloPanel
              label="FLOW SOURCE"
              code="FS-DET"
              accent="cyan"
              style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
              bodyStyle={{
                flex: 1,
                overflow: 'hidden',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {selSig ? (
                <>
                  <div>
                    <span
                      className="hud-label"
                      style={{ fontSize: 7.5, color: srcColor(selSig.source), letterSpacing: '0.22em' }}
                    >
                      {selSig.source} · {new Date(selSig.ts).toLocaleTimeString()}
                    </span>
                    <div
                      className="hud-label"
                      style={{
                        fontSize: 17,
                        color: sideColor(selSig.side),
                        letterSpacing: '0.12em',
                        marginTop: 3,
                      }}
                    >
                      {selSig.sym} · {selSig.side}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span className="hud-label" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>
                        CONFIDENCE
                      </span>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 10,
                          color: selSig.confidence > 75 ? JADE : selSig.confidence > 55 ? AMBER : ROSE,
                        }}
                      >
                        {selSig.confidence}%
                      </span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${selSig.confidence}%`,
                          background: selSig.confidence > 75 ? JADE : selSig.confidence > 55 ? AMBER : ROSE,
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      ['ENTRY', selSig.entry, CYAN_BRIGHT],
                      ['TP', selSig.tp, JADE],
                      ['SL', selSig.sl, ROSE],
                    ].map(([l, v, c]) => (
                      <div
                        key={l}
                        style={{ padding: '6px 8px', border: `1px solid ${c}30`, background: `${c}08` }}
                      >
                        <div
                          className="hud-label"
                          style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}
                        >
                          {l}
                        </div>
                        <div className="font-mono" style={{ fontSize: 11, color: c as string }}>
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 'auto' }}>
                    <button
                      className="hud-label"
                      style={{
                        flex: 1,
                        padding: '7px',
                        fontSize: 8,
                        color: JADE,
                        border: `1px solid ${JADE}`,
                        cursor: 'pointer',
                        letterSpacing: '0.18em',
                        background: `${JADE}12`,
                      }}
                    >
                      ⚡ ALERT
                    </button>
                    <button
                      className="hud-label"
                      onClick={() => {
                        onSymbolSelect?.(selSig.sym);
                        onNavigate?.('TERMINAL');
                      }}
                      style={{
                        flex: 1,
                        padding: '7px',
                        fontSize: 8,
                        color: sideColor(selSig.side),
                        border: `1px solid ${sideColor(selSig.side)}`,
                        cursor: 'pointer',
                        letterSpacing: '0.18em',
                        background: `${sideColor(selSig.side)}12`,
                      }}
                    >
                      ▶ CHART
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    color: 'rgba(255,255,255,0.15)',
                    fontSize: 10,
                    fontFamily: 'monospace',
                  }}
                >
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
