/**
 * LLM dependency injection — employees and harness call complete(), never direct SDK.
 */
// @ts-nocheck

export interface LlmMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LlmCompleteInput {
  messages: LlmMessage[];
  system?: string;
  maxTokens?: number;
  taskClass?: string;
}

export interface LlmProvider {
  readonly id: string;
  complete(input: LlmCompleteInput): Promise<string>;
  probe(): Promise<{ ok: boolean; latencyMs: number; detail?: string }>;
}

let provider: LlmProvider | null = null;

export function setLlmProvider(p: LlmProvider): void {
  provider = p;
}

export function getLlmProvider(): LlmProvider {
  if (!provider) throw new Error('LLM provider nicht registriert');
  return provider;
}

export async function llmComplete(input: LlmCompleteInput): Promise<string> {
  return getLlmProvider().complete(input);
}

/** Wrap an existing CompleteFn from harness types. */
export function wrapCompleteFn(
  fn: (input: {
    messages: { role: string; content: string }[];
    system?: string;
    maxTokens?: number;
  }) => Promise<string>,
  id = 'harness-default',
): LlmProvider {
  return {
    id,
    complete: (input) =>
      fn({
        messages: input.messages,
        system: input.system,
        maxTokens: input.maxTokens,
      }),
    probe: async () => {
      const t0 = Date.now();
      try {
        await fn({ messages: [{ role: 'user', content: 'ping' }], maxTokens: 8 });
        return { ok: true, latencyMs: Date.now() - t0 };
      } catch (err: unknown) {
        return { ok: false, latencyMs: Date.now() - t0, detail: String((err as Error)?.message ?? err) };
      }
    },
  };
}
