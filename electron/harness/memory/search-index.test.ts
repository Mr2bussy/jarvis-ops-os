// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';

// Only `embed` is stubbed — the real (pure) cosineSimilarity keeps the ranking
// assertions honest. Loading the actual MiniLM weights would download ~25 MB.
vi.mock('./embeddings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./embeddings')>();
  return { ...actual, embed: vi.fn() };
});

import { embed } from './embeddings';
import { MemorySearchIndex, draftSkillFromSession } from './search-index';

const embedMock = vi.mocked(embed);

function freshIndex(): MemorySearchIndex {
  const dir = path.join(os.tmpdir(), 'jarvis-memidx-test-' + Math.random().toString(36).slice(2));
  return new MemorySearchIndex(dir);
}

const ALPHA = 'alpha protocol deployment runbook for the trading floor';
const BETA = 'beta rollout checklist for the launch window';
const GROCERY = 'unrelated grocery shopping list with milk and bread';

/** Deterministic stand-in vectors, chosen so the fusion result is checkable by hand. */
function vectorFor(text: string): number[] {
  if (text.startsWith('alpha protocol')) return [0.8, 0.6, 0];
  if (text.startsWith('beta rollout')) return [1, 0, 0];
  if (text.startsWith('unrelated grocery')) return [0, 1, 0];
  return [1, 0, 0]; // the query
}

beforeEach(() => {
  embedMock.mockReset();
  embedMock.mockImplementation(async (texts: string[]) => texts.map(vectorFor));
});

describe('MemorySearchIndex — keyword path (unchanged)', () => {
  it('ranks token matches and respects the limit', () => {
    const idx = freshIndex();
    idx.indexSession('s1', ALPHA);
    idx.indexSession('s2', BETA);
    idx.indexSession('s3', GROCERY);

    const hits = idx.search('alpha runbook');
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toBe(ALPHA);
    expect(idx.search('of', 5)).toEqual([]); // tokens of length <= 2 are dropped
    expect(idx.search('list checklist', 1)).toHaveLength(1);
  });

  it('gives every session its own id so the vector cache cannot cross-serve', () => {
    const idx = freshIndex();
    const a = idx.indexSession('s1', ALPHA);
    const b = idx.indexSession('s2', BETA);
    expect(a.id).not.toBe(b.id);
  });
});

describe('MemorySearchIndex.searchSemantic — fallback', () => {
  it('reports via "keyword" and still answers when the model is unavailable', async () => {
    embedMock.mockResolvedValue(null);
    const idx = freshIndex();
    idx.indexSession('s1', ALPHA);
    idx.indexSession('s2', GROCERY);

    const res = await idx.searchSemantic('alpha runbook');
    expect(res.via).toBe('keyword');
    expect(res.reason).toMatch(/unavailable/i);
    expect(res.docs.map((d) => d.text)).toEqual([ALPHA]);
    expect(res.hits[0].score).toBeGreaterThan(0);
  });

  it('falls back when document embedding fails after the query succeeded', async () => {
    embedMock
      .mockResolvedValueOnce([[1, 0, 0]]) // query
      .mockResolvedValueOnce(null); // corpus batch
    const idx = freshIndex();
    idx.indexSession('s1', ALPHA);

    const res = await idx.searchSemantic('alpha');
    expect(res.via).toBe('keyword');
    expect(res.reason).toMatch(/document embedding failed/i);
    expect(res.docs).toHaveLength(1);
  });

  it('does not touch the model for an empty query or an empty index', async () => {
    const empty = await freshIndex().searchSemantic('alpha');
    expect(empty).toMatchObject({ via: 'keyword', reason: 'memory index is empty', docs: [] });

    const idx = freshIndex();
    idx.indexSession('s1', ALPHA);
    const blank = await idx.searchSemantic('   ');
    expect(blank).toMatchObject({ via: 'keyword', reason: 'empty query' });
    expect(embedMock).not.toHaveBeenCalled();
  });
});

describe('MemorySearchIndex.searchSemantic — semantic path', () => {
  it('finds a document with zero token overlap', async () => {
    const idx = freshIndex();
    idx.indexSession('s1', BETA); // vector [1,0,0] — same direction as the query
    idx.indexSession('s2', GROCERY); // vector [0,1,0] — orthogonal, dropped

    // 'feline' shares no token with any document, so the keyword path finds nothing.
    expect(idx.search('feline')).toEqual([]);

    const res = await idx.searchSemantic('feline');
    expect(res.via).toBe('semantic');
    expect(res.reason).toMatch(/no keyword match/);
    expect(res.docs.map((d) => d.text)).toEqual([BETA]);
  });

  it('fuses both rankings with RRF so a doc found by both wins', async () => {
    const idx = freshIndex();
    idx.indexSession('s1', ALPHA);
    idx.indexSession('s2', BETA);
    idx.indexSession('s3', GROCERY);

    // Keyword: only ALPHA matches. Semantic: BETA (cos 1.0) > ALPHA (cos 0.8),
    // GROCERY orthogonal → dropped. RRF: ALPHA 1/62 + 1/61 > BETA 1/61.
    const res = await idx.searchSemantic('alpha');
    expect(res.via).toBe('semantic');
    expect(res.reason).toBe('RRF fusion of 2 semantic and 1 keyword candidates');
    expect(res.docs.map((d) => d.text)).toEqual([ALPHA, BETA]);
    expect(res.hits[0].score).toBeCloseTo(1 / 62 + 1 / 61, 10);
    expect(res.hits[1].score).toBeCloseTo(1 / 61, 10);
  });

  it('honours the limit', async () => {
    const idx = freshIndex();
    idx.indexSession('s1', ALPHA);
    idx.indexSession('s2', BETA);
    const res = await idx.searchSemantic('alpha', { limit: 1 });
    expect(res.docs).toHaveLength(1);
  });

  it('caches document vectors per id and re-embeds only the new document', async () => {
    const idx = freshIndex();
    idx.indexSession('s1', ALPHA);
    idx.indexSession('s2', BETA);

    await idx.searchSemantic('alpha');
    expect(embedMock).toHaveBeenCalledTimes(2); // query + one corpus batch
    expect(embedMock.mock.calls[1][0]).toHaveLength(2);

    await idx.searchSemantic('alpha');
    expect(embedMock).toHaveBeenCalledTimes(3); // query only — corpus served from cache

    idx.indexSession('s3', GROCERY);
    await idx.searchSemantic('alpha');
    expect(embedMock).toHaveBeenCalledTimes(5);
    expect(embedMock.mock.calls[4][0]).toEqual([GROCERY]); // only the newcomer
  });
});

describe('draftSkillFromSession', () => {
  it('refuses drafts without enough material', () => {
    expect(draftSkillFromSession('too short', 'x')).toBeNull();
  });

  it('drafts a slug-named skill from a long enough summary', () => {
    const draft = draftSkillFromSession(
      'Rebuild the MT5 bridge token rotation flow end to end',
      'operator rotated the token twice during the incident',
    );
    expect(draft?.name).toBe('rebuild-the-mt5-bridge');
    expect(draft?.trigger).toMatch(/^When task resembles:/);
  });
});
