/**
 * Employee golden eval suite — expanded fixtures.
 */
// @ts-nocheck

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { executeEmployeeTask } from '../registry';
import { initFeatureFlags } from '../../config/flags';
import { initUndoStore } from '../../harness/undo-first';
import { initFewShotStore } from '../../harness/few-shot-corrections';
import { resumeEmployee, tryPanicCommand } from '../../harness/governance/kill-switch';

interface Fixture {
  id: string;
  employee: string;
  kind: string;
  input: Record<string, unknown>;
  expect: Record<string, unknown>;
}

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'golden-fixtures.json'), 'utf8'),
) as Fixture[];

describe('employee golden evals', () => {
  beforeAll(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-emp-'));
    initFeatureFlags(tmp);
    initUndoStore(tmp);
    initFewShotStore(tmp);
    tryPanicCommand('/resume');
    resumeEmployee('email');
    resumeEmployee('invoice');
    resumeEmployee('calendar');
  });

  for (const fx of fixtures.filter((f) => f.employee === 'email' && f.kind === 'classify')) {
    it(`${fx.id} classifies`, async () => {
      const r = await executeEmployeeTask('email', {
        id: fx.id,
        kind: 'classify',
        payload: fx.input,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const email = (r as { email?: { category: string; confidence: number } }).email;
        expect(email?.category).toBe(fx.expect.category);
        expect(email?.confidence ?? 0).toBeGreaterThanOrEqual(Number(fx.expect.minConfidence ?? 0));
      }
    });
  }

  it('email-draft-01 produces HITL draft with undo id', async () => {
    const fx = fixtures.find((f) => f.id === 'email-draft-01')!;
    const r = await executeEmployeeTask('email', {
      id: fx.id,
      kind: 'draft-reply',
      payload: fx.input,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const draft = (r as { draft?: { requiresHitl: boolean }; undoDraftId?: string }).draft;
      expect(draft?.requiresHitl).toBe(true);
      expect((r as { undoDraftId?: string }).undoDraftId).toBeTruthy();
    }
  });
});
