// @ts-nocheck
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import {
  LLM_REQUIRED_GOLDEN_IDS,
  DETERMINISTIC_GOLDEN_IDS,
  runDeterministicGolden,
} from './golden-automation';

const root = path.resolve(__dirname, '../../..');

describe('golden-automation deterministic checks', () => {
  it('G04 finds MT5 auth in main', () => {
    const r = runDeterministicGolden('G04', root);
    expect(r.success).toBe(true);
  });

  it('G02 finds zod IPC', () => {
    const r = runDeterministicGolden('G02', root);
    expect(r.success).toBe(true);
  });

  it('passes every id it advertises as deterministic', () => {
    for (const id of DETERMINISTIC_GOLDEN_IDS) {
      const r = runDeterministicGolden(id, root);
      expect(`${id}:${r.outcome}`, r.notes).toBe(`${id}:pass`);
    }
  });

  it('G03 no longer fails just because the extracted module grew', () => {
    const r = runDeterministicGolden('G03', root);
    expect(r.outcome).toBe('pass');
    expect(r.notes).toContain('imported by main');
  });

  it('G08 does not mistake a type annotation for a stored secret', () => {
    const r = runDeterministicGolden('G08', root);
    expect(r.outcome).toBe('pass');
  });

  it('G10 asks the allowlist directly instead of asserting a hardcoded true', () => {
    const r = runDeterministicGolden('G10', root);
    expect(r.outcome).toBe('pass');
    expect(r.notes).toContain('Advanced Mode');
  });

  it('G11 exercises the real path containment check', () => {
    const r = runDeterministicGolden('G11', root);
    expect(r.outcome).toBe('pass');
  });

  it('G09 requires schedule persistence and startup re-arm', () => {
    const r = runDeterministicGolden('G09', root);
    expect(r.outcome).toBe('pass');
  });

  it('reports a fail (not a skip) when an invariant is genuinely missing', () => {
    const r = runDeterministicGolden('G04', path.join(root, 'does-not-exist'));
    expect(r.outcome).toBe('fail');
    expect(r.success).toBe(false);
  });

  it('marks LLM-only cases as skipped with a reason, never as failures', () => {
    for (const id of LLM_REQUIRED_GOLDEN_IDS) {
      const r = runDeterministicGolden(id, root);
      expect(r.outcome).toBe('skipped');
      expect(r.success).toBe(false);
      expect(r.notes).toMatch(/^SKIPPED: .+LLM/);
    }
  });

  it('skips an unknown case instead of inventing a failure', () => {
    const r = runDeterministicGolden('G99', root);
    expect(r.outcome).toBe('skipped');
    expect(r.notes).toContain('G99');
  });
});
