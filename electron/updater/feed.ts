/**
 * Update feed URL resolution (D7).
 *
 * Priority: safeStorage UPDATE_FEED_URL → env UPDATE_FEED_URL (dev only) → null.
 * Packaged builds fail-closed when production policy requires a feed and none is set.
 */
// @ts-nocheck

import { app } from 'electron';
import { getDecryptedKey } from '../config/store';
import { getLogger } from '../logging/logger';

const log = getLogger('updater.feed');

export type UpdateFeedStatus =
  | { ok: true; url: string; source: 'safeStorage' | 'env' | 'package.json' }
  | { ok: false; url: null; reason: string; failClosed: boolean };

/** True when packaged production policy requires a configured feed. */
export function productionFeedRequired(): boolean {
  try {
    return Boolean(app?.isPackaged);
  } catch {
    return false;
  }
}

function normalizeFeedUrl(raw: string): string | null {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) return null;
  return t.endsWith('/') ? t : `${t}/`;
}

/**
 * Resolve the generic electron-updater feed base URL (must host latest.yml).
 */
export function resolveUpdateFeedUrl(opts?: {
  /** Force fail-closed even when unpackaged (tests). */
  forcePackaged?: boolean;
  /** Optional package.json publish.url fallback (dev / scaffold only). */
  packagePublishUrl?: string;
}): UpdateFeedStatus {
  const packaged = opts?.forcePackaged ?? productionFeedRequired();

  const fromStore = normalizeFeedUrl(getDecryptedKey('UPDATE_FEED_URL') || '');
  if (fromStore) {
    return { ok: true, url: fromStore, source: 'safeStorage' };
  }

  if (!packaged) {
    const fromEnv = normalizeFeedUrl(process.env.UPDATE_FEED_URL || '');
    if (fromEnv) return { ok: true, url: fromEnv, source: 'env' };
    const fromPkg = normalizeFeedUrl(opts?.packagePublishUrl || '');
    if (fromPkg) return { ok: true, url: fromPkg, source: 'package.json' };
    return {
      ok: false,
      url: null,
      reason: 'UPDATE_FEED_URL unset (dev — updates skipped)',
      failClosed: false,
    };
  }

  // Packaged: never read .env; missing feed = fail-closed for update channel.
  const reason = 'Packaged build has no UPDATE_FEED_URL in safeStorage — auto-update disabled (fail-closed)';
  log.warn({ packaged: true }, reason);
  return { ok: false, url: null, reason, failClosed: true };
}

export function describeFeedForUi(status: UpdateFeedStatus): {
  badge: 'ok' | 'warn' | 'fail';
  label: string;
} {
  if (status.ok) {
    return { badge: 'ok', label: `FEED · ${status.source.toUpperCase()}` };
  }
  if (status.failClosed) {
    return { badge: 'fail', label: 'FEED · MISSING' };
  }
  return { badge: 'warn', label: 'FEED · OFF' };
}
