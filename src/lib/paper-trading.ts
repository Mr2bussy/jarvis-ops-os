/**
 * Paper trading portfolio with hard euro caps — no live money, no MT5 orders.
 *
 * Signals are intents only; execution stays behind HITL + MT5 bridge.
 */
// @ts-nocheck

export type PaperSide = 'BUY' | 'SELL';

export interface PaperSignal {
  symbol: string;
  side: PaperSide;
  /** Suggested risk in account currency at stop. */
  riskEur: number;
  stopPips?: number;
  reason: string;
  at: string;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  side: PaperSide;
  lots: number;
  entryPrice: number;
  stopPrice: number;
  riskEur: number;
  openedAt: string;
}

export interface PaperPortfolio {
  startingEur: number;
  equityEur: number;
  maxDailyLossEur: number;
  maxRiskPerTradeEur: number;
  dayPnlEur: number;
  positions: PaperPosition[];
}

export type PaperResult<T> = ({ ok: true } & T) | { ok: false; reason: string };

export function createPaperPortfolio(opts: {
  startingEur: number;
  maxDailyLossPct?: number;
  maxRiskPerTradePct?: number;
}): PaperPortfolio {
  const starting = Math.max(0, opts.startingEur);
  const maxDailyLossEur = starting * (opts.maxDailyLossPct ?? 0.05);
  const maxRiskPerTradeEur = starting * (opts.maxRiskPerTradePct ?? 0.01);
  return {
    startingEur: starting,
    equityEur: starting,
    maxDailyLossEur,
    maxRiskPerTradeEur,
    dayPnlEur: 0,
    positions: [],
  };
}

/** Apply a signal as a paper position if caps allow. */
export function applyPaperSignal(
  portfolio: PaperPortfolio,
  signal: PaperSignal,
  entryPrice: number,
  stopPrice: number,
  lots: number,
): PaperResult<{ portfolio: PaperPortfolio; position: PaperPosition }> {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { ok: false, reason: 'Ungültiger Einstiegspreis' };
  }
  if (signal.riskEur > portfolio.maxRiskPerTradeEur) {
    return {
      ok: false,
      reason: `Risiko ${signal.riskEur.toFixed(2)} € über Limit ${portfolio.maxRiskPerTradeEur.toFixed(2)} €`,
    };
  }
  const projectedDayLoss = portfolio.dayPnlEur - signal.riskEur;
  if (projectedDayLoss < -portfolio.maxDailyLossEur) {
    return {
      ok: false,
      reason: `Tagesverlustlimit ${portfolio.maxDailyLossEur.toFixed(2)} € würde überschritten`,
    };
  }

  const position: PaperPosition = {
    id: `paper_${Date.now()}`,
    symbol: signal.symbol,
    side: signal.side,
    lots,
    entryPrice,
    stopPrice,
    riskEur: signal.riskEur,
    openedAt: signal.at,
  };

  return {
    ok: true,
    portfolio: { ...portfolio, positions: [...portfolio.positions, position] },
    position,
  };
}

/**
 * Apply a live CCXT last price into paper portfolio math helpers.
 * Keeps paper trading free of live order placement.
 */
export function paperEntryFromQuote(
  signal: PaperSignal,
  lastPrice: number,
  stopPips = 20,
  pipSize = 0.0001,
): { entryPrice: number; stopPrice: number } | { ok: false; reason: string } {
  if (!(lastPrice > 0) || !Number.isFinite(lastPrice)) {
    return { ok: false, reason: 'Ungültiger Marktpreis' };
  }
  const pips = signal.stopPips ?? stopPips;
  const stopDistance = pips * pipSize;
  const stopPrice = signal.side === 'BUY' ? lastPrice - stopDistance : lastPrice + stopDistance;
  return { entryPrice: lastPrice, stopPrice };
}

/** Close paper position at exit price — updates equity and day PnL. */
export function closePaperPosition(
  portfolio: PaperPortfolio,
  positionId: string,
  exitPrice: number,
): PaperResult<{ portfolio: PaperPortfolio; pnlEur: number }> {
  const pos = portfolio.positions.find((p) => p.id === positionId);
  if (!pos) return { ok: false, reason: 'Position nicht gefunden' };

  const dir = pos.side === 'BUY' ? 1 : -1;
  const pnlEur = dir * (exitPrice - pos.entryPrice) * pos.lots * 100_000 * 0.0001;
  const remaining = portfolio.positions.filter((p) => p.id !== positionId);

  return {
    ok: true,
    pnlEur,
    portfolio: {
      ...portfolio,
      equityEur: portfolio.equityEur + pnlEur,
      dayPnlEur: portfolio.dayPnlEur + pnlEur,
      positions: remaining,
    },
  };
}
