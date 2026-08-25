/**
 * Talk routing: harness (tools/HITL) or Hermes voiceSession.
 * Voice Mode must pass only `voiceSession` so replies stay on Hermes LLM pools.
 */
// @ts-nocheck

export type HarnessTurnLike = {
  assistantText?: string;
  toolCalls?: { name?: string }[];
  toolResults?: { ok?: boolean; output?: string; error?: string }[];
  blockedByHitl?: boolean;
  hitlReason?: string;
};

export type TalkResult = {
  text: string;
  via: 'harness' | 'hermes' | 'error';
  tools: string[];
  hitl?: string;
  err?: string;
};

export function isVoiceProbeCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === '/status' || t === '/probe' || t === '/stats';
}

export function lastSpokenReply(turns: HarnessTurnLike[]): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    const raw = (turns[i]?.assistantText ?? '').trim();
    if (!raw) continue;
    const cleaned = raw
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^\s*tool_call\s*:.*$/gim, '')
      .trim();
    if (cleaned) return cleaned.slice(0, 4000);
    if (raw) return raw.slice(0, 4000);
  }
  return '';
}

export function toolTrace(turns: HarnessTurnLike[]): string[] {
  const lines: string[] = [];
  for (const turn of turns) {
    for (const call of turn.toolCalls ?? []) {
      if (call?.name) lines.push(call.name);
    }
    for (const result of turn.toolResults ?? []) {
      if (result?.ok === false) {
        lines.push(`fail:${(result.error ?? result.output ?? 'tool').slice(0, 80)}`);
      }
    }
    if (turn.blockedByHitl) {
      lines.push(`hitl:${(turn.hitlReason ?? 'approval required').slice(0, 80)}`);
    }
  }
  return lines.slice(0, 24);
}

type TalkDeps = {
  harnessRun?: (payload: { sessionId: string; message: string }) => Promise<{
    ok: boolean;
    turns?: unknown[];
    err?: string;
  }>;
  voiceSession?: (
    message: string,
    mirrorTelegram?: boolean,
  ) => Promise<{ ok?: boolean; text?: string; err?: string }>;
};

function asHarnessTurns(raw: unknown[] | undefined): HarnessTurnLike[] {
  if (!raw) return [];
  return raw.filter((t): t is HarnessTurnLike => Boolean(t) && typeof t === 'object');
}

export async function runTalkTurn(
  message: string,
  deps: TalkDeps,
  sessionId = 'talk-home',
): Promise<TalkResult> {
  const trimmed = message.trim();
  if (!trimmed) return { text: '', via: 'error', tools: [], err: 'empty message' };

  if (deps.harnessRun) {
    try {
      const ran = await deps.harnessRun({ sessionId, message: trimmed });
      if (ran.ok && ran.turns?.length) {
        const turns = asHarnessTurns(ran.turns);
        const text = lastSpokenReply(turns);
        const tools = toolTrace(turns);
        const hitl = turns.find((t) => t.blockedByHitl)?.hitlReason;
        if (hitl) {
          return {
            text: text || `HITL pending: ${hitl}`,
            via: 'harness',
            tools,
            hitl,
          };
        }
        if (text) {
          return { text, via: 'harness', tools, hitl };
        }
      }
      if (!deps.voiceSession) {
        return {
          text: '',
          via: 'error',
          tools: [],
          err: ran.err ?? 'harness returned no reply',
        };
      }
    } catch (err: unknown) {
      if (!deps.voiceSession) {
        return { text: '', via: 'error', tools: [], err: String((err as Error)?.message ?? err) };
      }
    }
  }

  if (deps.voiceSession) {
    const r = await deps.voiceSession(trimmed, true);
    if (r.ok && r.text?.trim()) {
      return { text: r.text.trim(), via: 'hermes', tools: [] };
    }
    return { text: '', via: 'error', tools: [], err: r.err ?? 'hermes returned no reply' };
  }

  return { text: '', via: 'error', tools: [], err: 'no harness and no hermes voiceSession' };
}
