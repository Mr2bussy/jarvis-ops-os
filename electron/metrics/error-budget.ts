/**
 * Error-budget / reliability metrics for COCKPIT + Admin transparency.
 * Voice latency SLO: p95 end-to-end < VOICE_SLO_MS (default 3000).
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ErrorBudgetVoiceStats {
  samples: number;
  avgTotalMs: number | null;
  avgTtfbMs: number | null;
  p95TotalMs: number | null;
}

export interface ErrorBudgetSnapshot {
  at: string;
  windowHours: number;
  requests: number;
  failures: number;
  successRate: number;
  availabilityPct: number;
  budgetRemainingPct: number;
  sloTargetPct: number;
  voice: ErrorBudgetVoiceStats;
  /** Flat fields kept for ErrorBudgetWidget */
  voiceSamples: number;
  avgVoiceE2eMs: number | null;
  p95VoiceE2eMs: number | null;
  voiceSloMs: number;
  voiceSloBreached: boolean;
  /** True when availability budget OR voice SLO is exhausted — drives fail UI. */
  failUi: boolean;
  modelProbeOk: boolean | null;
  modelProbeLatencyMs: number | null;
  hitlPending: number;
  employeeFailures: number;
}

const SLO = 99.0;
/** Plan D8: p95 voice latency must stay under 3s. */
export const VOICE_SLO_MS = 3000;
const voiceTotals: number[] = [];
let voiceSamples = 0;
let voiceTotalSum = 0;
let voiceTtfbSum = 0;
let voiceTtfbSamples = 0;
let modelProbeOk: boolean | null = null;
let modelProbeLatencyMs: number | null = null;
let hitlPending = 0;
let employeeFailures = 0;
let okCount = 0;
let failCount = 0;

export function recordRequestOutcome(ok: boolean): void {
  if (ok) okCount++;
  else failCount++;
}

/** Alias used by main / employee execute path. */
export function recordEmployeeResult(ok: boolean): void {
  recordRequestOutcome(ok);
  if (!ok) employeeFailures++;
}

export function recordVoiceLatency(totalMs: number, ttfbMs?: number): void {
  if (!Number.isFinite(totalMs) || totalMs < 0) return;
  voiceSamples++;
  voiceTotalSum += totalMs;
  voiceTotals.push(totalMs);
  while (voiceTotals.length > 200) voiceTotals.shift();
  if (typeof ttfbMs === 'number' && Number.isFinite(ttfbMs) && ttfbMs >= 0) {
    voiceTtfbSamples++;
    voiceTtfbSum += ttfbMs;
  }
}

function p95(xs: number[]): number | null {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? null;
}

export function isVoiceSloBreached(snap?: ErrorBudgetSnapshot): boolean {
  const s = snap ?? getErrorBudgetSnapshot();
  return Boolean(s.p95VoiceE2eMs != null && s.p95VoiceE2eMs > VOICE_SLO_MS);
}

/** Write metric JSON + JSONL line for CI optional check (`scripts/check-voice-slo.mjs`). */
export function writeErrorBudgetMetricFile(userDataDir: string, snap?: ErrorBudgetSnapshot): string {
  const outDir = path.join(userDataDir, 'metrics');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'error-budget.json');
  const data = snap ?? getErrorBudgetSnapshot();
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
  const jsonl = path.join(outDir, 'voice-error-budget.jsonl');
  fs.appendFileSync(
    jsonl,
    `${JSON.stringify({
      at: data.at,
      p95VoiceE2eMs: data.p95VoiceE2eMs,
      voiceSloBreached: data.voiceSloBreached,
      budgetRemainingPct: data.budgetRemainingPct,
      failUi: data.failUi,
      samples: data.voiceSamples,
      sloMs: data.voiceSloMs,
    })}\n`,
    'utf8',
  );
  return out;
}

/** Alias used by production IPC when userData path is already known via cwd artifacts. */
export function appendErrorBudgetMetricFile(snap?: ErrorBudgetSnapshot): void {
  const dir = process.env.JARVIS_METRICS_DIR || path.join(process.cwd(), '.artifacts');
  try {
    writeErrorBudgetMetricFile(dir, snap);
  } catch {
    /* non-fatal */
  }
}

/** @deprecated prefer recordVoiceLatency */
export function recordVoiceE2e(ms: number): void {
  recordVoiceLatency(ms);
}

export function recordModelProbe(ok: boolean, latencyMs: number): void {
  modelProbeOk = ok;
  modelProbeLatencyMs = latencyMs;
}

export function setPendingHitlCount(n: number): void {
  hitlPending = Math.max(0, n);
}

/** @deprecated alias */
export function setHitlPendingCount(n: number): void {
  setPendingHitlCount(n);
}

export function recordEmployeeFailure(): void {
  employeeFailures++;
  failCount++;
}

export function getErrorBudgetSnapshot(windowHours = 24): ErrorBudgetSnapshot {
  const requests = okCount + failCount;
  const failures = failCount;
  const successRate = requests === 0 ? 1 : (requests - failures) / requests;
  const availabilityPct = successRate * 100;
  const allowedFailPct = 100 - SLO;
  const usedFailPct = Math.max(0, 100 - availabilityPct);
  const budgetRemainingPct =
    allowedFailPct <= 0
      ? 100
      : Math.max(0, Math.min(100, ((allowedFailPct - usedFailPct) / allowedFailPct) * 100));

  const avgTotalMs = voiceSamples ? Math.round(voiceTotalSum / voiceSamples) : null;
  const avgTtfbMs = voiceTtfbSamples ? Math.round(voiceTtfbSum / voiceTtfbSamples) : null;
  const p95TotalMs = p95(voiceTotals);
  const voiceSloBreached = p95TotalMs != null && p95TotalMs > VOICE_SLO_MS;
  const failUi = budgetRemainingPct < 25 || voiceSloBreached;

  return {
    at: new Date().toISOString(),
    windowHours,
    requests,
    failures,
    successRate: Math.round(successRate * 10_000) / 10_000,
    availabilityPct: Math.round(availabilityPct * 100) / 100,
    budgetRemainingPct: Math.round(budgetRemainingPct * 100) / 100,
    sloTargetPct: SLO,
    voice: {
      samples: voiceSamples,
      avgTotalMs,
      avgTtfbMs,
      p95TotalMs,
    },
    voiceSamples,
    avgVoiceE2eMs: avgTotalMs,
    p95VoiceE2eMs: p95TotalMs,
    voiceSloMs: VOICE_SLO_MS,
    voiceSloBreached,
    failUi,
    modelProbeOk,
    modelProbeLatencyMs,
    hitlPending,
    employeeFailures,
  };
}

export function resetErrorBudgetCounters(): void {
  okCount = 0;
  failCount = 0;
  voiceSamples = 0;
  voiceTotalSum = 0;
  voiceTtfbSum = 0;
  voiceTtfbSamples = 0;
  voiceTotals.length = 0;
  modelProbeOk = null;
  modelProbeLatencyMs = null;
  hitlPending = 0;
  employeeFailures = 0;
}

/** @deprecated alias for tests that used the older name */
export function resetErrorBudgetForTests(): void {
  resetErrorBudgetCounters();
}
