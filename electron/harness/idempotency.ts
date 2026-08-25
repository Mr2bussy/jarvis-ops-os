/**
 * Idempotency keys — prevent duplicate processing of IMAP msg-id, invoice numbers, etc.
 */
// @ts-nocheck

import { openDatabase, type SqliteLike } from '../db/sqlite';

let db: SqliteLike | null = null;

export function initIdempotency(dir: string): void {
  db = openDatabase(dir);
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotency (
      key TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      processed_at TEXT NOT NULL,
      meta TEXT
    )
  `);
}

function requireDb(): SqliteLike {
  if (!db) throw new Error('Idempotency store nicht initialisiert');
  return db;
}

export function idempotencyKey(namespace: string, raw: string): string {
  return `${namespace}:${raw}`;
}

/** Returns true if already processed (skip), false if new (claim). */
export function claimIdempotencyKey(namespace: string, raw: string, meta?: Record<string, unknown>): boolean {
  const key = idempotencyKey(namespace, raw);
  const existing = requireDb().prepare(`SELECT key FROM idempotency WHERE key = ?`).get(key);
  if (existing) return true;
  requireDb()
    .prepare(`INSERT INTO idempotency (key, namespace, processed_at, meta) VALUES (?, ?, ?, ?)`)
    .run(key, namespace, new Date().toISOString(), meta ? JSON.stringify(meta) : null);
  return false;
}

export function wasProcessed(namespace: string, raw: string): boolean {
  const key = idempotencyKey(namespace, raw);
  return Boolean(requireDb().prepare(`SELECT key FROM idempotency WHERE key = ?`).get(key));
}

export function closeIdempotency(): void {
  db?.close();
  db = null;
}
