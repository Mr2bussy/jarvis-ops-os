// @ts-nocheck
import type { Provider } from '../../ai/router';

/**
 * Cost- and latency-aware model catalogue for swarm routing.
 *
 * WHY this file exists: routing used to be "whatever model is configured", which means a
 * one-line classification is billed at the same rate as a refactor. The catalogue lets the
 * router pick the *cheapest model that can still do the job* instead of the strongest one.
 *
 * Data-honesty contract (AGENTS.md) — every number here is one of:
 *   1. a published list price, stamped with `pricedAt` so a later reader sees how stale it is,
 *   2. a hard fact (local inference has no per-token bill), or
 *   3. `null`, meaning "we do not know".
 * Nothing is estimated. A guessed price would silently harden into a routing decision, so an
 * unknown price stays `null` and `selectModel` treats it as unknown — never as cheap.
 *
 * `tier` and `strengths` are editorial classifications, not measurements: they encode which
 * jobs we are willing to send to a model, not how it scores on a benchmark.
 */

export type ModelTier = 'frontier' | 'balanced' | 'fast' | 'local';

export type TaskKind = 'classify' | 'extract' | 'summarize' | 'reason' | 'code' | 'converse';

export interface ModelProfile {
  id: string;
  provider: Provider;
  tier: ModelTier;
  /** USD per 1M input tokens. `null` = no verified source — must not be read as "cheap". */
  inputCostPerMTok: number | null;
  /** USD per 1M output tokens. `null` = no verified source. */
  outputCostPerMTok: number | null;
  /** Measured wall-clock latency. `null` = never measured here (see note below). */
  typicalLatencyMs: number | null;
  /** Max context in tokens. `null` = not verified for this id. */
  contextWindow: number | null;
  strengths: TaskKind[];
  /** ISO date the price columns were copied from the provider's list; `null` when unpriced. */
  pricedAt: string | null;
}

/**
 * Capability floor ordering for `minTier`. 'local' ranks lowest because it is the weakest
 * capability commitment we make, even though it is also the cheapest — cost and capability
 * are ranked separately on purpose.
 */
const TIER_RANK: Record<ModelTier, number> = { local: 0, fast: 1, balanced: 2, frontier: 3 };

/**
 * Latency is a MEASURED value, not a published one. Providers do not publish per-request
 * latency, and this repo has no harness feeding real timings back here yet — every recorded
 * benchmark `wallMs` is still 0. So every entry below is `null` = unknown, and a
 * `maxLatencyMs` constraint rejects unknown latency exactly the way a cost limit rejects an
 * unknown price. Fill these in from real measurements; never by guessing.
 */
const LATENCY_UNMEASURED = null;

export const MODEL_PROFILES: readonly ModelProfile[] = [
  // --- Anthropic -----------------------------------------------------------------------
  // LIST prices copied 2026-06-24 from Anthropic's published pricing table. These are list
  // prices at the time of writing, not observed spend; `pricedAt` is what makes that
  // checkable later instead of trusting the numbers blindly.
  {
    id: 'claude-opus-5',
    provider: 'anthropic',
    tier: 'frontier',
    inputCostPerMTok: 5.0,
    outputCostPerMTok: 25.0,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: 1_000_000,
    strengths: ['reason', 'code', 'summarize', 'converse'],
    pricedAt: '2026-06-24',
  },
  {
    // Standard list rate. An introductory $2/$10 rate runs through 2026-08-31; the standard
    // rate is recorded here on purpose so routing does not silently get more expensive the
    // day the promotion ends.
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    tier: 'balanced',
    inputCostPerMTok: 3.0,
    outputCostPerMTok: 15.0,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: 1_000_000,
    strengths: ['reason', 'code', 'summarize', 'extract', 'converse'],
    pricedAt: '2026-06-24',
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    tier: 'fast',
    inputCostPerMTok: 1.0,
    outputCostPerMTok: 5.0,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: 200_000,
    strengths: ['classify', 'extract', 'summarize', 'converse'],
    pricedAt: '2026-06-24',
  },

  // --- Cloud models with no verified price source --------------------------------------
  // We have no authoritative price for these ids in this repo, and a remembered number is
  // exactly the invented measurement AGENTS.md forbids. Cost and context therefore stay
  // `null`; `selectModel` drops them whenever a cost limit is set, because "unknown" must
  // never be routed as if it were "cheap". Fill in with `pricedAt` once sourced.
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    tier: 'fast',
    inputCostPerMTok: null,
    outputCostPerMTok: null,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: null,
    strengths: ['classify', 'extract', 'summarize', 'converse'],
    pricedAt: null,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    tier: 'fast',
    inputCostPerMTok: null,
    outputCostPerMTok: null,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: null,
    strengths: ['classify', 'extract', 'summarize', 'converse'],
    pricedAt: null,
  },
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    tier: 'balanced',
    inputCostPerMTok: null,
    outputCostPerMTok: null,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: null,
    strengths: ['reason', 'code', 'summarize'],
    pricedAt: null,
  },
  {
    id: 'codestral',
    provider: 'mistral',
    tier: 'fast',
    inputCostPerMTok: null,
    outputCostPerMTok: null,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: null,
    strengths: ['code', 'extract'],
    pricedAt: null,
  },

  // --- Local (Ollama) -------------------------------------------------------------------
  // Cost is exactly 0 per token. That is a FACT, not an estimate: inference runs on the
  // user's own hardware and no per-token bill exists. (Hardware and electricity are real
  // costs, but they are not per-token and not what a routing budget governs.)
  // `contextWindow` stays null because it is decided by the pull / `num_ctx` setting, not by
  // the model id — so we genuinely do not know it from here.
  {
    id: 'qwen3:latest',
    provider: 'ollama',
    tier: 'local',
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: null,
    strengths: ['classify', 'extract', 'summarize', 'converse'],
    pricedAt: null,
  },
  {
    id: 'qwen3-coder-next',
    provider: 'ollama',
    tier: 'local',
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: null,
    strengths: ['code', 'extract'],
    pricedAt: null,
  },
  {
    id: 'llama3.3:70b',
    provider: 'ollama',
    tier: 'local',
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    typicalLatencyMs: LATENCY_UNMEASURED,
    contextWindow: null,
    strengths: ['reason', 'summarize', 'converse'],
    pricedAt: null,
  },
];

export interface ModelConstraints {
  /** Applies to input AND output rates — a model is only "in budget" if both fit. */
  maxCostPerMTok?: number;
  maxLatencyMs?: number;
  /** Capability floor: reject anything ranked below this tier. */
  minTier?: ModelTier;
  /** Only zero-cost local models. */
  requireLocal?: boolean;
}

export interface ModelRejection {
  id: string;
  why: string;
}

/**
 * Explicit result. The `ok: false` branch is the whole point: when nothing fits we say so
 * with the per-model reasons instead of quietly handing back a default model.
 */
export type ModelSelection =
  | { ok: true; profile: ModelProfile; reason: string; rejected: ModelRejection[] }
  | { ok: false; profile: null; reason: string; rejected: ModelRejection[] };

/** A local model is only "free" if we actually know both rates are zero. */
function isFreeLocal(p: ModelProfile): boolean {
  return p.tier === 'local' && p.inputCostPerMTok === 0 && p.outputCostPerMTok === 0;
}

/**
 * Ordering key, NOT a price estimate: summing the two published rates ranks models
 * consistently without inventing an input:output token mix we have never measured. Unknown
 * cost sorts last so an unpriced model is never preferred over a priced one.
 */
function costRank(p: ModelProfile): number {
  if (p.inputCostPerMTok === null || p.outputCostPerMTok === null) return Number.POSITIVE_INFINITY;
  return p.inputCostPerMTok + p.outputCostPerMTok;
}

/** Cheapest first; ties go to the *least over-powered* tier, then id for determinism. */
function byCheapestAdequate(a: ModelProfile, b: ModelProfile): number {
  const ca = costRank(a);
  const cb = costRank(b);
  if (ca !== cb) return ca < cb ? -1 : 1;
  if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) return TIER_RANK[a.tier] - TIER_RANK[b.tier];
  return a.id.localeCompare(b.id);
}

/** Why this model is out, or null if it survives. One place, so the reasons stay honest. */
function rejectionFor(p: ModelProfile, task: TaskKind, c: ModelConstraints): string | null {
  if (!p.strengths.includes(task)) return `not listed for '${task}'`;
  if (c.requireLocal && !isFreeLocal(p)) return 'requireLocal: only zero-cost local models qualify';
  if (c.minTier && TIER_RANK[p.tier] < TIER_RANK[c.minTier]) {
    return `tier '${p.tier}' is below minTier '${c.minTier}'`;
  }
  if (c.maxCostPerMTok !== undefined) {
    // Unknown is not cheap. An unpriced model cannot be shown to fit a budget, so it is out.
    if (p.inputCostPerMTok === null || p.outputCostPerMTok === null) {
      return `cost unknown — cannot be proven under the ${c.maxCostPerMTok}/MTok limit`;
    }
    if (p.inputCostPerMTok > c.maxCostPerMTok || p.outputCostPerMTok > c.maxCostPerMTok) {
      return `costs ${p.inputCostPerMTok}/${p.outputCostPerMTok} per MTok, over the ${c.maxCostPerMTok} limit`;
    }
  }
  if (c.maxLatencyMs !== undefined) {
    // Same rule as cost: unmeasured is not fast.
    if (p.typicalLatencyMs === null) {
      return `latency unmeasured — cannot be proven under the ${c.maxLatencyMs}ms limit`;
    }
    if (p.typicalLatencyMs > c.maxLatencyMs) {
      return `~${p.typicalLatencyMs}ms is over the ${c.maxLatencyMs}ms limit`;
    }
  }
  return null;
}

export function describeConstraints(c: ModelConstraints): string {
  const parts: string[] = [];
  if (c.requireLocal) parts.push('requireLocal');
  if (c.minTier) parts.push(`minTier=${c.minTier}`);
  if (c.maxCostPerMTok !== undefined) parts.push(`maxCostPerMTok=${c.maxCostPerMTok}`);
  if (c.maxLatencyMs !== undefined) parts.push(`maxLatencyMs=${c.maxLatencyMs}`);
  return parts.length ? parts.join(', ') : 'no constraints';
}

/** Human-readable price for a reason string — never fabricates a number for unpriced models. */
function describePrice(p: ModelProfile): string {
  if (p.inputCostPerMTok === null || p.outputCostPerMTok === null) return 'cost unknown';
  return `$${p.inputCostPerMTok}/$${p.outputCostPerMTok} per MTok`;
}

/**
 * Pick the cheapest model that can actually do `task` under `constraints`.
 *
 * The core rule, and the reason this function exists: a 'classify' job does NOT get a
 * frontier model just because a frontier model would also be capable. Capability is a filter
 * (`strengths` + `minTier`), cost is the ranking — so the winner is the cheapest adequate
 * model, not the strongest available one.
 *
 * There is no silent fallback: if nothing survives the filters the result is `ok: false`
 * carrying every per-model rejection reason.
 */
export function selectModel(task: TaskKind, constraints: ModelConstraints = {}): ModelSelection {
  const rejected: ModelRejection[] = [];
  const candidates: ModelProfile[] = [];

  for (const profile of MODEL_PROFILES) {
    const why = rejectionFor(profile, task, constraints);
    if (why) rejected.push({ id: profile.id, why });
    else candidates.push(profile);
  }

  if (!candidates.length) {
    return {
      ok: false,
      profile: null,
      reason: `no model satisfies '${task}' with ${describeConstraints(constraints)} — all ${rejected.length} profiles rejected; refusing to fall back silently`,
      rejected,
    };
  }

  const [profile] = [...candidates].sort(byCheapestAdequate);
  const unpriced = costRank(profile) === Number.POSITIVE_INFINITY;
  const reason = [
    `cheapest of ${candidates.length} model(s) able to '${task}': ${profile.id}`,
    `(${profile.tier}, ${describePrice(profile)})`,
    unpriced ? '— no priced alternative qualified, so cost is unverified' : '',
    `under ${describeConstraints(constraints)}`,
  ]
    .filter(Boolean)
    .join(' ');

  return { ok: true, profile, reason, rejected };
}
