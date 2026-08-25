/**
 * SQLite access with JSON fallback — outbox, idempotency, audit trail.
 * Tries better-sqlite3 when installed; otherwise uses JsonStore.
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';
import { JsonStore } from './json-store';

export interface SqliteLike {
  exec(sql: string): void;
  prepare(sql: string): {
    run: (...args: unknown[]) => { changes: number };
    get: (...args: unknown[]) => Record<string, unknown> | undefined;
    all: (...args: unknown[]) => Record<string, unknown>[];
  };
  close(): void;
}

type BetterSqlite3 = {
  default: (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      run: (...args: unknown[]) => { changes: number };
      get: (...args: unknown[]) => Record<string, unknown> | undefined;
      all: (...args: unknown[]) => Record<string, unknown>[];
    };
    close: () => void;
  };
};

let nativeAvailable: boolean | null = null;

function probeNative(): boolean {
  if (nativeAvailable !== null) return nativeAvailable;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite = require('better-sqlite3') as BetterSqlite3['default'];
    const probe = BetterSqlite(':memory:');
    probe.close();
    nativeAvailable = true;
  } catch {
    nativeAvailable = false;
  }
  return nativeAvailable;
}

/** Opens native SQLite or JSON-backed fallback at `dir/jarvis.db`. */
export function openDatabase(dir: string): SqliteLike {
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'jarvis.db');

  if (probeNative()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const BetterSqlite = require('better-sqlite3') as BetterSqlite3['default'];
      const db = BetterSqlite(dbPath);
      if ('pragma' in db && typeof (db as { pragma: (s: string) => void }).pragma === 'function') {
        (db as { pragma: (s: string) => void }).pragma('journal_mode = WAL');
      }
      return db as SqliteLike;
    } catch {
      nativeAvailable = false;
    }
  }

  const json = new JsonStore(dir, 'jarvis-fallback.json');
  return createJsonAdapter(json);
}

function createJsonAdapter(json: JsonStore): SqliteLike {
  const tableFromSql = (sql: string): string | null => {
    const m = sql.match(/(?:INTO|FROM|UPDATE)\s+(\w+)/i);
    return m?.[1] ?? null;
  };

  return {
    exec(sql: string) {
      const t = tableFromSql(sql);
      if (!t) return;
      if (sql.includes('CREATE TABLE')) json.table(t);
    },
    prepare(sql: string) {
      const upper = sql.toUpperCase();
      const table = tableFromSql(sql) ?? '_unknown';

      return {
        run(...args: unknown[]) {
          if (upper.includes('INSERT INTO')) {
            const row: Record<string, unknown> = {};
            const cols = sql.match(/\(([^)]+)\)\s*VALUES/i)?.[1]?.split(',') ?? [];
            cols.forEach((c, i) => {
              row[c.trim()] = args[i];
            });
            if (!Object.keys(row).length && args[0]) {
              row.id = args[0];
              row.payload = args[1];
              row.status = args[2];
              row.created_at = args[3];
            }
            json.insert(table, row);
          } else if (upper.includes('UPDATE')) {
            const id = String(args[args.length - 1]);
            const patch: Record<string, unknown> = {};
            const setMatch = sql.match(/SET\s+(\w+)\s*=\s*\?/i);
            if (setMatch) patch[setMatch[1]] = args[0];
            json.update(table, 'id', id, patch);
          }
          return { changes: 1 };
        },
        get(...args: unknown[]) {
          if (upper.includes('WHERE')) {
            const key = sql.includes('key =') ? 'key' : 'id';
            return json.find(table, key, String(args[0]));
          }
          return undefined;
        },
        all(...args: unknown[]) {
          if (upper.includes('status =')) {
            return json.where(table, (r) => r.status === args[0]);
          }
          return json.table(table);
        },
      };
    },
    close() {
      json.persist();
    },
  };
}

export function isNativeSqlite(): boolean {
  return probeNative();
}
