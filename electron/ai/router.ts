export type Provider = 'anthropic' | 'openai' | 'google' | 'mistral' | 'deepseek' | 'ollama';

/**
 * Pure provider routing: which backend should serve a given model id?
 * `hasOllamaBase` reflects whether an OLLAMA_BASE_URL is configured (which makes
 * Ollama the catch-all for otherwise-ambiguous local models). Kept pure (no config
 * lookup) so it is trivially unit-testable; main.ts binds the config and calls this.
 */
export function detectProviderFrom(model: string, hasOllamaBase: boolean): Provider {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gemini')) return 'google';
  if (model.startsWith('codestral') || (model.startsWith('mistral') && !hasOllamaBase)) return 'mistral';
  if (model.startsWith('deepseek') && !hasOllamaBase) return 'deepseek';
  if (
    model.startsWith('gpt') ||
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('o4') ||
    model.startsWith('chatgpt')
  )
    return 'openai';
  if (hasOllamaBase || model.startsWith('llama') || model.startsWith('phi') || model.startsWith('qwen'))
    return 'ollama';
  return 'anthropic';
}

const estTok = (s: string): number => Math.ceil(s.length / 4);

/** Trim an over-long system prompt to ~maxTok tokens, preferring a sentence boundary. */
export function compressSystem(sys: string, maxTok = 200): string {
  if (estTok(sys) <= maxTok) return sys;
  const cut = sys.slice(0, maxTok * 4);
  const dot = cut.lastIndexOf('. ');
  return (dot > 0 ? cut.slice(0, dot + 1) : cut).trim();
}

/** Keep only the last `maxTurns` messages, ensuring the window starts on a user turn. */
export function compressMsgs<T extends { role: string }>(msgs: T[], maxTurns = 6): T[] {
  if (msgs.length <= maxTurns) return msgs;
  let t = msgs.slice(-maxTurns);
  while (t.length && t[0].role !== 'user') t = t.slice(1);
  return t.length ? t : msgs.slice(-2);
}
