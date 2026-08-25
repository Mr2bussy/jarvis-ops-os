/**
 * Undo-first drafts — write to drafts/trash before any irreversible send/delete.
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface DraftRecord {
  id: string;
  kind: 'email-reply' | 'cleanup-delete' | 'generic';
  createdAt: string;
  payload: Record<string, unknown>;
  status: 'draft' | 'trashed' | 'committed';
}

let rootDir = '';

export function initUndoStore(userDataDir: string): void {
  rootDir = path.join(userDataDir, 'undo-first');
  fs.mkdirSync(path.join(rootDir, 'drafts'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'trash'), { recursive: true });
}

function ensureInit(): void {
  if (!rootDir) {
    rootDir = path.join(process.cwd(), '.jarvis-undo');
    fs.mkdirSync(path.join(rootDir, 'drafts'), { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'trash'), { recursive: true });
  }
}

function draftPath(id: string): string {
  ensureInit();
  return path.join(rootDir, 'drafts', `${id}.json`);
}

function trashPath(id: string): string {
  ensureInit();
  return path.join(rootDir, 'trash', `${id}.json`);
}

export function saveDraft(
  kind: DraftRecord['kind'],
  payload: Record<string, unknown>,
  id?: string,
): DraftRecord {
  ensureInit();
  const record: DraftRecord = {
    id: id ?? `draft_${crypto.randomBytes(6).toString('hex')}`,
    kind,
    createdAt: new Date().toISOString(),
    payload,
    status: 'draft',
  };
  fs.writeFileSync(draftPath(record.id), JSON.stringify(record, null, 2), 'utf8');
  return record;
}

export function listDrafts(): DraftRecord[] {
  ensureInit();
  const dir = path.join(rootDir, 'drafts');
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as DraftRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function getDraft(id: string): DraftRecord | null {
  try {
    return JSON.parse(fs.readFileSync(draftPath(id), 'utf8')) as DraftRecord;
  } catch {
    return null;
  }
}

export function trashDraft(id: string): DraftRecord | null {
  const d = getDraft(id);
  if (!d) return null;
  const trashed: DraftRecord = { ...d, status: 'trashed' };
  fs.writeFileSync(trashPath(id), JSON.stringify(trashed, null, 2), 'utf8');
  try {
    fs.unlinkSync(draftPath(id));
  } catch {
    /* already gone */
  }
  return trashed;
}

export function restoreDraft(id: string): DraftRecord | null {
  ensureInit();
  try {
    const raw = JSON.parse(fs.readFileSync(trashPath(id), 'utf8')) as DraftRecord;
    const restored: DraftRecord = { ...raw, status: 'draft' };
    fs.writeFileSync(draftPath(id), JSON.stringify(restored, null, 2), 'utf8');
    fs.unlinkSync(trashPath(id));
    return restored;
  } catch {
    return null;
  }
}

export function commitDraft(id: string): DraftRecord | null {
  const d = getDraft(id);
  if (!d) return null;
  const committed: DraftRecord = { ...d, status: 'committed' };
  fs.writeFileSync(trashPath(id), JSON.stringify(committed, null, 2), 'utf8');
  try {
    fs.unlinkSync(draftPath(id));
  } catch {
    /* ignore */
  }
  return committed;
}

export function stageCleanup(paths: string[], reason: string): DraftRecord {
  return saveDraft('cleanup-delete', { paths, reason, staged: true });
}

/** Compatibility aliases used by some call sites. */
export function initUndoDrafts(userDataDir: string): void {
  initUndoStore(userDataDir);
}

export function tryGetUndoDrafts(): { saveDraft: typeof saveDraft; listDrafts: typeof listDrafts } | null {
  try {
    ensureInit();
    return { saveDraft, listDrafts };
  } catch {
    return null;
  }
}
