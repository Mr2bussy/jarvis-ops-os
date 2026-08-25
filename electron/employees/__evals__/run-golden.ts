/**
 * Employee golden eval runner — expands fixtures into contract assertions.
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';
import { executeEmployeeTask } from '../registry';

export interface GoldenFixture {
  id: string;
  employee: string;
  kind: string;
  input: Record<string, unknown>;
  expect: Record<string, unknown>;
}

export function loadGoldenFixtures(file?: string): GoldenFixture[] {
  const p = file ?? path.join(__dirname, 'golden-fixtures.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as GoldenFixture[];
  return Array.isArray(raw) ? raw : [];
}

export async function runGoldenFixture(fx: GoldenFixture): Promise<{
  id: string;
  ok: boolean;
  detail: string;
}> {
  const r = await executeEmployeeTask(fx.employee, {
    id: fx.id,
    kind: fx.kind,
    payload: fx.input,
  });

  if (!r.ok) {
    return { id: fx.id, ok: false, detail: r.reason ?? 'employee failed' };
  }

  const exp = fx.expect;
  if (typeof exp.category === 'string') {
    const cat = (r as { email?: { category?: string; confidence?: number } }).email?.category;
    if (cat !== exp.category) {
      return { id: fx.id, ok: false, detail: `category ${cat} != ${exp.category}` };
    }
    if (typeof exp.minConfidence === 'number') {
      const conf = (r as { email?: { confidence?: number } }).email?.confidence ?? 0;
      if (conf < exp.minConfidence) {
        return { id: fx.id, ok: false, detail: `confidence ${conf} < ${exp.minConfidence}` };
      }
    }
  }
  if (exp.requiresHitl === true) {
    const draft = (r as { draft?: { requiresHitl?: boolean } }).draft;
    const preview = (r as { preview?: { requiresHitl?: boolean } }).preview;
    const action = (r as { action?: { requiresHitl?: boolean } }).action;
    const proposal = (r as { proposal?: { requiresHitl?: boolean } }).proposal;
    const hit =
      draft?.requiresHitl ?? preview?.requiresHitl ?? action?.requiresHitl ?? proposal?.requiresHitl;
    if (!hit) return { id: fx.id, ok: false, detail: 'requiresHitl missing' };
  }
  if (typeof exp.amount === 'number') {
    const amount = (r as { invoice?: { amount?: number } }).invoice?.amount;
    if (amount !== exp.amount) {
      return { id: fx.id, ok: false, detail: `amount ${amount} != ${exp.amount}` };
    }
  }
  if (typeof exp.plausibility === 'string') {
    const p = (r as { invoice?: { plausibility?: string } }).invoice?.plausibility;
    if (p !== exp.plausibility) {
      return { id: fx.id, ok: false, detail: `plausibility ${p} != ${exp.plausibility}` };
    }
  }
  if (typeof exp.minAmount === 'number') {
    const amount = (r as { invoice?: { amount?: number } }).invoice?.amount ?? 0;
    if (amount < exp.minAmount) {
      return { id: fx.id, ok: false, detail: `amount ${amount} < ${exp.minAmount}` };
    }
  }
  if (exp.hasConflict === true) {
    const conflicts = (r as { proposal?: { conflicts?: unknown[] } }).proposal?.conflicts;
    if (!conflicts?.length) return { id: fx.id, ok: false, detail: 'expected conflict' };
  }
  return { id: fx.id, ok: true, detail: 'pass' };
}

export async function runAllGoldenEvals(file?: string): Promise<{
  passed: number;
  failed: number;
  results: Array<{ id: string; ok: boolean; detail: string }>;
}> {
  const fixtures = loadGoldenFixtures(file);
  const results = [];
  for (const fx of fixtures) {
    results.push(await runGoldenFixture(fx));
  }
  return {
    passed: results.filter((x) => x.ok).length,
    failed: results.filter((x) => !x.ok).length,
    results,
  };
}
