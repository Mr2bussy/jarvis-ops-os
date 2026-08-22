import * as fs from 'node:fs';
import * as path from 'node:path';

export interface MemoryDocument {
  id: string;
  sessionId: string;
  text: string;
  tokens: string[];
  createdAt: string;
}

/** Lightweight token index (Hermes FTS pattern, no native sqlite dep). */
export class MemorySearchIndex {
  private docs: MemoryDocument[] = [];
  private readonly indexPath: string;

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
      id: `doc_${Date.now()}`,
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
