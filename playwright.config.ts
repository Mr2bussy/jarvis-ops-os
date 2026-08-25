// @ts-nocheck
import { defineConfig } from '@playwright/test';

/**
 * End-to-end configuration — drives the *real* Electron app, not a dev server.
 *
 * Single worker on purpose: an instance of JARVIS owns a userData profile, two
 * global shortcuts (Alt+Space / Alt+J) and — via `tryStartMt5Bridge()` — TCP
 * port 1234. Two instances in parallel would fight over all three, so failures
 * would report on the harness instead of on the app.
 */
export default defineConfig({
  testDir: './e2e',
  // Playwright owns `*.spec.ts`; vitest owns `*.test.ts`. Keeping the two suffixes
  // disjoint is what stops either runner from collecting the other's files.
  testMatch: /.*\.spec\.ts$/,
  // Builds dist-electron/ + dist/ once, before the first spec launches Electron.
  globalSetup: './e2e/global-setup.ts',

  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),

  // Cold-starting Electron on Windows with an on-access virus scanner in front of
  // every file read regularly needs far more than Playwright's 30 s default —
  // the first window can take ~20 s on its own.
  timeout: 180_000,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      // Store visual baselines next to specs under e2e/__screenshots__
      pathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
      maxDiffPixelRatio: 0.12,
    },
  },

  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
});
