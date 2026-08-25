// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { applyPaperSignal, closePaperPosition, createPaperPortfolio } from './paper-trading';

describe('paper-trading', () => {
  const pf = createPaperPortfolio({ startingEur: 10_000, maxDailyLossPct: 0.05, maxRiskPerTradePct: 0.01 });

  it('rejects signal over per-trade cap', () => {
    const r = applyPaperSignal(
      pf,
      { symbol: 'EURUSD', side: 'BUY', riskEur: 200, reason: 'test', at: new Date().toISOString() },
      1.08,
      1.07,
      0.1,
    );
    expect(r.ok).toBe(false);
  });

  it('opens and closes paper position within caps', () => {
    const open = applyPaperSignal(
      pf,
      { symbol: 'EURUSD', side: 'BUY', riskEur: 50, reason: 'momentum', at: new Date().toISOString() },
      1.08,
      1.07,
      0.1,
    );
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    const close = closePaperPosition(open.portfolio, open.position.id, 1.09);
    expect(close.ok).toBe(true);
    if (!close.ok) return;
    expect(close.portfolio.positions).toHaveLength(0);
    expect(close.portfolio.equityEur).toBeGreaterThan(pf.equityEur);
  });
});
