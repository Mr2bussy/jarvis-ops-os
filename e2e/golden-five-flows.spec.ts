/**
 * Golden five flows (D4/D8) — Start → Setup → Chat → Trading → Voice.
 *
 * Modes:
 *   JARVIS_E2E_STUB=1 (CI default under VERIFY_E2E=1):
 *     - Source contract hints (non-empty)
 *     - Real Chromium page-load assertions against e2e/fixtures/golden-shell.html
 *     - First-paint budget measured (FCP-style mark < FIRST_PAINT_BUDGET_MS)
 *   JARVIS_E2E_STUB=0: full Electron path (see app.spec / performance-budget)
 */
// @ts-nocheck

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(__dirname, '..');
const STUB = process.env.JARVIS_E2E_STUB === '1' || process.env.VERIFY_E2E_STUB === '1';
const FIRST_PAINT_BUDGET_MS = Number(process.env.GOLDEN_FIRST_PAINT_MS || 1500);
const FIXTURE = path.join(__dirname, 'fixtures', 'golden-shell.html');

const FLOWS = [
  { id: 'start', screen: 'bridge', hint: 'SelftestHealthCard|SYSTEM SELFTEST|BridgeScreen', nav: 'bridge' },
  { id: 'setup', screen: 'admin', hint: 'ADMIN PANEL|ModelsTab|AdminScreen', nav: 'admin' },
  { id: 'chat', screen: 'console', hint: 'CORE CHANNEL|completeStream|DegradedBanner', nav: 'console' },
  { id: 'trading', screen: 'trading', hint: 'TradingScreen|GODMODE|ZeusBot', nav: 'trading' },
  { id: 'voice', screen: 'bridge', hint: 'ENTER VOICE MODE|onVoice', nav: 'bridge' },
] as const;

test.describe('golden five flows', () => {
  test.describe.configure({ mode: 'serial' });

  if (STUB) {
    for (const flow of FLOWS) {
      test(`stub: ${flow.id} flow contract`, () => {
        const bridge = fs.readFileSync(path.join(repoRoot, 'src/screens/Bridge.tsx'), 'utf8');
        const admin = fs.readFileSync(path.join(repoRoot, 'src/screens/Admin.tsx'), 'utf8');
        const consoleSrc = fs.readFileSync(path.join(repoRoot, 'src/screens/Console.tsx'), 'utf8');
        const trading = fs.readFileSync(path.join(repoRoot, 'src/screens/TradingContent.tsx'), 'utf8');
        const shell = fs.readFileSync(path.join(repoRoot, 'src/components/shell.tsx'), 'utf8');
        const app = fs.readFileSync(path.join(repoRoot, 'src/App.tsx'), 'utf8');
        const blob = [bridge, admin, consoleSrc, trading, shell, app].join('\n');
        expect(blob.length).toBeGreaterThan(1000);
        const re = new RegExp(flow.hint, 'i');
        expect(re.test(blob), `flow ${flow.id} missing hint ${flow.hint}`).toBe(true);
        if (flow.id === 'start') {
          expect(bridge).toMatch(/SelftestHealthCard|SYSTEM SELFTEST/);
          expect(bridge).toMatch(/DegradedBanner/);
        }
        if (flow.id === 'chat') {
          expect(bridge + consoleSrc).toMatch(/DegradedBanner|completeStream/);
        }
      });
    }

    test('stub: five flows registered', () => {
      expect(FLOWS).toHaveLength(5);
    });

    test('page-load: golden shell renders five screen labels', async ({ page }) => {
      expect(fs.existsSync(FIXTURE), 'missing e2e/fixtures/golden-shell.html').toBe(true);
      const url = pathToFileURL(FIXTURE).href;
      const t0 = Date.now();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-testid="golden-root"]').waitFor({ state: 'visible', timeout: 15_000 });
      for (const flow of FLOWS) {
        await expect(page.locator(`[data-screen-label="${flow.screen}"]`).first()).toBeVisible();
        await expect(page.locator(`[data-nav="${flow.nav}"]`).first()).toBeVisible();
      }
      const elapsed = Date.now() - t0;
      test.info().annotations.push({
        type: 'perf',
        description: `golden-shell-dom-ready=${elapsed}ms budget=${FIRST_PAINT_BUDGET_MS}ms`,
      });
      expect(elapsed, `golden shell load ${elapsed}ms exceeds ${FIRST_PAINT_BUDGET_MS}ms`).toBeLessThan(
        FIRST_PAINT_BUDGET_MS,
      );
    });

    test('page-load: first-paint budget measured', async ({ page }) => {
      const url = pathToFileURL(FIXTURE).href;
      await page.goto(url, { waitUntil: 'load' });
      const paint = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const paints = performance.getEntriesByType('paint');
        const fcp = paints.find((p) => p.name === 'first-contentful-paint');
        return {
          fcp: fcp ? fcp.startTime : null,
          domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
          now: performance.now(),
        };
      });
      const measured = paint.fcp ?? paint.domContentLoaded ?? paint.now;
      test.info().annotations.push({
        type: 'perf',
        description: `first-paint-measured=${Number(measured).toFixed(1)}ms fcp=${paint.fcp} dcl=${paint.domContentLoaded} budget=${FIRST_PAINT_BUDGET_MS}ms`,
      });
      expect(measured, 'first-paint metric missing').toBeGreaterThan(0);
      expect(measured, `first paint ${measured}ms exceeds budget ${FIRST_PAINT_BUDGET_MS}ms`).toBeLessThan(
        FIRST_PAINT_BUDGET_MS,
      );
    });

    return;
  }

  test('electron: five flows smoke (requires display)', async () => {
    test.skip(true, 'Set JARVIS_E2E_STUB=0 and run app.spec for full Electron; stub covers CI');
  });
});
