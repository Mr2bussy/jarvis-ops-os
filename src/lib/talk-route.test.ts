// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { isVoiceProbeCommand, lastSpokenReply, runTalkTurn, toolTrace } from './talk-route';

describe('talk-route', () => {
  it('extracts the last non-empty assistant text', () => {
    expect(
      lastSpokenReply([
        { assistantText: 'plan' },
        { assistantText: '  ' },
        { assistantText: 'done: file written' },
      ]),
    ).toBe('done: file written');
  });

  it('lists tool names and HITL blocks', () => {
    expect(
      toolTrace([
        {
          toolCalls: [{ name: 'read_file' }],
          toolResults: [{ ok: false, error: 'missing' }],
          blockedByHitl: true,
          hitlReason: 'order',
        },
      ]),
    ).toEqual(['read_file', 'fail:missing', 'hitl:order']);
  });

  it('recognises probe slash commands', () => {
    expect(isVoiceProbeCommand('/status')).toBe(true);
    expect(isVoiceProbeCommand('hello')).toBe(false);
  });

  it('prefers harness over hermes when both succeed', async () => {
    const out = await runTalkTurn('list vault', {
      harnessRun: async () => ({
        ok: true,
        turns: [{ assistantText: 'vault has 12 agents' }],
      }),
      voiceSession: async () => ({ ok: true, text: 'hermes should not win' }),
    });
    expect(out.via).toBe('harness');
    expect(out.text).toBe('vault has 12 agents');
  });

  it('falls back to hermes when harness is empty', async () => {
    const out = await runTalkTurn('ping', {
      harnessRun: async () => ({ ok: true, turns: [] }),
      voiceSession: async () => ({ ok: true, text: 'ack ping' }),
    });
    expect(out.via).toBe('hermes');
    expect(out.text).toBe('ack ping');
  });

  it('does not invent a success sentence when both fail', async () => {
    const out = await runTalkTurn('ping', {
      harnessRun: async () => ({ ok: false, err: 'down' }),
      voiceSession: async () => ({ ok: false, err: 'offline' }),
    });
    expect(out.via).toBe('error');
    expect(out.text).toBe('');
    expect(out.err).toMatch(/offline|down/);
  });

  it('keeps HITL on harness and does not fall through to hermes', async () => {
    const out = await runTalkTurn('buy EURUSD', {
      harnessRun: async () => ({
        ok: true,
        turns: [{ blockedByHitl: true, hitlReason: 'mt5 order', assistantText: '' }],
      }),
      voiceSession: async () => ({ ok: true, text: 'hermes must not run' }),
    });
    expect(out.via).toBe('harness');
    expect(out.hitl).toBe('mt5 order');
    expect(out.text).toMatch(/HITL/);
  });
});
