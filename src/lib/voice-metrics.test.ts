// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { beginVoiceTurn, markVoice, getLatestVoiceMetrics, summarizeVoiceLatency } from './voice-metrics';

describe('voice-metrics', () => {
  beforeEach(() => {
    beginVoiceTurn('t-reset');
  });

  it('tracks stt/llm/tts phases', () => {
    const id = beginVoiceTurn('t1');
    markVoice('stt_end', id);
    markVoice('llm_start', id);
    markVoice('llm_end', id);
    markVoice('tts_start', id);
    markVoice('tts_first_chunk', id);
    markVoice('tts_end', id);
    const latest = getLatestVoiceMetrics();
    expect(latest?.id).toBe('t1');
    expect(latest?.totalMs).toBeTypeOf('number');
    expect(latest?.ttfbMs).toBeTypeOf('number');
    const sum = summarizeVoiceLatency();
    expect(sum.samples).toBeGreaterThanOrEqual(1);
  });
});
