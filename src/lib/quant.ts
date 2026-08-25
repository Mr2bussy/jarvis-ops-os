/**
 * Institutional risk and execution mathematics for the JARVIS trading floor.
 *
 * Modelled on the ZeusEdge Institutional Desk, whose governing comment reads
 * "Never fabricates OPRA/TRF/EMSX/BTCA fills". Two habits are borrowed here and
 * they matter more than any single formula:
 *
 *  1. **Every function can refuse.** Results are a discriminated union: either
 *     `{ ok: true, … }` or `{ ok: false, reason }`. Nothing returns a plausible
 *     number derived from insufficient data — a 3-observation VaR is not a small
 *     inaccuracy, it is a fabrication with a confidence interval attached.
 *
 *  2. **Every result states its assumptions.** The `assumptions` block travels
 *     with the number so a reader can see the model behind it, including what
 *     the number is *not*. A drawdown computed from an equity poll is not a
 *     custodian-reconciled figure and says so.
 *
 * Kept free of React and Electron imports so it is unit-testable on its own.
 */

export type QuantResult<T> = ({ ok: true } & T) | { ok: false; reason: string };

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function round(v: number, digits = 6): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function clean(values: readonly unknown[]): number[] {
  return values.map(finite).filter((v): v is number => v !== null);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Returns
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Simple period returns from an equity curve.
 *
 * Non-positive equity points are skipped rather than producing ±Infinity — a
 * broker poll that momentarily reports 0 must not poison every downstream stat.
 */
export function returnsFromEquity(equity: readonly number[]): number[] {
  const pts = clean(equity);
  const out: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    if (prev <= 0) continue;
    out.push((pts[i] - prev) / prev);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Value at Risk
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface VarReport {
  method: 'historical+parametric';
  observations: number;
  confidence: number;
  /** Loss threshold at the confidence level, in percent (negative = loss). */
  historicalVarPct: number;
  /** Mean loss beyond the VaR threshold — CVaR / expected shortfall. */
  expectedShortfallPct: number;
  parametricVarPct: number;
  meanReturnPct: number;
  volatilityPct: number;
  assumptions: {
    iidReturns: true;
    noLookahead: true;
    /** This is a desk-side estimate, not a vendor risk-engine number. */
    vendorRiskEngine: false;
  };
}

/**
 * Historical VaR with a parametric cross-check.
 *
 * Both are reported because they disagree in exactly the situations that matter:
 * when returns are fat-tailed, the parametric figure understates the risk and
 * the gap between the two is itself the signal.
 */
export function historicalVar(returns: readonly number[], confidence = 0.99): QuantResult<VarReport> {
  const sorted = clean(returns).sort((a, b) => a - b);
  if (sorted.length < 10) {
    return { ok: false, reason: `Mindestens 10 Beobachtungen nötig — vorhanden: ${sorted.length}.` };
  }
  const conf = Math.min(0.999, Math.max(0.9, finite(confidence) ?? 0.99));
  const index = Math.max(0, Math.floor((1 - conf) * sorted.length));
  const varReturn = sorted[index];
  const tail = sorted.slice(0, index + 1);
  const cvar = tail.reduce((s, v) => s + v, 0) / tail.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, sorted.length - 1);
  const sigma = Math.sqrt(variance);
  const z = conf >= 0.99 ? 2.326 : conf >= 0.95 ? 1.645 : 1.282;

  return {
    ok: true,
    method: 'historical+parametric',
    observations: sorted.length,
    confidence: conf,
    historicalVarPct: round(varReturn * 100, 4),
    expectedShortfallPct: round(cvar * 100, 4),
    parametricVarPct: round((mean - z * sigma) * 100, 4),
    meanReturnPct: round(mean * 100, 4),
    volatilityPct: round(sigma * 100, 4),
    assumptions: { iidReturns: true, noLookahead: true, vendorRiskEngine: false },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Drawdown
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface DrawdownReport {
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  peak: number;
  trough: number;
  /** Observations from the peak to the worst point — a duration, not a date. */
  drawdownLength: number;
  recovered: boolean;
  assumptions: { source: 'equity-poll'; custodianReconciled: false };
}

/**
 * Peak-to-trough drawdown on the running maximum.
 *
 * This is the same definition the Bridge risk rail and the harness risk gate
 * use; sharing one implementation is what keeps the HUD and the gate from
 * disagreeing about whether the account is in breach.
 */
export function drawdownProfile(equity: readonly number[]): QuantResult<DrawdownReport> {
  const pts = clean(equity);
  if (pts.length < 2) return { ok: false, reason: 'Equity-Kurve braucht mindestens 2 Punkte.' };

  let peak = pts[0];
  let peakIdx = 0;
  let worst = 0;
  let troughVal = pts[0];
  let troughIdx = 0;
  let bestPeakIdx = 0;

  for (let i = 0; i < pts.length; i++) {
    if (pts[i] > peak) {
      peak = pts[i];
      peakIdx = i;
    }
    if (peak > 0) {
      const dd = (peak - pts[i]) / peak;
      if (dd > worst) {
        worst = dd;
        troughVal = pts[i];
        troughIdx = i;
        bestPeakIdx = peakIdx;
      }
    }
  }

  const last = pts[pts.length - 1];
  const runningPeak = Math.max(...pts);
  const current = runningPeak > 0 ? (runningPeak - last) / runningPeak : 0;

  return {
    ok: true,
    maxDrawdownPct: round(worst * 100, 4),
    currentDrawdownPct: round(current * 100, 4),
    peak: round(pts[bestPeakIdx], 2),
    trough: round(troughVal, 2),
    drawdownLength: troughIdx - bestPeakIdx,
    recovered: last >= pts[bestPeakIdx],
    assumptions: { source: 'equity-poll', custodianReconciled: false },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Performance
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface PerformanceReport {
  observations: number;
  totalReturnPct: number;
  meanReturnPct: number;
  volatilityPct: number;
  /** Annualised, using the caller's periods-per-year. */
  sharpe: number;
  /** Like Sharpe but penalising downside deviation only. */
  sortino: number;
  hitRatePct: number;
  bestPct: number;
  worstPct: number;
  assumptions: { periodsPerYear: number; riskFreeRate: number; geometricCompounding: true };
}

export function performanceStats(
  returns: readonly number[],
  opts: { periodsPerYear?: number; riskFreeRate?: number } = {},
): QuantResult<PerformanceReport> {
  const r = clean(returns);
  if (r.length < 3) return { ok: false, reason: `Mindestens 3 Renditen nötig — vorhanden: ${r.length}.` };

  const periodsPerYear = finite(opts.periodsPerYear) ?? 252;
  const riskFree = finite(opts.riskFreeRate) ?? 0;
  const perPeriodRf = riskFree / periodsPerYear;

  const mean = r.reduce((s, v) => s + v, 0) / r.length;
  const variance = r.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, r.length - 1);
  const sigma = Math.sqrt(variance);

  const downside = r.filter((v) => v < perPeriodRf);
  const downsideDev = downside.length
    ? Math.sqrt(downside.reduce((s, v) => s + (v - perPeriodRf) ** 2, 0) / downside.length)
    : 0;

  const scale = Math.sqrt(periodsPerYear);
  const excess = mean - perPeriodRf;
  const total = r.reduce((acc, v) => acc * (1 + v), 1) - 1;

  return {
    ok: true,
    observations: r.length,
    totalReturnPct: round(total * 100, 4),
    meanReturnPct: round(mean * 100, 4),
    volatilityPct: round(sigma * 100, 4),
    sharpe: sigma > 0 ? round((excess / sigma) * scale, 4) : 0,
    sortino: downsideDev > 0 ? round((excess / downsideDev) * scale, 4) : 0,
    hitRatePct: round((r.filter((v) => v > 0).length / r.length) * 100, 2),
    bestPct: round(Math.max(...r) * 100, 4),
    worstPct: round(Math.min(...r) * 100, 4),
    assumptions: { periodsPerYear, riskFreeRate: riskFree, geometricCompounding: true },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Execution cost
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface ImpactReport {
  orderSharePct: number;
  executionDays: number;
  permanentImpactBps: number;
  temporaryImpactBps: number;
  totalImpactBps: number;
  expectedCostUsd: number;
  assumptions: {
    model: 'almgren-chriss';
    permanentCoefficient: number;
    temporaryCoefficient: number;
    /** Coefficients are literature defaults, not calibrated to this venue. */
    venueCalibrated: false;
  };
}

/**
 * Almgren–Chriss market impact estimate.
 *
 * Permanent impact scales with the square root of the order's share of average
 * daily volume; temporary impact with the square root of participation rate.
 * Both coefficients are literature defaults — the `venueCalibrated: false` flag
 * exists so nobody mistakes this for a broker's calibrated cost curve.
 */
export function almgrenChrissImpact(input: {
  orderUsd: number;
  advUsd: number;
  volatilityPct: number;
  participationPct: number;
  permanentCoefficient?: number;
  temporaryCoefficient?: number;
}): QuantResult<ImpactReport> {
  const orderUsd = finite(input.orderUsd);
  const advUsd = finite(input.advUsd);
  const volatilityPct = finite(input.volatilityPct);
  const participationPct = finite(input.participationPct);
  if (!(orderUsd && orderUsd > 0) || !(advUsd && advUsd > 0)) {
    return { ok: false, reason: 'Ordergröße und ADV müssen positiv sein.' };
  }
  if (!(volatilityPct && volatilityPct > 0) || !(participationPct && participationPct > 0)) {
    return { ok: false, reason: 'Volatilität und Beteiligungsrate müssen positiv sein.' };
  }

  const orderShare = orderUsd / advUsd;
  const participation = Math.min(1, participationPct / 100);
  const sigmaBps = volatilityPct * 100;
  const permanentCoefficient = finite(input.permanentCoefficient) ?? 0.12;
  const temporaryCoefficient = finite(input.temporaryCoefficient) ?? 0.65;

  const permanentImpactBps = permanentCoefficient * sigmaBps * Math.sqrt(orderShare);
  const temporaryImpactBps = temporaryCoefficient * sigmaBps * Math.sqrt(participation);
  const totalImpactBps = permanentImpactBps + temporaryImpactBps;

  return {
    ok: true,
    orderSharePct: round(orderShare * 100, 4),
    executionDays: round(orderShare / participation, 4),
    permanentImpactBps: round(permanentImpactBps, 4),
    temporaryImpactBps: round(temporaryImpactBps, 4),
    totalImpactBps: round(totalImpactBps, 4),
    expectedCostUsd: round((orderUsd * totalImpactBps) / 10_000, 2),
    assumptions: {
      model: 'almgren-chriss',
      permanentCoefficient,
      temporaryCoefficient,
      venueCalibrated: false,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Walk-forward validation
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface WalkForwardFold {
  fold: number;
  trainFrom: number;
  trainTo: number;
  testFrom: number;
  testTo: number;
  testReturnPct: number;
}

export interface WalkForwardReport {
  folds: WalkForwardFold[];
  meanTestReturnPct: number;
  positiveFolds: number;
  /** Share of folds that were profitable — the honest headline number. */
  consistencyPct: number;
  assumptions: {
    purgeBars: number;
    embargoBars: number;
    /** Purge + embargo remove the label leakage a naive split leaves behind. */
    leakageControlled: true;
    transactionCosts: false;
  };
}

/**
 * Purged walk-forward evaluation of a momentum rule.
 *
 * The purge and embargo are the point. A naive train/test split on overlapping
 * financial windows leaks the test period's information into training and makes
 * every strategy look profitable; dropping `purgeBars` around the boundary and
 * embargoing the bars right after it is the standard correction (López de Prado).
 * Costs are explicitly *not* modelled — `transactionCosts: false` says so.
 */
export function purgedWalkForward(
  closes: readonly number[],
  opts: { folds?: number; lookback?: number; purgeBars?: number; embargoBars?: number } = {},
): QuantResult<WalkForwardReport> {
  const px = clean(closes);
  const folds = Math.max(2, Math.floor(finite(opts.folds) ?? 4));
  const lookback = Math.max(2, Math.floor(finite(opts.lookback) ?? 20));
  const purge = Math.max(0, Math.floor(finite(opts.purgeBars) ?? lookback));
  const embargo = Math.max(0, Math.floor(finite(opts.embargoBars) ?? Math.ceil(lookback / 2)));

  const minBars = folds * (lookback + purge + embargo + 5);
  if (px.length < minBars) {
    return {
      ok: false,
      reason: `Mindestens ${minBars} Kursbeobachtungen nötig (${folds} Folds × Lookback ${lookback} + Purge/Embargo) — vorhanden: ${px.length}.`,
    };
  }

  const segment = Math.floor(px.length / folds);
  const results: WalkForwardFold[] = [];

  for (let f = 0; f < folds; f++) {
    const testFrom = f * segment;
    const testTo = f === folds - 1 ? px.length - 1 : testFrom + segment - 1;
    const trainTo = Math.max(0, testFrom - purge - 1);
    const trainFrom = 0;
    if (trainTo - trainFrom < lookback) continue;

    // Momentum rule: long while price is above its trailing mean.
    let ret = 1;
    for (let i = Math.max(testFrom + embargo, lookback); i <= testTo; i++) {
      const window = px.slice(i - lookback, i);
      const sma = window.reduce((s, v) => s + v, 0) / window.length;
      const long = px[i - 1] > sma;
      if (long && px[i - 1] > 0) ret *= px[i] / px[i - 1];
    }

    results.push({
      fold: f + 1,
      trainFrom,
      trainTo,
      testFrom,
      testTo,
      testReturnPct: round((ret - 1) * 100, 4),
    });
  }

  if (results.length === 0) return { ok: false, reason: 'Kein Fold hatte genug Trainingsdaten.' };

  const mean = results.reduce((s, r) => s + r.testReturnPct, 0) / results.length;
  const positive = results.filter((r) => r.testReturnPct > 0).length;

  return {
    ok: true,
    folds: results,
    meanTestReturnPct: round(mean, 4),
    positiveFolds: positive,
    consistencyPct: round((positive / results.length) * 100, 2),
    assumptions: {
      purgeBars: purge,
      embargoBars: embargo,
      leakageControlled: true,
      transactionCosts: false,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Transaction cost analysis
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface Fill {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  /** Reference price at decision time — arrival price for implementation shortfall. */
  arrivalPrice: number;
}

export interface TcaReport {
  fills: number;
  notionalUsd: number;
  /** Implementation shortfall in basis points, signed against the trader. */
  slippageBps: number;
  worstFillBps: number;
  bestFillBps: number;
  bySymbol: { symbol: string; fills: number; slippageBps: number }[];
  assumptions: {
    benchmark: 'arrival-price';
    /** No venue fees or borrow costs are included. */
    feesIncluded: false;
  };
}

/**
 * Implementation-shortfall TCA against arrival price.
 *
 * Sign convention: positive basis points always mean the fill was *worse* than
 * arrival, for both buys and sells. Reporting raw signed price differences is
 * the classic TCA bug — it makes a bad sell look like a good one.
 */
export function transactionCostAnalysis(fills: readonly Fill[]): QuantResult<TcaReport> {
  const valid = fills.filter(
    (f) =>
      finite(f.quantity) !== null &&
      finite(f.price) !== null &&
      finite(f.arrivalPrice) !== null &&
      f.quantity > 0 &&
      f.price > 0 &&
      f.arrivalPrice > 0,
  );
  if (valid.length === 0) return { ok: false, reason: 'Keine auswertbaren Ausführungen.' };

  const perFill = valid.map((f) => {
    const dir = f.side === 'BUY' ? 1 : -1;
    const bps = (((f.price - f.arrivalPrice) * dir) / f.arrivalPrice) * 10_000;
    return { ...f, bps, notional: f.price * f.quantity };
  });

  const notional = perFill.reduce((s, f) => s + f.notional, 0);
  const weighted = perFill.reduce((s, f) => s + f.bps * f.notional, 0) / Math.max(notional, 1e-9);

  const bySymbol = [...new Set(perFill.map((f) => f.symbol))].map((symbol) => {
    const rows = perFill.filter((f) => f.symbol === symbol);
    const n = rows.reduce((s, f) => s + f.notional, 0);
    return {
      symbol,
      fills: rows.length,
      slippageBps: round(rows.reduce((s, f) => s + f.bps * f.notional, 0) / Math.max(n, 1e-9), 4),
    };
  });

  return {
    ok: true,
    fills: perFill.length,
    notionalUsd: round(notional, 2),
    slippageBps: round(weighted, 4),
    worstFillBps: round(Math.max(...perFill.map((f) => f.bps)), 4),
    bestFillBps: round(Math.min(...perFill.map((f) => f.bps)), 4),
    bySymbol,
    assumptions: { benchmark: 'arrival-price', feesIncluded: false },
  };
}
