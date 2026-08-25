/**
 * Global simulation / dry-run mode — blocks destructive side effects.
 * Enabled via JARVIS_DRY_RUN=1|true|yes or feature flag simulation.dryRun.
 */
// @ts-nocheck

import { getFeatureFlag } from './flags';

export function isDryRun(): boolean {
  const env = (process.env.JARVIS_DRY_RUN ?? '').trim().toLowerCase();
  if (env === '1' || env === 'true' || env === 'yes' || env === 'on') return true;
  try {
    return getFeatureFlag('simulation.dryRun');
  } catch {
    return false;
  }
}

/** Guard for write/send/order paths — returns a blocked result when dry-run is on. */
export function dryRunBlock(action: string): { blocked: true; reason: string } | { blocked: false } {
  if (!isDryRun()) return { blocked: false };
  return {
    blocked: true,
    reason: `JARVIS_DRY_RUN: „${action}" simuliert — kein Live-Side-Effect`,
  };
}
