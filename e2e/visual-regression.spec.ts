/**
 * Visual regression scaffold (D8) — Bridge, Admin, Trading.
 * Baselines under e2e/__screenshots__/
 *
 * Update: pnpm exec playwright test e2e/visual-regression.spec.ts --update-snapshots
 */
// @ts-nocheck

import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');
const userDataDir = path.join(__dirname, '.artifacts', 'visual', 'user-data');
const shotsDir = path.join(__dirname, '__screenshots__');

const MODULES: { id: string; label: string }[] = [
  { id: 'bridge', label: 'Bridge' },
  { id: 'admin', label: 'Admin' },
  { id: 'trading', label: 'Trading' },
];

test.describe.configure({ mode: 'serial' });

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(shotsDir, { recursive: true });

  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: repoRoot,
    env: { ...process.env, JARVIS_E2E: '1', NODE_ENV: 'production' },
    timeout: 120_000,
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => window.localStorage.setItem('jarvis.setupDone', '1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-screen-label]').first().waitFor({ state: 'visible', timeout: 90_000 });
});

test.afterAll(async () => {
  await app?.close().catch(() => {});
});

async function gotoModule(id: string) {
  // Prefer nav button by label text; fallback to data attributes if present.
  const nav = page
    .locator(`aside button`, {
      hasText: new RegExp(id === 'bridge' ? 'Bridge' : id === 'admin' ? 'Admin' : 'Trading', 'i'),
    })
    .first();
  if (await nav.count()) {
    await nav.click();
  } else {
    await page.evaluate((screenId) => {
      window.dispatchEvent(new CustomEvent('jarvis:nav', { detail: screenId }));
    }, id);
  }
  await page.locator(`[data-screen-label="${id}"]`).waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(400);
}

for (const mod of MODULES) {
  test(`screenshot baseline · ${mod.label}`, async () => {
    await gotoModule(mod.id);
    const out = path.join(shotsDir, `${mod.id}.png`);
    await page.screenshot({ path: out, fullPage: true });
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.statSync(out).size).toBeGreaterThan(800);

    // Playwright snapshot compare when baselines exist under e2e/__screenshots__
    await expect(page).toHaveScreenshot(`${mod.id}-viewport.png`, {
      fullPage: false,
      maxDiffPixelRatio: 0.12,
      animations: 'disabled',
    });
  });
}
