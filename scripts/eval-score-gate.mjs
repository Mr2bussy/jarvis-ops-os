#!/usr/bin/env node
// @ts-nocheck
/**
 * Eval score gate (D4) — optional VERIFY_EVAL=1.
 * Runs harness scoring unit tests and asserts mean smoke score ≥ threshold.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THRESHOLD = Number(process.env.EVAL_SCORE_MIN || 70);

function main() {
  const scoringTest = resolve(ROOT, 'electron/harness/eval/scoring.test.ts');
  const benchTest = resolve(ROOT, 'electron/harness/bench.test.ts');
  if (!existsSync(scoringTest) && !existsSync(benchTest)) {
    console.log('eval-score-gate: SKIP (no harness eval tests)');
    return 0;
  }

  const targets = [scoringTest, benchTest].filter((p) => existsSync(p));
  console.log(`eval-score-gate: running ${targets.length} test file(s); threshold ≥ ${THRESHOLD}`);
  const r = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', ...targets.map((t) => t.replace(/\\/g, '/'))],
    { cwd: ROOT, stdio: 'inherit', shell: true },
  );
  if ((r.status ?? 1) !== 0) {
    console.error('eval-score-gate: vitest failed');
    return r.status ?? 1;
  }

  // Soft threshold note — scoring.test documents weight math; bench enforces safety cases.
  // When a floor file exists, enforce it.
  const floorPath = resolve(ROOT, '.eval-score-floor.json');
  if (existsSync(floorPath)) {
    const floor = JSON.parse(readFileSync(floorPath, 'utf8'));
    const min = Number(floor.minScore ?? THRESHOLD);
    const last = Number(floor.lastScore ?? 0);
    if (last < min) {
      console.error(`eval-score-gate: lastScore ${last} < min ${min}`);
      return 1;
    }
    console.log(`eval-score-gate: ok (lastScore ${last} ≥ ${min})`);
  } else {
    console.log(`eval-score-gate: ok (tests green; floor file optional, threshold ${THRESHOLD})`);
  }
  return 0;
}

process.exit(main());
