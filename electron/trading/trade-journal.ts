/**
 * Trade journal — screenshot/path + tags + weekly rollup.
 * Path-not-blob: stores filesystem paths, never image bytes in IPC.
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';
import { openDatabase, type SqliteLike } from '../db/sqlite';

export interface TradeJournalEntry {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  tags: string[];
  notes: string;
  screenshotPath?: string;
  pnlEur?: number;
  openedAt: string;
  closedAt?: string;
  createdAt: string;
}

let db: SqliteLike | null = null;
let journalDir = '';

export function initTradeJournal(userDataDir: string): void {
  journalDir = path.join(userDataDir, 'trade-journal');
  fs.mkdirSync(journalDir, { recursive: true });
  db = openDatabase(journalDir);
  db.exec(`CREATE TABLE IF NOT EXISTS trade_journal (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    tags TEXT NOT NULL,
    notes TEXT NOT NULL,
    screenshot_path TEXT,
    pnl_eur REAL,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    created_at TEXT NOT NULL
  )`);
}

function requireDb(): SqliteLike {
  if (!db) throw new Error('Trade journal not initialized');
  return db;
}

export function addJournalEntry(input: {
  symbol: string;
  side: 'BUY' | 'SELL';
  tags?: string[];
  notes?: string;
  screenshotPath?: string;
  pnlEur?: number;
  openedAt?: string;
  closedAt?: string;
}): TradeJournalEntry {
  const d = requireDb();
  if (input.screenshotPath) {
    if (!fs.existsSync(input.screenshotPath)) {
      throw new Error(`Screenshot-Pfad fehlt: ${input.screenshotPath}`);
    }
    if (input.screenshotPath.length > 4096) {
      throw new Error('screenshotPath zu lang');
    }
  }
  const entry: TradeJournalEntry = {
    id: `tj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    symbol: input.symbol.slice(0, 32),
    side: input.side,
    tags: (input.tags ?? []).map((t) => t.slice(0, 48)).slice(0, 20),
    notes: (input.notes ?? '').slice(0, 4000),
    screenshotPath: input.screenshotPath,
    pnlEur: input.pnlEur,
    openedAt: input.openedAt ?? new Date().toISOString(),
    closedAt: input.closedAt,
    createdAt: new Date().toISOString(),
  };
  d.prepare(
    `INSERT INTO trade_journal (id, symbol, side, tags, notes, screenshot_path, pnl_eur, opened_at, closed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.symbol,
    entry.side,
    JSON.stringify(entry.tags),
    entry.notes,
    entry.screenshotPath ?? null,
    entry.pnlEur ?? null,
    entry.openedAt,
    entry.closedAt ?? null,
    entry.createdAt,
  );
  return entry;
}

export function listJournalEntries(limit = 50): TradeJournalEntry[] {
  const d = requireDb();
  const rows = d
    .prepare(`SELECT * FROM trade_journal ORDER BY created_at DESC LIMIT ?`)
    .all(Math.min(200, Math.max(1, limit)));
  return rows.map((r) => ({
    id: String(r.id),
    symbol: String(r.symbol),
    side: r.side as 'BUY' | 'SELL',
    tags: JSON.parse(String(r.tags || '[]')) as string[],
    notes: String(r.notes ?? ''),
    screenshotPath: r.screenshot_path ? String(r.screenshot_path) : undefined,
    pnlEur: typeof r.pnl_eur === 'number' ? r.pnl_eur : undefined,
    openedAt: String(r.opened_at),
    closedAt: r.closed_at ? String(r.closed_at) : undefined,
    createdAt: String(r.created_at),
  }));
}

export function weeklyJournalReport(): {
  weekOf: string;
  count: number;
  tags: Record<string, number>;
  pnlSum: number;
} {
  const entries = listJournalEntries(200);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60_000;
  const week = entries.filter((e) => Date.parse(e.createdAt) >= weekAgo);
  const tags: Record<string, number> = {};
  let pnlSum = 0;
  for (const e of week) {
    for (const t of e.tags) tags[t] = (tags[t] ?? 0) + 1;
    if (typeof e.pnlEur === 'number') pnlSum += e.pnlEur;
  }
  return { weekOf: new Date(weekAgo).toISOString().slice(0, 10), count: week.length, tags, pnlSum };
}
