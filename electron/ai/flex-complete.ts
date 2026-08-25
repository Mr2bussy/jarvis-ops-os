// @ts-nocheck
import { detectProviderFrom, type Provider } from './router';

export interface ModelProviderResolution {
  model: string;
  provider: Provider;
  fallbackReason?: string;
}

/**
 * Resolve model + provider with key-aware fallback so JARVIS_MODEL=claude without
 * ANTHROPIC_API_KEY does not hard-fail when Gemini/Ollama is configured.
 */
export function resolveModelAndProvider(deps: {
  getKey: (name: string) => string;
  envModel?: string;
  envGeminiModel?: string;
  envOllamaModel?: string;
}): ModelProviderResolution {
  const configured = deps.getKey('JARVIS_MODEL') || deps.envModel;
  const hasOllama = Boolean(deps.getKey('OLLAMA_BASE_URL') || deps.getKey('OLLAMA_HOST'));
  const hasGemini = Boolean(deps.getKey('GEMINI_API_KEY'));
  const hasAnthropic = Boolean(deps.getKey('ANTHROPIC_API_KEY'));
  const hasOpenAi = Boolean(deps.getKey('OPENAI_API_KEY'));

  const model =
    configured ||
    (hasGemini ? deps.envGeminiModel || 'gemini-2.5-flash' : '') ||
    (hasOllama ? deps.envOllamaModel || 'qwen3-coder-next' : '') ||
    (hasAnthropic ? 'claude-haiku-4-5' : '') ||
    (hasOpenAi ? 'gpt-4o-mini' : '') ||
    'gemini-2.5-flash';

  const provider = detectProviderFrom(model, hasOllama);

  const needsFallback =
    (provider === 'anthropic' && !hasAnthropic) ||
    (provider === 'openai' && !hasOpenAi) ||
    (provider === 'google' && !hasGemini) ||
    (provider === 'mistral' && !deps.getKey('MISTRAL_API_KEY')) ||
    (provider === 'deepseek' && !deps.getKey('DEEPSEEK_API_KEY'));

  if (needsFallback) {
    if (hasGemini) {
      return {
        model: deps.envGeminiModel || 'gemini-2.5-flash',
        provider: 'google',
        fallbackReason: `${provider} key missing — using Gemini`,
      };
    }
    if (hasOllama) {
      return {
        model: deps.envOllamaModel || 'qwen3-coder-next',
        provider: 'ollama',
        fallbackReason: `${provider} key missing — using Ollama`,
      };
    }
    if (hasAnthropic) {
      return { model: 'claude-haiku-4-5', provider: 'anthropic', fallbackReason: 'fallback to Anthropic' };
    }
    if (hasOpenAi) {
      return { model: 'gpt-4o-mini', provider: 'openai', fallbackReason: 'fallback to OpenAI' };
    }
  }

  return { model, provider };
}
