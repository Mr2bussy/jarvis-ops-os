/**
 * electron-updater wiring (D7).
 * autoDownload stays false — install is an explicit IPC action (threat-model chain 6).
 */
// @ts-nocheck

import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import { getLogger } from '../logging/logger';
import { describeFeedForUi, resolveUpdateFeedUrl, type UpdateFeedStatus } from './feed';

const log = getLogger('updater');

let configured = false;
let lastStatus: UpdateFeedStatus | null = null;
let lastCheck: { at: string; ok: boolean; detail: string } | null = null;

export function getLastFeedStatus(): UpdateFeedStatus | null {
  return lastStatus;
}

export function getLastUpdateCheck(): typeof lastCheck {
  return lastCheck;
}

/**
 * Configure feed + fail-closed policy. Safe to call multiple times.
 * @param onLog optional activity/log callback (main pushActivity)
 */
export function configureAutoUpdater(
  onLog?: (msg: string) => void,
): UpdateFeedStatus & { failClosed: boolean; reason?: string } {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  const status = resolveUpdateFeedUrl();
  lastStatus = status;

  if (!status.ok || !status.url) {
    configured = false;
    const msg = status.reason;
    if (status.failClosed) {
      log.error({ reason: msg }, 'update feed fail-closed');
      onLog?.(msg);
    } else {
      log.info({ reason: msg }, 'update feed skipped');
      onLog?.(msg);
    }
    return { ...status, failClosed: Boolean(status.failClosed), reason: msg };
  }

  try {
    autoUpdater.setFeedURL({ provider: 'generic', url: status.url });
    configured = true;
    log.info({ url: status.url, source: status.source }, 'update feed configured');
    onLog?.(`feed ok · ${status.source}`);
  } catch (e: unknown) {
    configured = false;
    const reason = String((e as Error)?.message ?? e);
    log.error({ err: reason }, 'setFeedURL failed');
    lastStatus = { ok: false, url: null, reason, failClosed: Boolean(app?.isPackaged) };
    onLog?.(reason);
  }
  return {
    ...(lastStatus as UpdateFeedStatus),
    failClosed: Boolean(lastStatus && !lastStatus.ok && lastStatus.failClosed),
    reason: lastStatus && !lastStatus.ok ? lastStatus.reason : undefined,
  };
}

/** Push feed badge payload to renderer (TopBar). */
export function broadcastFeedStatus(win: BrowserWindow | null | undefined): void {
  if (!win || win.isDestroyed()) return;
  const status = lastStatus ?? resolveUpdateFeedUrl();
  const ui = describeFeedForUi(status);
  try {
    win.webContents.send('updater:feed-status', {
      feedUrl: status.ok ? status.url : null,
      source: status.ok ? status.source : 'none',
      packaged: Boolean(app?.isPackaged),
      failClosed: !status.ok && Boolean(status.failClosed),
      reason: status.ok ? undefined : status.reason,
      badge: ui.badge,
      label: ui.label,
    });
  } catch {
    /* window gone */
  }
}

export async function checkForUpdates(): Promise<{
  ok: boolean;
  updateAvailable?: boolean;
  version?: string;
  err?: string;
  feed?: UpdateFeedStatus;
}> {
  const feed = configureAutoUpdater();
  if (!feed.ok || !configured) {
    lastCheck = { at: new Date().toISOString(), ok: false, detail: feed.reason ?? 'no feed' };
    return { ok: false, err: feed.reason, feed: lastStatus ?? undefined };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo?.version;
    const updateAvailable = Boolean(version && version !== app.getVersion());
    lastCheck = {
      at: new Date().toISOString(),
      ok: true,
      detail: updateAvailable ? `available ${version}` : 'up-to-date',
    };
    return { ok: true, updateAvailable, version, feed: lastStatus ?? undefined };
  } catch (e: unknown) {
    const err = String((e as Error)?.message ?? e);
    lastCheck = { at: new Date().toISOString(), ok: false, detail: err };
    return { ok: false, err, feed: lastStatus ?? undefined };
  }
}

export async function downloadUpdate(): Promise<{ ok: boolean; err?: string }> {
  if (!configured) configureAutoUpdater();
  if (!configured) {
    return { ok: false, err: lastStatus?.reason ?? 'feed not configured' };
  }
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, err: String((e as Error)?.message ?? e) };
  }
}

export function installUpdate(): { ok: boolean; err?: string } {
  try {
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, err: String((e as Error)?.message ?? e) };
  }
}

/** Re-export for threat-model / main bootstrap visibility. */
export { autoUpdater };
