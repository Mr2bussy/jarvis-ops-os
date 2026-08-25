import * as fs from 'node:fs';
import * as path from 'node:path';
import { cosineSimilarity, embed } from './embeddings';

export interface MemoryDocument {
  id: string;
  sessionId: string;
  text: string;
  tokens: string[];
  createdAt: string;
}

export interface SemanticHit {
  id: string;
  text: string;
  score: number;
}

export interface SemanticSearchResult {
  via: 'keyword' | 'semantic';
  reason: string;
  docs: MemoryDocument[];
  hits: SemanticHit[];
}

const RRF_K = 60;

/** Lightweight token index (Hermes FTS pattern, no native sqlite dep). */
export class MemorySearchIndex {
  private docs: MemoryDocument[] = [];
  private readonly indexPath: string;
  /** Per-document embedding cache — avoids re-embedding unchanged corpus rows. */
  private readonly vectorCache = new Map<string, number[]>();

  constructor(memoryDir: string) {
    fs.mkdirSync(memoryDir, { recursive: true });
    this.indexPath = path.join(memoryDir, 'memory-index.json');
    this.load();
  }

  private load(): void {
    try {
      this.docs = JSON.parse(fs.readFileSync(this.indexPath, 'utf8')) as MemoryDocument[];
    } catch {
      this.docs = [];
    }
  }

  private persist(): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(this.docs, null, 2), 'utf8');
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9_+-]+/)
      .filter((t) => t.length > 2);
  }

  indexSession(sessionId: string, text: string): MemoryDocument {
    const doc: MemoryDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      text: text.slice(0, 50_000),
      tokens: this.tokenize(text),
      createdAt: new Date().toISOString(),
    };
    this.docs.push(doc);
    if (this.docs.length > 500) this.docs = this.docs.slice(-500);
    this.persist();
    return doc;
  }

  search(query: string, limit = 8): MemoryDocument[] {
    const qTokens = this.tokenize(query);
    if (qTokens.length === 0) return [];

    const scored = this.docs.map((doc) => {
      let score = 0;
      for (const qt of qTokens) {
        if (doc.tokens.includes(qt)) score += 2;
        if (doc.text.toLowerCase().includes(qt)) score += 1;
      }
      return { doc, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.doc);
  }

  /**
   * Keyword + semantic fusion (RRF). Falls back to keyword-only when embeddings
   * are unavailable — never invents vectors.
   */
  async searchSemantic(query: string, opts: { limit?: number } = {}): Promise<SemanticSearchResult> {
    const limit = opts.limit ?? 8;
    const q = query.trim();
    if (!q) {
      return { via: 'keyword', reason: 'empty query', docs: [], hits: [] };
    }
    if (this.docs.length === 0) {
      return { via: 'keyword', reason: 'memory index is empty', docs: [], hits: [] };
    }

    const keywordDocs = this.search(q, limit);
    const keywordRank = new Map(keywordDocs.map((d, i) => [d.id, i + 1]));

    const queryVecs = await embed([q]);
    if (!queryVecs || !queryVecs[0]) {
      return this.keywordOnly(keywordDocs, 'model unavailable');
    }
    const queryVec = queryVecs[0];

    const missing = this.docs.filter((d) => !this.vectorCache.has(d.id));
    if (missing.length) {
      const batch = await embed(missing.map((d) => d.text));
      if (!batch) {
        return this.keywordOnly(keywordDocs, 'document embedding failed');
      }
      for (let i = 0; i < missing.length; i++) {
        this.vectorCache.set(missing[i].id, batch[i]);
      }
    }

    const semanticScored = this.docs
      .map((doc) => {
        const vec = this.vectorCache.get(doc.id);
        const score = vec ? cosineSimilarity(queryVec, vec) : 0;
        return { doc, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const semanticRank = new Map(semanticScored.map((s, i) => [s.doc.id, i + 1]));

    if (semanticRank.size === 0) {
      return this.keywordOnly(keywordDocs, 'no semantic candidates');
    }

    const ids = new Set([...keywordRank.keys(), ...semanticRank.keys()]);
    const fused: SemanticHit[] = [];
    for (const id of ids) {
      const doc = this.docs.find((d) => d.id === id);
      if (!doc) continue;
      let score = 0;
      const kr = keywordRank.get(id);
      const sr = semanticRank.get(id);
      if (kr !== undefined) score += 1 / (RRF_K + kr);
      if (sr !== undefined) score += 1 / (RRF_K + sr);
      fused.push({ id, text: doc.text, score });
    }
    fused.sort((a, b) => b.score - a.score);
    const top = fused.slice(0, limit);
    const docs = top
      .map((h) => this.docs.find((d) => d.id === h.id))
      .filter((d): d is MemoryDocument => Boolean(d));

    if (keywordRank.size === 0) {
      return {
        via: 'semantic',
        reason: 'no keyword match — semantic ranking only',
        docs,
        hits: top,
      };
    }

    return {
      via: 'semantic',
      reason: `RRF fusion of ${semanticRank.size} semantic and ${keywordRank.size} keyword candidates`,
      docs,
      hits: top,
    };
  }

  private keywordOnly(keywordDocs: MemoryDocument[], reason: string): SemanticSearchResult {
    const hits = keywordDocs.map((d, i) => ({
      id: d.id,
      text: d.text,
      score: 1 / (RRF_K + i + 1),
    }));
    return { via: 'keyword', reason, docs: keywordDocs, hits };
  }
}

export function draftSkillFromSession(
  summary: string,
  evidence: string,
): { name: string; description: string; trigger: string } | null {
  if (summary.length < 40 || evidence.length < 20) return null;
  const name = summary
    .split(/\s+/)
    .slice(0, 4)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48);
  if (!name) return null;
  return {
    name,
    description: summary.slice(0, 500),
    trigger: `When task resembles: ${evidence.slice(0, 200)}`,
  };
}
