// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  MAX_RESULTS,
  MAX_SNIPPET,
  NO_KEY_ERROR,
  buildRequest,
  normalizeResponse,
  pickProvider,
  searchWeb,
} from './web-search';

/** Only `name` is configured; every other lookup returns the empty string. */
function only(name: string, value = 'test-key-value'): (n: string) => string {
  return (n) => (n === name ? value : '');
}

/** A whole key store in one literal. */
function keys(map: Record<string, string>): (n: string) => string {
  return (n) => map[n] ?? '';
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function stubFetch(handler: (url: string, init: any) => Response | Promise<Response>) {
  const calls: { url: string; init: any }[] = [];
  const impl = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

// ── Captured provider payloads ────────────────────────────────────────────────
// Trimmed copies of the real wire formats; the field names are what matter.

const BRAVE_RESPONSE = {
  type: 'search',
  query: { original: 'electron security' },
  web: {
    type: 'search',
    results: [
      {
        title: 'Security | Electron',
        url: 'https://www.electronjs.org/docs/latest/tutorial/security',
        description: 'Follow these <strong>security</strong> guidelines when building an Electron app.',
        page_age: '2024-11-02T09:14:00',
        age: '3 months ago',
        profile: { name: 'electronjs.org' },
      },
      {
        title: 'Electron context isolation',
        url: 'https://www.electronjs.org/docs/latest/tutorial/context-isolation',
        description: 'Context   isolation\nkeeps preload scripts separate.',
      },
    ],
  },
};

const TAVILY_RESPONSE = {
  query: 'electron security',
  answer: 'Electron apps should enable context isolation.',
  results: [
    {
      title: 'Security, Native Capabilities, and Your Responsibility',
      url: 'https://www.electronjs.org/docs/latest/tutorial/security',
      content: 'Enable context isolation and disable nodeIntegration in every renderer.',
      score: 0.973_21,
      published_date: 'Tue, 12 Mar 2024 00:00:00 GMT',
    },
    {
      title: 'Electron hardening checklist',
      url: 'https://example.dev/electron-hardening',
      content: 'A checklist of CSP, sandbox and IPC rules.',
      score: 0.81,
    },
  ],
  response_time: 1.42,
};

const SERPAPI_RESPONSE = {
  search_metadata: { id: 'abc', status: 'Success' },
  search_parameters: { engine: 'google', q: 'electron security' },
  organic_results: [
    {
      position: 1,
      title: 'Electron Security Documentation',
      link: 'https://www.electronjs.org/docs/latest/tutorial/security',
      snippet: 'Security is a shared responsibility between Electron and the app developer.',
      date: 'Jan 15, 2024',
    },
    {
      position: 2,
      title: 'Hardening Electron apps',
      link: 'https://example.org/hardening',
      snippet: 'Turn off remote module, enable sandbox.',
    },
  ],
};

// ── Provider selection ────────────────────────────────────────────────────────

describe('pickProvider', () => {
  it('selects Brave when the Brave key is present', () => {
    expect(pickProvider(only('BRAVE_SEARCH_API_KEY', 'brave-1'))).toEqual({
      provider: 'brave',
      key: 'brave-1',
      keyName: 'BRAVE_SEARCH_API_KEY',
    });
  });

  it('accepts the legacy BRAVE_API_KEY name already used by Admin → Connectors', () => {
    expect(pickProvider(only('BRAVE_API_KEY', 'legacy-brave'))?.provider).toBe('brave');
  });

  it('selects Tavily when only the Tavily key is present', () => {
    expect(pickProvider(only('TAVILY_API_KEY', 't-1'))).toMatchObject({ provider: 'tavily', key: 't-1' });
  });

  it('selects SerpAPI when only the SerpAPI key is present', () => {
    expect(pickProvider(only('SERPAPI_KEY', 's-1'))).toMatchObject({ provider: 'serpapi', key: 's-1' });
  });

  it('honours the preference order Brave → Tavily → SerpAPI', () => {
    const all = keys({ BRAVE_SEARCH_API_KEY: 'b', TAVILY_API_KEY: 't', SERPAPI_KEY: 's' });
    expect(pickProvider(all)?.provider).toBe('brave');
    expect(pickProvider(keys({ TAVILY_API_KEY: 't', SERPAPI_KEY: 's' }))?.provider).toBe('tavily');
    expect(pickProvider(keys({ SERPAPI_KEY: 's' }))?.provider).toBe('serpapi');
  });

  it('ignores blank / whitespace-only keys', () => {
    expect(pickProvider(only('BRAVE_SEARCH_API_KEY', '   '))).toBeNull();
  });

  it('treats a throwing key store as "not configured" instead of crashing', () => {
    const broken = (n: string) => {
      if (n === 'BRAVE_SEARCH_API_KEY') throw new Error('keychain locked');
      return n === 'TAVILY_API_KEY' ? 't-1' : '';
    };
    expect(pickProvider(broken)?.provider).toBe('tavily');
  });

  it('returns null when nothing is configured', () => {
    expect(pickProvider(() => '')).toBeNull();
  });
});

// ── Data honesty ──────────────────────────────────────────────────────────────

describe('searchWeb without any key', () => {
  it('returns the explicit German error and never touches the network', async () => {
    const { impl, calls } = stubFetch(() => jsonResponse({}));
    const r = await searchWeb({ query: 'was ist ein candlestick', getKey: () => '', fetchImpl: impl });
    expect(r.ok).toBe(false);
    expect(r).toEqual({ ok: false, err: NO_KEY_ERROR });
    expect(NO_KEY_ERROR).toBe('Keine Such-API hinterlegt — Schlüssel unter Admin → Connectors eintragen');
    expect(calls).toHaveLength(0);
  });

  it('rejects an empty query before selecting a provider', async () => {
    const r = await searchWeb({ query: '   ', getKey: only('BRAVE_SEARCH_API_KEY') });
    expect(r).toEqual({ ok: false, err: 'Leere Suchanfrage' });
  });
});

// ── Normalization ─────────────────────────────────────────────────────────────

describe('normalizeResponse', () => {
  it('normalizes the Brave shape (description → snippet, page_age → publishedAt)', () => {
    const out = normalizeResponse('brave', BRAVE_RESPONSE);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      title: 'Security | Electron',
      url: 'https://www.electronjs.org/docs/latest/tutorial/security',
      snippet: 'Follow these security guidelines when building an Electron app.',
      publishedAt: '2024-11-02T09:14:00',
    });
    // No page_age → no invented date, and whitespace is collapsed.
    expect(out[1].publishedAt).toBeUndefined();
    expect(out[1].snippet).toBe('Context isolation keeps preload scripts separate.');
  });

  it('never passes Brave’s relative "age" label off as a date', () => {
    const out = normalizeResponse('brave', {
      web: { results: [{ title: 't', url: 'https://x.dev', description: 'd', age: '3 months ago' }] },
    });
    expect(out[0].publishedAt).toBeUndefined();
  });

  it('normalizes the Tavily shape (content → snippet, published_date → publishedAt)', () => {
    const out = normalizeResponse('tavily', TAVILY_RESPONSE);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      title: 'Security, Native Capabilities, and Your Responsibility',
      url: 'https://www.electronjs.org/docs/latest/tutorial/security',
      snippet: 'Enable context isolation and disable nodeIntegration in every renderer.',
      publishedAt: 'Tue, 12 Mar 2024 00:00:00 GMT',
    });
    expect(out[1].publishedAt).toBeUndefined();
  });

  it('normalizes the SerpAPI shape (link → url, date → publishedAt)', () => {
    const out = normalizeResponse('serpapi', SERPAPI_RESPONSE);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      title: 'Electron Security Documentation',
      url: 'https://www.electronjs.org/docs/latest/tutorial/security',
      snippet: 'Security is a shared responsibility between Electron and the app developer.',
      publishedAt: 'Jan 15, 2024',
    });
    expect(out[1].url).toBe('https://example.org/hardening');
  });

  it('drops hits without a URL rather than emitting an unverifiable result', () => {
    const out = normalizeResponse('tavily', {
      results: [
        { title: 'no link', content: 'x' },
        { title: 'ok', url: 'https://ok.dev' },
      ],
    });
    expect(out.map((r) => r.url)).toEqual(['https://ok.dev']);
  });

  it('falls back to the URL when the provider sends no title', () => {
    const out = normalizeResponse('serpapi', { organic_results: [{ link: 'https://only-url.dev' }] });
    expect(out[0].title).toBe('https://only-url.dev');
  });

  it('returns [] for a malformed or empty payload — never a fabricated hit', () => {
    expect(normalizeResponse('brave', null)).toEqual([]);
    expect(normalizeResponse('brave', { web: { results: 'nope' } })).toEqual([]);
    expect(normalizeResponse('tavily', {})).toEqual([]);
    expect(normalizeResponse('serpapi', { organic_results: null })).toEqual([]);
  });
});

// ── Caps ──────────────────────────────────────────────────────────────────────

describe('caps', () => {
  const many = {
    results: Array.from({ length: 25 }, (_, i) => ({
      title: `hit ${i}`,
      url: `https://example.dev/${i}`,
      content: 'x',
    })),
  };

  it('caps the result count at 10 even when the caller asks for more', () => {
    expect(normalizeResponse('tavily', many, 99)).toHaveLength(MAX_RESULTS);
    expect(MAX_RESULTS).toBe(10);
  });

  it('caps the result count at 10 even when the provider over-delivers', () => {
    expect(normalizeResponse('tavily', many)).toHaveLength(10);
  });

  it('honours a smaller caller-requested count', () => {
    expect(normalizeResponse('tavily', many, 3)).toHaveLength(3);
  });

  it('clamps a nonsensical count to at least 1', () => {
    expect(normalizeResponse('tavily', many, 0)).toHaveLength(1);
    expect(normalizeResponse('tavily', many, -5)).toHaveLength(1);
  });

  it('truncates snippets to 500 characters', () => {
    const long = 'a'.repeat(2000);
    const out = normalizeResponse('brave', {
      web: { results: [{ title: 't', url: 'https://x.dev', description: long }] },
    });
    expect(out[0].snippet).toHaveLength(MAX_SNIPPET);
    expect(MAX_SNIPPET).toBe(500);
  });

  it('applies both caps end to end through searchWeb', async () => {
    const { impl } = stubFetch(() =>
      jsonResponse({
        results: Array.from({ length: 25 }, (_, i) => ({
          title: `t${i}`,
          url: `https://example.dev/${i}`,
          content: 'b'.repeat(900),
        })),
      }),
    );
    const r = await searchWeb({
      query: 'q',
      maxResults: 50,
      getKey: only('TAVILY_API_KEY'),
      fetchImpl: impl,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results).toHaveLength(10);
    expect(r.results.every((x) => x.snippet.length === 500)).toBe(true);
  });
});

// ── Request construction ──────────────────────────────────────────────────────

describe('buildRequest', () => {
  it('sends the Brave key as a header, never in the URL', () => {
    const req = buildRequest('brave', 'brave-secret', 'jarvis ops', 5);
    expect(req.url).toContain('api.search.brave.com');
    expect(req.url).toContain('q=jarvis%20ops');
    expect(req.url).not.toContain('brave-secret');
    expect((req.init.headers as Record<string, string>)['X-Subscription-Token']).toBe('brave-secret');
  });

  it('POSTs the Tavily query with a bearer header', () => {
    const req = buildRequest('tavily', 'tavily-secret', 'jarvis', 4);
    expect(req.init.method).toBe('POST');
    expect((req.init.headers as Record<string, string>).Authorization).toBe('Bearer tavily-secret');
    expect(JSON.parse(String(req.init.body))).toEqual({
      query: 'jarvis',
      max_results: 4,
      search_depth: 'basic',
    });
    expect(req.url).not.toContain('tavily-secret');
  });

  it('passes the SerpAPI key as a query parameter (their API offers no header form)', () => {
    const req = buildRequest('serpapi', 'serp secret', 'jarvis', 3);
    expect(req.url).toContain('api_key=serp%20secret');
    expect(req.url).toContain('num=3');
  });

  it('clamps the requested count inside the built request', () => {
    expect(buildRequest('brave', 'k', 'q', 99).url).toContain('count=10');
  });
});

// ── searchWeb wiring ──────────────────────────────────────────────────────────

describe('searchWeb', () => {
  it('uses the injected fetch and reports the answering provider', async () => {
    const { impl, calls } = stubFetch(() => jsonResponse(BRAVE_RESPONSE));
    const r = await searchWeb({
      query: 'electron security',
      getKey: only('BRAVE_SEARCH_API_KEY'),
      fetchImpl: impl,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.provider).toBe('brave');
    expect(r.results[0].url).toBe('https://www.electronjs.org/docs/latest/tutorial/security');
    expect(calls[0].url).toContain('api.search.brave.com');
    expect(calls[0].init.signal).toBeDefined();
  });

  it('routes to Tavily and SerpAPI according to the configured key', async () => {
    const tav = stubFetch(() => jsonResponse(TAVILY_RESPONSE));
    const t = await searchWeb({ query: 'q', getKey: only('TAVILY_API_KEY'), fetchImpl: tav.impl });
    expect(t.ok && t.provider).toBe('tavily');
    expect(tav.calls[0].url).toBe('https://api.tavily.com/search');

    const serp = stubFetch(() => jsonResponse(SERPAPI_RESPONSE));
    const s = await searchWeb({ query: 'q', getKey: only('SERPAPI_KEY'), fetchImpl: serp.impl });
    expect(s.ok && s.provider).toBe('serpapi');
    expect(serp.calls[0].url).toContain('serpapi.com');
  });

  it('surfaces a non-2xx provider response as an error, not as empty results', async () => {
    const { impl } = stubFetch(
      () =>
        ({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized',
          json: async () => ({}),
        }) as unknown as Response,
    );
    const r = await searchWeb({ query: 'q', getKey: only('BRAVE_SEARCH_API_KEY'), fetchImpl: impl });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.err).toMatch(/brave 401: Unauthorized/);
  });

  it('reports an empty index answer as a successful search with zero hits', async () => {
    const { impl } = stubFetch(() => jsonResponse({ web: { results: [] } }));
    const r = await searchWeb({ query: 'zzz', getKey: only('BRAVE_SEARCH_API_KEY'), fetchImpl: impl });
    expect(r.ok).toBe(true);
    expect(r.ok && r.results).toEqual([]);
  });

  it('aborts via AbortController when the provider hangs', async () => {
    const impl = ((_url: any, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        });
      })) as unknown as typeof fetch;
    const r = await searchWeb({
      query: 'q',
      getKey: only('BRAVE_SEARCH_API_KEY'),
      fetchImpl: impl,
      timeoutMs: 10,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.err).toMatch(/Zeitlimit 10 ms überschritten/);
  });

  it('redacts the API key from any error text bubbling back out', async () => {
    const impl = (async () => {
      throw new Error('connect ECONNREFUSED for api_key=super-secret-key');
    }) as unknown as typeof fetch;
    const r = await searchWeb({
      query: 'q',
      getKey: only('SERPAPI_KEY', 'super-secret-key'),
      fetchImpl: impl,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.err).not.toContain('super-secret-key');
    expect(r.ok === false && r.err).toContain('***');
  });

  it('does not fall back to a second provider when the first one fails', async () => {
    const { impl, calls } = stubFetch(
      () =>
        ({
          ok: false,
          status: 500,
          text: async () => 'boom',
          json: async () => ({}),
        }) as unknown as Response,
    );
    const both = keys({ BRAVE_SEARCH_API_KEY: 'b', TAVILY_API_KEY: 't' });
    const r = await searchWeb({ query: 'q', getKey: both, fetchImpl: impl });
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });
});
