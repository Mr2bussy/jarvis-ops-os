/**
 * JARVIS Skills Index Builder
 * Scans all skill/agent/prompt/instruction directories from the boosters folder
 * and emits src/data/skills-index.json for the Arsenal screen.
 *
 * Run: node scripts/build-skills-index.mjs
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'fs';
import { join, basename, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT   = resolve(__dir, '..');
const BOOST  = 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb';
const OUT    = join(ROOT, 'src', 'data', 'skills-index.json');

// ── helpers ──────────────────────────────────────────────────────────────────

function readSafe(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

/** Parse YAML frontmatter from a .md file — returns { meta, body } */
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const k = line.slice(0, sep).trim();
    const v = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    meta[k] = v;
  }
  return { meta, body: m[2] };
}

/** Pull first non-empty paragraph from markdown body */
function firstParagraph(text, max = 120) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const raw   = lines[0] || '';
  return raw.length > max ? raw.slice(0, max) + '…' : raw;
}

/** Guess category from name/desc string */
function guessCategory(slug, desc = '') {
  const s = (slug + ' ' + desc).toLowerCase();
  if (/react|next|vue|svelte|angular|tailwind|ui|ux|frontend|css|html|component/.test(s)) return 'FRONTEND';
  if (/azure|aws|gcp|cloud|terraform|k8s|kubernetes|docker|ci.?cd|devops|infra/.test(s)) return 'CLOUD';
  if (/security|pentest|owasp|xss|sqli|vuln|exploit|hack|auth/.test(s)) return 'SECURITY';
  if (/python|rust|go|golang|java|kotlin|typescript|csharp|cpp|backend|api|node|fastapi|django|spring/.test(s)) return 'BACKEND';
  if (/data|sql|postgres|mongo|redis|db|database|spark|pandas|ml|ai|llm|rag|embedding/.test(s)) return 'DATA';
  if (/debug|test|qa|playwright|jest|vitest|tdd|review|lint/.test(s)) return 'DEBUG';
  if (/content|seo|blog|social|media|marketing|copywrite|email/.test(s)) return 'CONTENT';
  if (/trading|crypto|finance|quant|stock/.test(s)) return 'TRADING';
  if (/agent|orchestrat|workflow|automat|pipeline|meta|plan/.test(s)) return 'META';
  return 'SPECIALIST';
}

// ── collectors ───────────────────────────────────────────────────────────────

/** Scan antigravity-style skills dir (each subdir has SKILL.md) */
function scanSkillsDir(dir, source, entries) {
  if (!existsSync(dir)) return;
  const subdirs = readdirSync(dir).filter(n => {
    try { return statSync(join(dir, n)).isDirectory(); } catch { return false; }
  });
  for (const slug of subdirs) {
    const skillMd = join(dir, slug, 'SKILL.md');
    const readmeMd = join(dir, slug, 'README.md');
    const text = readSafe(skillMd) || readSafe(readmeMd);
    if (!text) continue;
    const { meta, body } = parseFrontmatter(text);
    const name = meta.name || slug.replace(/-/g, ' ');
    const desc = meta.description || firstParagraph(body);
    entries.push({
      id:     `SK-${source.toUpperCase().slice(0, 3)}-${slug}`,
      slug,
      name:   name.length > 60 ? name.slice(0, 60) + '…' : name,
      desc:   desc.length > 130 ? desc.slice(0, 130) + '…' : desc,
      risk:   meta.risk || 'safe',
      source,
      cat:    guessCategory(slug, desc),
      type:   'skill',
      path:   join(dir, slug),
      file:   existsSync(skillMd) ? skillMd : readmeMd,
    });
  }
}

/** Scan a flat dir of .md files (agents/, prompts/, instructions/) */
function scanFlatDir(dir, type, source, entries) {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter(n => n.endsWith('.md') && !n.startsWith('_') && !n.toUpperCase().startsWith('README'));
  for (const file of files) {
    const fullPath = join(dir, file);
    try { if (statSync(fullPath).isDirectory()) continue; } catch { continue; }
    const text = readSafe(fullPath);
    const { meta, body } = parseFrontmatter(text);
    const slug = basename(file, '.md').replace(/\.(agent|prompt|instructions?)$/, '');
    const name = meta.name || meta.title || slug.replace(/[-_.]/g, ' ');
    const desc = meta.description || firstParagraph(body);
    entries.push({
      id:     `${type.toUpperCase().slice(0, 2)}-${source.toUpperCase().slice(0, 3)}-${slug}`,
      slug,
      name:   name.length > 60 ? name.slice(0, 60) + '…' : name,
      desc:   desc.length > 130 ? desc.slice(0, 130) + '…' : desc,
      risk:   meta.risk || 'safe',
      source,
      cat:    guessCategory(slug, desc),
      type,
      path:   fullPath,
      file:   fullPath,
    });
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

const entries = [];

console.log('📡 Scanning boosters folder…');

// 1. Agents (already in JARVIS catalog but include here for completeness)
scanFlatDir(join(BOOST, 'agents'), 'agent', 'copilot-agents', entries);
console.log(`  agents/:          ${entries.length}`);

// 2. Prompts
const prevLen = entries.length;
scanFlatDir(join(BOOST, 'prompts'), 'prompt', 'copilot-prompts', entries);
console.log(`  prompts/:         ${entries.length - prevLen}`);

// 3. Instructions
const prev2 = entries.length;
scanFlatDir(join(BOOST, 'instructions'), 'instruction', 'copilot-instructions', entries);
console.log(`  instructions/:    ${entries.length - prev2}`);

// 4. Antigravity skills (the big one)
const prev3 = entries.length;
scanSkillsDir(join(BOOST, 'antigravity-awesome-skills', 'skills'), 'antigravity', entries);
console.log(`  antigravity/:     ${entries.length - prev3}`);

// 5. Copilot skills from main skills/
const prev4 = entries.length;
scanSkillsDir(join(BOOST, 'skills'), 'copilot-skills', entries);
console.log(`  skills/:          ${entries.length - prev4}`);

// 6. github-gamechangers sub-repos
const GAMECHANGER_BASE = join(BOOST, 'github-gamechangers');

/** Auto-scan a repo that may have agents/, skills/, prompts/, instructions/ subdirs */
function scanGcRepo(repoDir, repoName) {
  if (!existsSync(repoDir)) return 0;
  const pBefore = entries.length;
  const flatMap = [
    { sub: 'agents',       type: 'agent',       source: repoName },
    { sub: 'prompts',      type: 'prompt',      source: repoName },
    { sub: 'instructions', type: 'instruction', source: repoName },
  ];
  for (const { sub, type, source } of flatMap) {
    const d = join(repoDir, sub);
    if (existsSync(d)) scanFlatDir(d, type, source, entries);
  }
  // skills can be subdirs
  const skillsDir = join(repoDir, 'skills');
  if (existsSync(skillsDir)) scanSkillsDir(skillsDir, repoName, entries);
  // also scan flat skill-like dirs at root level (e.g. awesome-claude-skills)
  const rootItems = readdirSync(repoDir);
  const hasMd     = rootItems.some(n => n.endsWith('.md') && !n.toLowerCase().startsWith('readme') && !n.toLowerCase().startsWith('contributing'));
  if (hasMd) scanFlatDir(repoDir, 'skill', repoName, entries);
  return entries.length - pBefore;
}

const gcRepos = [
  // original batch
  'awesome-copilot-agents', 'awesome-claude-skills', 'dev-skills',
  'agent-skills-standard', 'kilocode', 'pro-workflow', 'serena', 'skillkit',
  // previously unscanned
  'agency-agents-zh', 'ai-prompts', 'awesome-claude-code',
  'awesome-copilot-for-testers', 'everything-claude-code',
  'github-copilot-configs', 'Prompt-Engineering-Guide', 'ruler',
  'system-prompts-and-models-of-ai-tools', 'THERION-SYSTEM',
  // new clones
  'claude-skills', 'agents', 'scientific-agent-skills',
  'Product-Manager-Skills', 'AI-Research-SKILLs', 'copilot-agents-dojo',
  'copilot-agent-library', 'uncle-bob', 'antigravity-skills',
  'awesome-agent-skills', 'jeffallan-claude-skills',
];
for (const repo of gcRepos) {
  const added = scanGcRepo(join(GAMECHANGER_BASE, repo), `gc-${repo}`);
  console.log(`  gc/${repo}: ${added}`);
}

// 6b. awesome-ai-apps (apps with per-app README.md)
const awesomeBase = join(BOOST, 'awesome-ai-apps');
const awesomeDirs = ['advance_ai_agents','agents','course','fine_tuning','mcp_ai_agents','memory_agents','rag_apps','simple_ai_agents','starter_ai_agents','voice_agents'];
const prev5 = entries.length;
for (const sub of awesomeDirs) {
  scanFlatDir(join(awesomeBase, sub), 'skill', `awesome-ai-apps-${sub}`, entries);
  // each sub may have deeper dirs with README.md
  const subDir = join(awesomeBase, sub);
  if (!existsSync(subDir)) continue;
  const nested = readdirSync(subDir).filter(n => { try { return statSync(join(subDir, n)).isDirectory(); } catch { return false; } });
  for (const nDir of nested) {
    scanFlatDir(join(subDir, nDir), 'skill', `awesome-ai-apps-${sub}`, entries);
  }
}
console.log(`  awesome-ai-apps/: ${entries.length - prev5}`);

// 7. De-duplicate by slug+source
const seen = new Set();
const deduped = entries.filter(e => {
  const key = `${e.source}::${e.slug}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// 8. Summary by category
const byCat = {};
for (const e of deduped) byCat[e.cat] = (byCat[e.cat] || 0) + 1;
const byType = {};
for (const e of deduped) byType[e.type] = (byType[e.type] || 0) + 1;

const index = {
  generated: new Date().toISOString(),
  total: deduped.length,
  byCat,
  byType,
  entries: deduped,
};

writeFileSync(OUT, JSON.stringify(index, null, 2), 'utf8');
console.log(`\n✅ Wrote ${deduped.length} entries → src/data/skills-index.json`);
console.log('\nBy category:', byCat);
console.log('By type:', byType);
