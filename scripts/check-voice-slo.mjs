#!/usr/bin/env node
// @ts-nocheck
/**
 * Optional CI check: fail if latest voice error-budget metric shows SLO breach.
 * Reads .artifacts/metrics/error-budget.json or JARVIS_METRICS_DIR.
 *
 *   node scripts/check-voice-slo.mjs
 *   CHECK_VOICE_SLO=1 pnpm verify  (wired optional)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.JARVIS_METRICS_DIR || join(ROOT, '.artifacts');
const candidates = [
  join(dir, 'metrics', 'error-budget.json'),
  join(dir, 'error-budget.json'),
  join(ROOT, '.artifacts', 'metrics', 'error-budget.json'),
];

const path = candidates.find((p) => existsSync(p));
if (!path) {
  console.log('check-voice-slo: SKIP (no metrics file — run app / production:error-budget first)');
  process.exit(0);
}

const snap = JSON.parse(readFileSync(path, 'utf8'));
const breached = Boolean(snap.voiceSloBreached || snap.failUi);
console.log(
  `check-voice-slo: p95=${snap.p95VoiceE2eMs ?? '—'} slo=${snap.voiceSloMs ?? 3000} breached=${breached}`,
);
if (breached && process.env.CHECK_VOICE_SLO === '1') {
  console.error('Voice / error-budget SLO breached — failing (CHECK_VOICE_SLO=1)');
  process.exit(1);
}
process.exit(0);
