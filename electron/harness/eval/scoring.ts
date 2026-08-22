import type { BenchmarkCaseResult } from '../types';

export interface CaseWeights {
  success: number;
  correctness: number;
  efficiency: number;
  surgical: number;
  safety: number;
  recovery: number;
}

export const DEFAULT_WEIGHTS: CaseWeights = {
  success: 0.35,
  correctness: 0.25,
  efficiency: 0.15,
  surgical: 0.1,
  safety: 0.1,
  recovery: 0.05,
};

export function scoreCase(input: {
  success: boolean;
  correctness: number;
  turns: number;
  baselineTurns: number;
  surgical: number;
  safety: number;
  recovery: number;
  weights?: CaseWeights;
}): number {
  const w = input.weights ?? DEFAULT_WEIGHTS;
  const success = input.success ? 100 : 0;
  const efficiency =
    input.baselineTurns <= 0
      ? 50
      : Math.max(0, Math.min(100, 100 - ((input.turns - input.baselineTurns) / input.baselineTurns) * 50));

  return (
    success * w.success +
    input.correctness * w.correctness +
    efficiency * w.efficiency +
    input.surgical * w.surgical +
    input.safety * w.safety +
    input.recovery * w.recovery
  );
}

export function meanHarnessScore(cases: BenchmarkCaseResult[]): number {
  if (cases.length === 0) return 0;
  return cases.reduce((a, c) => a + c.caseScore, 0) / cases.length;
}

export function compareDelta(jarvis: number, rival: number): number {
  return Math.round((jarvis - rival) * 10) / 10;
}

export interface CriticInput {
  caseId: string;
  trajectory: string;
  artifact?: string;
  expectedOutcome: string;
}

/** Deterministic critic stub — replace with LLM judge in scripts/bench/critic-judge.mjs */
export function deterministicCritic(input: CriticInput): {
  score: number;
  agreeWithSuccess: boolean;
  notes: string;
} {
  const hasEvidence = input.trajectory.length > 20;
  const mentionsExpected = input.trajectory
    .toLowerCase()
    .includes(input.expectedOutcome.toLowerCase().slice(0, 12));
  const score = hasEvidence ? (mentionsExpected ? 92 : 78) : 55;
  return {
    score,
    agreeWithSuccess: score >= 70,
    notes: mentionsExpected ? 'Trajectory aligns with expected outcome' : 'Weak alignment — review manually',
  };
}

export function aggregateCriticScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}
