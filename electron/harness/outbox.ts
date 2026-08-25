/**
 * Transactional outbox for gate actions — persist → execute → mark executed.
 */
// @ts-nocheck

import { openDatabase, isNativeSqlite, type SqliteLike } from '../db/sqlite';
import { JsonStore } from '../db/json-store';

export type OutboxStatus = 'pending' | 'executed' | 'failed';

export interface OutboxEntry {
  id: string;
  actionType: string;
  payload: string;
  status: OutboxStatus;
  createdAt: string;
  executedAt?: string;
  error?: string;
}

let db: SqliteLike | null = null;
let jsonStore: JsonStore | null = null;

export function initOutbox(dir: string): void {
  db = openDatabase(dir);
  if (!isNativeSqlite()) {
    jsonStore = new JsonStore(dir, 'jarvis-fallback.json');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      executed_at TEXT,
      error TEXT
    )
  `);
}

function requireDb(): SqliteLike {
  if (!db) throw new Error('Outbox nicht initialisiert');
  return db;
}

function jsonRows(): Record<string, unknown>[] {
  return jsonStore?.table('outbox') ?? [];
}

export function enqueueOutbox(id: string, actionType: string, payload: unknown): OutboxEntry {
  const entry: OutboxEntry = {
    id,
    actionType,
    payload: JSON.stringify(payload),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  if (jsonStore) {
    jsonStore.insert('outbox', {
      id: entry.id,
      action_type: entry.actionType,
      payload: entry.payload,
      status: entry.status,
      created_at: entry.createdAt,
    });
  } else {
    requireDb()
      .prepare(`INSERT INTO outbox (id, action_type, payload, status, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(entry.id, entry.actionType, entry.payload, entry.status, entry.createdAt);
  }
  return entry;
}

export function listPendingOutbox(): OutboxEntry[] {
  if (jsonStore) {
    return jsonRows()
      .filter((r) => r.status === 'pending')
      .map(rowToEntry);
  }
  const rows = requireDb().prepare(`SELECT * FROM outbox WHERE status = ?`).all('pending') as Record<
    string,
    unknown
  >[];
  return rows.map(rowToEntry);
}

export function markOutboxExecuted(id: string): void {
  const at = new Date().toISOString();
  if (jsonStore) {
    jsonStore.update('outbox', 'id', id, { status: 'executed', executed_at: at });
    return;
  }
  const d = requireDb();
  d.prepare(`UPDATE outbox SET status = ? WHERE id = ?`).run('executed', id);
  d.prepare(`UPDATE outbox SET executed_at = ? WHERE id = ?`).run(at, id);
}

export function markOutboxFailed(id: string, error: string): void {
  if (jsonStore) {
    jsonStore.update('outbox', 'id', id, { status: 'failed', error: error.slice(0, 500) });
    return;
  }
  requireDb()
    .prepare(`UPDATE outbox SET status = ?, error = ? WHERE id = ?`)
    .run('failed', error.slice(0, 500), id);
}

export async function flushOutbox(
  executor: (entry: OutboxEntry) => Promise<void>,
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  for (const entry of listPendingOutbox()) {
    try {
      await executor(entry);
      markOutboxExecuted(entry.id);
      processed++;
    } catch (err: unknown) {
      markOutboxFailed(entry.id, String((err as Error)?.message ?? err));
      failed++;
    }
  }
  return { processed, failed };
}

export function closeOutbox(): void {
  if (isNativeSqlite()) db?.close();
  db = null;
  jsonStore = null;
}

function rowToEntry(row: Record<string, unknown>): OutboxEntry {
  return {
    id: String(row.id ?? ''),
    actionType: String(row.action_type ?? row.actionType ?? ''),
    payload: String(row.payload ?? '{}'),
    status: (row.status as OutboxStatus) ?? 'pending',
    createdAt: String(row.created_at ?? row.createdAt ?? ''),
    executedAt: row.executed_at ? String(row.executed_at) : undefined,
    error: row.error ? String(row.error) : undefined,
  };
}
