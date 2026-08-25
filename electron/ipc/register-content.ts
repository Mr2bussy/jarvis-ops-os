// @ts-nocheck
import type { IpcMain } from 'electron';
import { z } from 'zod';
import { publishContent, type ContentPlatformCode } from '../content/publish';
import { dryRunBlock } from '../config/dry-run';
import { ipcRateLimiter, rateLimitOrThrow } from '../security/rate-limiter';

const PublishPayload = z.object({
  platform: z.enum(['YT', 'X', 'IG', 'TW', 'NWS', 'LI']),
  title: z.string().max(512),
  body: z.string().max(50_000),
  imageUrl: z.string().url().optional(),
});

/** Content publish IPC — connection gate + live X when OAuth1 keys present. */
export function registerContentIpc(ipcMain: IpcMain): void {
  ipcMain.handle('content:publish', async (_e, raw: unknown) => {
    try {
      rateLimitOrThrow(ipcRateLimiter, 'content:publish');
      const blocked = dryRunBlock('content:publish');
      if (blocked.blocked) {
        return { ok: true, mode: 'draft-only' as const, dryRun: true, reason: blocked.reason };
      }
      const p = PublishPayload.parse(raw);
      return await publishContent({
        platform: p.platform as ContentPlatformCode,
        title: p.title,
        body: p.body,
        imageUrl: p.imageUrl,
      });
    } catch (err: unknown) {
      return { ok: false, mode: 'gated' as const, reason: String((err as Error)?.message ?? err) };
    }
  });
}
