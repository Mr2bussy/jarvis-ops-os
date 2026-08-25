// @ts-nocheck
import { describe, expect, it } from 'vitest';
import type { BenchmarkCaseResult } from '../types';
import { caseOutcome, isScoredCase, meanHarnessScore, scoreCase, summarizeOutcomes } from './scoring';

function caseResult(
  id: string,
  over: Partial<BenchmarkCaseResult> & { outcome?: string },
): BenchmarkCaseResult {
  return {
    id,
    success: false,
    turns: 1,
    tokensIn: 0,
    tokensOut: 0,
    wallMs: 0,
    surgical: 100,
    safety: 100,
    recovery: 100,
    caseScore: 0,
    ...over,
  } as BenchmarkCaseResult;
}

describe('case outcome', () => {
  it('reads the explicit flag when present', () => {
    expect(caseOutcome(caseResult('G13', { outcome: 'skipped', success: false }))).toBe('skipped');
    expect(caseOutcome(caseResult('G01', { outcome: 'pass', success: true }))).toBe('pass');
  });

  it('falls back to the boolean for records written before the flag existed', () => {
    expect(caseOutcome(caseResult('G01', { success: true }))).toBe('pass');
    expect(caseOutcome(caseResult('G02', { success: false }))).toBe('fail');
  });

  it('treats only non-skipped cases as scored', () => {
    expect(isScoredCase(caseResult('G01', { outcome: 'fail' }))).toBe(true);
    expect(isScoredCase(caseResult('G13', { outcome: 'skipped' }))).toBe(false);
  });
});

describe('meanHarnessScore', () => {
  it('takes skipped cases out of the denominator instead of scoring them zero', () => {
    const cases = [
      caseResult('G01', { outcome: 'pass', success: true, caseScore: 100 }),
      caseResult('G02', { outcome: 'pass', success: true, caseScore: 80 }),
      caseResult('G13', { outcome: 'skipped', caseScore: 0 }),
    ];
    expect(meanHarnessScore(cases)).toBe(90);
  });

  it('returns 0 when every case was skipped', () => {
    expect(meanHarnessScore([caseResult('G13', { outcome: 'skipped' })])).toBe(0);
  });

  it('still averages legacy results that carry no outcome flag', () => {
    const high = scoreCase({
      success: true,
      correctness: 100,
      turns: 4,
      baselineTurns: 4,
      surgical: 100,
      safety: 100,
      recovery: 100,
    });
    expect(meanHarnessScore([{ caseScore: high } as BenchmarkCaseResult])).toBe(high);
  });
});

describe('summarizeOutcomes', () => {
  it('reports scored, skipped and the skipped ids', () => {
    const summary = summarizeOutcomes([
      caseResult('G01', { outcome: 'pass', success: true }),
      caseResult('G02', { outcome: 'fail' }),
      caseResult('G13', { outcome: 'skipped' }),
      caseResult('G15', { outcome: 'skipped' }),
    ]);
    expect(summary).toEqual({
      total: 4,
      scored: 2,
      passed: 1,
      failed: 1,
      skipped: 2,
      skippedIds: ['G13', 'G15'],
    });
  });
});
