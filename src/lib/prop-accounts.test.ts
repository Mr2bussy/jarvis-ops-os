// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  planMirror,
  planTotals,
  roundToStep,
  originRiskPct,
  dailyLossHeadroom,
  totalLossHeadroom,
  type PropAccount,
  type OriginFill,
  type MirrorContext,
} from './prop-accounts';

const rules = (over: Partial<PropAccount['rules']> = {}): PropAccount['rules'] => ({
  maxDailyLossPct: 0.05,
  maxTotalLossPct: 0.1,
  maxLotsPerPosition: 10,
  newsWindowBanned: false,
  copyTradingForbidden: false,
  ...over,
});

const acct = (over: Partial<PropAccount> = {}): PropAccount => ({
  id: 'a1',
  label: 'Konto',
  firm: 'TestFunder',
  role: 'follower',
  equity: 100_000,
  startingEquity: 100_000,
  highWaterMark: 100_000,
  dayPnl: 0,
  riskPerTradePct: 0.01,
  rules: rules(),
  minLots: 0.01,
  lotStep: 0.01,
  enabled: true,
  ...over,
});

/** Origin risking 0.4 % of a 250k account: 1 lot at 1000 per lot = 1000 = 0.4 %. */
const origin = acct({
  id: 'origin',
  label: 'Haupt',
  role: 'origin',
  equity: 250_000,
  startingEquity: 250_000,
  highWaterMark: 250_000,
  riskPerTradePct: 0.01,
});

const fill: OriginFill = {
  symbol: 'XAUUSD',
  side: 'BUY',
  lots: 1,
  entryPrice: 2400,
  stopPrice: 2390,
  moneyRiskPerLotAtStop: 1000,
  openedAt: '2026-08-24T08:00:00Z',
};

const ctx: MirrorContext = { inNewsWindow: false, copyTradingAcknowledged: true };

describe('the defect this module exists to prevent', () => {
  it('does NOT copy the origin lot size onto a much smaller account', () => {
    const small = acct({
      id: 'small',
      label: 'Klein 10k',
      equity: 10_000,
      startingEquity: 10_000,
      highWaterMark: 10_000,
    });
    const plan = planMirror(fill, [origin, small], ctx);

    expect(plan.orders).toHaveLength(1);
    const o = plan.orders[0];
    // Copying 1.00 lot would risk 1000 on 10k = 10 %, twice the daily limit.
    expect(o.lots).toBeLessThan(1);
    expect(o.riskPct).toBeLessThanOrEqual(0.01 + 1e-9);
  });

  it('scales the same intent proportionally across different account sizes', () => {
    const a = acct({ id: 'a', label: '50k', equity: 50_000, startingEquity: 50_000, highWaterMark: 50_000 });
    const b = acct({
      id: 'b',
      label: '200k',
      equity: 200_000,
      startingEquity: 200_000,
      highWaterMark: 200_000,
    });
    const plan = planMirror(fill, [origin, a, b], ctx);
    const [oa, ob] = plan.orders;
    // Four times the equity, four times the size — same fraction at risk.
    expect(ob.lots / oa.lots).toBeCloseTo(4, 1);
    expect(ob.riskPct).toBeCloseTo(oa.riskPct, 6);
  });

  it('never rounds up to the broker minimum to make a trade fit', () => {
    // 0.4 % of 500 is 2 currency units; at 1000 per lot that is 0.002 lots,
    // below a 0.10 minimum. Rounding up would risk 20 % of the account.
    const tiny = acct({
      id: 'tiny',
      label: 'Mini',
      equity: 500,
      startingEquity: 500,
      highWaterMark: 500,
      minLots: 0.1,
      lotStep: 0.1,
    });
    const plan = planMirror(fill, [origin, tiny], ctx);
    expect(plan.orders).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/Mindestvolumen/);
    expect(plan.skipped[0].ruleBlocked).toBe(false);
  });
});

describe('prop-firm rules block before sizing', () => {
  it('skips accounts whose firm forbids cross-account copying unless acknowledged', () => {
    const strict = acct({ id: 's', label: 'Streng', rules: rules({ copyTradingForbidden: true }) });
    const notAck = planMirror(fill, [origin, strict], { ...ctx, copyTradingAcknowledged: false });
    expect(notAck.orders).toHaveLength(0);
    expect(notAck.skipped[0].ruleBlocked).toBe(true);
    expect(notAck.skipped[0].reason).toMatch(/untersagt/);

    const ack = planMirror(fill, [origin, strict], { ...ctx, copyTradingAcknowledged: true });
    expect(ack.orders).toHaveLength(1);
  });

  it('skips news-banned accounts while a news window is open', () => {
    const banned = acct({ id: 'n', label: 'NewsBan', rules: rules({ newsWindowBanned: true }) });
    const free = acct({ id: 'f', label: 'Frei' });
    const plan = planMirror(fill, [origin, banned, free], { ...ctx, inNewsWindow: true });
    expect(plan.orders.map((o) => o.accountId)).toEqual(['f']);
    expect(plan.skipped[0].reason).toMatch(/News/);
    expect(plan.assumptions.join(' ')).toMatch(/News-Fenster/);
  });

  it('refuses an account that already hit its daily loss limit', () => {
    const burnt = acct({ id: 'b', label: 'Ausgereizt', dayPnl: -5_000 }); // 5 % of 100k
    const plan = planMirror(fill, [origin, burnt], ctx);
    expect(plan.orders).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/Tagesverlustlimit/);
    expect(plan.skipped[0].ruleBlocked).toBe(true);
  });

  it('refuses an account at its trailing total-drawdown floor', () => {
    const drawn = acct({ id: 'd', label: 'Drawdown', equity: 90_000, highWaterMark: 100_000 });
    const plan = planMirror(fill, [origin, drawn], ctx);
    expect(plan.orders).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/Gesamtverlustlimit/);
  });

  it('shrinks the size to the remaining daily headroom rather than refusing', () => {
    // The headroom only binds when it is tighter than the intent, so the origin
    // has to be risking more than the follower has left: 5 lots on the 250k
    // origin is 2 %, while 4 % already lost of a 5 % limit leaves 1 % of 100k =
    // 1000 => 1.00 lot at 1000 risk per lot.
    const partial = acct({ id: 'p', label: 'Teilweise', dayPnl: -4_000, riskPerTradePct: 0.05 });
    const plan = planMirror({ ...fill, lots: 5 }, [origin, partial], ctx);
    expect(plan.orders).toHaveLength(1);
    expect(plan.orders[0].lots).toBeCloseTo(1, 2);
    expect(plan.orders[0].sizing).toMatch(/Tagesverlust-Restraum/);
  });

  it('lets the origin intent bind when it is tighter than the headroom', () => {
    // The mirror image of the case above, and the reason the one above needed a
    // bigger origin fill: a 0.4 % origin trade stays 0.4 % even when the
    // follower still has 1 % of daily budget left.
    const partial = acct({ id: 'p2', label: 'Reserve', dayPnl: -4_000, riskPerTradePct: 0.05 });
    const plan = planMirror(fill, [origin, partial], ctx);
    expect(plan.orders[0].lots).toBeCloseTo(0.4, 2);
    expect(plan.orders[0].sizing).toMatch(/Risiko des Origin/);
  });

  it('honours the per-position lot ceiling and names it as the limiter', () => {
    const capped = acct({
      id: 'c',
      label: 'Deckel',
      equity: 1_000_000,
      startingEquity: 1_000_000,
      highWaterMark: 1_000_000,
      rules: rules({ maxLotsPerPosition: 2 }),
    });
    const plan = planMirror(fill, [origin, capped], ctx);
    expect(plan.orders[0].lots).toBe(2);
    expect(plan.orders[0].sizing).toMatch(/Positionsobergrenze/);
  });

  it('caps at the follower own risk limit when the origin risked more', () => {
    const bigRisk: OriginFill = { ...fill, lots: 5 }; // 2 % of the origin
    const cautious = acct({ id: 'q', label: 'Vorsichtig', riskPerTradePct: 0.005 });
    const plan = planMirror(bigRisk, [origin, cautious], ctx);
    expect(plan.orders[0].riskPct).toBeLessThanOrEqual(0.005 + 1e-9);
    expect(plan.orders[0].sizing).toMatch(/eigenes Risikolimit/);
  });
});

describe('reporting', () => {
  it('reports disabled accounts as skipped rather than dropping them silently', () => {
    const off = acct({ id: 'o', label: 'Aus', enabled: false });
    const plan = planMirror(fill, [origin, off], ctx);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].reason).toMatch(/deaktiviert/);
  });

  it('returns an explicit assumption when no origin is marked', () => {
    const plan = planMirror(fill, [acct({ id: 'x' })], ctx);
    expect(plan.orders).toHaveLength(0);
    expect(plan.assumptions.join(' ')).toMatch(/Kein Origin/);
  });

  it('skips when the per-lot risk is unknown instead of guessing one', () => {
    const plan = planMirror({ ...fill, moneyRiskPerLotAtStop: 0 }, [origin, acct()], ctx);
    expect(plan.orders).toHaveLength(0);
    expect(plan.skipped[0].reason).toMatch(/unbekannt/);
  });

  it('always states the origin risk it is propagating', () => {
    const plan = planMirror(fill, [origin, acct()], ctx);
    expect(plan.assumptions[0]).toMatch(/0\.40 %/);
  });

  it('totals the plan for the confirmation dialog', () => {
    const plan = planMirror(
      fill,
      [origin, acct({ id: 'a' }), acct({ id: 'b', rules: rules({ copyTradingForbidden: true }) })],
      {
        ...ctx,
        copyTradingAcknowledged: false,
      },
    );
    const t = planTotals(plan);
    expect(t.accounts).toBe(1);
    expect(t.ruleBlocked).toBe(1);
    expect(t.totalLots).toBeGreaterThan(0);
  });
});

describe('helpers', () => {
  it('rounds volume down to the step, never up', () => {
    expect(roundToStep(0.19, 0.1)).toBeCloseTo(0.1, 6);
    expect(roundToStep(1.999, 0.5)).toBeCloseTo(1.5, 6);
    expect(roundToStep(0.5, 0)).toBe(0.5); // no step known → unchanged
  });

  it('computes origin risk as a fraction of origin equity', () => {
    expect(originRiskPct(fill, origin)).toBeCloseTo(0.004, 6);
    expect(originRiskPct(fill, acct({ equity: 0 }))).toBe(0);
  });

  it('shrinks daily headroom only for losses, never grows it on wins', () => {
    expect(dailyLossHeadroom(acct({ dayPnl: 0 }))).toBeCloseTo(5000, 6);
    expect(dailyLossHeadroom(acct({ dayPnl: -2000 }))).toBeCloseTo(3000, 6);
    // A profitable day must not unlock extra loss budget.
    expect(dailyLossHeadroom(acct({ dayPnl: 9000 }))).toBeCloseTo(5000, 6);
  });

  it('measures total headroom against the high-water mark, not the start', () => {
    expect(totalLossHeadroom(acct({ equity: 120_000, highWaterMark: 120_000 }))).toBeCloseTo(12_000, 6);
    // Equity 100k against a 120k peak is already below the 10 % trailing floor
    // of 108k — headroom clamps to 0 rather than going negative.
    expect(totalLossHeadroom(acct({ equity: 100_000, highWaterMark: 120_000 }))).toBe(0);
  });
});
