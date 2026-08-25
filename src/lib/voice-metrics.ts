/**
 * Voice latency metrics — end-to-end STT → LLM → TTS timing for a turn.
 * Surfaced in Admin / COCKPIT error-budget widgets when `voice.metrics` is on.
 */
// @ts-nocheck

export type VoiceMark = 'stt_end' | 'llm_start' | 'llm_end' | 'tts_start' | 'tts_first_chunk' | 'tts_end';

export interface VoiceTurnMetrics {
  id: string;
  at: string;
  sttMs?: number;
  llmMs?: number;
  ttsTimeToFirstAudioMs?: number | null;
  ttsTotalMs?: number;
  ttsMode?: 'single' | 'streaming';
  ttsChunks?: number;
  /** Alias used by App.tsx / tests */
  ttfbMs?: number | null;
  totalMs?: number;
  endToEndMs?: number;
  marks: Partial<Record<VoiceMark, number>>;
  startedAt: number;
}

const MAX = 40;
const ring: VoiceTurnMetrics[] = [];
const open = new Map<string, VoiceTurnMetrics>();

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function beginVoiceTurn(id?: string): string {
  const turnId = id ?? `vt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const entry: VoiceTurnMetrics = {
    id: turnId,
    at: new Date().toISOString(),
    marks: {},
    startedAt: now(),
  };
  open.set(turnId, entry);
  return turnId;
}

export function markVoice(mark: VoiceMark, turnId: string): VoiceTurnMetrics | null {
  const entry = open.get(turnId);
  if (!entry) return null;
  const t = now();
  entry.marks[mark] = t;

  if (mark === 'stt_end') {
    entry.sttMs = Math.max(0, t - entry.startedAt);
  }
  if (mark === 'llm_end' && entry.marks.llm_start != null) {
    entry.llmMs = Math.max(0, t - entry.marks.llm_start);
  }
  if (mark === 'tts_first_chunk' && entry.marks.tts_start != null) {
    entry.ttsTimeToFirstAudioMs = Math.max(0, t - entry.marks.tts_start);
    entry.ttfbMs = entry.ttsTimeToFirstAudioMs;
  }
  if (mark === 'tts_end') {
    if (entry.marks.tts_start != null) {
      entry.ttsTotalMs = Math.max(0, t - entry.marks.tts_start);
    }
    entry.totalMs = Math.max(0, t - entry.startedAt);
    entry.endToEndMs = entry.totalMs;
    if (entry.ttfbMs == null && entry.ttsTimeToFirstAudioMs != null) {
      entry.ttfbMs = entry.ttsTimeToFirstAudioMs;
    }
    open.delete(turnId);
    ring.unshift({ ...entry });
    while (ring.length > MAX) ring.pop();
    try {
      window.dispatchEvent(new CustomEvent('jarvis:voice-metrics', { detail: entry }));
    } catch {
      /* non-DOM */
    }
  }
  return entry;
}

export function recordVoiceMetrics(partial: Partial<VoiceTurnMetrics> & { id?: string }): VoiceTurnMetrics {
  const entry: VoiceTurnMetrics = {
    id: partial.id ?? `rec_${Date.now()}`,
    at: partial.at ?? new Date().toISOString(),
    marks: partial.marks ?? {},
    startedAt: partial.startedAt ?? now(),
    ...partial,
  };
  if (entry.endToEndMs == null && entry.sttMs != null && entry.llmMs != null && entry.ttsTotalMs != null) {
    entry.endToEndMs = entry.sttMs + entry.llmMs + entry.ttsTotalMs;
    entry.totalMs = entry.endToEndMs;
  }
  ring.unshift(entry);
  while (ring.length > MAX) ring.pop();
  return entry;
}

export function getLatestVoiceMetrics(): VoiceTurnMetrics | null {
  return ring[0] ?? null;
}

export function listVoiceMetrics(limit = 20): VoiceTurnMetrics[] {
  return ring.slice(0, Math.max(1, limit));
}

export function summarizeVoiceLatency(): {
  samples: number;
  avgTtsFirstMs: number | null;
  avgEndToEndMs: number | null;
  p95TtsFirstMs: number | null;
  avgTotalMs: number | null;
} {
  return voiceMetricsSummary();
}

export function voiceMetricsSummary(): {
  samples: number;
  avgTtsFirstMs: number | null;
  avgEndToEndMs: number | null;
  p95TtsFirstMs: number | null;
  avgTotalMs: number | null;
} {
  const samples = ring.length;
  if (!samples) {
    return {
      samples: 0,
      avgTtsFirstMs: null,
      avgEndToEndMs: null,
      p95TtsFirstMs: null,
      avgTotalMs: null,
    };
  }
  const firsts = ring
    .map((r) => r.ttfbMs ?? r.ttsTimeToFirstAudioMs)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    .sort((a, b) => a - b);
  const e2e = ring
    .map((r) => r.totalMs ?? r.endToEndMs)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const p95 =
    firsts.length === 0 ? null : firsts[Math.min(firsts.length - 1, Math.floor(firsts.length * 0.95))];
  return {
    samples,
    avgTtsFirstMs: avg(firsts),
    avgEndToEndMs: avg(e2e),
    p95TtsFirstMs: p95,
    avgTotalMs: avg(e2e),
  };
}

export function clearVoiceMetrics(): void {
  ring.length = 0;
  open.clear();
}
