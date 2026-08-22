#!/usr/bin/env node
/**
 * Phase 7 weekly eval loop — smoke + critic + markdown report
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const weekOf = new Date().toISOString().slice(0, 10);
const outDir = path.join(root, 'benchmarks', 'runs', `weekly-${weekOf}`);

fs.mkdirSync(outDir, { recursive: true });

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const vitest = spawnSync(
  pnpmCmd,
  [
    'exec',
    'vitest',
    'run',
    'electron/harness/bench.test.ts',
    'electron/harness/eval/weekly-report.test.ts',
    'electron/gateway/hermes-router.test.ts',
    '--reporter=json',
  ],
  { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' },
);

if (vitest.stdout) fs.writeFileSync(path.join(outDir, 'vitest.json'), vitest.stdout);

const benchEnv = { ...process.env, BENCH_OUT_DIR: outDir };
spawnSync(process.execPath, ['scripts/bench/run-suite.mjs'], { cwd: root, env: benchEnv, stdio: 'inherit' });

const criticEnv = { ...process.env, BENCH_RUN_DIR: outDir };
spawnSync(process.execPath, ['scripts/bench/critic-judge.mjs'], { cwd: root, env: criticEnv, stdio: 'inherit' });
spawnSync(process.execPath, ['scripts/bench/write-weekly-report.mjs', outDir], { cwd: root, stdio: 'inherit' });

const summary = {
  weekOf,
  vitestExit: vitest.status,
  outDir,
  report: path.join(root, 'docs', 'benchmarks', `WEEKLY-${weekOf}.md`),
};

fs.writeFileSync(path.join(outDir, 'weekly-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(vitest.status ?? 1);
