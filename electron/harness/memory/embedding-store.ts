/**
 * Persistent local embedding store (BLOB vectors in SQLite).
 * sqlite-vec is optional; this ships a working cosine search without the native extension.
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';
import { openDatabase, type SqliteLike } from '../../db/sqlite';
import { cosineSimilarity, embed } from './embeddings';

let db: SqliteLike | null = null;

export function initEmbeddingStore(userDataDir: string): void {
  const dir = path.join(userDataDir, 'embedding-store');
  fs.mkdirSync(dir, { recursive: true });
  db = openDatabase(dir);
  db.exec(`CREATE TABLE IF NOT EXISTS embedding_vectors (
    id TEXT PRIMARY KEY,
    text_preview TEXT NOT NULL,
    dims INTEGER NOT NULL,
    vector BLOB NOT NULL,
    updated_at TEXT NOT NULL
  )`);
}

function requireDb(): SqliteLike {
  if (!db) throw new Error('Embedding store not initialized');
  return db;
}

function pack(vec: number[]): Buffer {
  const buf = Buffer.alloc(vec.length * 4);
  for (let i = 0; i < vec.length; i++) buf.writeFloatLE(vec[i], i * 4);
  return buf;
}

function unpack(buf: Buffer, dims: number): number[] {
  const out = new Array<number>(dims);
  for (let i = 0; i < dims; i++) out[i] = buf.readFloatLE(i * 4);
  return out;
}

export async function upsertEmbedding(
  id: string,
  text: string,
): Promise<{ ok: boolean; dims?: number; reason?: string }> {
  const vectors = await embed([text]);
  if (!vectors || !vectors[0]) return { ok: false, reason: 'embedder unavailable' };
  const vec = vectors[0];
  const d = requireDb();
  try {
    d.prepare(`DELETE FROM embedding_vectors WHERE id = ?`).run(id);
  } catch {
    /* first insert */
  }
  d.prepare(
    `INSERT INTO embedding_vectors (id, text_preview, dims, vector, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, text.slice(0, 240), vec.length, pack(vec), new Date().toISOString());
  return { ok: true, dims: vec.length };
}

export async function searchEmbeddings(
  query: string,
  limit = 8,
): Promise<{ id: string; score: number; textPreview: string }[]> {
  const vectors = await embed([query]);
  if (!vectors || !vectors[0]) return [];
  const q = vectors[0];
  const rows = requireDb().prepare(`SELECT id, text_preview, dims, vector FROM embedding_vectors`).all();
  const scored = rows.map((r: Record<string, unknown>) => {
    const dims = Number(r.dims);
    const vec = unpack(Buffer.from(r.vector as Buffer), dims);
    return {
      id: String(r.id),
      textPreview: String(r.text_preview),
      score: cosineSimilarity(q, vec),
    };
  });
  return scored
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, Math.min(32, limit));
}

export function embeddingStoreStats(): { count: number } {
  if (!db) return { count: 0 };
  const row = db.prepare(`SELECT COUNT(*) AS c FROM embedding_vectors`).get();
  return { count: Number(row?.c ?? 0) };
}
