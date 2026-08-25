// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as os from 'node:os';
import { cosineSimilarity } from './embeddings';

describe('cosineSimilarity', () => {
  it('scores identical vectors as 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBe(1);
  });

  it('is scale invariant (direction, not magnitude)', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBe(1);
  });

  it('scores orthogonal vectors as 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('scores opposite vectors as -1', () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBe(-1);
  });

  it('returns 0 — never NaN — for a zero vector', () => {
    const s = cosineSimilarity([0, 0, 0], [1, 2, 3]);
    expect(Number.isNaN(s)).toBe(false);
    expect(s).toBe(0);
  });

  it('returns 0 for mismatched dimensions instead of comparing garbage', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('does not leak NaN/Infinity from a corrupt component', () => {
    expect(cosineSimilarity([Number.NaN, 1], [1, 1])).toBe(0);
    expect(cosineSimilarity([Number.POSITIVE_INFINITY, 1], [1, 1])).toBe(0);
  });

  it('stays inside [-1, 1]', () => {
    for (const [a, b] of [
      [
        [0.5, 0.5],
        [0.5, 0.5],
      ],
      [
        [3, -1],
        [-3, 1],
      ],
      [
        [1e-8, 1e-8],
        [1e8, 1e8],
      ],
    ] as Array<[number[], number[]]>) {
      const s = cosineSimilarity(a, b);
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * The model itself is mocked everywhere: a real first run downloads ~25 MB,
 * which would make this suite useless as a fast feedback loop.
 */
describe('embed / model availability', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when the model cannot be loaded and does not retry it', async () => {
    const pipeline = vi.fn(async () => {
      throw new Error('offline: model not in cache');
    });
    vi.doMock('@huggingface/transformers', () => ({ env: {}, pipeline }));

    const mod = await import('./embeddings');
    mod.setEmbeddingCacheDir(os.tmpdir());

    expect(await mod.embed(['hallo welt'])).toBeNull();
    expect(await mod.embeddingsAvailable()).toBe(false);
    // A sticky failure: one offline start must not stall every later search.
    expect(pipeline).toHaveBeenCalledTimes(1);
    expect(mod.embeddingStatus().loaded).toBe(false);
    expect(mod.embeddingStatus().error).toMatch(/offline/);
  });

  it('returns one vector per input when the model loads', async () => {
    const pipe = vi.fn(async (texts: string[]) => ({
      tolist: () => texts.map((_t, i) => [i, 1, 0]),
    }));
    vi.doMock('@huggingface/transformers', () => ({ env: {}, pipeline: async () => pipe }));

    const mod = await import('./embeddings');
    mod.setEmbeddingCacheDir(os.tmpdir());

    expect(await mod.embed(['a', 'b'])).toEqual([
      [0, 1, 0],
      [1, 1, 0],
    ]);
    expect(await mod.embeddingsAvailable()).toBe(true);
    expect(mod.embeddingStatus()).toMatchObject({ loaded: true, error: '' });
    // Model loaded once, reused for both calls.
    expect(pipe).toHaveBeenCalledTimes(1);
  });

  it('returns [] for no input without touching the model', async () => {
    const pipeline = vi.fn();
    vi.doMock('@huggingface/transformers', () => ({ env: {}, pipeline }));

    const mod = await import('./embeddings');
    expect(await mod.embed([])).toEqual([]);
    expect(pipeline).not.toHaveBeenCalled();
  });

  it('returns null when the pipeline hands back an unexpected shape', async () => {
    const pipe = async () => ({ tolist: () => [[1, 0, 0]] });
    vi.doMock('@huggingface/transformers', () => ({ env: {}, pipeline: async () => pipe }));

    const mod = await import('./embeddings');
    mod.setEmbeddingCacheDir(os.tmpdir());
    // Two inputs, one row back — refuse rather than guess which text it belongs to.
    expect(await mod.embed(['a', 'b'])).toBeNull();
  });
});
