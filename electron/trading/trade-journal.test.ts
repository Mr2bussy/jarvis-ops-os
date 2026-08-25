// @ts-nocheck
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { initTradeJournal, addJournalEntry, listJournalEntries, weeklyJournalReport } from './trade-journal';

describe('trade-journal', () => {
  const dir = path.join(os.tmpdir(), `jarvis-tj-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(dir, { recursive: true });
    initTradeJournal(dir);
  });

  afterEach(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('stores path + tags (path-not-blob)', () => {
    const shot = path.join(dir, 'shot.png');
    fs.writeFileSync(shot, 'png');
    const e = addJournalEntry({
      symbol: 'XAUUSD',
      side: 'BUY',
      tags: ['fvg', 'london'],
      notes: 'session A',
      screenshotPath: shot,
      pnlEur: 12.5,
    });
    expect(e.screenshotPath).toBe(shot);
    expect(listJournalEntries(10)[0]?.tags).toContain('fvg');
    expect(weeklyJournalReport().count).toBeGreaterThanOrEqual(1);
  });
});
