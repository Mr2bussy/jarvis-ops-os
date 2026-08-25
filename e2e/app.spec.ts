// @ts-nocheck
import { test, expect } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/* ═══════════════════════════════════════════════════════════════════════════
 * End-to-end test of the real, built Electron app.
 *
 * Everything here asserts observable behaviour of a cold start: the window the
 * operator gets, the panels it paints, the date it claims, and — most
 * importantly — that it reports *nothing it cannot prove*. A test that only
 * checked "the app starts" would pass on a build that renders a fabricated HUD.
 * ═══════════════════════════════════════════════════════════════════════════ */

const repoRoot = path.resolve(__dirname, '..');
const artifactsDir = path.join(__dirname, '.artifacts');
/** Throwaway Electron profile — see `launch()` for why the run must not reuse the operator's. */
const userDataDir = path.join(artifactsDir, 'user-data');

/**
 * safeStorage keys that decide the CONTENT ORACLE rows (src/data/connectors.ts).
 * They are stripped from the child environment because `hasConfigKey()` falls
 * back to `process.env`, so an operator with, say, TIKTOK_TOKEN exported in
 * their shell would otherwise flip a row to "verbunden" and the honesty check
 * would silently stop testing anything.
 */
const CONNECTOR_ENV_KEYS = [
  'YOUTUBE_API_KEY',
  'INSTAGRAM_TOKEN',
  'TIKTOK_TOKEN',
  'TWITTER_BEARER_TOKEN',
  'LINKEDIN_TOKEN',
];

/**
 * Renderer console output that is *expected* on a machine without the trading
 * stack, and therefore not a defect:
 *
 *  - MT5: `useMt5LiveData` polls the Python bridge on 127.0.0.1:1234 every few
 *    seconds. Without a running bridge (or without MetaTrader5 installed) those
 *    calls fail; the HUD already renders that as "not connected", so a console
 *    line about it is noise, not a regression.
 *  - Autofill.*: Chromium DevTools protocol chatter emitted by Electron when a
 *    debugging client attaches. It comes from the browser, not from app code.
 *
 * Anything else fails the suite.
 */
const ALLOWED_CONSOLE_ERRORS: { pattern: RegExp; why: string }[] = [
  { pattern: /(localhost|127\.0\.0\.1):1234/i, why: 'MT5 bridge not running' },
  { pattern: /\bMT5\b/i, why: 'MT5 bridge not running' },
  { pattern: /ECONNREFUSED|ERR_CONNECTION_REFUSED|fetch failed/i, why: 'local bridge not running' },
  { pattern: /Autofill\.(enable|setAddresses)/i, why: 'Electron DevTools protocol noise' },
];

interface ConsoleEntry {
  type: string;
  text: string;
}

let app: ElectronApplication;
let page: Page;
const consoleEntries: ConsoleEntry[] = [];
const pageErrors: string[] = [];
const watchedPages = new WeakSet<Page>();
/** PIDs of MT5 bridges this run spawned; see `killOwnBridgeProcesses()`. */
let spawnedPythonPids: number[] = [];

/** Mirrors `useHudClock()` in src/lib/hud-clock.ts — e.g. `SUN 24 AUG 2026`. */
function hudDateLabel(d: Date): string {
  return d
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    .replace(',', '')
    .toUpperCase();
}

function watchConsole(target: Page): void {
  if (watchedPages.has(target)) return;
  watchedPages.add(target);
  target.on('console', (msg) => consoleEntries.push({ type: msg.type(), text: msg.text() }));
  target.on('pageerror', (err) => pageErrors.push(String(err?.stack || err)));
}

/**
 * The app spawns `python mt5_bridge/bridge.py` detached, so it outlives the
 * Electron process the test closes. Collecting the child PIDs *before* shutdown
 * (while the parent still exists) and killing exactly those afterwards means the
 * suite cannot strand a background HTTP server on port 1234 — and cannot touch a
 * bridge that some other JARVIS instance owns.
 */
function findChildPythonPids(parentPid: number): number[] {
  if (process.platform !== 'win32') return [];
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "ParentProcessId=${parentPid}" | Where-Object { $_.Name -like 'python*' } | ForEach-Object { $_.ProcessId }`,
      ],
      { encoding: 'utf8', timeout: 30_000 },
    );
    return out
      .split(/\r?\n/)
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

function killOwnBridgeProcesses(): void {
  for (const pid of spawnedPythonPids) {
    try {
      process.kill(pid);
    } catch {
      /* already gone */
    }
  }
  spawnedPythonPids = [];
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  fs.mkdirSync(artifactsDir, { recursive: true });
  // A fresh profile is what makes the honesty assertion meaningful: the config
  // store lives in userData, so reusing the operator's profile would test their
  // machine's key inventory instead of the app's empty-state contract.
  fs.rmSync(userDataDir, { recursive: true, force: true });

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !CONNECTOR_ENV_KEYS.includes(k)) env[k] = v;
  }
  // main.ts: `isDev = NODE_ENV !== 'production' && !app.isPackaged`. Unpackaged +
  // unset NODE_ENV would make the window load http://localhost:5173 and hang on a
  // dev server that is not running. Production mode is also the mode that applies
  // the real CSP, which is what we want to be testing anyway.
  env.NODE_ENV = 'production';

  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: repoRoot,
    env,
    timeout: 120_000,
  });
  // Attach before awaiting the window so nothing logged during first paint is missed.
  app.on('window', watchConsole);

  page = await app.firstWindow();
  watchConsole(page);
  await page.waitForLoadState('domcontentloaded');

  // First run shows the setup wizard on top of the Bridge. Flipping the flag the
  // wizard itself sets (src/screens/Setup.tsx) and reloading puts the app in the
  // state a returning operator sees — without writing a single connector key.
  await page.evaluate(() => window.localStorage.setItem('jarvis.setupDone', '1'));
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.locator('[data-screen-label="bridge"]').waitFor({ state: 'visible', timeout: 90_000 });

  const mainPid = app.process().pid;
  if (mainPid) spawnedPythonPids = findChildPythonPids(mainPid);
});

// Playwright rejects a non-destructured first parameter, so the empty pattern is
// mandatory here even though no fixture is used.
// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus || !page || page.isClosed()) return;
  const file = path.join(artifactsDir, `${testInfo.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.png`);
  await page.screenshot({ path: file }).catch(() => {
    /* screenshot is a debugging aid, never the reason a run fails */
  });
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
          /* already gone */
        }
      }
    }
    killOwnBridgeProcesses();
  },
  { timeout: 20_000 },
);

test('opens a single main window that identifies the app', async () => {
  const titles = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => w.getTitle()),
  );
  expect(titles).toHaveLength(1);
  // Electron replaces the `title:` given to `new BrowserWindow` with the loaded
  // document's <title> as soon as the page paints, so this asserts what the
  // operator actually reads on the taskbar.
  expect(titles[0]).toBe('JARVIS — Operations OS');
  expect(titles[0].replace(/\s+—\s+/, ' ')).toBe('JARVIS Operations OS');
  expect(await page.title()).toBe('JARVIS — Operations OS');
});

test('renders the three Bridge panels', async () => {
  // Labels carry a leading HUD glyph (◤ / ◆ / ◈); matching on the words keeps the
  // test about the panel's identity rather than its decoration.
  await expect(page.locator('.holo', { hasText: 'ZEUS EXECUTION MESH' }).first()).toBeVisible();
  await expect(page.locator('.holo', { hasText: 'CONTENT ORACLE · VERBINDUNGEN' }).first()).toBeVisible();
  await expect(
    page.locator('.holo', { hasText: 'MISSION CONTROL · ACTIVE DIRECTIVES' }).first(),
  ).toBeVisible();
});

test('status bar shows today, not a hard-coded date', async () => {
  const expected = hudDateLabel(new Date());
  const clock = page.locator('header').getByText(/^UTC[+-]\d{2} · /);
  await expect(clock).toBeVisible();

  const text = (await clock.innerText()).trim();
  // The whole point of this assertion: the label must be derived from the clock,
  // so it changes with the calendar. (A run started in the last second before
  // midnight can straddle the boundary — the app and the test read the same
  // local clock, so that window is a second wide.)
  expect(text).toContain(expected);

  // The literal that used to be baked into two components. Only a real 13 May
  // 2026 could legitimately print it, hence the guard.
  if (expected !== 'WED 13 MAY 2026') {
    expect(await page.locator('body').innerText()).not.toContain('WED 13 MAY 2026');
  }
});

test('reports 0/5 connectors and invents no reach when no keys are stored', async () => {
  const oracle = page.locator('.holo', { hasText: 'CONTENT ORACLE · VERBINDUNGEN' }).first();
  await expect(oracle).toBeVisible();

  // Counter must read exactly 0 of 5 — "3/5" or "5/5" fails here.
  await expect(oracle.getByText('0/5', { exact: true })).toBeVisible();
  await expect(oracle.getByText('VERBUNDEN', { exact: true })).toBeVisible();

  // Every platform row states the truth, and none claims a connection.
  await expect(oracle.getByText('+ nicht gesetzt', { exact: true })).toHaveCount(5);
  await expect(oracle.getByText('✓ verbunden', { exact: true })).toHaveCount(0);
  for (const label of ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'X/TWITTER', 'LINKEDIN']) {
    await expect(oracle.getByText(label, { exact: true })).toBeVisible();
  }

  // Reach stays the explicit empty marker, and no follower/impression figure may
  // appear anywhere in the panel: "12.4K", "3,2 Mio", "1.2M" and friends.
  await expect(oracle.getByText('REICHWEITE', { exact: true })).toBeVisible();
  const oracleText = (await oracle.innerText()).replace(/\s+/g, ' ');
  expect(oracleText).toMatch(/—/);
  expect(oracleText).not.toMatch(/\d+([.,]\d+)?\s*(K|M|Mio|Mrd)\b/);
  expect(oracleText).not.toMatch(/follower|impression|reichweite:\s*\d/i);
});

test('keeps contextIsolation intact — no Node reachable from the renderer', async () => {
  const probe = await page.evaluate(() => ({
    require: typeof (window as unknown as Record<string, unknown>).require,
    process: typeof (window as unknown as Record<string, unknown>).process,
    module: typeof (window as unknown as Record<string, unknown>).module,
    // Proves the assertion above is not passing merely because the page is blank:
    // the contextBridge surface is present while Node is not.
    bridge: typeof (window as unknown as Record<string, unknown>).jarvisBridge,
  }));
  expect(probe.require).toBe('undefined');
  expect(probe.process).toBe('undefined');
  expect(probe.module).toBe('undefined');
  expect(probe.bridge).toBe('object');
});

test('boots without unexpected renderer console errors', async () => {
  const errors = consoleEntries.filter((e) => e.type === 'error');
  const unexpected = errors.filter((e) => !ALLOWED_CONSOLE_ERRORS.some((a) => a.pattern.test(e.text)));

  expect(
    unexpected.map((e) => e.text),
    `Unexpected renderer console errors (allowed: ${ALLOWED_CONSOLE_ERRORS.map((a) => a.why).join(', ')})`,
  ).toEqual([]);
  expect(pageErrors, 'Uncaught renderer exceptions').toEqual([]);
});
