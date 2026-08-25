/**
 * Prompt versioning — load versioned markdown prompts with changelog.
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PromptMeta {
  id: string;
  version: string;
  title: string;
  changelog: string[];
  body: string;
  path: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { meta: {}, body: raw.trim() };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    meta[key] = val;
  }
  return { meta, body: m[2].trim() };
}

function defaultPromptsDir(): string {
  // Prefer repo prompts/ next to package; fall back to cwd.
  const candidates = [path.join(__dirname, '..', '..', 'prompts'), path.join(process.cwd(), 'prompts')];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

let promptsRoot = '';

export function initPromptLoader(dir?: string): void {
  promptsRoot = dir && dir.trim() ? dir : defaultPromptsDir();
}

export function getPromptsDir(): string {
  return promptsRoot || defaultPromptsDir();
}

export function listPromptIds(): string[] {
  const dir = getPromptsDir();
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'changelog.md')
      .map((f) => f.replace(/\.md$/i, ''))
      .sort();
  } catch {
    return [];
  }
}

export function loadPrompt(id: string): PromptMeta | null {
  const file = path.join(getPromptsDir(), `${id}.md`);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const { meta, body } = parseFrontmatter(raw);
  const changelog = (meta.changelog ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    id: meta.id ?? id,
    version: meta.version ?? '0.0.0',
    title: meta.title ?? id,
    changelog,
    body,
    path: file,
  };
}

export function renderPrompt(id: string, vars: Record<string, string> = {}): string | null {
  const p = loadPrompt(id);
  if (!p) return null;
  let out = p.body;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

/** Raw body without variable substitution — for system prompts. */
export function loadPromptBody(id: string): string | null {
  return loadPrompt(id)?.body ?? null;
}

export function promptChangelog(): Array<{ id: string; version: string; changelog: string[] }> {
  return listPromptIds()
    .map((id) => loadPrompt(id))
    .filter((p): p is PromptMeta => p != null)
    .map((p) => ({ id: p.id, version: p.version, changelog: p.changelog }));
}

/** List prompts as meta objects (tests + Admin). */
export function listPrompts(): PromptMeta[] {
  return listPromptIds()
    .map((id) => loadPrompt(id))
    .filter((p): p is PromptMeta => p != null);
}

export function readPromptChangelog(): Array<{ version: string; date: string; notes: string }> {
  const file = path.join(getPromptsDir(), 'CHANGELOG.md');
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const entries: Array<{ version: string; date: string; notes: string }> = [];
  const blocks = text.split(/^##\s+/m).slice(1);
  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/);
    const header = lines[0] ?? '';
    const m = header.match(/^v?([\d.]+)\s*[·\-—]\s*(\d{4}-\d{2}-\d{2})/i);
    if (!m) continue;
    entries.push({ version: m[1], date: m[2], notes: lines.slice(1).join('\n').trim() });
  }
  return entries;
}
