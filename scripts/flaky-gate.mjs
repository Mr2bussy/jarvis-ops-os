#!/usr/bin/env node
// @ts-nocheck
/**
 * Flaky gate (D3): run the unit suite three times; any mismatch or failure = exit 1.
 * Usage: pnpm test:flaky
 */

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = Number(process.env.FLAKY_RUNS || 3);

function runOnce(i) {
  console.log(`\n── flaky-gate: run ${i}/${RUNS} ──`);
  const r = spawnSync('pnpm', ['exec', 'vitest', 'run'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  });
  return r.status ?? 1;
}

function main() {
  const codes = [];
  for (let i = 1; i <= RUNS; i++) {
    const code = runOnce(i);
    codes.push(code);
    if (code !== 0) {
      console.error(`flaky-gate: FAILED on run ${i}/${RUNS} (exit ${code})`);
      return code;
    }
  }
  console.log(`\nflaky-gate: ${RUNS} consecutive green runs (${codes.join(',')})`);
  return 0;
}

process.exit(main());
