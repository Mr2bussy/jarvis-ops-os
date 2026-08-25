/**
 * Token heuristics shared by bench budget and context-budget skill.
 * Prose uses words×1.3 (ECC context-budget); code/mixed keeps chars/4.
 */
// @ts-nocheck

/** Gemini 2.0 Flash list pricing (USD per 1M tokens) — conservative for budget gate. */
const INPUT_USD_PER_M = 0.1;
const OUTPUT_USD_PER_M = 0.4;

export const BENCH_MAX_USD = 10;

export function estimateUsd(tokensIn: number, tokensOut: number): number {
  return (tokensIn / 1_000_000) * INPUT_USD_PER_M + (tokensOut / 1_000_000) * OUTPUT_USD_PER_M;
}

/** Legacy char heuristic — kept for bench charge paths. */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

export type TokenContentKind = 'prose' | 'code' | 'auto';

/**
 * ECC-inspired estimator. `auto` picks prose when letter/space density is high
 * and code-ish punctuation is low.
 */
export function estimateTokensHeuristic(text: string, kind: TokenContentKind = 'auto'): number {
  if (!text) return 0;
  const mode = kind === 'auto' ? detectContentKind(text) : kind;
  if (mode === 'prose') {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words * 1.3));
  }
  return Math.ceil(text.length / 4);
}

function detectContentKind(text: string): 'prose' | 'code' {
  const sample = text.slice(0, 4000);
  const codeSignals = (sample.match(/[{};=<>[\]`]/g) ?? []).length;
  const alphaSpace = (sample.match(/[A-Za-zÄÖÜäöüß\s]/g) ?? []).length;
  const ratio = sample.length ? codeSignals / sample.length : 0;
  if (ratio > 0.04 && codeSignals > 20) return 'code';
  if (alphaSpace / Math.max(sample.length, 1) > 0.7) return 'prose';
  return 'code';
}

export class BenchTokenBudget {
  spentUsd = 0;
  readonly maxUsd: number;

  constructor(maxUsd = BENCH_MAX_USD) {
    this.maxUsd = maxUsd;
  }

  remainingUsd(): number {
    return Math.max(0, this.maxUsd - this.spentUsd);
  }

  canAfford(tokensIn: number, tokensOut: number): boolean {
    return this.spentUsd + estimateUsd(tokensIn, tokensOut) <= this.maxUsd;
  }

  charge(tokensIn: number, tokensOut: number): boolean {
    const cost = estimateUsd(tokensIn, tokensOut);
    if (this.spentUsd + cost > this.maxUsd) return false;
    this.spentUsd += cost;
    return true;
  }
}
