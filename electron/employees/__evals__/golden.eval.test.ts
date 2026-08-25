// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import { initFeatureFlags } from '../../config/flags';
import { loadGoldenFixtures, runAllGoldenEvals } from './run-golden';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('employee golden evals', () => {
  beforeAll(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-flags-'));
    initFeatureFlags(tmp);
  });

  it('loads expanded fixture suite', () => {
    const fx = loadGoldenFixtures();
    expect(fx.length).toBeGreaterThanOrEqual(6);
    expect(fx.every((f) => f.employee && f.kind)).toBe(true);
  });

  it('passes golden suite (best-effort per employee scaffold)', async () => {
    const out = await runAllGoldenEvals();
    // Email classify fixtures must pass; others may skip if kind unsupported.
    const email = out.results.filter((r) => r.id.startsWith('email-'));
    expect(email.every((r) => r.ok)).toBe(true);
    expect(out.passed).toBeGreaterThanOrEqual(3);
  });
});
