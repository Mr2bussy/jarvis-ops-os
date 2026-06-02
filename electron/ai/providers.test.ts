import { describe, it, expect, vi, afterEach } from 'vitest';
import { openAICompatComplete } from './providers';

function mockFetch(impl: (url: string, init: any) => any) {
  vi.stubGlobal('fetch', vi.fn(impl));
}
afterEach(() => vi.unstubAllGlobals());

const base = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-x',
  model: 'gpt-4o',
  label: 'OpenAI',
  maxTokens: 256,
};

describe('openAICompatComplete', () => {
  it('posts to /chat/completions with auth + returns the content', async () => {
    let captured: any;
    mockFetch(async (url, init) => {
      captured = { url, body: JSON.parse(init.body), headers: init.headers };
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'hello' } }] }) };
    });
    const out = await openAICompatComplete({ ...base, messages: [{ role: 'user', content: 'hi' }] });
    expect(out).toBe('hello');
    expect(captured.url).toBe('https://api.example.com/v1/chat/completions');
    expect(captured.headers.Authorization).toBe('Bearer sk-x');
    expect(captured.body).toMatchObject({ model: 'gpt-4o', max_tokens: 256 });
  });

  it('prepends the system message when provided', async () => {
    let body: any;
    mockFetch(async (_url, init) => {
      body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) };
    });
    await openAICompatComplete({ ...base, messages: [{ role: 'user', content: 'q' }], system: 'SYS' });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'q' });
  });

  it('omits the system message when not provided', async () => {
    let body: any;
    mockFetch(async (_url, init) => {
      body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) };
    });
    await openAICompatComplete({ ...base, messages: [{ role: 'user', content: 'q' }] });
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('throws "<label> <status>: <body>" on a non-ok response', async () => {
    mockFetch(async () => ({ ok: false, status: 429, text: async () => 'rate limited' }));
    await expect(openAICompatComplete({ ...base, label: 'Mistral', messages: [] })).rejects.toThrow(
      /Mistral 429: rate limited/,
    );
  });

  it('returns an empty string when the response has no content', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({}) }));
    expect(await openAICompatComplete({ ...base, messages: [] })).toBe('');
  });
});
