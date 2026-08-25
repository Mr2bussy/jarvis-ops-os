import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-logic unit tests run in Node; no DOM needed for the current suite.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts', 'electron/harness/bench.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Scope coverage to the modules currently under test so the threshold is
      // meaningful. Expand this list as more logic is extracted + tested
      // (path to Dimension-1 "9/10": all of src/lib + electron non-UI ≥ 80%).
      include: [
        'electron/security/**',
        'electron/ai/**',
        'electron/config/**',
        'src/lib/extract-json.ts',
        'src/lib/claude.ts',
        'src/lib/trading-math.ts',
      ],
      // Exclude stubs / not-yet-tested modules so the floor reflects exercised code.
      exclude: [
        'electron/ai/llm-provider.ts',
        'electron/config/export-import.ts',
        'electron/security/path-not-blob.ts',
        '**/*.test.ts',
        '**/*.fuzz.test.ts',
      ],
      // Hard floor under last measured totals (92.5% lines); coverage-ratchet enforces non-regression.
      thresholds: { lines: 90, functions: 90, branches: 80 },
    },
  },
});
