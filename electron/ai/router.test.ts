import { describe, it, expect } from 'vitest';
import { detectProviderFrom, compressSystem, compressMsgs } from './router';

describe('detectProviderFrom', () => {
  it('routes claude → anthropic', () =>
    expect(detectProviderFrom('claude-haiku-4-5', false)).toBe('anthropic'));
  it('routes gemini → google', () => expect(detectProviderFrom('gemini-2.0-flash', false)).toBe('google'));
  it('routes gpt → openai', () => expect(detectProviderFrom('gpt-4.1-mini', false)).toBe('openai'));
  it('routes o3 → openai', () => expect(detectProviderFrom('o3-mini', false)).toBe('openai'));
  it('routes mistral → mistral when no ollama base', () =>
    expect(detectProviderFrom('mistral-large', false)).toBe('mistral'));
  it('routes deepseek → deepseek when no ollama base', () =>
    expect(detectProviderFrom('deepseek-chat', false)).toBe('deepseek'));
  it('routes llama → ollama', () => expect(detectProviderFrom('llama3.1', false)).toBe('ollama'));
  it('prefers ollama when an ollama base url is set', () => {
    expect(detectProviderFrom('mistral-large', true)).toBe('ollama');
    expect(detectProviderFrom('deepseek-chat', true)).toBe('ollama');
  });
  it('falls back to anthropic for unknown models', () =>
    expect(detectProviderFrom('mystery-x', false)).toBe('anthropic'));
});

describe('compressSystem', () => {
  it('returns short prompts unchanged', () => {
    expect(compressSystem('short prompt', 200)).toBe('short prompt');
  });
  it('truncates long prompts at a sentence boundary', () => {
    const long = 'First sentence. ' + 'x'.repeat(2000);
    const out = compressSystem(long, 10);
    expect(out.length).toBeLessThan(long.length);
    expect(out.endsWith('.')).toBe(true);
  });
});

describe('compressMsgs', () => {
  const m = (role: string, i: number) => ({ role, content: String(i) });
  it('returns short histories unchanged', () => {
    expect(compressMsgs([m('user', 1), m('assistant', 2)], 6)).toHaveLength(2);
  });
  it('keeps only the last N and starts on a user turn', () => {
    const arr = [
      m('user', 1),
      m('assistant', 2),
      m('user', 3),
      m('assistant', 4),
      m('user', 5),
      m('assistant', 6),
      m('user', 7),
      m('assistant', 8),
    ];
    const out = compressMsgs(arr, 3);
    expect(out[0].role).toBe('user');
    expect(out.length).toBeLessThanOrEqual(3);
  });
});
