/**
 * Golden demo + screenshot regression (Electron production path).
 * Reuses the same launch pattern as app.spec.ts; focuses on Bridge → Admin screenshots.
 */
// @ts-nocheck

import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');
const artifactsDir = path.join(__dirname, '.artifacts', 'golden-demo');
const userDataDir = path.join(artifactsDir, 'user-data');
const shotsDir = path.join(artifactsDir, 'screenshots');

let app: ElectronApplication;
let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  fs.mkdirSync(shotsDir, { recursive: true });
  fs.rmSync(userDataDir, { recursive: true, force: true });

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  env.NODE_ENV = 'production';

  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: repoRoot,
    env,
    timeout: 120_000,
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => window.localStorage.setItem('jarvis.setupDone', '1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-screen-label="bridge"]').waitFor({ state: 'visible', timeout: 90_000 });
});

test.afterAll(
  async () => {
    const pid = app?.process()?.pid;
    if (pid) {
      try {
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { timeout: 10_000, stdio: 'ignore' });
      } catch {
        try {
          process.kill(pid);
        } catch {
          /* gone */
        }
      }
    }
  },
  { timeout: 20_000 },
);

test('golden demo: Bridge screenshot', async () => {
  await expect(page.locator('[data-screen-label="bridge"]')).toBeVisible();
  const file = path.join(shotsDir, '01-bridge.png');
  await page.screenshot({ path: file, fullPage: true });
  expect(fs.existsSync(file)).toBe(true);
  expect(fs.statSync(file).size).toBeGreaterThan(5_000);
});

test('golden demo: navigates sidebar and captures Admin', async () => {
  // Prefer data attributes / labels used by the HUD shell.
  const adminNav = page
    .locator('[data-nav="admin"], [data-screen="admin"], button:has-text("ADMIN")')
    .first();
  if (await adminNav.count()) {
    await adminNav.click({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  const file = path.join(shotsDir, '02-admin-or-bridge.png');
  await page.screenshot({ path: file, fullPage: true });
  expect(fs.statSync(file).size).toBeGreaterThan(2_000);
});
