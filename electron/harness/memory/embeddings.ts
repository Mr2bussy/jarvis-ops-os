/**
 * Local sentence embeddings for the memory index.
 *
 * Same engine as the free STT path (`electron/stt/free-whisper.ts`):
 * `@huggingface/transformers` with q8 weights, loaded lazily once and cached for
 * the rest of the process. A cold start costs one model download; every call
 * after that is local, offline and free.
 *
 * Data honesty (AGENTS.md): when the model cannot be obtained — no network on
 * the first run and nothing in the cache — `embed()` returns `null`. It never
 * falls back to hashed or random pseudo-vectors. A fabricated vector would not
 * degrade search visibly; it would produce a confidently ordered ranking built
 * from noise, which is worse than admitting the model is missing.
 */
// @ts-nocheck

import * as os from 'node:os';
import * as path from 'node:path';

/** Minimal shape of the feature-extraction pipeline we actually use. */
type FeaturePipe = (input: string[], opts?: Record<string, unknown>) => Promise<{ tolist: () => unknown }>;

/** 384-dim MiniLM: the smallest sentence encoder that still ranks usefully. */
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

let embedder: FeaturePipe | null = null;
let embedderLoading: Promise<FeaturePipe | null> | null = null;
/**
 * A failed load is sticky. Retrying the download on every search would turn one
 * offline start into a permanent multi-second stall on the keyword path.
 */
let loadFailed = false;
let lastError = '';
let cacheDirOverride: string | null = null;

/** LRU cache for embedding vectors — avoids re-computing identical strings. */
const EMBED_CACHE_MAX = 256;
const embedCache = new Map<string, number[]>();

function cacheKey(text: string): string {
  return text.slice(0, 512);
}

function cacheGet(text: string): number[] | undefined {
  const k = cacheKey(text);
  const v = embedCache.get(k);
  if (v) {
    embedCache.delete(k);
    embedCache.set(k, v);
  }
  return v;
}

function cacheSet(text: string, vector: number[]): void {
  const k = cacheKey(text);
  if (embedCache.has(k)) embedCache.delete(k);
  embedCache.set(k, vector);
  while (embedCache.size > EMBED_CACHE_MAX) {
    const oldest = embedCache.keys().next().value;
    if (oldest) embedCache.delete(oldest);
  }
}

export function clearEmbeddingCache(): void {
  embedCache.clear();
}

export function embeddingCacheStats(): { size: number; max: number } {
  return { size: embedCache.size, max: EMBED_CACHE_MAX };
}

/** Lets the harness (or a test) pin the model cache instead of probing electron. */
export function setEmbeddingCacheDir(dir: string): void {
  cacheDirOverride = dir;
}

async function resolveCacheDir(): Promise<string> {
  if (cacheDirOverride) return cacheDirOverride;
  // The harness layer stays free of a hard electron import so it runs under
  // vitest/node too — outside electron this resolves to a plain path string
  // without an `app`, and we fall through to the OS temp dir.
  try {
    const mod = (await import('electron')) as unknown as {
      app?: { getPath?: (name: string) => string };
    };
    const userData = mod?.app?.getPath?.('userData');
    if (userData) return path.join(userData, 'embedding-cache');
  } catch {
    /* not running inside electron */
  }
  return path.join(os.tmpdir(), 'jarvis-embedding-cache');
}

async function loadEmbedder(): Promise<FeaturePipe | null> {
  if (embedder) return embedder;
  if (loadFailed) return null;
  if (embedderLoading) return embedderLoading;
  embedderLoading = (async () => {
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = await resolveCacheDir();
      env.allowLocalModels = true;
      const pipe = (await pipeline('feature-extraction', MODEL_ID, {
        dtype: 'q8',
      })) as unknown as FeaturePipe;
      embedder = pipe;
      return pipe;
    } catch (e: unknown) {
      loadFailed = true;
      lastError = String((e as Error)?.message ?? e).slice(0, 200);
      return null;
    } finally {
      // Concurrent callers already hold this promise; clearing it only stops a
      // *later* caller from re-using a settled load attempt.
      embedderLoading = null;
    }
  })();
  return embedderLoading;
}

/**
 * Mean-pooled, L2-normalised sentence vectors — one per input string.
 *
 * Returns `null` (never a guess) when the model is unavailable or the pipeline
 * hands back a shape we did not ask for.
 */
export async function embed(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  const uncached: { idx: number; text: string }[] = [];
  for (let i = 0; i < texts.length; i++) {
    const cached = cacheGet(texts[i]);
    if (cached) results[i] = cached;
    else uncached.push({ idx: i, text: texts[i] });
  }
  if (uncached.length === 0) return results as number[][];

  const pipe = await loadEmbedder();
  if (!pipe) return null;
  try {
    const out = await pipe(
      uncached.map((u) => u.text),
      { pooling: 'mean', normalize: true },
    );
    const rows = out.tolist() as unknown;
    if (!Array.isArray(rows) || rows.length !== uncached.length) return null;
    for (let j = 0; j < uncached.length; j++) {
      const row = rows[j];
      if (!Array.isArray(row) || row.length === 0) return null;
      const vec = row as number[];
      cacheSet(uncached[j].text, vec);
      results[uncached[j].idx] = vec;
    }
    return results as number[][];
  } catch (e: unknown) {
    lastError = String((e as Error)?.message ?? e).slice(0, 200);
    return null;
  }
}

/**
 * Cosine similarity in [-1, 1]. Pure — no model, no IO.
 *
 * Degenerate inputs (zero vector, non-finite component, mismatched dimensions)
 * return 0 rather than NaN: "no measurable similarity" is the honest answer and
 * it keeps a single bad vector from poisoning an entire ranking with NaN.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (!Number.isFinite(denom) || denom === 0 || !Number.isFinite(dot)) return 0;
  // Clamp: float error can push an identical pair to 1.0000000000000002.
  return Math.max(-1, Math.min(1, dot / denom));
}

/** True only if the model is actually loaded and usable right now. */
export async function embeddingsAvailable(): Promise<boolean> {
  return (await loadEmbedder()) !== null;
}

/** Diagnostics for status panels — states plainly why semantic search is off. */
export function embeddingStatus(): { model: string; loaded: boolean; error: string } {
  return { model: MODEL_ID, loaded: embedder !== null, error: loadFailed ? lastError : '' };
}
