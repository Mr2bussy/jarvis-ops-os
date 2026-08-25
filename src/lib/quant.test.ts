// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  returnsFromEquity,
  historicalVar,
  drawdownProfile,
  performanceStats,
  almgrenChrissImpact,
  purgedWalkForward,
  transactionCostAnalysis,
  type Fill,
} from './quant';

/** Deterministic pseudo-random walk — no Math.random, so failures reproduce. */
function walk(n: number, seed = 42, drift = 0.0004, vol = 0.01): number[] {
  let s = seed;
  const out = [100];
  for (let i = 1; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const u = s / 2147483648 - 0.5;
    out.push(out[i - 1] * (1 + drift + u * vol * 2));
  }
  return out;
}

describe('returnsFromEquity', () => {
  it('converts an equity curve to period returns', () => {
    expect(returnsFromEquity([100, 110, 99])).toEqual([0.1, -0.1]);
  });

  it('skips non-positive points instead of emitting Infinity', () => {
    const r = returnsFromEquity([100, 0, 50]);
    expect(r.every(Number.isFinite)).toBe(true);
  });

  it('returns an empty array for a single point', () => {
    expect(returnsFromEquity([100])).toEqual([]);
  });
});

describe('historicalVar', () => {
  it('refuses rather than estimating from too few observations', () => {
    const r = historicalVar([0.01, -0.02, 0.005]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/10 Beobachtungen/);
  });

  it('reports a loss threshold and a fatter expected shortfall', () => {
    const returns = Array.from({ length: 200 }, (_, i) => (i === 0 ? -0.2 : (i % 7) * 0.004 - 0.012));
    const r = historicalVar(returns, 0.99);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.historicalVarPct).toBeLessThan(0);
    // Expected shortfall averages the tail *beyond* VaR, so it is never milder.
    expect(r.expectedShortfallPct).toBeLessThanOrEqual(r.historicalVarPct);
    expect(r.observations).toBe(200);
  });

  it('clamps confidence into a sane band', () => {
    const returns = Array.from({ length: 50 }, (_, i) => (i % 5) * 0.002 - 0.004);
    const r = historicalVar(returns, 0.5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.confidence).toBe(0.9);
  });
});

describe('drawdownProfile', () => {
  it('measures peak-to-trough on the running maximum', () => {
    const r = drawdownProfile([100, 120, 90, 110]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.maxDrawdownPct).toBeCloseTo(25, 4); // 120 -> 90
    expect(r.peak).toBe(120);
    expect(r.trough).toBe(90);
  });

  it('reports zero drawdown for a monotonically rising curve', () => {
    const r = drawdownProfile([100, 101, 102, 103]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.maxDrawdownPct).toBe(0);
  });

  it('separates current drawdown from the worst one', () => {
    const r = drawdownProfile([100, 200, 100, 190]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.maxDrawdownPct).toBeCloseTo(50, 4);
    expect(r.currentDrawdownPct).toBeCloseTo(5, 4);
  });

  it('refuses a curve with fewer than two points', () => {
    expect(drawdownProfile([100]).ok).toBe(false);
  });
});

describe('performanceStats', () => {
  it('refuses fewer than three returns', () => {
    expect(performanceStats([0.01, 0.02]).ok).toBe(false);
  });

  it('computes hit rate and compounded total return', () => {
    const r = performanceStats([0.1, -0.05, 0.1, 0.02]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hitRatePct).toBe(75);
    // Geometric, not arithmetic: 1.1 * 0.95 * 1.1 * 1.02 - 1
    expect(r.totalReturnPct).toBeCloseTo((1.1 * 0.95 * 1.1 * 1.02 - 1) * 100, 4);
  });

  it('rates Sortino above Sharpe when losses are rarer than gains', () => {
    const returns = [0.02, 0.02, 0.02, 0.02, -0.005, 0.02, 0.02, 0.02];
    const r = performanceStats(returns);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sortino).toBeGreaterThan(r.sharpe);
  });
});

describe('almgrenChrissImpact', () => {
  it('rejects non-positive inputs instead of returning a cost', () => {
    const r = almgrenChrissImpact({ orderUsd: 0, advUsd: 1e6, volatilityPct: 2, participationPct: 10 });
    expect(r.ok).toBe(false);
  });

  it('grows impact with order size, sub-linearly', () => {
    const base = { advUsd: 100e6, volatilityPct: 2, participationPct: 10 };
    const small = almgrenChrissImpact({ ...base, orderUsd: 1e6 });
    const large = almgrenChrissImpact({ ...base, orderUsd: 4e6 });
    expect(small.ok && large.ok).toBe(true);
    if (!small.ok || !large.ok) return;
    expect(large.totalImpactBps).toBeGreaterThan(small.totalImpactBps);
    // Square-root law: 4x the order is 2x the permanent impact, not 4x.
    expect(large.permanentImpactBps / small.permanentImpactBps).toBeCloseTo(2, 4);
  });

  it('flags that the coefficients are not venue-calibrated', () => {
    const r = almgrenChrissImpact({ orderUsd: 1e6, advUsd: 1e8, volatilityPct: 2, participationPct: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.assumptions.venueCalibrated).toBe(false);
  });
});

describe('purgedWalkForward', () => {
  it('refuses when there are not enough bars for the requested folds', () => {
    const r = purgedWalkForward(walk(50), { folds: 4, lookback: 20 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Kursbeobachtungen/);
  });

  it('evaluates every fold and reports consistency, not just mean return', () => {
    const r = purgedWalkForward(walk(600), { folds: 4, lookback: 20 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.folds.length).toBeGreaterThan(0);
    expect(r.consistencyPct).toBeGreaterThanOrEqual(0);
    expect(r.consistencyPct).toBeLessThanOrEqual(100);
    expect(r.assumptions.leakageControlled).toBe(true);
    expect(r.assumptions.transactionCosts).toBe(false);
  });

  it('keeps a purge gap between the end of training and the test window', () => {
    const r = purgedWalkForward(walk(600), { folds: 4, lookback: 20, purgeBars: 20 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const f of r.folds) {
      if (f.testFrom > 0) expect(f.testFrom - f.trainTo).toBeGreaterThan(20);
    }
  });
});

describe('transactionCostAnalysis', () => {
  const buyWorse: Fill = { symbol: 'EURUSD', side: 'BUY', quantity: 100, price: 1.101, arrivalPrice: 1.1 };
  const sellWorse: Fill = { symbol: 'EURUSD', side: 'SELL', quantity: 100, price: 1.099, arrivalPrice: 1.1 };

  it('signs slippage against the trader for buys and sells alike', () => {
    const buy = transactionCostAnalysis([buyWorse]);
    const sell = transactionCostAnalysis([sellWorse]);
    expect(buy.ok && sell.ok).toBe(true);
    if (!buy.ok || !sell.ok) return;
    // Paying above arrival and selling below arrival are both costs.
    expect(buy.slippageBps).toBeGreaterThan(0);
    expect(sell.slippageBps).toBeGreaterThan(0);
    expect(buy.slippageBps).toBeCloseTo(sell.slippageBps, 6);
  });

  it('reports a negative figure when the fill beat arrival', () => {
    const r = transactionCostAnalysis([
      { symbol: 'BTCUSD', side: 'BUY', quantity: 1, price: 99, arrivalPrice: 100 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slippageBps).toBeLessThan(0);
  });

  it('weights the aggregate by notional, not by fill count', () => {
    const r = transactionCostAnalysis([
      { symbol: 'A', side: 'BUY', quantity: 1, price: 101, arrivalPrice: 100 },
      { symbol: 'B', side: 'BUY', quantity: 1000, price: 100, arrivalPrice: 100 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The large zero-slippage fill must dominate the small costly one.
    expect(r.slippageBps).toBeLessThan(10);
    expect(r.bySymbol).toHaveLength(2);
  });

  it('refuses a set with no usable fills', () => {
    expect(transactionCostAnalysis([]).ok).toBe(false);
  });
});
