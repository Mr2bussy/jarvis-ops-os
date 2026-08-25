/**
 * Lightweight append-friendly JSON store — fallback when better-sqlite3 is unavailable.
 * Used by outbox, idempotency, and audit-trail in dev/test environments.
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface JsonStoreTable {
  name: string;
  rows: Record<string, unknown>[];
}

export class JsonStore {
  private readonly filePath: string;
  private tables = new Map<string, Record<string, unknown>[]>();

  constructor(baseDir: string, dbName = 'jarvis-store.json') {
    this.filePath = path.join(baseDir, dbName);
    fs.mkdirSync(baseDir, { recursive: true });
    this.load();
  }

  private load(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as JsonStoreTable[];
      if (!Array.isArray(raw)) return;
      for (const t of raw) {
        if (t?.name && Array.isArray(t.rows)) this.tables.set(t.name, t.rows);
      }
    } catch {
      /* fresh store */
    }
  }

  persist(): void {
    const payload: JsonStoreTable[] = [];
    for (const [name, rows] of this.tables) payload.push({ name, rows });
    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  table(name: string): Record<string, unknown>[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  insert(name: string, row: Record<string, unknown>): void {
    this.table(name).push(row);
    this.persist();
  }

  update(name: string, idKey: string, id: string, patch: Record<string, unknown>): boolean {
    const rows = this.table(name);
    const idx = rows.findIndex((r) => r[idKey] === id);
    if (idx < 0) return false;
    rows[idx] = { ...rows[idx], ...patch };
    this.persist();
    return true;
  }

  find(name: string, idKey: string, id: string): Record<string, unknown> | undefined {
    return this.table(name).find((r) => r[idKey] === id);
  }

  where(name: string, pred: (row: Record<string, unknown>) => boolean): Record<string, unknown>[] {
    return this.table(name).filter(pred);
  }
}
