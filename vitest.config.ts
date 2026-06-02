import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-logic unit tests run in Node; no DOM needed for the current suite.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Scope coverage to the modules currently under test so the threshold is
      // meaningful. Expand this list as more logic is extracted + tested
      // (path to Dimension-1 "9/10": all of src/lib + electron non-UI ≥ 80%).
      include: [
        'electron/security/**',
        'electron/ai/**',
        'electron/config/**',
        'src/lib/extract-json.ts',
        'src/lib/claude.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
  },
});
