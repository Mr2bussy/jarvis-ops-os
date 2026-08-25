/**
 * Error-budget + voice latency transparency widget for Admin / COCKPIT.
 * Fail UI when availability budget <25% OR voice p95 SLO (3s) is breached.
 */
// @ts-nocheck

import { useEffect, useState } from 'react';
import { getJarvisBridge } from '../lib/bridge';
import { listVoiceMetrics, voiceMetricsSummary } from '../lib/voice-metrics';

interface BudgetSnap {
  availabilityPct: number;
  budgetRemainingPct: number;
  sloTargetPct: number;
  requests: number;
  failures: number;
  avgVoiceE2eMs: number | null;
  p95VoiceE2eMs?: number | null;
  voiceSloBreached?: boolean;
  failUi?: boolean;
  voiceSloMs?: number;
  modelProbeOk: boolean | null;
  modelProbeLatencyMs: number | null;
  hitlPending: number;
  employeeFailures: number;
}

function fmt(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return `${Math.round(ms)} ms`;
}

export function ErrorBudgetWidget({ compact = false }: { compact?: boolean }) {
  const [budget, setBudget] = useState<BudgetSnap | null>(null);
  const [voiceSum, setVoiceSum] = useState(voiceMetricsSummary());

  useEffect(() => {
    const bridge = getJarvisBridge() as {
      production?: {
        errorBudget?: () => Promise<BudgetSnap>;
      };
    };
    const refresh = () => {
      void bridge.production
        ?.errorBudget?.()
        .then(setBudget)
        .catch(() => {});
      setVoiceSum(voiceMetricsSummary());
    };
    refresh();
    const t = setInterval(refresh, 4000);
    const onVoice = () => setVoiceSum(voiceMetricsSummary());
    window.addEventListener('jarvis:voice-metrics', onVoice);
    return () => {
      clearInterval(t);
      window.removeEventListener('jarvis:voice-metrics', onVoice);
    };
  }, []);

  const recent = listVoiceMetrics(5);
  const voiceBreached =
    budget?.voiceSloBreached ||
    (voiceSum.p95TtsFirstMs != null && voiceSum.p95TtsFirstMs > (budget?.voiceSloMs ?? 3000));
  const failUi = Boolean(budget?.failUi || voiceBreached || (budget && budget.budgetRemainingPct < 25));
  const budgetColor =
    budget == null
      ? 'var(--cyan-dim)'
      : failUi
        ? 'var(--rose)'
        : budget.budgetRemainingPct < 50
          ? 'var(--amber)'
          : 'var(--jade)';

  return (
    <div
      className="font-mono"
      data-error-budget={failUi ? 'fail' : 'ok'}
      style={{ fontSize: compact ? 9 : 10, letterSpacing: '0.06em' }}
    >
      <div
        style={{
          color: failUi ? 'var(--rose)' : 'var(--cyan-dim)',
          marginBottom: 8,
          fontWeight: failUi ? 700 : 400,
        }}
      >
        {failUi ? 'ERROR BUDGET · FAIL' : `ERROR BUDGET · SLO ${budget?.sloTargetPct ?? 99}%`}
        {voiceBreached ? ` · VOICE p95 > ${budget?.voiceSloMs ?? 3000}ms` : ''}
      </div>
      {failUi ? (
        <div
          role="alert"
          style={{
            border: '1px solid var(--rose)',
            color: 'var(--rose)',
            padding: '6px 8px',
            marginBottom: 10,
            letterSpacing: '0.08em',
          }}
        >
          SLO BREACH — availability budget and/or voice latency over limit. Metric logged for CI.
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ border: '1px solid var(--line-soft)', padding: '6px 8px' }}>
          <div style={{ color: 'var(--cyan-dim)' }}>Availability</div>
          <div style={{ color: 'var(--fg)', fontSize: compact ? 12 : 14 }}>
            {budget ? `${budget.availabilityPct.toFixed(2)}%` : '—'}
          </div>
        </div>
        <div style={{ border: '1px solid var(--line-soft)', padding: '6px 8px' }}>
          <div style={{ color: 'var(--cyan-dim)' }}>Budget left</div>
          <div style={{ color: budgetColor, fontSize: compact ? 12 : 14 }}>
            {budget ? `${budget.budgetRemainingPct.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>
      <div style={{ color: 'var(--fg-dim)', marginBottom: 6 }}>
        Reqs {budget?.requests ?? 0} · Fail {budget?.failures ?? 0} · HITL {budget?.hitlPending ?? 0} ·
        EmpFail {budget?.employeeFailures ?? 0}
      </div>
      <div style={{ color: 'var(--cyan-dim)', marginBottom: 4 }}>Voice latency</div>
      <div
        style={{
          color: voiceBreached ? 'var(--rose)' : 'var(--fg-dim)',
          marginBottom: 6,
        }}
      >
        samples {voiceSum.samples} · avg TTS-first {fmt(voiceSum.avgTtsFirstMs)} · p95{' '}
        {fmt(voiceSum.p95TtsFirstMs ?? budget?.p95VoiceE2eMs)} · e2e{' '}
        {fmt(voiceSum.avgEndToEndMs ?? budget?.avgVoiceE2eMs)}
      </div>
      <div style={{ color: 'var(--cyan-dim)', marginBottom: 4 }}>Model probe</div>
      <div style={{ color: 'var(--fg-dim)', marginBottom: compact ? 0 : 8 }}>
        {budget?.modelProbeOk == null
          ? 'noch kein Probe'
          : budget.modelProbeOk
            ? `ok · ${fmt(budget.modelProbeLatencyMs)}`
            : `fail · ${fmt(budget.modelProbeLatencyMs)}`}
      </div>
      {!compact && recent.length > 0 ? (
        <div style={{ maxHeight: 80, overflow: 'auto' }}>
          {recent.map((r, i) => (
            <div key={`${r.at}-${i}`} style={{ color: 'var(--fg-dim)', fontSize: 9 }}>
              {r.at.slice(11, 19)} · TTS {r.ttsMode ?? '—'} · first {fmt(r.ttsTimeToFirstAudioMs)} · total{' '}
              {fmt(r.ttsTotalMs)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
