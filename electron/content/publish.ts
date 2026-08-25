// @ts-nocheck
import { getDecryptedKey } from '../config/store';
import { dryRunBlock } from '../config/dry-run';

export type ContentPlatformCode = 'YT' | 'X' | 'IG' | 'TW' | 'NWS' | 'LI';

export interface ContentPublishInput {
  platform: ContentPlatformCode;
  title: string;
  body: string;
  /** Required for IG publish path */
  imageUrl?: string;
}

export interface ContentPublishResult {
  ok: boolean;
  mode: 'live' | 'draft-only' | 'gated';
  reason?: string;
  missingKeys?: string[];
  postId?: string;
  dryRun?: boolean;
}

const PLATFORM_KEYS: Record<ContentPlatformCode, { keys: string[]; label: string }> = {
  YT: { keys: ['YOUTUBE_API_KEY'], label: 'YouTube Data API' },
  X: {
    keys: ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'],
    label: 'X OAuth1 posting',
  },
  IG: { keys: ['INSTAGRAM_TOKEN', 'INSTAGRAM_USER_ID'], label: 'Instagram Graph' },
  TW: { keys: ['TWITCH_TOKEN'], label: 'Twitch Helix' },
  NWS: { keys: ['NEWSLETTER_SMTP_HOST'], label: 'Newsletter SMTP' },
  LI: { keys: ['LINKEDIN_TOKEN', 'LINKEDIN_ORG_URN'], label: 'LinkedIn Marketing API' },
};

function missingFor(platform: ContentPlatformCode): string[] {
  const spec = PLATFORM_KEYS[platform];
  return spec.keys.filter((k) => !getDecryptedKey(k)?.trim());
}

async function postToXInternal(text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = getDecryptedKey('TWITTER_API_KEY');
  const apiSecret = getDecryptedKey('TWITTER_API_SECRET');
  const accessToken = getDecryptedKey('TWITTER_ACCESS_TOKEN');
  const accessSecret = getDecryptedKey('TWITTER_ACCESS_SECRET');
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return { ok: false, error: 'X OAuth1 keys incomplete' };
  }
  try {
    const { createHmac, randomBytes } = await import('node:crypto');
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '');
    const params: Record<string, string> = {
      oauth_consumer_key: apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: ts,
      oauth_token: accessToken,
      oauth_version: '1.0',
    };
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    const sigBase = `POST&${encodeURIComponent('https://api.twitter.com/2/tweets')}&${encodeURIComponent(sorted)}`;
    const sigKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
    params.oauth_signature = createHmac('sha1', sigKey).update(sigBase).digest('base64');
    const authHeader =
      'OAuth ' +
      Object.keys(params)
        .sort()
        .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
        .join(', ');
    const r = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 280) }),
    });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      const detail = json?.detail ?? (json?.errors as { message?: string }[] | undefined)?.[0]?.message;
      return { ok: false, error: String(detail ?? `HTTP ${r.status}`) };
    }
    return { ok: true, id: String((json?.data as { id?: string } | undefined)?.id ?? '') };
  } catch (err: unknown) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

/**
 * Publish or gate content by platform connector keys.
 * X posts live when OAuth1 keys exist; other platforms remain draft-only until APIs wire.
 */
export async function publishContent(input: ContentPublishInput): Promise<ContentPublishResult> {
  const blocked = dryRunBlock('content:publish');
  if (blocked.blocked) {
    return { ok: true, mode: 'draft-only', dryRun: true, reason: blocked.reason };
  }

  const missing = missingFor(input.platform);
  if (missing.length > 0) {
    return {
      ok: false,
      mode: 'gated',
      reason: `${PLATFORM_KEYS[input.platform].label} — Keys in Admin → Connections hinterlegen`,
      missingKeys: missing,
    };
  }

  if (input.platform === 'X') {
    const text = input.body.trim() || input.title.trim();
    if (!text) return { ok: false, mode: 'gated', reason: 'Leerer Post-Text' };
    const posted = await postToXInternal(text);
    if (!posted.ok) {
      return { ok: false, mode: 'draft-only', reason: posted.error ?? 'X post failed' };
    }
    return { ok: true, mode: 'live', postId: posted.id };
  }

  // Keys present but live API not implemented for this platform yet.
  return {
    ok: true,
    mode: 'draft-only',
    reason: `${PLATFORM_KEYS[input.platform].label}: Keys ok — Live-Post-API noch nicht verdrahtet (Draft gespeichert)`,
  };
}
