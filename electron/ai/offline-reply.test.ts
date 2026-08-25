// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { offlineJarvisReply } from './offline-reply';

describe('offlineJarvisReply', () => {
  it('acks empty standby as degraded', () => {
    const r = offlineJarvisReply('');
    expect(r.degraded).toBe(true);
    expect(r.text).toMatch(/standing by/i);
    expect(r.reason).toBeTruthy();
  });
  it('handles ping', () => {
    expect(offlineJarvisReply('ping').text).toMatch(/nominal|live/i);
  });
  it('echoes unknown directives', () => {
    expect(offlineJarvisReply('deploy cell ARC').text).toMatch(/Acknowledged/);
  });
  it('surfaces concrete fail reasons when provided', () => {
    const r = offlineJarvisReply('ping', ['gemini:RATE_LIMIT', 'ollama:fetch failed']);
    expect(r.degraded).toBe(true);
    expect(r.text).toMatch(/Kein LLM erreichbar|Gemini|Ollama/i);
    expect(r.reason).toMatch(/gemini|ollama/i);
  });
});
