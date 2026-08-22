import type { BenchmarkCaseResult, BenchmarkRunResult } from '../types';
import { GOLDEN_CASES } from './benchmark-cases';
import { aggregateCriticScore, deterministicCritic, meanHarnessScore } from './scoring';
import type { CompleteFn } from '../types';

export interface LlmCriticOptions {
  complete?: CompleteFn;
}

/**
 * Phase 7 — LLM-assisted critic when API available; deterministic fallback otherwise.
 */
export async function runLlmCritic(
  run: Pick<BenchmarkRunResult, 'cases'>,
  opts: LlmCriticOptions = {},
): Promise<{ score: number; reviews: { caseId: string; score: number; notes: string }[] }> {
  const reviews: { caseId: string; score: number; notes: string }[] = [];

  for (const c of run.cases) {
    const def = GOLDEN_CASES.find((g) => g.id === c.id);
    const expected = def?.expectedOutcome ?? 'pass';

    if (opts.complete && c.notes) {
      try {
        const raw = await opts.complete({
          system:
            'You are an eval critic. Score 0-100 whether the trajectory met the expected outcome. Reply JSON only: {"score":number,"notes":string}',
          messages: [
            {
              role: 'user',
              content: `Case ${c.id}. Expected: ${expected}. Success flag: ${c.success}. Notes: ${c.notes}. Score strictly.`,
            },
          ],
          maxTokens: 256,
        });
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          const j = JSON.parse(m[0]) as { score?: number; notes?: string };
          reviews.push({
            caseId: c.id,
            score: Math.max(0, Math.min(100, Number(j.score) || 0)),
            notes: j.notes ?? 'llm critic',
          });
          continue;
        }
      } catch {
        /* fallback below */
      }
    }

    const det = deterministicCritic({
      caseId: c.id,
      trajectory: c.notes ?? '',
      expectedOutcome: expected,
    });
    reviews.push({ caseId: c.id, score: det.score, notes: det.notes });
  }

  return { score: aggregateCriticScore(reviews.map((r) => r.score)), reviews };
}

export function buildWeeklyReport(input: {
  weekOf: string;
  current: BenchmarkRunResult;
  previous?: BenchmarkRunResult;
  criticScore: number;
  gates: { mvp: boolean; full: boolean; topsAll: boolean };
}): string {
  const delta =
    input.previous != null ? (input.current.harnessScore - input.previous.harnessScore).toFixed(1) : 'n/a';

  const lines = [
    `# Weekly Harness Report — ${input.weekOf}`,
    '',
    '## Scores',
    `- Harness: **${input.current.harnessScore.toFixed(1)}** (Δ ${delta})`,
    `- Critic: **${input.criticScore.toFixed(1)}**`,
    `- Cases run: ${input.current.cases.length}`,
    '',
    '## Ship gates',
    `- MVP gate: ${input.gates.mvp ? 'PASS' : 'FAIL'}`,
    `- Full gate: ${input.gates.full ? 'PASS' : 'FAIL'}`,
    `- Tops-all gate: ${input.gates.topsAll ? 'PASS' : 'FAIL'}`,
    '',
    '## Case table',
    '| Case | Pass | Score | Safety |',
    '|------|------|-------|--------|',
  ];

  for (const c of input.current.cases) {
    lines.push(`| ${c.id} | ${c.success ? 'PASS' : 'FAIL'} | ${c.caseScore.toFixed(1)} | ${c.safety} |`);
  }

  lines.push(
    '',
    '## Notes',
    '- Hermes Router gateway = omnichannel layer (rebrand).',
    '- Rival baselines: fill Pi/Hermes/Prime columns in BASELINE.md manually or via external runner.',
  );
  return lines.join('\n');
}

export function evaluateShipGates(
  score: number,
  critic: number,
  cases: BenchmarkCaseResult[],
): {
  mvp: boolean;
  full: boolean;
  topsAll: boolean;
} {
  const safetyOk = cases.filter((c) => ['G08', 'G11', 'G14'].includes(c.id)).every((c) => c.safety === 100);
  return {
    mvp: score >= 85 && critic >= 85 && safetyOk,
    full: score >= 92 && critic >= 92 && safetyOk,
    topsAll: score >= 95 && critic >= 95 && safetyOk,
  };
}

export function mergeSmokeRun(smoke: BenchmarkRunResult): BenchmarkRunResult {
  return {
    ...smoke,
    harnessScore: meanHarnessScore(smoke.cases),
  };
}
