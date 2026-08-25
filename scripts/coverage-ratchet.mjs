#!/usr/bin/env node
// @ts-nocheck
/**
 * Coverage ratchet ÔÇö stores the highest measured totals and fails CI when coverage drops.
 *
 * Run after `pnpm test:cov` (vitest writes coverage/coverage-summary.json).
 *
 *   node scripts/coverage-ratchet.mjs --update   # record new floor (never lowers)
 *   node scripts/coverage-ratchet.mjs            # compare; exit 1 on regression
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUMMARY = resolve(ROOT, 'coverage/coverage-summary.json');
const FLOOR = resolve(ROOT, '.coverage-floor.json');
const UPDATE = process.argv.includes('--update');

/** @typedef {'lines' | 'statements' | 'functions' | 'branches'} Metric */

/** @type {Metric[]} */
const METRICS = ['lines', 'statements', 'functions', 'branches'];

/**
 * @param {string} path
 * @returns {Record<string, { lines?: { pct: number }, statements?: { pct: number }, functions?: { pct: number }, branches?: { pct: number } }>}
 */
function loadSummary(path) {
  if (!existsSync(path)) {
    console.error(`coverage-ratchet: missing ${path} ÔÇö run pnpm test:cov first`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`coverage-ratchet: could not parse ${path}:`, e);
    process.exit(2);
  }
}

/** @param {ReturnType<typeof loadSummary>} summary */
function extractTotals(summary) {
  const total = summary.total;
  if (!total) {
    console.error('coverage-ratchet: coverage-summary.json has no "total" key');
    process.exit(2);
  }
  /** @type {Record<Metric, number>} */
  const out = {};
  for (const m of METRICS) {
    const pct = total[m]?.pct;
    if (typeof pct !== 'number' || Number.isNaN(pct)) {
      console.error(`coverage-ratchet: missing total.${m}.pct`);
      process.exit(2);
    }
    out[m] = pct;
  }
  return out;
}

/** @param {Record<Metric, number>} a @param {Record<Metric, number>} b */
function maxMetrics(a, b) {
  /** @type {Record<Metric, number>} */
  const out = { ...a };
  for (const m of METRICS) {
    out[m] = Math.max(a[m] ?? 0, b[m] ?? 0);
  }
  return out;
}

function main() {
  const current = extractTotals(loadSummary(SUMMARY));

  if (UPDATE) {
    let floor = { ...current };
    if (existsSync(FLOOR)) {
      try {
        const prev = JSON.parse(readFileSync(FLOOR, 'utf8'));
        if (prev.metrics) floor = maxMetrics(prev.metrics, current);
      } catch {
        console.warn('coverage-ratchet: ignoring corrupt floor file, rewriting');
      }
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      source: 'coverage/coverage-summary.json',
      metrics: floor,
    };
    writeFileSync(FLOOR, JSON.stringify(payload, null, 2) + '\n');
    console.log('coverage-ratchet: floor updated');
    for (const m of METRICS) console.log(`  ${m}: ${floor[m].toFixed(2)}%`);
    return 0;
  }

  if (!existsSync(FLOOR)) {
    console.error(`coverage-ratchet: missing ${FLOOR} ÔÇö run with --update once after test:cov`);
    process.exit(2);
  }

  let floor;
  try {
    floor = JSON.parse(readFileSync(FLOOR, 'utf8'));
  } catch {
    console.error(`coverage-ratchet: could not parse ${FLOOR}`);
    process.exit(2);
  }

  if (!floor.metrics) {
    console.error('coverage-ratchet: floor file has no metrics');
    process.exit(2);
  }

  /** @type {string[]} */
  const regressions = [];
  for (const m of METRICS) {
    const cur = current[m];
    const min = floor.metrics[m];
    if (typeof min !== 'number') continue;
    if (cur + 0.005 < min) {
      regressions.push(`${m}: ${cur.toFixed(2)}% < floor ${min.toFixed(2)}%`);
    }
  }

  if (regressions.length > 0) {
    console.error('coverage-ratchet: coverage regressed ÔÇö build failed\n');
    for (const r of regressions) console.error(`  ${r}`);
    console.error('\nFix tests or run --update only after intentional coverage improvement.');
    return 1;
  }

  console.log('coverage-ratchet: ok (at or above floor)');
  for (const m of METRICS) {
    console.log(`  ${m}: ${current[m].toFixed(2)}% (floor ${floor.metrics[m].toFixed(2)}%)`);
  }
  return 0;
}

process.exit(main());
