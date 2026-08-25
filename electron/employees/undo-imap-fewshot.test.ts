// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { initUndoStore, saveDraft, listDrafts, trashDraft, restoreDraft } from '../harness/undo-first';
import { getImapIdleStatus, startImapIdle, stopImapIdle } from './imap-idle';
import { initFeatureFlags } from '../config/flags';
import { formatFewShotBlock, initFewShotStore, recordGateCorrection } from '../harness/few-shot-corrections';

describe('undo-first drafts', () => {
  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'undo-'));
    initUndoStore(tmp);
  });

  it('saves, trashes, and restores', () => {
    const d = saveDraft('email-reply', { body: 'Danke' });
    expect(listDrafts()).toHaveLength(1);
    trashDraft(d.id);
    expect(listDrafts()).toHaveLength(0);
    restoreDraft(d.id);
    expect(listDrafts()[0]?.status).toBe('draft');
  });
});

describe('imap idle scaffold', () => {
  it('stays disabled without credentials and does not throw', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flags-'));
    initFeatureFlags(tmp);
    await stopImapIdle();
    const st = await startImapIdle({});
    expect(['disabled', 'unavailable', 'idle']).toContain(st.state);
    expect(getImapIdleStatus().detail).toBeTruthy();
  });
});

describe('few-shot from gates', () => {
  it('formats approval memory', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-'));
    initFewShotStore(tmp);
    recordGateCorrection({ tool: 'shell_exec', riskClass: 'shell', approved: true });
    expect(formatFewShotBlock(3)).toMatch(/Operator-Korrekturen|Few-Shot/i);
  });
});
