/**
 * Visual regression scaffold (D8) — Bridge, Admin, Trading.
 * Baselines: e2e/__screenshots__/
 * Update: UPDATE_SCREENSHOTS=1
 */
// @ts-nocheck

import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');
const artifactsDir = path.join(__dirname, '.artifacts');
const userDataDir = path.join(artifactsDir, 'screenshot-user-data');
const baselineDir = path.join(__dirname, '__screenshots__');
const update = process.env.UPDATE_SCREENSHOTS === '1';

const MODULES = [
  { id: 'bridge', nav: 'bridge' },
  { id: 'admin', nav: 'admin' },
  { id: 'trading', nav: 'trading' },
] as const;

test.describe.configure({ mode: 'serial' });

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(baselineDir, { recursive: true });
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
  await page.locator('[data-screen-label="bridge"]').waitFor({ state: 'visible', timeout: 90_000 });
});

test.afterAll(async () => {
  await app?.close().catch(() => {});
});

for (const mod of MODULES) {
  test(`screenshot baseline · ${mod.id}`, async () => {
    if (mod.nav !== 'bridge') {
      await page.locator(`[data-nav="${mod.nav}"]`).click();
    }
    await page.locator(`[data-screen-label="${mod.id}"]`).waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(400);

    const name = `${mod.id}.png`;
    const baseline = path.join(baselineDir, name);
    const shot = await page.screenshot({ fullPage: false });

    if (update || !fs.existsSync(baseline)) {
      fs.writeFileSync(baseline, shot);
      expect(fs.statSync(baseline).size).toBeGreaterThan(500);
      test.info().annotations.push({ type: 'screenshot', description: `wrote baseline ${name}` });
      return;
    }

    // Soft compare: size band (full pixelmatch is optional follow-up).
    const prev = fs.statSync(baseline).size;
    const next = shot.byteLength;
    const ratio = Math.abs(next - prev) / Math.max(prev, 1);
    test.info().annotations.push({
      type: 'screenshot',
      description: `compare ${name} prev=${prev} next=${next} delta=${(ratio * 100).toFixed(1)}%`,
    });
    // Allow 35% size drift for font/DPI; strict pixelmatch later.
    expect(ratio, `${name} size drifted ${(ratio * 100).toFixed(1)}%`).toBeLessThan(0.35);
    expect(next).toBeGreaterThan(500);
  });
}
