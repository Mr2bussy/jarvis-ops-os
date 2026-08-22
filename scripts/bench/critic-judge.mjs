#!/usr/bin/env node
/**
 * Deterministic critic stub for benchmark runs (LLM judge plugs in later).
 *
 * Usage:
 *   node scripts/bench/critic-judge.mjs --run=benchmarks/runs/2026-08-22
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveRunDir } from './path-utils.mjs';

const runDir = resolveRunDir();
if (!runDir) {
  console.error('Usage: node scripts/bench/critic-judge.mjs <runDir>');
  console.error('   or: BENCH_RUN_DIR=... node scripts/bench/critic-judge.mjs');
  process.exit(1);
}
const resultsPath = path.join(runDir, 'results.json');

if (!fs.existsSync(resultsPath)) {
  console.error(`Missing ${resultsPath}`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const vitestPath = path.join(runDir, 'vitest.json');
let vitestOk = false;
if (typeof results.manifest?.vitestExit === 'number') {
  vitestOk = results.manifest.vitestExit === 0;
} else if (fs.existsSync(vitestPath)) {
  try {
    const v = JSON.parse(fs.readFileSync(vitestPath, 'utf8'));
    vitestOk = v.success === true || v.numFailedTests === 0;
  } catch {
    vitestOk = false;
  }
}

const criticScore = vitestOk ? 88 : 55;
results.criticScore = criticScore;
results.critic = {
  mode: 'deterministic-stub',
  agreeWithAutomation: vitestOk,
  notes: vitestOk ? 'Vitest smoke green — upgrade to LLM judge for full suite' : 'Fix failing smoke before claiming harness improvement',
};

fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ runDir, criticScore }, null, 2));
