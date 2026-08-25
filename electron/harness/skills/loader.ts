/**
 * Bundled Affaan/ECC-derived skills for JARVIS Prime.
 *
 * Source of truth lives next to this file (each skill folder's SKILL.md).
 * On harness boot we materialize copies into userData harness/skills/ so
 * operators can edit local copies without losing the repo defaults on upgrade
 * (we never overwrite an existing local file).
 *
 * Trigger-table lazy loading (ECC strategic-compact pattern): only the matching
 * skill body is injected into the system supplement — not the full library.
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BundledSkill {
  name: string;
  description: string;
  /** Keywords / phrases that activate the skill body. */
  triggers: string[];
  /** Full markdown body without YAML frontmatter. */
  body: string;
  /** Absolute path of the materialized (or bundled) SKILL.md. */
  filePath: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/** Resolve the directory that ships with the Electron main bundle / repo. */
export function bundledSkillsRoot(): string {
  // This module lives *inside* electron/harness/skills/, so __dirname is the
  // skills root when sibling folders (verification-loop/, …) are present.
  const resources =
    typeof process.resourcesPath === 'string' && process.resourcesPath
      ? path.join(process.resourcesPath, 'harness-skills')
      : '';
  const candidates = [
    path.join(__dirname),
    resources,
    path.join(process.cwd(), 'electron', 'harness', 'skills'),
    path.join(__dirname, '..', '..', 'electron', 'harness', 'skills'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c) && hasSkillDirs(c)) return c;
  }
  return candidates[0]!;
}

function hasSkillDirs(dir: string): boolean {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .some((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'SKILL.md')));
  } catch {
    return false;
  }
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) return { meta: {}, body: raw.trim() };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
  }
  return { meta, body: m[2].trim() };
}

function parseTriggers(meta: Record<string, string>, name: string): string[] {
  const raw = meta.triggers ?? meta.trigger ?? '';
  if (raw) {
    return raw
      .split(/[,|]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  // Fallback: skill name tokens
  return name
    .toLowerCase()
    .split(/[-_]/)
    .filter((t) => t.length > 2);
}

/**
 * Copy bundled SKILL.md trees into `destDir` without clobbering local edits.
 * Returns the list of skill directories present after seeding.
 */
export function materializeBundledSkills(destDir: string): string[] {
  fs.mkdirSync(destDir, { recursive: true });
  const srcRoot = bundledSkillsRoot();
  if (!fs.existsSync(srcRoot)) return [];

  const names: string[] = [];
  for (const ent of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const skillMd = path.join(srcRoot, ent.name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    names.push(ent.name);
    const destSkillDir = path.join(destDir, ent.name);
    const destMd = path.join(destSkillDir, 'SKILL.md');
    if (fs.existsSync(destMd)) continue;
    fs.mkdirSync(destSkillDir, { recursive: true });
    fs.copyFileSync(skillMd, destMd);
  }
  return names;
}

/** Load all skills from a skills directory (userData or bundled). */
export function loadSkillsFromDir(dir: string): BundledSkill[] {
  if (!fs.existsSync(dir)) return [];
  const out: BundledSkill[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const filePath = path.join(dir, ent.name, 'SKILL.md');
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const name = (meta.name ?? ent.name).trim();
      out.push({
        name,
        description: (meta.description ?? name).trim().slice(0, 512),
        triggers: parseTriggers(meta, name),
        body,
        filePath,
      });
    } catch {
      // skip unreadable skill
    }
  }
  return out;
}

/**
 * ECC-style trigger table: return short index for always-on context, plus
 * full bodies for skills whose triggers match the user message.
 */
export function selectSkillsForMessage(
  skills: BundledSkill[],
  message: string,
  opts?: { maxBodies?: number; maxBodyChars?: number },
): { triggerTable: string; bodies: string } {
  const maxBodies = opts?.maxBodies ?? 2;
  const maxBodyChars = opts?.maxBodyChars ?? 3500;
  const lower = message.toLowerCase();

  const tableLines = skills.map(
    (s) => `- ${s.name}: ${s.description.slice(0, 120)} [triggers: ${s.triggers.slice(0, 6).join(', ')}]`,
  );
  const triggerTable =
    tableLines.length > 0
      ? ['Bundled skill index (lazy — bodies load only on trigger):', ...tableLines].join('\n')
      : '';

  const matched = skills.filter((s) => s.triggers.some((t) => t.length > 2 && lower.includes(t)));
  const bodies = matched
    .slice(0, maxBodies)
    .map((s) => `### Skill: ${s.name}\n${s.body.slice(0, maxBodyChars)}`)
    .join('\n\n');

  return { triggerTable, bodies };
}

/** One-shot bootstrap used by JarvisPrimeHarness. */
export function bootstrapHarnessSkills(skillsDir: string): BundledSkill[] {
  materializeBundledSkills(skillsDir);
  const fromUser = loadSkillsFromDir(skillsDir);
  if (fromUser.length) return fromUser;
  return loadSkillsFromDir(bundledSkillsRoot());
}
