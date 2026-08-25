// @ts-nocheck
import type { JarvisPrimeHarness } from '../harness/service';
import { emitJarvisEvent } from '../event-bus';
import { isLightInboundMessage, LIGHT_REPLY_SYSTEM } from './reply-router';

export type InboundSource = 'voice' | 'telegram' | 'discord' | 'slack' | 'cli' | 'internal';

export interface InboundRouteDeps {
  harness: JarvisPrimeHarness | null;
  complete: (input: {
    messages: { role: 'user' | 'assistant'; content: string }[];
    system?: string;
    maxTokens?: number;
  }) => Promise<string>;
}

export interface InboundRouteResult {
  ok: boolean;
  text: string;
  err?: string;
  via: 'harness-swarm' | 'harness-light' | 'llm-fallback';
}

/** Shared Hermes + Voice inbound path — light replies skip swarm; failures fall back to LLM. */
export async function routeInboundMessage(
  text: string,
  sessionId: string,
  source: InboundSource,
  deps: InboundRouteDeps,
): Promise<InboundRouteResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, text: '', err: 'Empty message', via: 'llm-fallback' };

  emitJarvisEvent({
    at: new Date().toISOString(),
    source: source === 'voice' ? 'voice' : (source as 'telegram' | 'discord' | 'slack'),
    kind: 'inbound',
    sessionId,
    preview: trimmed.slice(0, 80),
  });

  try {
    if (isLightInboundMessage(trimmed)) {
      const brief = await deps.complete({
        messages: [{ role: 'user', content: trimmed }],
        system: LIGHT_REPLY_SYSTEM,
        maxTokens: 128,
      });
      const reply = brief.slice(0, 4000);
      emitJarvisEvent({
        at: new Date().toISOString(),
        source: source === 'voice' ? 'voice' : (source as 'telegram' | 'discord' | 'slack'),
        kind: 'outbound',
        sessionId,
        preview: reply.slice(0, 80),
      });
      return { ok: true, text: reply, via: 'harness-light' };
    }

    const h = deps.harness;
    if (h) {
      const turns = await h.runSwarmSession({ sessionId, message: trimmed });
      const reply = turns[turns.length - 1]?.assistantText?.slice(0, 4000) ?? '';
      if (reply) {
        emitJarvisEvent({
          at: new Date().toISOString(),
          source: source === 'voice' ? 'voice' : (source as 'telegram' | 'discord' | 'slack'),
          kind: 'session-end',
          sessionId,
          preview: reply.slice(0, 80),
        });
        return { ok: true, text: reply, via: 'harness-swarm' };
      }
    }

    const fallback = await deps.complete({
      messages: [{ role: 'user', content: trimmed }],
      system: LIGHT_REPLY_SYSTEM,
      maxTokens: 512,
    });
    const reply = fallback.slice(0, 4000);
    if (!reply) return { ok: false, text: '', err: 'LLM returned empty response', via: 'llm-fallback' };
    emitJarvisEvent({
      at: new Date().toISOString(),
      source: source === 'voice' ? 'voice' : (source as 'telegram' | 'discord' | 'slack'),
      kind: 'outbound',
      sessionId,
      preview: reply.slice(0, 80),
    });
    return { ok: true, text: reply, via: 'llm-fallback' };
  } catch (err: unknown) {
    const errMsg = String((err as Error)?.message ?? err);
    emitJarvisEvent({
      at: new Date().toISOString(),
      source: source === 'voice' ? 'voice' : (source as 'telegram' | 'discord' | 'slack'),
      kind: 'error',
      sessionId,
      preview: errMsg.slice(0, 80),
    });
    try {
      const rescue = await deps.complete({
        messages: [{ role: 'user', content: trimmed }],
        system: LIGHT_REPLY_SYSTEM,
        maxTokens: 256,
      });
      if (rescue.trim()) {
        return { ok: true, text: rescue.slice(0, 4000), via: 'llm-fallback' };
      }
    } catch {
      /* final fail */
    }
    return { ok: false, text: '', err: errMsg, via: 'llm-fallback' };
  }
}
