// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { resolveModelAndProvider } from './flex-complete';

describe('resolveModelAndProvider', () => {
  it('falls back to Gemini when JARVIS_MODEL is claude but Anthropic key missing', () => {
    const r = resolveModelAndProvider({
      getKey: (n) => (n === 'JARVIS_MODEL' ? 'claude-haiku-4-5' : n === 'GEMINI_API_KEY' ? 'g' : ''),
    });
    expect(r.provider).toBe('google');
    expect(r.model).toMatch(/^gemini/);
    expect(r.fallbackReason).toMatch(/anthropic/i);
  });

  it('keeps anthropic when key present', () => {
    const r = resolveModelAndProvider({
      getKey: (n) => (n === 'JARVIS_MODEL' ? 'claude-haiku-4-5' : n === 'ANTHROPIC_API_KEY' ? 'sk' : ''),
    });
    expect(r.provider).toBe('anthropic');
  });

  it('falls back to Ollama when Gemini missing and Ollama host set', () => {
    const r = resolveModelAndProvider({
      getKey: (n) =>
        n === 'JARVIS_MODEL' ? 'claude-haiku-4-5' : n === 'OLLAMA_BASE_URL' ? 'http://127.0.0.1:11434' : '',
      envOllamaModel: 'qwen3-coder-next',
    });
    expect(r.provider).toBe('ollama');
    expect(r.model).toBe('qwen3-coder-next');
    expect(r.fallbackReason).toMatch(/Ollama/i);
  });

  it('defaults to gemini flash when nothing configured', () => {
    const r = resolveModelAndProvider({ getKey: () => '' });
    expect(r.provider).toBe('google');
    expect(r.model).toMatch(/^gemini/);
  });
});
