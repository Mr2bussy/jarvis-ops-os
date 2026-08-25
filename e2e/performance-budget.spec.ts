/**
 * Performance budgets (D8).
 * - First paint / Bridge visible < 1500ms
 * - Module switch Bridge → Trading < 100ms (interaction)
 * VERIFY_E2E=1 (or PERF_BUDGET_STRICT=1) enforces; otherwise records only.
 */
// @ts-nocheck

import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');
const userDataDir = path.join(__dirname, '.artifacts', 'perf-budget', 'user-data');
const FIRST_PAINT_BUDGET_MS = 1500;
const MODULE_SWITCH_BUDGET_MS = 100;
const enforce = process.env.VERIFY_E2E === '1' || process.env.PERF_BUDGET_STRICT === '1';

let app: ElectronApplication;
let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  env.NODE_ENV = 'production';
  env.JARVIS_E2E = '1';

  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: repoRoot,
    env,
    timeout: 120_000,
  });
  page = await app.firstWindow();
});

test.afterAll(async () => {
  await app?.close().catch(() => {});
});

test('first paint budget (< 1.5s target)', async () => {
  const t0 = Date.now();
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => window.localStorage.setItem('jarvis.setupDone', '1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-screen-label="bridge"]').waitFor({ state: 'visible', timeout: 90_000 });
  const elapsed = Date.now() - t0;

  test.info().annotations.push({
    type: 'perf',
    description: `bridge-first-paint=${elapsed}ms budget=${FIRST_PAINT_BUDGET_MS}ms enforce=${enforce}`,
  });

  if (enforce) {
    expect(elapsed, `first paint ${elapsed}ms exceeds ${FIRST_PAINT_BUDGET_MS}ms`).toBeLessThan(
      FIRST_PAINT_BUDGET_MS,
    );
  } else {
    expect(elapsed).toBeGreaterThan(0);
  }
});

test('module switch budget Bridge → Trading (< 100ms)', async () => {
  await page.locator('[data-screen-label="bridge"]').waitFor({ state: 'visible', timeout: 60_000 });
  const tradingNav = page.locator('[data-nav="trading"]');
  await tradingNav.waitFor({ state: 'visible', timeout: 30_000 });

  const t0 = await page.evaluate(() => performance.now());
  await tradingNav.click();
  await page.locator('[data-screen-label="trading"]').waitFor({ state: 'visible', timeout: 30_000 });
  const t1 = await page.evaluate(() => performance.now());
  const elapsed = t1 - t0;

  test.info().annotations.push({
    type: 'perf',
    description: `module-switch=${elapsed.toFixed(1)}ms budget=${MODULE_SWITCH_BUDGET_MS}ms enforce=${enforce}`,
  });

  if (enforce) {
    expect(elapsed, `module switch ${elapsed}ms exceeds ${MODULE_SWITCH_BUDGET_MS}ms`).toBeLessThan(
      MODULE_SWITCH_BUDGET_MS,
    );
  } else {
    expect(elapsed).toBeGreaterThan(0);
  }
});
