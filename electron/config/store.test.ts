import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

const tmp = path.join(os.tmpdir(), 'jarvis-store-test-' + Math.random().toString(36).slice(2));

// Mock electron so the store can be exercised without booting the app. The plain
// base64 path (no encryption) keeps the round-trip deterministic across machines.
vi.mock('electron', () => ({
  app: { getPath: () => tmp },
  safeStorage: { isEncryptionAvailable: () => false },
}));

import {
  setConfigKey,
  getDecryptedKey,
  deleteConfigKey,
  hasConfigKey,
  getAdvancedMode,
  setAdvancedMode,
  ensureBridgeToken,
  configStorePath,
} from './store';

beforeEach(() => {
  try {
    fs.rmSync(configStorePath());
  } catch {
    /* fresh */
  }
});

describe('config store', () => {
  it('round-trips a key (set → get)', () => {
    setConfigKey('FOO', 'bar');
    expect(getDecryptedKey('FOO')).toBe('bar');
  });

  it('reflects presence via hasConfigKey', () => {
    expect(hasConfigKey('NOPE')).toBe(false);
    setConfigKey('NOPE', 'x');
    expect(hasConfigKey('NOPE')).toBe(true);
  });

  it('deletes a key', () => {
    setConfigKey('DEL', 'x');
    deleteConfigKey('DEL');
    expect(getDecryptedKey('DEL')).toBe('');
  });

  it('defaults Advanced Mode OFF and toggles it', () => {
    expect(getAdvancedMode()).toBe(false);
    setAdvancedMode(true);
    expect(getAdvancedMode()).toBe(true);
    setAdvancedMode(false);
    expect(getAdvancedMode()).toBe(false);
  });

  it('generates a stable 48-hex bridge token', () => {
    const t1 = ensureBridgeToken();
    expect(t1).toMatch(/^[0-9a-f]{48}$/);
    expect(ensureBridgeToken()).toBe(t1);
  });
});
