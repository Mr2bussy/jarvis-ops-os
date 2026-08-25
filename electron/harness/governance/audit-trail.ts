/**
 * Append-only audit trail with hash chain (WAL when native SQLite available).
 */
// @ts-nocheck

import { createHash } from 'node:crypto';
import { openDatabase, type SqliteLike } from '../../db/sqlite';

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  action: string;
  detail: string;
  prevHash: string;
  hash: string;
}

let db: SqliteLike | null = null;
let lastHash = 'genesis';

export function initAuditTrail(dir: string): void {
  db = openDatabase(dir);
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_trail (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL
    )
  `);
  const last = db.prepare(`SELECT hash FROM audit_trail ORDER BY seq DESC LIMIT 1`).get() as
    | { hash: string }
    | undefined;
  if (last?.hash) lastHash = last.hash;
}

function requireDb(): SqliteLike {
  if (!db) throw new Error('Audit trail nicht initialisiert');
  return db;
}

function computeHash(prev: string, at: string, actor: string, action: string, detail: string): string {
  return createHash('sha256').update(`${prev}|${at}|${actor}|${action}|${detail}`).digest('hex');
}

export function appendAudit(actor: string, action: string, detail: string): AuditEntry {
  const at = new Date().toISOString();
  const hash = computeHash(lastHash, at, actor, action, detail);
  const d = requireDb();
  d.prepare(
    `INSERT INTO audit_trail (at, actor, action, detail, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(at, actor, action, detail.slice(0, 2000), lastHash, hash);
  lastHash = hash;
  const rows = d.prepare(`SELECT * FROM audit_trail ORDER BY seq DESC LIMIT 1`).all() as Record<
    string,
    unknown
  >[];
  return rowToEntry(rows[0] ?? { seq: 0, at, actor, action, detail, prev_hash: lastHash, hash });
}

export function listAuditTrail(limit = 50): AuditEntry[] {
  const rows = requireDb()
    .prepare(`SELECT * FROM audit_trail ORDER BY seq DESC LIMIT ?`)
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToEntry).reverse();
}

export function verifyAuditChain(): { ok: boolean; brokenAt?: number } {
  const rows = requireDb().prepare(`SELECT * FROM audit_trail ORDER BY seq ASC`).all() as Record<
    string,
    unknown
  >[];
  let prev = 'genesis';
  for (const row of rows) {
    const expected = computeHash(
      prev,
      String(row.at),
      String(row.actor),
      String(row.action),
      String(row.detail),
    );
    if (expected !== String(row.hash)) return { ok: false, brokenAt: Number(row.seq) };
    prev = String(row.hash);
  }
  return { ok: true };
}

export function closeAuditTrail(): void {
  db?.close();
  db = null;
  lastHash = 'genesis';
}

function rowToEntry(row: Record<string, unknown>): AuditEntry {
  return {
    seq: Number(row.seq ?? 0),
    at: String(row.at ?? ''),
    actor: String(row.actor ?? ''),
    action: String(row.action ?? ''),
    detail: String(row.detail ?? ''),
    prevHash: String(row.prev_hash ?? row.prevHash ?? ''),
    hash: String(row.hash ?? ''),
  };
}
