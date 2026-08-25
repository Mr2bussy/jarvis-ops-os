// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  initOutbox,
  enqueueOutbox,
  listPendingOutbox,
  markOutboxExecuted,
  flushOutbox,
  closeOutbox,
} from './outbox';

describe('outbox pattern', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-outbox-'));
    initOutbox(tmp);
  });

  afterEach(() => {
    closeOutbox();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('persists and marks executed', async () => {
    enqueueOutbox('ob1', 'gate-action', { tool: 'mt5_call' });
    expect(listPendingOutbox()).toHaveLength(1);
    const r = await flushOutbox(async () => {});
    expect(r.processed).toBe(1);
    expect(listPendingOutbox()).toHaveLength(0);
  });

  it('survives restart via flush', async () => {
    enqueueOutbox('ob2', 'test', { x: 1 });
    closeOutbox();
    initOutbox(tmp);
    const r = await flushOutbox(async (e) => {
      expect(JSON.parse(e.payload)).toEqual({ x: 1 });
    });
    expect(r.processed).toBe(1);
  });
});
