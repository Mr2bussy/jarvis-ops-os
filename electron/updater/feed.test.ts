/**
 * Unit tests for update feed fail-closed policy (D7).
 */
// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
  },
}));

vi.mock('../config/store', () => ({
  getDecryptedKey: vi.fn(() => ''),
}));

vi.mock('../logging/logger', () => ({
  getLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

import { resolveUpdateFeedUrl, describeFeedForUi } from './feed';
import { getDecryptedKey } from '../config/store';
import { app } from 'electron';

describe('resolveUpdateFeedUrl', () => {
  beforeEach(() => {
    vi.mocked(getDecryptedKey).mockReturnValue('');
    (app as { isPackaged: boolean }).isPackaged = false;
    delete process.env.UPDATE_FEED_URL;
  });

  it('uses safeStorage when set', () => {
    vi.mocked(getDecryptedKey).mockReturnValue('https://example.com/feed');
    const s = resolveUpdateFeedUrl();
    expect(s.ok).toBe(true);
    if (s.ok) {
      expect(s.url).toBe('https://example.com/feed/');
      expect(s.source).toBe('safeStorage');
    }
  });

  it('fail-closed when packaged without feed', () => {
    (app as { isPackaged: boolean }).isPackaged = true;
    const s = resolveUpdateFeedUrl({ forcePackaged: true });
    expect(s.ok).toBe(false);
    if (!s.ok) {
      expect(s.failClosed).toBe(true);
      expect(s.reason).toMatch(/fail-closed|safeStorage/i);
    }
    expect(describeFeedForUi(s).badge).toBe('fail');
  });

  it('allows missing feed in unpackaged (non-fatal skip)', () => {
    (app as { isPackaged: boolean }).isPackaged = false;
    const s = resolveUpdateFeedUrl({ forcePackaged: false });
    expect(s.ok).toBe(false);
    if (!s.ok) {
      expect(s.failClosed).toBe(false);
    }
    expect(describeFeedForUi(s).badge).toBe('warn');
  });

  it('reads env feed only when unpackaged', () => {
    process.env.UPDATE_FEED_URL = 'https://env.example/updates';
    (app as { isPackaged: boolean }).isPackaged = false;
    const s = resolveUpdateFeedUrl({ forcePackaged: false });
    expect(s.ok).toBe(true);
    if (s.ok) expect(s.source).toBe('env');
  });
});
