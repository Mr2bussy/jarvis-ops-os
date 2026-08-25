/**
 * Few-shot examples derived from HITL gate corrections (approve/deny lessons).
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GateMemoryEntry } from './governance/gate-memory';

export interface FewShotExample {
  tool: string;
  riskClass: string;
  approved: boolean;
  note: string;
  at: string;
}

let storePath = '';
const MAX = 50;

export function initFewShotStore(userDataDir: string): void {
  storePath = path.join(userDataDir, 'harness', 'few-shot-corrections.json');
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
}

function load(): FewShotExample[] {
  if (!storePath) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(storePath, 'utf8')) as FewShotExample[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function save(rows: FewShotExample[]): void {
  if (!storePath) return;
  fs.writeFileSync(storePath, JSON.stringify(rows.slice(0, MAX), null, 2), 'utf8');
}

export function recordGateCorrection(input: {
  tool: string;
  riskClass: string;
  approved: boolean;
  note?: string;
}): FewShotExample {
  const row: FewShotExample = {
    tool: input.tool,
    riskClass: input.riskClass,
    approved: input.approved,
    note: input.note ?? (input.approved ? 'operator approved' : 'operator denied'),
    at: new Date().toISOString(),
  };
  const next = [row, ...load()].slice(0, MAX);
  save(next);
  return row;
}

export function ingestGateMemory(entries: GateMemoryEntry[]): number {
  let n = 0;
  const existing = load();
  for (const e of entries) {
    if (!e.autoGreen) continue;
    existing.unshift({
      tool: e.fingerprint.tool,
      riskClass: e.fingerprint.riskClass,
      approved: true,
      note: `gate-memory auto-green after ${e.approvals} approvals`,
      at: e.lastApprovedAt,
    });
    n++;
  }
  save(existing.slice(0, MAX));
  return n;
}

export function listFewShots(limit = 10): FewShotExample[] {
  return load().slice(0, limit);
}

export function formatFewShotBlock(limit = 5): string {
  const rows = listFewShots(limit);
  if (!rows.length) return '';
  const lines = rows.map(
    (r, i) => `${i + 1}. tool=${r.tool} risk=${r.riskClass} → ${r.approved ? 'APPROVE' : 'DENY'} (${r.note})`,
  );
  return `Operator-Korrekturen (Few-Shot):\n${lines.join('\n')}`;
}

/** Alias for employee call sites that expect gate-memory shaped few-shots. */
export function fewShotsFromGateMemory(entries: GateMemoryEntry[], limit = 8): FewShotExample[] {
  return [...entries]
    .filter((e) => e.approvals > 0)
    .sort((a, b) => b.approvals - a.approvals)
    .slice(0, limit)
    .map((e) => ({
      tool: e.fingerprint.tool,
      riskClass: e.fingerprint.riskClass,
      approved: true,
      note: `n=${e.approvals}`,
      at: e.lastApprovedAt,
    }));
}
