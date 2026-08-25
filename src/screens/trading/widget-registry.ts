// @ts-nocheck
/**
 * Terminal widget registry — extracted from ZeusBotPanel (D6).
 */

/* ─── Shared types ───────────────────────────────────────────────── */
export type WidgetId =
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

export const WIDGET_REGISTRY: WidgetDef[] = [
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

export const DEFAULT_LAYOUT: WidgetId[][] = [
  ['PRICE_CHART', 'ORDER_BOOK', 'CVD'],
  ['GAMMA_EXPOSURE', 'OPTIONS_FLOW', 'DARK_POOL'],
  ['RISK_DASHBOARD', 'EQUITY_CURVE', 'EXECUTION_LOG'],
];
