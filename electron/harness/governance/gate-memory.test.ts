// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { GateMemoryStore, makeFingerprint } from './gate-memory';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('gate-memory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-mem-'));

  it('auto-greens after N approvals for shell class', () => {
    const store = new GateMemoryStore(dir, 2);
    const fp = makeFingerprint('browser_task', 'browser', { task: 'open google' });
    expect(store.isAutoGreen(fp)).toBe(false);
    store.recordApproval(fp);
    expect(store.isAutoGreen(fp)).toBe(false);
    store.recordApproval(fp);
    expect(store.isAutoGreen(fp)).toBe(true);
  });

  it('never auto-greens trading mutations', () => {
    const store = new GateMemoryStore(path.join(dir, 't2'), 1);
    const fp = makeFingerprint('mt5_call', 'trading', { endpoint: 'order_send' });
    store.recordApproval(fp);
    store.recordApproval(fp);
    expect(store.isAutoGreen(fp)).toBe(false);
  });
});
