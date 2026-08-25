// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { BenchTokenBudget, BENCH_MAX_USD, estimateTokensHeuristic, estimateUsd } from './token-budget';

describe('BenchTokenBudget', () => {
  it('caps spend at $10', () => {
    const b = new BenchTokenBudget(BENCH_MAX_USD);
    expect(b.canAfford(1_000_000, 1_000_000)).toBe(true);
    b.charge(1_000_000, 1_000_000);
    expect(b.remainingUsd()).toBeLessThan(BENCH_MAX_USD);
    expect(b.canAfford(50_000_000, 50_000_000)).toBe(false);
  });

  it('estimates gemini flash cost', () => {
    expect(estimateUsd(1_000_000, 0)).toBeCloseTo(0.1, 5);
  });
});

describe('estimateTokensHeuristic', () => {
  it('uses words×1.3 for prose', () => {
    const text = 'one two three four five';
    expect(estimateTokensHeuristic(text, 'prose')).toBe(Math.ceil(5 * 1.3));
  });

  it('uses chars/4 for code', () => {
    const text = 'const x = 1;';
    expect(estimateTokensHeuristic(text, 'code')).toBe(Math.ceil(text.length / 4));
  });
});
