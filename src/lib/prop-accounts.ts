/**
 * Prop Maxing — multi-account trade mirroring.
 *
 * One account is the **origin**: the desk the operator actually trades. Every
 * other connected account is a **follower** that reproduces the origin's trades.
 *
 * ## Why lot size is never copied
 *
 * The naive implementation copies `volume` across accounts. That is the single
 * most destructive thing this module could do: 1.00 lot risking 0.4 % on a
 * $250k account risks 10 % on a $10k account. One mirrored trade would breach
 * the smaller account's daily loss limit and fail the evaluation.
 *
 * So the mirror carries **risk intent**, not size. From the origin fill we
 * derive the fraction of equity being risked, then re-solve the lot size for
 * each follower against its own equity, its own risk cap, and its own broker
 * constraints (min/max/step). A follower that cannot express the trade inside
 * its own rules is **skipped with a reason** — never rounded up to "close
 * enough".
 *
 * ## Prop-firm rules are enforced, not assumed
 *
 * Each account carries its own rule set (daily loss, total loss, max lots,
 * news-window ban). A mirror is refused when it would breach any of them. The
 * rules live with the account because they differ per firm and per phase, and a
 * single global setting would quietly mis-apply to every other account.
 *
 * Nothing here places orders. It computes intents; execution stays behind the
 * MT5 bridge and the harness risk gate, which require explicit approval.
 */

export type AccountRole = 'origin' | 'follower';

/** Rule set as published by the prop firm for this account and phase. */
export interface PropRules {
  /** Max loss per trading day, as a fraction of starting equity (0.05 = 5 %). */
  maxDailyLossPct: number;
  /** Max total drawdown from the high-water mark, as a fraction. */
  maxTotalLossPct: number;
  /** Hard broker/firm ceiling on a single position, in lots. */
  maxLotsPerPosition: number;
  /** Firm forbids opening inside a macro-news window. */
  newsWindowBanned: boolean;
  /**
   * Firm forbids identical fills across accounts. Several funders treat
   * cross-account copying as a rule breach, so it is an explicit per-account
   * flag rather than an assumption either way.
   */
  copyTradingForbidden: boolean;
}

export interface PropAccount {
  id: string;
  label: string;
  firm: string;
  role: AccountRole;
  /** Current account equity in account currency. */
  equity: number;
  /** Equity the evaluation started from — the base for the daily/total limits. */
  startingEquity: number;
  /** Highest equity reached; the reference for trailing drawdown. */
  highWaterMark: number;
  /** Realised + floating P&L for the current trading day. */
  dayPnl: number;
  /** Fraction of equity this account may risk on one trade. */
  riskPerTradePct: number;
  rules: PropRules;
  /** Broker volume constraints. */
  minLots: number;
  lotStep: number;
  enabled: boolean;
}

/** A fill on the origin account that should be mirrored. */
export interface OriginFill {
  symbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  entryPrice: number;
  stopPrice: number;
  /** Account-currency loss per lot if the stop is hit. Broker-specific. */
  moneyRiskPerLotAtStop: number;
  takeProfitPrice?: number;
  openedAt: string;
}

export interface MirrorOrder {
  accountId: string;
  label: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  entryPrice: number;
  stopPrice: number;
  takeProfitPrice?: number;
  /** Fraction of this account's equity actually at risk after rounding. */
  riskPct: number;
  /** How the size was arrived at — shown in the UI, never hidden. */
  sizing: string;
}

export interface MirrorSkip {
  accountId: string;
  label: string;
  reason: string;
  /** True when a firm rule blocked it, as opposed to a sizing impossibility. */
  ruleBlocked: boolean;
}

export interface MirrorPlan {
  orders: MirrorOrder[];
  skipped: MirrorSkip[];
  /** Assumptions the plan rests on — always surfaced with the numbers. */
  assumptions: string[];
}

/** Round to the broker's volume step without ever rounding *up* past a cap. */
export function roundToStep(lots: number, step: number): number {
  if (!(step > 0)) return lots;
  const steps = Math.floor(lots / step + 1e-9);
  // Two decimals is the conventional lot precision; more invites float noise.
  return Math.round(steps * step * 100) / 100;
}

/** Risk the origin took, as a fraction of its own equity. */
export function originRiskPct(fill: OriginFill, origin: PropAccount): number {
  if (!(origin.equity > 0)) return 0;
  return (fill.lots * fill.moneyRiskPerLotAtStop) / origin.equity;
}

/** Remaining room before this account's daily loss limit, in account currency. */
export function dailyLossHeadroom(acc: PropAccount): number {
  const limit = acc.startingEquity * acc.rules.maxDailyLossPct;
  // dayPnl is negative on a losing day; headroom shrinks as it falls.
  return Math.max(0, limit + Math.min(0, acc.dayPnl));
}

/** Remaining room before the trailing total-drawdown limit. */
export function totalLossHeadroom(acc: PropAccount): number {
  const floor = acc.highWaterMark * (1 - acc.rules.maxTotalLossPct);
  return Math.max(0, acc.equity - floor);
}

export interface MirrorContext {
  /** True when a macro-news window is currently open. */
  inNewsWindow: boolean;
  /**
   * Operator has acknowledged that copying across accounts may breach firm
   * rules. Without it, accounts flagged `copyTradingForbidden` are skipped.
   */
  copyTradingAcknowledged: boolean;
}

/**
 * Build the mirror plan for one origin fill.
 *
 * Every follower is evaluated independently. A refusal is reported, not
 * silently dropped: an operator who believes six accounts mirrored when only
 * four did is worse off than one who sees two explicit skips.
 */
export function planMirror(fill: OriginFill, accounts: PropAccount[], ctx: MirrorContext): MirrorPlan {
  const origin = accounts.find((a) => a.role === 'origin');
  const orders: MirrorOrder[] = [];
  const skipped: MirrorSkip[] = [];

  if (!origin) {
    return {
      orders: [],
      skipped: [],
      assumptions: ['Kein Origin-Konto markiert — ohne Origin gibt es keine Risikoreferenz.'],
    };
  }

  const targetRisk = originRiskPct(fill, origin);
  const assumptions = [
    `Origin: ${origin.label} (${origin.firm}), Einsatz ${(targetRisk * 100).toFixed(2)} % des Kontos.`,
    'Übertragen wird die Risikoabsicht, nicht die Lotgröße — jedes Konto rechnet gegen sein eigenes Kapital.',
    `Geld-Risiko pro Lot am Stop: ${fill.moneyRiskPerLotAtStop.toFixed(2)} (brokerabhängig, vom Origin übernommen).`,
  ];
  if (ctx.inNewsWindow)
    assumptions.push('News-Fenster ist offen — Konten mit News-Verbot werden übersprungen.');

  for (const acc of accounts) {
    if (acc.role === 'origin') continue;
    if (!acc.enabled) {
      skipped.push({ accountId: acc.id, label: acc.label, reason: 'Konto deaktiviert', ruleBlocked: false });
      continue;
    }

    // ── Firm rules first: a rule breach is never worth any position size ──
    if (acc.rules.copyTradingForbidden && !ctx.copyTradingAcknowledged) {
      skipped.push({
        accountId: acc.id,
        label: acc.label,
        reason: `${acc.firm} untersagt identische Trades über Konten hinweg — nicht bestätigt`,
        ruleBlocked: true,
      });
      continue;
    }
    if (ctx.inNewsWindow && acc.rules.newsWindowBanned) {
      skipped.push({
        accountId: acc.id,
        label: acc.label,
        reason: 'Eröffnung im News-Fenster verboten',
        ruleBlocked: true,
      });
      continue;
    }

    const dayRoom = dailyLossHeadroom(acc);
    const totalRoom = totalLossHeadroom(acc);
    if (dayRoom <= 0) {
      skipped.push({
        accountId: acc.id,
        label: acc.label,
        reason: 'Tagesverlustlimit erreicht',
        ruleBlocked: true,
      });
      continue;
    }
    if (totalRoom <= 0) {
      skipped.push({
        accountId: acc.id,
        label: acc.label,
        reason: 'Gesamtverlustlimit erreicht',
        ruleBlocked: true,
      });
      continue;
    }

    // ── Sizing: the smallest of intent, own cap, and remaining headroom ──
    const byIntent = Math.min(targetRisk, acc.riskPerTradePct) * acc.equity;
    const budget = Math.min(byIntent, dayRoom, totalRoom);
    if (!(fill.moneyRiskPerLotAtStop > 0)) {
      skipped.push({
        accountId: acc.id,
        label: acc.label,
        reason: 'Risiko pro Lot unbekannt — Größe nicht berechenbar',
        ruleBlocked: false,
      });
      continue;
    }

    const raw = budget / fill.moneyRiskPerLotAtStop;
    const capped = Math.min(raw, acc.rules.maxLotsPerPosition);
    const lots = roundToStep(capped, acc.lotStep);

    if (lots < acc.minLots || lots <= 0) {
      skipped.push({
        accountId: acc.id,
        label: acc.label,
        // Rounding *up* to the minimum would silently exceed the risk budget,
        // which is how mirrored trades breach limits on small accounts.
        reason: `Berechnete Größe ${lots.toFixed(2)} unter Mindestvolumen ${acc.minLots} — kein Aufrunden`,
        ruleBlocked: false,
      });
      continue;
    }

    const actualRisk = (lots * fill.moneyRiskPerLotAtStop) / acc.equity;
    const limiter =
      capped === acc.rules.maxLotsPerPosition
        ? 'Positionsobergrenze'
        : budget === dayRoom
          ? 'Tagesverlust-Restraum'
          : budget === totalRoom
            ? 'Gesamtverlust-Restraum'
            : targetRisk <= acc.riskPerTradePct
              ? 'Risiko des Origin'
              : 'eigenes Risikolimit';

    orders.push({
      accountId: acc.id,
      label: acc.label,
      symbol: fill.symbol,
      side: fill.side,
      lots,
      entryPrice: fill.entryPrice,
      stopPrice: fill.stopPrice,
      takeProfitPrice: fill.takeProfitPrice,
      riskPct: actualRisk,
      sizing: `${lots.toFixed(2)} Lots · ${(actualRisk * 100).toFixed(2)} % Risiko · begrenzt durch ${limiter}`,
    });
  }

  return { orders, skipped, assumptions };
}

/** Aggregate exposure of a plan, for the confirmation dialog. */
export function planTotals(plan: MirrorPlan): {
  accounts: number;
  totalLots: number;
  maxRiskPct: number;
  ruleBlocked: number;
} {
  return {
    accounts: plan.orders.length,
    totalLots: Math.round(plan.orders.reduce((s, o) => s + o.lots, 0) * 100) / 100,
    maxRiskPct: plan.orders.reduce((m, o) => Math.max(m, o.riskPct), 0),
    ruleBlocked: plan.skipped.filter((s) => s.ruleBlocked).length,
  };
}
