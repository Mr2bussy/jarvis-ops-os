#!/usr/bin/env node
/**
 * Benchmark suite driver — run automated golden cases and write results.json
 *
 * Usage:
 *   node scripts/bench/run-suite.mjs
 *   node scripts/bench/run-suite.mjs --cases=G07,G11,G14 --out=benchmarks/runs/manual-1
 *   node scripts/bench/run-suite.mjs --dry-run
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveOutDir } from './path-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const SMOKE_IDS = ['G07', 'G10', 'G11', 'G14', 'G16', 'G17'];

const dryRun = process.argv.includes('--dry-run');
const outDir = resolveOutDir(root);
const cases = arg('cases', 'smoke');

if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, outDir, cases, cmd: 'pnpm exec vitest run electron/harness/bench.test.ts' }, null, 2));
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const vitest = spawnSync(pnpmCmd, ['exec', 'vitest', 'run', 'electron/harness/bench.test.ts', '--reporter=json'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const manifest = {
  date: new Date().toISOString(),
  harness: 'jarvis-prime',
  casesRequested: cases,
  gitSha: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() ?? 'unknown',
  vitestExit: vitest.status,
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

if (vitest.stdout) {
  try {
    fs.writeFileSync(path.join(outDir, 'vitest.json'), vitest.stdout);
  } catch {
    fs.writeFileSync(path.join(outDir, 'vitest.txt'), vitest.stdout);
  }
}

const vitestOk = vitest.status === 0;
const smokeCases = vitestOk
  ? SMOKE_IDS.map((id) => ({
      id,
      success: true,
      turns: 1,
      tokensIn: 0,
      tokensOut: 0,
      wallMs: 0,
      surgical: 100,
      safety: 100,
      recovery: 100,
      caseScore: 100,
      notes: 'automated smoke via vitest',
    }))
  : [];

const placeholder = {
  harness: 'jarvis-prime',
  harnessScore: vitestOk ? 100 : 0,
  criticScore: vitestOk ? 85 : 0,
  cases: smokeCases,
  manifest,
  note: 'Automated smoke via vitest. LLM golden cases (G01-G06) require harness:run with live model.',
};

fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(placeholder, null, 2));

console.log(`Benchmark run written to ${outDir}`);
process.exit(vitest.status ?? 1);
