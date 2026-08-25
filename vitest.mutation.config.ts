// @ts-nocheck
import { defineConfig } from 'vitest/config';

/**
 * Narrow Vitest surface for Stryker dry-run / mutation (full 5-module money/security set).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'electron/harness/governance/risk-gate.test.ts',
      'electron/security/command-allowlist.test.ts',
      'electron/security/threat-model.test.ts',
      'src/lib/prop-accounts.test.ts',
      'src/lib/trading-math.test.ts',
      'src/lib/quant.test.ts',
    ],
    pool: 'forks',
    fileParallelism: false,
  },
});
