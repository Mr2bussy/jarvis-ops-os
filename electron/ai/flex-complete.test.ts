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
});
