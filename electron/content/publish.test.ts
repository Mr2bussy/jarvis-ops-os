// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';

const tmp = path.join(os.tmpdir(), 'jarvis-publish-test-' + Math.random().toString(36).slice(2));

vi.mock('electron', () => ({
  app: { getPath: () => tmp, isPackaged: false },
  safeStorage: { isEncryptionAvailable: () => false },
}));

import { publishContent } from './publish';

describe('content publish gates', () => {
  beforeEach(() => {
    for (const k of [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET',
      'YOUTUBE_API_KEY',
    ]) {
      delete process.env[k];
    }
  });

  it('gates X publish without OAuth keys', async () => {
    const r = await publishContent({ platform: 'X', title: 'Hi', body: 'Hello world' });
    expect(r.mode).toBe('gated');
    expect(r.ok).toBe(false);
    expect(r.missingKeys?.length).toBeGreaterThan(0);
  });

  it('gates YouTube without API key', async () => {
    const r = await publishContent({ platform: 'YT', title: 'Vid', body: 'Desc' });
    expect(r.mode).toBe('gated');
    expect(r.missingKeys).toContain('YOUTUBE_API_KEY');
  });
});
