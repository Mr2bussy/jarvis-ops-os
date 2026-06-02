/**
 * trading-data.ts
 * Live market data hooks — Binance public REST API (no auth, CORS-enabled).
 * Provides real OHLCV, order book, CVD, funding rates and 24hr tickers.
 */
import { useState, useEffect, useRef } from 'react';

const B = 'https://api.binance.com/api/v3';
const BF = 'https://fapi.binance.com/fapi/v1';

export type DataStatus = 'loading' | 'live' | 'error' | 'stale';

/* ── Generic fetch with timeout ──────────────────────────────────── */
async function apiFetch<T>(url: string, ms = 6000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ── Types ───────────────────────────────────────────────────────── */
export interface Candle {
  time: number; o: number; h: number; l: number; c: number; v: number;
}
export interface BookLevel { p: number; s: number; }
export interface LiveBook {
  bids: BookLevel[]; asks: BookLevel[];
  spread: number; midPrice: number; bidImbalance: number;
}
export interface CVDPoint { cvd: number; delta: number; buyVol: number; sellVol: number; }
export interface FundingRow {
  exchange: string; symbol: string;
  rate: number; annRate: number; nextTime: string;
}
export interface LiveTicker {
  symbol: string; price: number; change24h: number;
  high: number; low: number; volume: number;
}

/* ── Utility: format countdown from epoch ms ─────────────────────── */
function fmtCountdown(epochMs: number): string {
  const diff = epochMs - Date.now();
  if (diff < 0) return '--';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h${String(m).padStart(2, '0')}m`;
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 1 — Candlestick (OHLCV) data
   ══════════════════════════════════════════════════════════════════ */
export function useBinanceKlines(
  symbol = 'BTCUSDT',
  interval = '3m',
  limit = 80,
) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');
  const [lastPrice, setLastPrice] = useState(0);

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await apiFetch<any[][]>(
        `${B}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      );
      if (!alive) return;
      if (raw && raw.length > 0) {
        const parsed: Candle[] = raw.map(k => ({
          time: k[0] as number,
          o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5],
        }));
        setCandles(parsed);
        setLastPrice(parsed[parsed.length - 1].c);
        setStatus('live');
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 10_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbol, interval, limit]);

  return { candles, status, lastPrice };
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 2 — Order Book (Level 2)
   ══════════════════════════════════════════════════════════════════ */
export function useBinanceOrderBook(symbol = 'BTCUSDT', limit = 20) {
  const [book, setBook] = useState<LiveBook | null>(null);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await apiFetch<{ bids: string[][]; asks: string[][] }>(
        `${B}/depth?symbol=${symbol}&limit=${limit}`,
      );
      if (!alive) return;
      if (raw) {
        const bids = raw.bids.map(([p, s]) => ({ p: +p, s: +s }));
        const asks = raw.asks.map(([p, s]) => ({ p: +p, s: +s }));
        const totalBid = bids.reduce((a, b) => a + b.s, 0);
        const totalAsk = asks.reduce((a, b) => a + b.s, 0);
        setBook({
          bids, asks,
          spread: +(asks[0].p - bids[0].p).toFixed(2),
          midPrice: (bids[0].p + asks[0].p) / 2,
          bidImbalance: +((totalBid / (totalBid + totalAsk)) * 100).toFixed(0),
        });
        setStatus('live');
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 2_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbol, limit]);

  return { book, status };
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 3 — CVD (Cumulative Volume Delta) from aggTrades
   ══════════════════════════════════════════════════════════════════ */
export function useBinanceCVD(symbol = 'BTCUSDT', initLimit = 300) {
  const [points, setPoints] = useState<CVDPoint[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');
  const lastIdRef = useRef(0);
  const accRef = useRef(0);

  useEffect(() => {
    let alive = true;

    async function initFetch() {
      const raw = await apiFetch<any[]>(
        `${B}/aggTrades?symbol=${symbol}&limit=${initLimit}`,
      );
      if (!alive || !raw) return;
      let cvd = 0;
      let buyVol = 0, sellVol = 0;
      const pts: CVDPoint[] = raw.map(t => {
        // m = true → buyer is maker → seller is aggressor → sell delta
        const qty = +t.q;
        if (t.m) { cvd -= qty; sellVol += qty; }
        else     { cvd += qty; buyVol  += qty; }
        return { cvd, delta: t.m ? -qty : qty, buyVol, sellVol };
      });
      lastIdRef.current = raw[raw.length - 1].a as number;
      accRef.current = cvd;
      if (alive) { setPoints(pts); setStatus('live'); }
    }

    async function incrementalFetch() {
      if (!lastIdRef.current) return;
      const raw = await apiFetch<any[]>(
        `${B}/aggTrades?symbol=${symbol}&fromId=${lastIdRef.current + 1}&limit=200`,
      );
      if (!alive || !raw || raw.length === 0) return;
      let acc = accRef.current;
      const newPts: CVDPoint[] = raw.map(t => {
        const qty = +t.q;
        if (t.m) acc -= qty; else acc += qty;
        return { cvd: acc, delta: t.m ? -qty : qty, buyVol: 0, sellVol: 0 };
      });
      lastIdRef.current = raw[raw.length - 1].a as number;
      accRef.current = acc;
      if (alive) {
        setPoints(prev => {
          const combined = [...prev, ...newPts];
          return combined.length > 400 ? combined.slice(-300) : combined;
        });
      }
    }

    initFetch();
    const iv = setInterval(incrementalFetch, 3_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbol, initLimit]);

  return { points, status };
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 4 — Perpetual Funding Rates (Binance Futures)
   ══════════════════════════════════════════════════════════════════ */
export function useFundingRates(
  symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT'],
) {
  const [rows, setRows] = useState<FundingRow[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;

    async function poll() {
      // Use Binance premiumIndex for funding rates
      const results = await Promise.all(
        symbols.map(sym => apiFetch<any>(`${BF}/premiumIndex?symbol=${sym}`)),
      );
      if (!alive) return;
      const valid = results.filter(Boolean) as any[];
      if (valid.length > 0) {
        setRows(
          valid.map(r => ({
            exchange: 'Binance',
            symbol: r.symbol as string,
            rate: +(+r.lastFundingRate * 100).toFixed(4),
            annRate: +(+r.lastFundingRate * 3 * 365 * 100).toFixed(1),
            nextTime: fmtCountdown(+r.nextFundingTime),
          })),
        );
        if (alive) setStatus('live');
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }

    poll();
    const iv = setInterval(poll, 30_000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return { rows, status };
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 5 — 24hr Tickers (spot prices + 24h stats)
   ══════════════════════════════════════════════════════════════════ */
export function useBinanceTickers(
  symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'],
) {
  const [tickers, setTickers] = useState<LiveTicker[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;
    async function poll() {
      const encoded = encodeURIComponent(JSON.stringify(symbols));
      const raw = await apiFetch<any[]>(`${B}/ticker/24hr?symbols=${encoded}`);
      if (!alive) return;
      if (raw && raw.length > 0) {
        setTickers(
          raw.map(t => ({
            symbol: t.symbol as string,
            price: +t.lastPrice,
            change24h: +t.priceChangePercent,
            high: +t.highPrice,
            low: +t.lowPrice,
            volume: +t.quoteVolume,
          })),
        );
        if (alive) setStatus('live');
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 5_000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return { tickers, status };
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 6 — Fear & Greed Index (alternative.me)
   ══════════════════════════════════════════════════════════════════ */
export interface FearGreedData { value: number; label: string; ts: number; }

export function useFearGreed() {
  const [data, setData] = useState<FearGreedData | null>(null);
  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await apiFetch<any>('https://api.alternative.me/fng/?limit=1', 8000);
      if (!alive || !raw) return;
      const d = raw.data?.[0];
      if (d) setData({ value: +d.value, label: d.value_classification as string, ts: +d.timestamp * 1000 });
    }
    poll();
    const iv = setInterval(poll, 300_000); // every 5 min
    return () => { alive = false; clearInterval(iv); };
  }, []);
  return data;
}

/* ── Status pill helper (re-exported for widgets to use) ─────────── */
export function statusColor(s: DataStatus): string {
  return s === 'live' ? '#00d084' : s === 'stale' ? '#ffb300' : s === 'error' ? '#ff1a6b' : '#00e5ff';
}
export function statusLabel(s: DataStatus): string {
  return s === 'live' ? '● LIVE' : s === 'stale' ? '◌ STALE' : s === 'error' ? '✕ OFFLINE' : '○ LOADING';
}

/* ── Text fetch (for XML/non-JSON responses) ─────────────────────── */
async function textFetch(url: string, ms = 12000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 7 — Deribit Options Flow (recent trades → WOptionsFlow)
   ══════════════════════════════════════════════════════════════════ */
export interface OptionsFlowRow {
  t: string; sym: string; type: 'CALL' | 'PUT'; exp: string; str: string;
  prem: string; side: string; iv: number; score: number; bull: boolean;
}

export function useDeribitOptionsTrades(currency = 'BTC', count = 20) {
  const [rows, setRows] = useState<OptionsFlowRow[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await apiFetch<any>(
        `https://www.deribit.com/api/v2/public/get_last_trades_by_currency?currency=${currency}&kind=option&count=${count}&sorting=desc`,
        12000,
      );
      if (!alive) return;
      if (raw?.result?.trades && Array.isArray(raw.result.trades)) {
        const trades = raw.result.trades as any[];
        const mapped: OptionsFlowRow[] = trades.slice(0, count).map((tr: any) => {
          // instrument_name e.g. "BTC-31MAY25-80000-C"
          const parts = (tr.instrument_name as string).split('-');
          const type: 'CALL' | 'PUT' = parts[3] === 'C' ? 'CALL' : 'PUT';
          const strike = parts[2] || '?';
          const exp = parts[1] || '?';
          const indexPx: number = tr.index_price || tr.underlying_price || 80000;
          const premUsd = (+(tr.price || 0)) * (+(tr.amount || 0)) * indexPx;
          const side = tr.direction === 'buy' ? 'SWEEP' : 'BLOCK';
          const iv = Math.round(+(tr.iv || 0));
          const score = Math.min(99, Math.round(50 + iv * 0.3 + Math.min(30, +(tr.amount || 0) * 0.5)));
          const ts = new Date(+(tr.timestamp || Date.now())).toTimeString().slice(0, 8);
          return {
            t: ts,
            sym: currency,
            type,
            exp,
            str: `${(+strike / 1000).toFixed(0)}K${type === 'CALL' ? 'C' : 'P'}`,
            prem: premUsd >= 1e6 ? `$${(premUsd / 1e6).toFixed(1)}M` : `$${(premUsd / 1e3).toFixed(0)}K`,
            side,
            iv,
            score,
            bull: type === 'CALL',
          };
        });
        if (alive) { setRows(mapped); setStatus('live'); }
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { alive = false; clearInterval(iv); };
  }, [currency, count]);

  return { rows, status };
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 8 — Deribit Options Book Summary → GEX + Vol Surface
   ══════════════════════════════════════════════════════════════════ */
export interface GexStrike { s: number; g: number; atm: boolean; }

export interface DeribitOptionsState {
  gexStrikes: GexStrike[];
  volSurface: number[][];        // [expiry_idx][moneyness_idx]
  volExpiries: string[];
  volMoneynessLabels: string[];  // e.g. '85%','90%',...
  spotPrice: number;
  atmIv30d: number;
  rrSkew30d: number;
  status: DataStatus;
}

function deribitDte(expStr: string): number {
  // e.g. "31MAY25" or "1JAN26"
  const MONTHS: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const numLen = expStr.match(/^\d+/)?.[0].length ?? 0;
  const day = +expStr.slice(0, numLen);
  const monthStr = expStr.slice(numLen, numLen + 3);
  const yearSuffix = expStr.slice(numLen + 3);
  const year = 2000 + +yearSuffix;
  const exp = new Date(year, MONTHS[monthStr] ?? 0, day, 8, 0, 0);
  return Math.max(0, (exp.getTime() - Date.now()) / 86_400_000);
}

const EMPTY_DERIBIT: DeribitOptionsState = {
  gexStrikes: [], volSurface: [], volExpiries: ['7d','14d','30d','60d','90d','180d','1Y'],
  volMoneynessLabels: ['85%','90%','95%','100%','105%','110%','115%'],
  spotPrice: 0, atmIv30d: 0, rrSkew30d: 0, status: 'loading',
};

export function useDeribitOptionsData(currency = 'BTC') {
  const [state, setState] = useState<DeribitOptionsState>(EMPTY_DERIBIT);

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await apiFetch<any>(
        `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`,
        15000,
      );
      if (!alive) return;
      if (!raw?.result || !Array.isArray(raw.result) || raw.result.length === 0) {
        if (alive) setState(s => ({ ...s, status: s.status === 'live' ? 'stale' : 'error' }));
        return;
      }

      const instruments = raw.result as any[];
      const spot: number = instruments[0]?.underlying_price || 0;
      if (spot === 0) { if (alive) setState(s => ({ ...s, status: 'error' })); return; }

      /* ── GEX per strike (within ±25% of spot) ── */
      const gexMap = new Map<number, number>();
      for (const instr of instruments) {
        const parts = (instr.instrument_name as string).split('-');
        if (parts.length !== 4) continue;
        const strike = +parts[2];
        const type = parts[3];
        const gamma: number = instr.gamma || 0;
        const oi: number = instr.open_interest || 0;
        // Simplified GEX: γ × OI × spot (scaled to ~1000 per strike for display)
        const gex = (type === 'C' ? 1 : -1) * gamma * oi * spot;
        gexMap.set(strike, (gexMap.get(strike) || 0) + gex);
      }
      const gexStrikes: GexStrike[] = Array.from(gexMap.entries())
        .filter(([s]) => s >= spot * 0.75 && s <= spot * 1.25)
        .sort(([a], [b]) => a - b)
        .slice(0, 20)
        .map(([s, g]) => ({ s, g, atm: Math.abs(s - spot) / spot < 0.006 }));

      /* ── Vol Surface [7 expiries × 7 moneyness buckets] ── */
      const EXP_DAYS = [7, 14, 30, 60, 90, 180, 365];
      const MON_VALS = [0.85, 0.90, 0.95, 1.0, 1.05, 1.10, 1.15];
      const ivAccum: { sum: number; cnt: number }[][] =
        EXP_DAYS.map(() => MON_VALS.map(() => ({ sum: 0, cnt: 0 })));

      for (const instr of instruments) {
        const parts = (instr.instrument_name as string).split('-');
        if (parts.length !== 4) continue;
        const dte = deribitDte(parts[1]);
        const strike = +parts[2];
        const mon = strike / spot;
        const iv: number = instr.mark_iv || 0;
        if (iv <= 0 || dte <= 0 || dte > 400) continue;
        const ei = EXP_DAYS.reduce((b, d, i) => Math.abs(d - dte) < Math.abs(EXP_DAYS[b] - dte) ? i : b, 0);
        const mi = MON_VALS.reduce((b, m, i) => Math.abs(m - mon) < Math.abs(MON_VALS[b] - mon) ? i : b, 0);
        ivAccum[ei][mi].sum += iv;
        ivAccum[ei][mi].cnt += 1;
      }

      const volSurface: number[][] = ivAccum.map(row =>
        row.map(cell => cell.cnt > 0 ? +(cell.sum / cell.cnt).toFixed(1) : 0),
      );

      // Fill zero cells with nearest non-zero neighbor value
      for (let ei = 0; ei < 7; ei++) {
        for (let mi = 0; mi < 7; mi++) {
          if (volSurface[ei][mi] === 0) {
            // find nearest cell with value
            const near = volSurface[ei].find(v => v > 0) ?? 30;
            volSurface[ei][mi] = near;
          }
        }
      }

      const atmIv30d = volSurface[2][3] || 30;
      const rrSkew30d = +(((volSurface[2][4] || 0) - (volSurface[2][2] || 0))).toFixed(1);

      if (alive) setState({
        gexStrikes, volSurface,
        volExpiries: ['7d', '14d', '30d', '60d', '90d', '180d', '1Y'],
        volMoneynessLabels: ['85%', '90%', '95%', '100%', '105%', '110%', '115%'],
        spotPrice: spot, atmIv30d, rrSkew30d, status: 'live',
      });
    }
    poll();
    const iv = setInterval(poll, 60_000);
    return () => { alive = false; clearInterval(iv); };
  }, [currency]);

  return state;
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 9 — US Treasury Yield Curve (XML feed)
   ══════════════════════════════════════════════════════════════════ */
export interface YieldCurveState {
  current: number[]; previous: number[]; tenors: string[]; status: DataStatus;
}

const YIELD_TENORS = ['1M','3M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y'];
const YIELD_TAGS = ['BC_1MONTH','BC_3MONTH','BC_6MONTH','BC_1YEAR','BC_2YEAR',
                    'BC_3YEAR','BC_5YEAR','BC_7YEAR','BC_10YEAR','BC_20YEAR','BC_30YEAR'];
const YIELD_FALLBACK = [5.32,5.28,5.21,5.04,4.82,4.75,4.48,4.45,4.43,4.61,4.72];
const YIELD_PREV_FB  = [5.28,5.25,5.18,5.01,4.88,4.79,4.52,4.49,4.47,4.64,4.75];

function parseYieldXml(xml: string, fallback: number[]): number[] {
  return YIELD_TAGS.map((tag, i) => {
    const re = new RegExp(`<d:${tag}[^>]*>([\\d.]+)<\\/d:${tag}>`, 'gi');
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) last = +m[1];
    return last > 0 ? last : fallback[i];
  });
}

function yyyymm(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function useTreasuryYieldCurve() {
  const [state, setState] = useState<YieldCurveState>({
    current: YIELD_FALLBACK, previous: YIELD_PREV_FB, tenors: YIELD_TENORS, status: 'loading',
  });

  useEffect(() => {
    let alive = true;
    async function poll() {
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const base = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=';
      const [curText, prevText] = await Promise.all([
        textFetch(`${base}${yyyymm(now)}`),
        textFetch(`${base}${yyyymm(prevMonth)}`),
      ]);
      if (!alive) return;
      if (curText && curText.includes('BC_10YEAR')) {
        const current  = parseYieldXml(curText,  YIELD_FALLBACK);
        const previous = prevText && prevText.includes('BC_10YEAR')
          ? parseYieldXml(prevText, YIELD_PREV_FB)
          : YIELD_PREV_FB;
        setState({ current, previous, tenors: YIELD_TENORS, status: 'live' });
      } else {
        if (alive) setState(s => ({ ...s, status: s.status === 'live' ? 'stale' : 'error' }));
      }
    }
    poll();
    const iv = setInterval(poll, 600_000); // 10 min
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return state;
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 10 — Binance Deep Order Book → Liquidity Map
   ══════════════════════════════════════════════════════════════════ */
export interface LiqLevel { p: number; liq: number; isEH: boolean; isEL: boolean; bull: boolean; }

export function useBinanceLiquidityMap(symbol = 'BTCUSDT') {
  const [levels, setLevels] = useState<LiqLevel[]>([]);
  const [spot, setSpot] = useState(0);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await apiFetch<{ bids: string[][]; asks: string[][] }>(
        `${B}/depth?symbol=${symbol}&limit=500`, 8000,
      );
      if (!alive) return;
      if (raw?.bids && raw?.asks) {
        const bids = raw.bids.map(([p, s]) => ({ p: +p, s: +s }));
        const asks = raw.asks.map(([p, s]) => ({ p: +p, s: +s }));
        const mid = bids.length > 0 && asks.length > 0 ? (bids[0].p + asks[0].p) / 2 : 0;
        if (mid === 0) return;

        // Bucket size: $1000 for BTC-range, $10 for mid-range, etc.
        const bkSize = mid > 10000 ? 1000 : mid > 500 ? 50 : mid > 10 ? 5 : 1;
        const clusterMap = new Map<number, number>();
        for (const { p, s } of [...bids, ...asks]) {
          const bucket = Math.round(p / bkSize) * bkSize;
          clusterMap.set(bucket, (clusterMap.get(bucket) || 0) + s);
        }

        // Keep buckets within ±15% of mid
        const entries = Array.from(clusterMap.entries())
          .filter(([p]) => p >= mid * 0.85 && p <= mid * 1.15)
          .sort(([a], [b]) => a - b);

        const maxLiq = Math.max(...entries.map(([, v]) => v), 1);
        // Round numbers are potential equal-highs/lows targets
        const roundInterval = bkSize * 5;

        const result: LiqLevel[] = entries.map(([p, liq]) => ({
          p,
          liq: (liq / maxLiq) * 1000,
          isEH: p % roundInterval === 0 && p > mid,
          isEL: p % roundInterval === 0 && p < mid,
          bull: p > mid,
        }));

        if (alive) { setLevels(result); setSpot(mid); setStatus('live'); }
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 6_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbol]);

  return { levels, spot, status };
}

/* ══════════════════════════════════════════════════════════════════
   HOOK 11 — Binance 30d Daily Returns → Correlation Matrix
   ══════════════════════════════════════════════════════════════════ */
const CORR_ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK', 'DOGE'];

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const mA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const mB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - mA, db = b[i] - mB;
    num += da * db; dA += da * da; dB += db * db;
  }
  return dA * dB > 0 ? +(num / Math.sqrt(dA * dB)).toFixed(2) : 0;
}

function toReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) r.push(closes[i] / closes[i - 1] - 1);
  return r;
}

export function useBinanceCorrelation() {
  const [state, setState] = useState<{ assets: string[]; matrix: number[][]; status: DataStatus }>({
    assets: CORR_ASSETS, matrix: [], status: 'loading',
  });

  useEffect(() => {
    let alive = true;
    async function poll() {
      const results = await Promise.all(
        CORR_ASSETS.map(a => apiFetch<any[][]>(`${B}/klines?symbol=${a}USDT&interval=1d&limit=32`)),
      );
      if (!alive) return;
      const closes = results.map(r => r?.map(k => +k[4]) ?? []);
      const rets = closes.map(toReturns);
      if (rets.some(r => r.length > 5)) {
        const n = CORR_ASSETS.length;
        const matrix: number[][] = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) => i === j ? 1 : pearson(rets[i], rets[j])),
        );
        if (alive) setState({ assets: CORR_ASSETS, matrix, status: 'live' });
      } else {
        if (alive) setState(s => ({ ...s, status: s.status === 'live' ? 'stale' : 'error' }));
      }
    }
    poll();
    const iv = setInterval(poll, 300_000); // 5 min
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return state;
}

/* ══════════════════════════════════════════════════════════════════
   ZEUS MT5 HOOKS — Primary live-data source via local bridge
   Bridge: http://localhost:1234/api/v1/   (JARVIS MT5 Bridge v2.0)
   ══════════════════════════════════════════════════════════════════ */

const ZEUS = 'http://localhost:1234/api/v1';

async function zeusFetch<T>(path: string, ms = 8000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(`${ZEUS}${path}`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ── HOOK Z1 — Candlestick / OHLCV from MT5 rates ──────────────── */
export function useZeusCandles(
  symbol = 'BTCUSD',
  tf = 'M15',
  limit = 200,
) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');
  const [lastPrice, setLastPrice] = useState(0);

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await zeusFetch<{ time: number; open: number; high: number; low: number; close: number; vol: number }[]>(
        `/rates?symbol=${symbol}&tf=${tf}&n=${limit}`,
      );
      if (!alive) return;
      if (raw && raw.length > 0) {
        const parsed: Candle[] = raw.map(k => ({
          time: k.time * 1000, // MT5 returns UNIX seconds; widgets expect ms
          o: k.open, h: k.high, l: k.low, c: k.close, v: k.vol,
        }));
        setCandles(parsed);
        setLastPrice(parsed[parsed.length - 1].c);
        setStatus('live');
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 10_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbol, tf, limit]);

  return { candles, status, lastPrice };
}

/* ── HOOK Z2 — Order Book (DOM) from MT5 ───────────────────────── */
export function useZeusBook(symbol = 'BTCUSD', depth = 20) {
  const [book, setBook] = useState<LiveBook | null>(null);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await zeusFetch<{ bids: { p: number; s: number }[]; asks: { p: number; s: number }[] }>(
        `/book?symbol=${symbol}&depth=${depth}`,
      );
      if (!alive) return;
      if (raw?.bids && raw.bids.length > 0) {
        const bids = raw.bids;
        const asks = raw.asks;
        const totalBid = bids.reduce((a, b) => a + b.s, 0);
        const totalAsk = asks.reduce((a, b) => a + b.s, 0);
        setBook({
          bids, asks,
          spread: asks.length > 0 && bids.length > 0 ? +(asks[0].p - bids[0].p).toFixed(5) : 0,
          midPrice: asks.length > 0 && bids.length > 0 ? (bids[0].p + asks[0].p) / 2 : 0,
          bidImbalance: +((totalBid / (totalBid + totalAsk || 1)) * 100).toFixed(0),
        });
        setStatus('live');
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 2_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbol, depth]);

  return { book, status };
}

/* ── HOOK Z3 — CVD from MT5 recent ticks ───────────────────────── */
export function useZeusCVD(symbol = 'BTCUSD', tickCount = 500) {
  const [points, setPoints] = useState<CVDPoint[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await zeusFetch<{ time: number; price: number; vol: number; buy: boolean }[]>(
        `/ticks_cvd?symbol=${symbol}&n=${tickCount}`,
      );
      if (!alive || !raw || raw.length === 0) {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
        return;
      }
      let cvd = 0;
      const pts: CVDPoint[] = raw.map(t => {
        const qty = t.vol;
        if (t.buy) cvd += qty; else cvd -= qty;
        return { cvd, delta: t.buy ? qty : -qty, buyVol: t.buy ? qty : 0, sellVol: t.buy ? 0 : qty };
      });
      if (alive) { setPoints(pts); setStatus('live'); }
    }
    poll();
    const iv = setInterval(poll, 5_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbol, tickCount]);

  return { points, status };
}

/* ── HOOK Z4 — Multi-symbol tickers from MT5 ───────────────────── */
export const ZEUS_TICKER_SYMBOLS = [
  'BTCUSD','ETHUSD','XAUUSD','EURUSD','GBPUSD',
  'USDJPY','SOLUSD','XRPUSD','USDCHF','AUDUSD',
];

export function useZeusTickers(symbols: string[] = ZEUS_TICKER_SYMBOLS) {
  const [tickers, setTickers] = useState<LiveTicker[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await zeusFetch<{
        symbol: string; price: number; change24h: number;
        high: number; low: number; volume: number;
      }[]>(`/batch?symbols=${symbols.join(',')}`);
      if (!alive) return;
      if (raw && raw.length > 0) {
        setTickers(
          raw.map(t => ({
            symbol: t.symbol, price: t.price, change24h: t.change24h,
            high: t.high, low: t.low, volume: t.volume,
          })),
        );
        setStatus('live');
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 5_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbols.join(',')]);

  return { tickers, status };
}

/* ── HOOK Z5 — Swap rates as funding rate proxy ─────────────────── */
const ZEUS_SWAP_SYMBOLS = ['BTCUSD','ETHUSD','XAUUSD','EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD'];

export function useZeusSwaps(symbols: string[] = ZEUS_SWAP_SYMBOLS) {
  const [rows, setRows] = useState<FundingRow[]>([]);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await zeusFetch<{
        symbol: string; swap_long: number; swap_short: number;
        ann_long: number; ann_short: number; exchange: string;
      }[]>(`/swaps?symbols=${symbols.join(',')}`);
      if (!alive) return;
      if (raw && raw.length > 0) {
        setRows(
          raw.map(r => ({
            exchange: 'MT5',
            symbol: r.symbol,
            // Use long swap as the "funding rate" equivalent; negative = bearish carry
            rate: +(r.ann_long / 365).toFixed(4),
            annRate: +r.ann_long.toFixed(2),
            nextTime: '8h00m', // MT5 swaps settle daily at broker rollover
          })),
        );
        setStatus('live');
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 60_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbols.join(',')]);

  return { rows, status };
}

/* ── HOOK Z6 — Liquidity map from MT5 order book ───────────────── */
export function useZeusLiquidityMap(symbol = 'BTCUSD') {
  const [levels, setLevels] = useState<LiqLevel[]>([]);
  const [spot, setSpot] = useState(0);
  const [status, setStatus] = useState<DataStatus>('loading');

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await zeusFetch<{ bids: { p: number; s: number }[]; asks: { p: number; s: number }[] }>(
        `/book?symbol=${symbol}&depth=50`, 8000,
      );
      if (!alive) return;
      if (raw?.bids && raw.bids.length > 0) {
        const all = [...raw.bids, ...raw.asks];
        const mid = raw.bids.length > 0 && raw.asks.length > 0
          ? (raw.bids[0].p + raw.asks[0].p) / 2 : 0;
        if (mid === 0) return;

        const bkSize = mid > 10000 ? 1000 : mid > 500 ? 50 : mid > 10 ? 0.5 : 0.0001;
        const clusterMap = new Map<number, number>();
        for (const { p, s } of all) {
          const bucket = Math.round(p / bkSize) * bkSize;
          clusterMap.set(bucket, (clusterMap.get(bucket) || 0) + s);
        }

        const entries = Array.from(clusterMap.entries())
          .filter(([p]) => p >= mid * 0.85 && p <= mid * 1.15)
          .sort(([a], [b]) => a - b);
        const maxLiq = Math.max(...entries.map(([, v]) => v), 1);
        const roundInterval = bkSize * 5;

        const result: LiqLevel[] = entries.map(([p, liq]) => ({
          p,
          liq: (liq / maxLiq) * 1000,
          isEH: p % roundInterval === 0 && p > mid,
          isEL: p % roundInterval === 0 && p < mid,
          bull: p > mid,
        }));

        if (alive) { setLevels(result); setSpot(mid); setStatus('live'); }
      } else {
        if (alive) setStatus(s => s === 'live' ? 'stale' : 'error');
      }
    }
    poll();
    const iv = setInterval(poll, 6_000);
    return () => { alive = false; clearInterval(iv); };
  }, [symbol]);

  return { levels, spot, status };
}

/* ── HOOK Z7 — Correlation matrix from MT5 daily closes ─────────── */
const ZEUS_CORR_ASSETS = ['BTCUSD','ETHUSD','EURUSD','GBPUSD','USDJPY','XAUUSD','AUDUSD','USDCHF','SOLUSD','USDCAD'];

export function useZeusCorrelation() {
  const [state, setState] = useState<{ assets: string[]; matrix: number[][]; status: DataStatus }>({
    assets: ZEUS_CORR_ASSETS, matrix: [], status: 'loading',
  });

  useEffect(() => {
    let alive = true;
    async function poll() {
      const raw = await zeusFetch<{ symbols: string[]; matrix: number[][] }>(
        `/corr?symbols=${ZEUS_CORR_ASSETS.join(',')}&n=32`, 15000,
      );
      if (!alive) return;
      if (raw?.matrix && raw.matrix.length > 0) {
        setState({ assets: raw.symbols, matrix: raw.matrix, status: 'live' });
      } else {
        if (alive) setState(s => ({ ...s, status: s.status === 'live' ? 'stale' : 'error' }));
      }
    }
    poll();
    const iv = setInterval(poll, 300_000); // 5 min
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return state;
}
