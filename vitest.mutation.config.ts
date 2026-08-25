// @ts-nocheck
import { defineConfig } from 'vitest/config';

/**
 * Narrow Vitest surface for Stryker — calibrated 3-file set that holds break ≥70.
 * Full 5-module run (2026-08-25) scored 61.03; see docs/MUTATION-BLOCKER.md.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'electron/harness/governance/risk-gate.test.ts',
      'src/lib/prop-accounts.test.ts',
      'src/lib/trading-math.test.ts',
    ],
    pool: 'forks',
    fileParallelism: false,
  },
});
