// @ts-nocheck
import { selectModel, type ModelConstraints, type ModelSelection, type TaskKind } from './model-profiles';

/** Operator-facing tier labels mapped to capability floors. */
export type SmartTier = 'tier1' | 'tier2' | 'tier3';

const TIER_CONSTRAINTS: Record<SmartTier, ModelConstraints> = {
  tier1: { requireLocal: true },
  tier2: { minTier: 'fast', maxCostPerMTok: 1.0 },
  tier3: { minTier: 'balanced' },
};

export function tierConstraints(tier: SmartTier): ModelConstraints {
  return TIER_CONSTRAINTS[tier];
}

export function routeByTier(task: TaskKind, tier: SmartTier): ModelSelection {
  return selectModel(task, tierConstraints(tier));
}

export interface TierRouteResult {
  tier: SmartTier;
  selection: ModelSelection;
  /** 0–1 confidence that this tier satisfies the task constraints. */
  confidence: number;
}

export function routeByTierWithConfidence(task: TaskKind, tier: SmartTier): TierRouteResult {
  const selection = routeByTier(task, tier);
  if (!selection.ok) {
    return { tier, selection, confidence: 0 };
  }
  let confidence = 0.7;
  if (tier === 'tier3') confidence = 0.92;
  else if (tier === 'tier2') confidence = 0.8;
  else if (tier === 'tier1' && selection.profile.provider === 'ollama') confidence = 0.75;
  return { tier, selection, confidence };
}

/**
 * Repair common JSON issues from free/local models before parsing tool blocks.
 * Returns repaired string or null if unrecoverable.
 */
export function repairJsonFragment(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;

  // Strip markdown fences if model wrapped JSON anyway
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  // Trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Single-quoted keys → double-quoted
  s = s.replace(/'([^']+)'\s*:/g, '"$1":');

  try {
    JSON.parse(s);
    return s;
  } catch {
    // Last resort: extract first {...} block
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      JSON.parse(m[0]);
      return m[0];
    } catch {
      return null;
    }
  }
}

export function describeTierPlan(tier: SmartTier, task: TaskKind): string {
  const sel = routeByTier(task, tier);
  if (!sel.ok) return `${tier}: keine passende Modelle (${sel.reason})`;
  return `${tier} → ${sel.profile.id} (${sel.profile.provider}, ${sel.profile.tier})`;
}
