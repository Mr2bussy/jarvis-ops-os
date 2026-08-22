import type { AgentLoopDeps, AgentTurnResult, ChatMessage, ToolCall, ToolContext } from './types';
import { classifyToolRisk } from './governance/risk-gate';
import { parseDoneClaim, verifyCompletion } from './governance/anti-early-victory';

const TOOL_CALL_RE = /```tool\s*\n([\s\S]*?)```/g;

function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let i = 0;
  for (const match of text.matchAll(TOOL_CALL_RE)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as { name?: string; arguments?: Record<string, unknown> };
      if (!parsed.name) continue;
      calls.push({
        id: `tc_${Date.now()}_${i++}`,
        name: parsed.name,
        arguments: parsed.arguments ?? {},
      });
    } catch {
      // ignore malformed tool blocks
    }
  }
  return calls;
}

function buildToolInstructions(): string {
  return [
    'When you need to act, emit a fenced block:',
    '```tool',
    '{"name":"read_file","arguments":{"path":"relative/path.ts"}}',
    '```',
    'Available tools: read_file, write_file, shell_exec, mt5_call, verify_check.',
    'Do not claim done until verify_check passes.',
  ].join('\n');
}

export async function runAgentLoop(input: {
  sessionId: string;
  deps: AgentLoopDeps;
  ctx: ToolContext;
  userMessage: string;
  baseSystem: string;
  supplementalSystem?: string;
  verifierId?: string;
}): Promise<AgentTurnResult[]> {
  const maxTurns = input.deps.maxTurns ?? 12;
  const messages: ChatMessage[] = [{ role: 'user', content: input.userMessage }];
  const system = [input.baseSystem, input.supplementalSystem ?? '', buildToolInstructions()]
    .filter(Boolean)
    .join('\n\n');

  const turns: AgentTurnResult[] = [];

  for (let turn = 1; turn <= maxTurns; turn++) {
    const assistantText = await input.deps.complete({ messages, system, maxTokens: 2048 });
    input.deps.onTurn?.({ turn, assistantText });

    const toolCalls = parseToolCalls(assistantText);
    const toolResults = [];

    for (const call of toolCalls) {
      const risk = classifyToolRisk(call.name, call.arguments);
      if (input.ctx.hitlArmed && risk.requiresHitl) {
        const approved = await input.ctx.requestApproval(risk.reason, {
          tool: call.name,
          arguments: call.arguments,
          riskClass: risk.class,
        });
        if (!approved) {
          turns.push({
            sessionId: input.sessionId,
            turn,
            assistantText,
            toolCalls,
            toolResults: [
              {
                toolCallId: call.id,
                ok: false,
                output: '',
                error: `HITL denied: ${risk.reason}`,
              },
            ],
            done: false,
            blockedByHitl: true,
            hitlReason: risk.reason,
          });
          return turns;
        }
      }

      const result = await input.deps.executeTool(call, input.ctx);
      toolResults.push(result);
      messages.push({
        role: 'assistant',
        content: assistantText,
      });
      messages.push({
        role: 'user',
        content: `Tool ${call.name} result:\n${result.ok ? result.output : (result.error ?? 'error')}`,
      });
    }

    const claimedDone = parseDoneClaim(assistantText);
    const victory = await verifyCompletion({ claimedDone, verifierId: input.verifierId ?? 'default' }, (id) =>
      input.ctx.verify(id),
    );

    const done = !victory.shouldContinue && (toolCalls.length === 0 || victory.ok);

    turns.push({
      sessionId: input.sessionId,
      turn,
      assistantText,
      toolCalls,
      toolResults,
      done,
    });

    if (done) return turns;

    if (claimedDone && !victory.ok) {
      messages.push({
        role: 'user',
        content: `Verification failed: ${victory.detail}. Continue until checks pass.`,
      });
      continue;
    }

    if (toolCalls.length === 0 && !claimedDone) {
      messages.push({ role: 'user', content: 'Continue or run verify_check before finishing.' });
    }
  }

  return turns;
}
