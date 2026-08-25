/**
 * axe accessibility smoke (D8) — inject axe-core, fail on serious/critical.
 */
// @ts-nocheck

import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');
const userDataDir = path.join(__dirname, '.artifacts', 'a11y-user-data');

function resolveAxeSource(): string | null {
  const candidates = [
    path.join(repoRoot, 'node_modules', 'axe-core', 'axe.min.js'),
    path.join(repoRoot, 'node_modules', 'axe-core', 'axe.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  return null;
}

test.describe('a11y axe smoke', () => {
  test('Bridge has no serious/critical axe violations', async () => {
    const axeSrc = resolveAxeSource();
    test.skip(!axeSrc, 'axe-core not installed — pnpm add -D axe-core');

    fs.mkdirSync(userDataDir, { recursive: true });
    let app: ElectronApplication | undefined;
    try {
      app = await electron.launch({
        args: ['.', `--user-data-dir=${userDataDir}`],
        cwd: repoRoot,
        env: { ...process.env, JARVIS_E2E: '1', NODE_ENV: 'production' },
        timeout: 120_000,
      });
      const page: Page = await app.firstWindow();
      await page.waitForLoadState('domcontentloaded');
      await page.evaluate(() => window.localStorage.setItem('jarvis.setupDone', '1'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-screen-label="bridge"]').waitFor({ state: 'visible', timeout: 90_000 });

      await page.addScriptTag({ content: axeSrc });
      const results = await page.evaluate(async () => {
        // @ts-expect-error axe injected
        return await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
      });

      const bad = (results.violations || []).filter((v) => ['serious', 'critical'].includes(v.impact));
      test.info().annotations.push({
        type: 'a11y',
        description: `violations=${results.violations?.length ?? 0} serious+critical=${bad.length}`,
      });
      expect(bad, bad.map((v) => `${v.id}: ${v.help}`).join('; ') || 'axe serious/critical').toEqual([]);
    } finally {
      await app?.close().catch(() => {});
    }
  });
});
