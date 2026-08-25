/**
 * Production / ops IPC — dry-run, error-budget, updater, flags (D7).
 */
// @ts-nocheck

import type { IpcMain, BrowserWindow } from 'electron';
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isDryRun } from '../config/dry-run';
import { getAllFeatureFlags, getFeatureFlag, setFeatureFlag, type FeatureFlags } from '../config/flags';
import { getDecryptedKey, hasConfigKey, readConfigStore } from '../config/store';
import {
  getErrorBudgetSnapshot,
  recordVoiceLatency,
  appendErrorBudgetMetricFile,
} from '../metrics/error-budget';
import { getLogger } from '../logging/logger';
import { checkForUpdates, configureAutoUpdater, downloadUpdate, installUpdate } from '../updater/auto-update';
import { describeFeedForUi, resolveUpdateFeedUrl } from '../updater/feed';

const log = getLogger('ipc.production');

/** Packaged migration checklist — mirrors docs/PACKAGED-SAFESTORAGE-MIGRATION.md P0. */
export const PACKAGED_P0_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'JARVIS_MODEL',
  'JARVIS_AGENTS_PATH',
  'COMPOSIO_API_KEY',
] as const;

export type ProductionIpcDeps = {
  getMainWindow?: () => BrowserWindow | null;
  pushActivity?: (who: string, action: string, target: string) => void;
};

function redactedExport(): Record<string, string> {
  const store = readConfigStore();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(store)) {
    if (k.endsWith('__SET_AT') || k === 'ADVANCED_MODE') {
      out[k] = String(v);
      continue;
    }
    out[k] = v ? '[set]' : '';
  }
  return out;
}

export function registerProductionIpc(ipcMain: IpcMain, deps: ProductionIpcDeps = {}): void {
  // Updater is configured again in app.whenReady via configureAutoUpdater(pushActivity).
  void deps;
  configureAutoUpdater();

  ipcMain.handle('production:dry-run', () => {
    const packaged = Boolean(app.isPackaged);
    const p0 = PACKAGED_P0_KEYS.map((key) => ({
      key,
      inStore: hasConfigKey(key) && Boolean(getDecryptedKey(key)),
    }));
    const feed = resolveUpdateFeedUrl();
    const missingP0 = p0.filter((r) => !r.inStore).map((r) => r.key);
    return {
      ok: true,
      dryRun: isDryRun(),
      packaged,
      feed: describeFeedForUi(feed),
      feedDetail: feed,
      packagedChecklist: {
        p0,
        missingP0,
        ready: missingP0.length === 0 || !packaged,
      },
      version: app.getVersion(),
    };
  });

  ipcMain.handle('production:error-budget', () => {
    const snap = getErrorBudgetSnapshot();
    appendErrorBudgetMetricFile(snap);
    return snap;
  });

  ipcMain.handle('production:record-voice-latency', (_e, raw: unknown) => {
    const totalMs =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'object' && raw && 'totalMs' in raw
          ? Number((raw as { totalMs: number }).totalMs)
          : NaN;
    const ttfb =
      typeof raw === 'object' && raw && 'ttfbMs' in raw
        ? Number((raw as { ttfbMs?: number }).ttfbMs)
        : undefined;
    recordVoiceLatency(totalMs, ttfb);
    const snap = getErrorBudgetSnapshot();
    appendErrorBudgetMetricFile(snap);
    return snap;
  });

  ipcMain.handle('production:check-updates', async () => checkForUpdates());
  ipcMain.handle('production:download-update', async () => downloadUpdate());
  ipcMain.handle('production:install-update', () => installUpdate());

  ipcMain.handle('production:flags', () => getAllFeatureFlags());
  ipcMain.handle('production:setFlag', (_e, raw: unknown) => {
    const key = String((raw as { key?: string })?.key ?? '');
    const value = Boolean((raw as { value?: boolean })?.value);
    if (!(key in getAllFeatureFlags())) {
      return { ok: false, err: `unknown flag ${key}` };
    }
    setFeatureFlag(key as keyof FeatureFlags, value as FeatureFlags[keyof FeatureFlags]);
    return { ok: true, flags: getAllFeatureFlags() };
  });

  ipcMain.handle('production:kill-switch', (_e, raw: unknown) => {
    const on = Boolean((raw as { on?: boolean })?.on ?? true);
    setFeatureFlag('global.killSwitch', on);
    log.warn({ on }, 'kill-switch toggled');
    return { ok: true, killSwitch: getFeatureFlag('global.killSwitch') };
  });

  ipcMain.handle('production:crash-dumps-path', () => {
    try {
      return { ok: true, path: app.getPath('crashDumps') };
    } catch (e: unknown) {
      return { ok: false, err: String((e as Error)?.message ?? e) };
    }
  });

  ipcMain.handle('production:export-config', () => {
    const data = redactedExport();
    const outDir = app.getPath('documents');
    const out = path.join(outDir, `jarvis-config-export-${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, path: out };
  });

  ipcMain.handle('production:audit-trail', () => {
    // Lightweight stub — harness owns the durable audit log.
    return { ok: true, entries: [], note: 'see harness audit when enabled' };
  });

  ipcMain.handle('production:employee-health', () => {
    return {
      ok: true,
      email: Boolean(getFeatureFlag('email.enabled')),
      invoice: Boolean(getFeatureFlag('invoice.enabled')),
      calendar: Boolean(getFeatureFlag('calendar.enabled')),
      shop: Boolean(getFeatureFlag('shop.enabled')),
      killSwitch: Boolean(getFeatureFlag('global.killSwitch')),
    };
  });

  ipcMain.handle('production:employee-execute', (_e, raw: unknown) => {
    if (getFeatureFlag('global.killSwitch')) {
      return { ok: false, err: 'kill-switch armed' };
    }
    if (isDryRun()) {
      return { ok: true, dryRun: true, action: (raw as { action?: string })?.action ?? 'unknown' };
    }
    return {
      ok: false,
      err: 'employee-execute routed via employee:* IPC — use domain channels',
    };
  });

  ipcMain.handle('production:imap-idle-status', () => {
    return {
      ok: true,
      configured: Boolean(
        getDecryptedKey('IMAP_HOST') && getDecryptedKey('IMAP_USER') && getDecryptedKey('IMAP_PASSWORD'),
      ),
      idle: false,
    };
  });
}
