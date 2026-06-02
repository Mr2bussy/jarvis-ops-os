import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LS,
  lsGet,
  lsSet,
  askJarvis,
  BRIEFING_KINDS,
  composeBriefing,
  chatWithJarvis,
  runResearch,
  runContent,
  runPlanDay,
  type ConsoleLine,
} from './claude';

// claude.ts only touches `localStorage` / `window.jarvisBridge` inside functions, so
// we stub them on globalThis per-test (node env, no jsdom needed).
let lastComplete: any;

function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

function installBridge(reply: string = 'OK') {
  lastComplete = undefined;
  (globalThis as any).window = {
    jarvisBridge: {
      complete: vi.fn(async (payload: any) => {
        lastComplete = payload;
        return reply;
      }),
    },
  };
}

beforeEach(() => {
  installLocalStorage();
  installBridge();
});

describe('lsGet / lsSet', () => {
  it('round-trips a value', () => {
    lsSet('k', { a: 1 });
    expect(lsGet('k', null)).toEqual({ a: 1 });
  });
  it('returns the fallback for a missing key', () => {
    expect(lsGet('missing', 'fallback')).toBe('fallback');
  });
  it('returns the fallback on corrupt JSON', () => {
    localStorage.setItem('bad', '{not json');
    expect(lsGet('bad', 42)).toBe(42);
  });
  it('lsSet swallows storage errors (never throws)', () => {
    (globalThis as any).localStorage = {
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => lsSet('x', 1)).not.toThrow();
  });
});

describe('askJarvis', () => {
  it('throws if the bridge is missing', async () => {
    (globalThis as any).window = {};
    await expect(askJarvis({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/jarvisBridge/);
  });
  it('injects the persona + operator context into the system prompt', async () => {
    await askJarvis({ messages: [{ role: 'user', content: 'hi' }] });
    expect(lastComplete.system).toContain('You are JARVIS');
    expect(lastComplete.system).toContain('OPERATOR CONTEXT');
    expect(lastComplete.system).toContain('ZAXCO'); // from DEFAULT_CONTEXT
  });
  it('prepends a caller-supplied system block', async () => {
    await askJarvis({ messages: [{ role: 'user', content: 'hi' }], system: 'EXTRA-SYS' });
    expect(lastComplete.system.startsWith('EXTRA-SYS')).toBe(true);
  });
  it('passes messages + maxTokens through unchanged', async () => {
    const messages = [{ role: 'user' as const, content: 'q' }];
    await askJarvis({ messages, maxTokens: 123 });
    expect(lastComplete.messages).toEqual(messages);
    expect(lastComplete.maxTokens).toBe(123);
  });
  it('uses a stored operator context when present', async () => {
    lsSet(LS.context, 'MY-CUSTOM-CONTEXT');
    await askJarvis({ messages: [{ role: 'user', content: 'hi' }] });
    expect(lastComplete.system).toContain('MY-CUSTOM-CONTEXT');
  });
});

describe('BRIEFING_KINDS prompt builders', () => {
  it('morning prompt requests JSON with the schema keys', () => {
    const p = BRIEFING_KINDS.morning.prompt('');
    expect(p).toContain('MORNING INTEL');
    expect(p).toContain('"title"');
    expect(p).toContain('"items"');
    expect(p).toContain('Return JSON ONLY');
  });
  it('embeds the operator focus when extra is provided', () => {
    expect(BRIEFING_KINDS.custom.prompt('crypto regulation')).toContain('crypto regulation');
  });
});

describe('composeBriefing', () => {
  it('returns a structured briefing on valid JSON', async () => {
    installBridge(JSON.stringify({ title: 'T', blurb: 'B', items: [{ tag: 'X', text: 'y' }], summary: 'S' }));
    const b = await composeBriefing('morning');
    expect(b.title).toBe('T');
    expect(b.items).toHaveLength(1);
    expect(b.tag).toBe('MORNING INTEL');
    expect(b.accent).toBe('cyan');
  });
  it('falls back to a raw briefing on non-JSON output', async () => {
    installBridge('totally not json');
    const b = await composeBriefing('market');
    expect(b.title).toBe('Briefing (raw)');
    expect(b.items[0].tag).toBe('RAW');
    expect(b.tag).toBe('MARKET BRIEF');
  });
});

describe('chatWithJarvis', () => {
  it('maps roles, appends the new message, and trims to the last 12 turns', async () => {
    const history: ConsoleLine[] = Array.from({ length: 15 }, (_, i) => ({
      who: (i % 2 === 0 ? 'OPERATOR' : 'JARVIS') as 'OPERATOR' | 'JARVIS',
      t: '00:00',
      text: `m${i}`,
    }));
    await chatWithJarvis(history, 'NEW');
    const sent = lastComplete.messages;
    expect(sent).toHaveLength(13); // last 12 history + 1 new
    expect(sent[sent.length - 1]).toEqual({ role: 'user', content: 'NEW' });
    expect(sent.find((m: any) => m.content === 'm14').role).toBe('user'); // OPERATOR → user
    expect(sent.find((m: any) => m.content === 'm13').role).toBe('assistant'); // JARVIS → assistant
  });
});

describe('workflow prompt builders', () => {
  it('runResearch embeds the topic + the required structure', async () => {
    await runResearch('quantum widgets');
    expect(lastComplete.messages[0].content).toContain('quantum widgets');
    expect(lastComplete.messages[0].content).toContain('## TL;DR');
  });
  it('runContent tailors instructions to the channel', async () => {
    await runContent('my brief', 'YouTube');
    expect(lastComplete.messages[0].content).toContain('video title');
  });
  it('runContent covers each channel branch', async () => {
    const cases: [string, string][] = [
      ['X / Twitter', 'tweet'],
      ['Instagram', 'reel'],
      ['Newsletter', 'subject line'],
      ['Twitch', 'stream title'],
    ];
    for (const [channel, marker] of cases) {
      await runContent('b', channel);
      expect(lastComplete.messages[0].content).toContain(marker);
    }
  });
  it('runPlanDay embeds tasks + the schedule scaffold', async () => {
    await runPlanDay('task1, task2');
    expect(lastComplete.messages[0].content).toContain('task1');
    expect(lastComplete.messages[0].content).toContain('## Schedule');
  });
});
