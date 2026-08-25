// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import { executeEmployeeTask } from './registry';
import { killEmployee, resumeEmployee, tryPanicCommand } from '../harness/governance/kill-switch';
import { initFeatureFlags } from '../config/flags';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('employee contract', () => {
  beforeAll(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-flags-'));
    initFeatureFlags(tmp);
  });

  it('email employee classifies invoice', async () => {
    const r = await executeEmployeeTask('email', {
      id: 't1',
      kind: 'classify',
      payload: { from: 'billing@vendor.de', subject: 'Rechnung #123', body: 'Zahlung fällig' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r as { email?: { category: string } }).email?.category).toBe('invoice');
  });

  it('kill switch blocks employee', async () => {
    killEmployee('email');
    const r = await executeEmployeeTask('email', {
      id: 't2',
      kind: 'classify',
      payload: { from: 'a@b.de', subject: 'Test', body: 'Hi' },
    });
    expect(r.ok).toBe(false);
    resumeEmployee('email');
  });

  it('panic command kills global', () => {
    const reply = tryPanicCommand('/panic');
    expect(reply).toContain('KILL-SWITCH');
    const resume = tryPanicCommand('/resume');
    expect(resume).toContain('deaktiviert');
  });
});
