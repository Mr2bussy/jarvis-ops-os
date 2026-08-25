/**
 * Multi-provider web search for the main process.
 *
 * Data honesty (AGENTS.md, rule 1) is the whole design here: with no provider
 * key configured this returns an explicit error and nothing else. There is no
 * scraping fallback, no cached stand-in and no synthesized hit. A search tool
 * that quietly invents results is strictly worse than one that admits it cannot
 * search — the agent downstream cannot tell the difference, but the operator
 * acting on the answer can, far too late.
 *
 * Provider selection, request construction and response normalization are pure
 * functions that never touch the network; `searchWeb` is the thin shell that
 * wires them to `fetch`. That split is what lets every provider's wire format be
 * tested offline against a captured sample response.
 *
 * Main-process only, like every other credential-touching client: the renderer
 * holds no keys, so it cannot reach a search API except through the harness tool
 * layer, where the risk gate inspects the query first.
 */
// @ts-nocheck

export type SearchProvider = 'brave' | 'tavily' | 'serpapi';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /**
   * The publication date exactly as the provider reported it — deliberately not
   * re-parsed into a canonical shape. Providers disagree (Brave sends ISO,
   * SerpAPI sends a rendered label like "Jan 15, 2024"), and inventing a precise
   * timestamp out of a vague one would be the same lie as inventing a result.
   */
  publishedAt?: string;
}

export type SearchWebResult =
  | { ok: true; provider: SearchProvider; results: SearchResult[] }
  | { ok: false; err: string };

/** Hard ceilings: a tool result is pasted straight into an LLM context window. */
export const MAX_RESULTS = 10;
export const MAX_SNIPPET = 500;
export const SEARCH_TIMEOUT_MS = 10_000;
const DEFAULT_RESULTS = 5;

/** Verbatim operator-facing text; the Admin screen is where keys are entered. */
export const NO_KEY_ERROR = 'Keine Such-API hinterlegt — Schlüssel unter Admin → Connectors eintragen';

/**
 * Try order. Brave first because it answers from its own index (no per-query
 * LLM cost, no third-party re-broker), Tavily second because it is the
 * agent-shaped API, SerpAPI last because it is the most expensive per call.
 *
 * `BRAVE_API_KEY` is the name Admin → Connectors has always used for the key the
 * old `search:web` IPC handler reads. Accepting it as an alias means an operator
 * who already stored a Brave key does not have to enter the same secret twice
 * under a new name.
 */
const PROVIDER_KEYS: { provider: SearchProvider; names: string[] }[] = [
  { provider: 'brave', names: ['BRAVE_SEARCH_API_KEY', 'BRAVE_API_KEY'] },
  { provider: 'tavily', names: ['TAVILY_API_KEY'] },
  { provider: 'serpapi', names: ['SERPAPI_KEY', 'SERPAPI_API_KEY'] },
];

export interface ProviderChoice {
  provider: SearchProvider;
  key: string;
  /** Which config entry supplied the key — useful for the activity log, never the value. */
  keyName: string;
}

function readKey(getKey: (name: string) => string, name: string): string {
  try {
    return (getKey(name) ?? '').trim();
  } catch {
    // A locked or broken key store must not take the search tool down with it;
    // an unreadable entry simply reads as "not configured" and probing continues.
    return '';
  }
}

/** Pure: first provider in preference order that has a non-blank key. */
export function pickProvider(getKey: (name: string) => string): ProviderChoice | null {
  for (const entry of PROVIDER_KEYS) {
    for (const keyName of entry.names) {
      const key = readKey(getKey, keyName);
      if (key) return { provider: entry.provider, key, keyName };
    }
  }
  return null;
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function clampCount(n: unknown): number {
  const num = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : DEFAULT_RESULTS;
  return Math.max(1, Math.min(MAX_RESULTS, num));
}

/**
 * Providers embed `<strong>` markup in snippets to highlight the query terms.
 * Stripped here rather than at render time: this string ends up inside a prompt,
 * where stray markup is noise the model has to spend attention on.
 */
function cleanSnippet(raw: unknown): string {
  return asText(raw)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SNIPPET);
}

function toResult(row: {
  title?: unknown;
  url?: unknown;
  snippet?: unknown;
  publishedAt?: unknown;
}): SearchResult | null {
  const url = asText(row.url).trim();
  // A hit without a URL cannot be verified by the operator, so it is not a hit.
  if (!url) return null;
  const out: SearchResult = {
    title: asText(row.title).trim() || url,
    url,
    snippet: cleanSnippet(row.snippet),
  };
  const published = asText(row.publishedAt).trim();
  if (published) out.publishedAt = published;
  return out;
}

/**
 * Pure: fold one provider's response shape into the shared result form.
 * Unknown/malformed payloads normalize to `[]` — never to a fabricated hit.
 */
export function normalizeResponse(
  provider: SearchProvider,
  raw: unknown,
  limit: number = MAX_RESULTS,
): SearchResult[] {
  const data = (raw ?? {}) as Record<string, any>;
  const cap = clampCount(limit);
  const collect = (list: unknown, pick: (row: any) => Parameters<typeof toResult>[0]): SearchResult[] =>
    (Array.isArray(list) ? list : [])
      .map((row) => toResult(pick(row ?? {})))
      .filter((r): r is SearchResult => r !== null)
      .slice(0, cap);

  switch (provider) {
    case 'brave':
      // `page_age` is the real publication timestamp; the sibling `age` field is a
      // rendered label ("3 days ago") and is dropped rather than passed off as a date.
      return collect(data.web?.results, (r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
        publishedAt: r.page_age,
      }));
    case 'tavily':
      return collect(data.results, (r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        publishedAt: r.published_date,
      }));
    case 'serpapi':
      return collect(data.organic_results, (r) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        publishedAt: r.date,
      }));
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export interface ProviderRequest {
  url: string;
  init: RequestInit;
}

/** Pure: the exact HTTP call for one provider. Separated so tests can assert it without a network. */
export function buildRequest(
  provider: SearchProvider,
  key: string,
  query: string,
  count: number,
): ProviderRequest {
  const n = clampCount(count);
  switch (provider) {
    case 'brave':
      return {
        url:
          'https://api.search.brave.com/res/v1/web/search' +
          `?q=${encodeURIComponent(query)}&count=${n}&text_decorations=false&safesearch=moderate`,
        init: {
          method: 'GET',
          headers: { Accept: 'application/json', 'X-Subscription-Token': key },
        },
      };
    case 'tavily':
      return {
        url: 'https://api.tavily.com/search',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ query, max_results: n, search_depth: 'basic' }),
        },
      };
    case 'serpapi':
      // SerpAPI authenticates by query parameter only — their API offers no header
      // form. The key therefore rides in the URL, so the URL is never logged and
      // never echoed into an error string (see `redactKey`).
      return {
        url:
          'https://serpapi.com/search.json' +
          `?engine=google&q=${encodeURIComponent(query)}&num=${n}&api_key=${encodeURIComponent(key)}`,
        init: { method: 'GET', headers: { Accept: 'application/json' } },
      };
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

/** Belt-and-braces: a provider error or a network stack trace must not leak the key back out. */
function redactKey(text: string, key: string): string {
  if (!key) return text;
  return text.split(key).join('***');
}

export interface SearchWebOptions {
  query: string;
  maxResults?: number;
  getKey: (name: string) => string;
  /** Injected so provider wire formats are testable without a network. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Run one search against the highest-preference configured provider.
 *
 * No provider chaining on failure: if the configured provider errors, that is
 * the answer. Silently retrying elsewhere would hide a broken key behind a
 * different index's results and make the returned data unattributable.
 */
export async function searchWeb(opts: SearchWebOptions): Promise<SearchWebResult> {
  const query = asText(opts.query).trim();
  if (!query) return { ok: false, err: 'Leere Suchanfrage' };

  const chosen = pickProvider(opts.getKey);
  if (!chosen) return { ok: false, err: NO_KEY_ERROR };

  const count = clampCount(opts.maxResults);
  const req = buildRequest(chosen.provider, chosen.key, query, count);
  const doFetch = opts.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timeoutMs =
    typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0 ? opts.timeoutMs : SEARCH_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await doFetch(req.url, { ...req.init, signal: controller.signal });
    if (!res.ok) {
      let body = '';
      try {
        body = (await res.text()).slice(0, 200);
      } catch {
        body = '';
      }
      return { ok: false, err: redactKey(`${chosen.provider} ${res.status}: ${body}`.trim(), chosen.key) };
    }
    const raw = await res.json();
    return { ok: true, provider: chosen.provider, results: normalizeResponse(chosen.provider, raw, count) };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    const detail =
      err?.name === 'AbortError' || err?.name === 'TimeoutError'
        ? `Zeitlimit ${timeoutMs} ms überschritten`
        : String(err?.message ?? e);
    return { ok: false, err: redactKey(`Suche fehlgeschlagen (${chosen.provider}): ${detail}`, chosen.key) };
  } finally {
    clearTimeout(timer);
  }
}
