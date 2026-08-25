// @ts-nocheck
import type { AccentName } from '../theme';
import { getJarvisBridge } from '../lib/bridge';

/**
 * Canonical social/content connector registry — the single source of truth for
 * "is this platform actually connected?".
 *
 * Three screens previously disagreed about this: the Bridge widget invented its
 * own key names, the Content module read a `live: true` flag baked into a static
 * array, and Admin offered no way to store the credentials at all. A viewer
 * could therefore see "X / Twitter · LIVE" on a machine with zero platform keys.
 *
 * Everything reachable from here is derived from `configKey` at runtime via
 * `window.jarvisBridge.config.hasKey()`. Nothing in this file asserts state.
 */
export interface ConnectorDef {
  id: string;
  /** Display name, as shown in the HUD. */
  name: string;
  /** Uppercase HUD label. */
  label: string;
  /** Single-glyph mark used in compact rows. */
  glyph: string;
  /** safeStorage key that decides connected/not-connected. */
  configKey: string;
  /** Extra keys the platform needs before it can actually pull metrics. */
  extraKeys?: { key: string; label: string; placeholder: string; secret?: boolean }[];
  accent: AccentName;
  /** What this channel is *for* — editorial intent, not a metric. */
  role: string;
  /** Where to get credentials, shown in Admin. */
  docsHint: string;
}

export const CONNECTORS: ConnectorDef[] = [
  {
    id: 'yt',
    name: 'YouTube',
    label: 'YOUTUBE',
    glyph: '▶',
    configKey: 'YOUTUBE_API_KEY',
    extraKeys: [{ key: 'YOUTUBE_CHANNEL_ID', label: 'CHANNEL ID', placeholder: 'UC…' }],
    accent: 'rose',
    role: 'long-form authority',
    docsHint: 'Google Cloud Console → YouTube Data API v3',
  },
  {
    id: 'ig',
    name: 'Instagram',
    label: 'INSTAGRAM',
    glyph: '◈',
    configKey: 'INSTAGRAM_TOKEN',
    extraKeys: [{ key: 'INSTAGRAM_USER_ID', label: 'USER ID', placeholder: '178414…' }],
    accent: 'violet',
    role: 'visual brand',
    docsHint: 'Meta for Developers → Instagram Graph API',
  },
  {
    id: 'tt',
    name: 'TikTok',
    label: 'TIKTOK',
    glyph: '♪',
    configKey: 'TIKTOK_TOKEN',
    accent: 'cyan',
    role: 'short-form reach',
    docsHint: 'TikTok for Developers → Display API',
  },
  {
    id: 'x',
    name: 'X / Twitter',
    label: 'X/TWITTER',
    glyph: '✕',
    configKey: 'TWITTER_BEARER_TOKEN',
    accent: 'cyan',
    role: 'real-time reply hub',
    docsHint: 'X Developer Portal → Bearer Token',
  },
  {
    id: 'li',
    name: 'LinkedIn',
    label: 'LINKEDIN',
    glyph: 'in',
    configKey: 'LINKEDIN_TOKEN',
    extraKeys: [{ key: 'LINKEDIN_ORG_URN', label: 'ORG URN', placeholder: 'urn:li:organization:…' }],
    accent: 'jade',
    role: 'professional distribution',
    docsHint: 'LinkedIn Developers → Marketing Developer Platform',
  },
];

/** Runtime connection state, keyed by connector id. Absent id === not checked yet. */
export type ConnectorState = Record<string, boolean>;

/**
 * Ask the main process which connector keys exist. Never throws: a missing
 * bridge (e.g. the page opened outside Electron) resolves to "nothing connected"
 * rather than leaving the caller with a half-populated map.
 */
export async function probeConnectors(): Promise<ConnectorState> {
  const cfg = getJarvisBridge()?.config;
  if (!cfg?.hasKey) return {};
  const entries = await Promise.all(
    CONNECTORS.map(async (c) => {
      try {
        return [c.id, Boolean(await cfg.hasKey(c.configKey))] as const;
      } catch {
        return [c.id, false] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function connectedCount(state: ConnectorState): number {
  return CONNECTORS.filter((c) => state[c.id]).length;
}
