/**
 * CCXT paper-trading data path — live OHLCV/ticker for paper portfolio, never places orders.
 */
// @ts-nocheck

import { apiRateLimiter, rateLimitOrThrow } from '../security/rate-limiter';
import { isDryRun } from '../config/dry-run';

export interface CcxtTickerQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  exchange: string;
  at: string;
}

export interface CcxtOhlcvBar {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type CcxtExchange = {
  loadMarkets: () => Promise<unknown>;
  fetchTicker: (symbol: string) => Promise<{
    bid?: number;
    ask?: number;
    last?: number;
  }>;
  fetchOHLCV: (symbol: string, timeframe?: string, since?: number, limit?: number) => Promise<number[][]>;
};

let exchange: CcxtExchange | null = null;
let exchangeId = 'binance';

async function loadExchange(id?: string): Promise<CcxtExchange> {
  const want = (id || process.env.JARVIS_CCXT_EXCHANGE || 'binance').toLowerCase();
  if (exchange && exchangeId === want) return exchange;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ccxt = require('ccxt') as Record<string, new (opts?: Record<string, unknown>) => CcxtExchange>;
  const Ctor = ccxt[want];
  if (!Ctor) throw new Error(`ccxt exchange „${want}" nicht gefunden`);
  exchange = new Ctor({ enableRateLimit: true });
  exchangeId = want;
  await exchange.loadMarkets();
  return exchange;
}

/** Fetch ticker for paper sizing — read-only, never creates orders. */
export async function fetchPaperTicker(symbol: string): Promise<CcxtTickerQuote> {
  rateLimitOrThrow(apiRateLimiter, `ccxt-ticker:${symbol}`);
  const ex = await loadExchange();
  const t = await ex.fetchTicker(symbol);
  const last = Number(t.last ?? t.bid ?? t.ask ?? 0);
  return {
    symbol,
    bid: Number(t.bid ?? last),
    ask: Number(t.ask ?? last),
    last,
    exchange: exchangeId,
    at: new Date().toISOString(),
  };
}

/** OHLCV for paper backtests / charts. */
export async function fetchPaperOhlcv(
  symbol: string,
  timeframe = '1h',
  limit = 100,
): Promise<CcxtOhlcvBar[]> {
  rateLimitOrThrow(apiRateLimiter, `ccxt-ohlcv:${symbol}`);
  const ex = await loadExchange();
  const rows = await ex.fetchOHLCV(symbol, timeframe, undefined, Math.min(500, limit));
  return rows.map((r) => ({
    ts: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
}

/** Status probe — dry-run safe. */
export async function ccxtPaperStatus(): Promise<{
  ok: boolean;
  exchange: string;
  dryRun: boolean;
  detail: string;
}> {
  try {
    rateLimitOrThrow(apiRateLimiter, 'ccxt-status');
    const ex = await loadExchange();
    void ex;
    return {
      ok: true,
      exchange: exchangeId,
      dryRun: isDryRun(),
      detail: 'ccxt paper data path ready (no live orders)',
    };
  } catch (err: unknown) {
    return {
      ok: false,
      exchange: exchangeId,
      dryRun: isDryRun(),
      detail: String((err as Error)?.message ?? err).slice(0, 160),
    };
  }
}
