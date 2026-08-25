// @ts-nocheck
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDecryptedKey } from '../config/store';

/** Operator vault root (Admin → Paths). */
export const DEFAULT_VAULT_ROOT = 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb';

const VAULT_REL = path.join('Codingbackup und tools', 'all ai agents and boosters', 'oooooggithubbb');

export interface VaultPathEntry {
  label: string;
  value: string;
  exists: boolean;
}

export function discoverVaultRoot(): string | null {
  for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    const root = path.join(`${letter}:`, VAULT_REL);
    const agents = path.join(root, 'agents');
    if (fs.existsSync(agents)) return root;
    if (fs.existsSync(root)) return root;
  }
  return null;
}

export function getVaultPathEntries(): VaultPathEntry[] {
  const root = discoverVaultRoot() ?? DEFAULT_VAULT_ROOT;
  const entries: { label: string; rel: string }[] = [
    { label: 'VAULT ROOT', rel: '' },
    { label: 'AGENTS', rel: 'agents' },
    { label: 'SKILLS', rel: 'skills' },
    { label: 'PROMPTS', rel: 'prompts' },
    { label: 'INSTRUCTIONS', rel: 'instructions' },
    { label: 'ANTIGRAVITY', rel: path.join('antigravity-awesome-skills', 'skills') },
    { label: 'GC COLLECTIONS', rel: 'github-gamechangers' },
  ];
  return entries.map(({ label, rel }) => {
    const value = rel ? path.join(root, rel) : root;
    return { label, value, exists: fs.existsSync(value) };
  });
}

/** Parse agent rows from bundled src/data/agents-catalog.ts (dev / repo checkout). */
export function parseAgentsCatalogTs(
  catalogPath: string,
): { id: string; name: string; desc: string; cat: string }[] {
  if (!fs.existsSync(catalogPath)) return [];
  const text = fs.readFileSync(catalogPath, 'utf8');
  const out: { id: string; name: string; desc: string; cat: string }[] = [];
  const re =
    /\{\s*id:\s*'([^']+)',\s*name:\s*'((?:\\'|[^''])*)',\s*desc:\s*'((?:\\'|[^''])*)',\s*model:[^,]+,\s*cat:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({
      id: m[1],
      name: m[2].replace(/\\'/g, "'"),
      desc: m[3].replace(/\\'/g, "'"),
      cat: m[4],
    });
  }
  return out;
}

function catalogCandidates(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, 'src', 'data', 'agents-catalog.ts'),
    path.join(cwd, '..', 'src', 'data', 'agents-catalog.ts'),
    path.join(__dirname, '..', '..', 'src', 'data', 'agents-catalog.ts'),
  ];
}

/** Materialize catalog agents into userData when external vault (G:\\…) is unavailable. */
export function materializeLocalAgentsVault(userDataDir: string): string {
  const agentsDir = path.join(userDataDir, 'vault', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  seedBundledHarnessAgents(agentsDir);
  const existing = fs.readdirSync(agentsDir).filter(isAgentFile).length;
  if (existing >= 50) return agentsDir;

  let catalog: { id: string; name: string; desc: string; cat: string }[] = [];
  for (const p of catalogCandidates()) {
    catalog = parseAgentsCatalogTs(p);
    if (catalog.length) break;
  }
  if (!catalog.length) return agentsDir;

  for (const a of catalog) {
    const slug =
      a.name
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || a.id;
    const file = path.join(agentsDir, `${slug}.agent.md`);
    if (fs.existsSync(file)) continue;
    const body = `---
id: ${a.id}
name: ${a.name}
category: ${a.cat}
model: catalog
---

# ${a.name}

${a.desc}
`;
    fs.writeFileSync(file, body, 'utf8');
  }
  return agentsDir;
}

/** Affaan-adapted agent prompts shipped under electron/harness/agents/. */
function seedBundledHarnessAgents(agentsDir: string): void {
  const resources =
    typeof process.resourcesPath === 'string' && process.resourcesPath
      ? path.join(process.resourcesPath, 'harness-agents')
      : '';
  const roots = [
    path.join(process.cwd(), 'electron', 'harness', 'agents'),
    resources,
    path.join(__dirname, '..', 'harness', 'agents'),
    path.join(__dirname, 'harness', 'agents'),
  ].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      if (!isAgentFile(name)) continue;
      const dest = path.join(agentsDir, name);
      if (fs.existsSync(dest)) continue;
      try {
        fs.copyFileSync(path.join(root, name), dest);
      } catch {
        // best-effort seed
      }
    }
    break;
  }
}

/** Count agent definition files in a vault directory (selftest-equivalent). */
export function countAgentFiles(dir: string): number {
  try {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter(isAgentFile).length;
  } catch {
    return 0;
  }
}

/**
 * Prefer an existing on-disk agents directory with real agent files.
 * Stale Admin/env values that point at removed or empty paths (historically
 * `G:\jarvis the og project\agents`) must not win over a live Codingbackup vault.
 */
export function resolveAgentsPath(): string {
  const discovered = discoverVaultRoot();
  const vaultAgents = discovered ? path.join(discovered, 'agents') : '';
  const candidates = [
    process.env.JARVIS_AGENTS_PATH?.trim(),
    getDecryptedKey('JARVIS_AGENTS_PATH')?.trim(),
    vaultAgents,
    path.join(DEFAULT_VAULT_ROOT, 'agents'),
  ].filter(Boolean) as string[];

  let firstExisting = '';
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    if (!firstExisting) firstExisting = p;
    if (countAgentFiles(p) > 0) return p;
  }
  // Last resort: known nested vault location used before top-level agents/ existed.
  if (discovered) {
    const nested = path.join(
      discovered,
      'github-gamechangers',
      'github-copilot-configs',
      '.github',
      'agents',
    );
    if (fs.existsSync(nested) && countAgentFiles(nested) > 0) return nested;
    if (fs.existsSync(nested) && !firstExisting) firstExisting = nested;
  }
  return firstExisting || candidates[0] || path.join(DEFAULT_VAULT_ROOT, 'agents');
}

export function resolveSkillsIndexPath(): string {
  const discovered = discoverVaultRoot();
  const candidates = [
    process.env.JARVIS_SKILLS_INDEX?.trim(),
    getDecryptedKey('JARVIS_SKILLS_INDEX')?.trim(),
    discovered ? path.join(discovered, 'skills-index.json') : '',
    path.join(DEFAULT_VAULT_ROOT, 'skills-index.json'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0] ?? '';
}

export function bootstrapWorkspaceEnv(userDataDir?: string): { agentsPath: string; skillsIndexPath: string } {
  let agentsPath = resolveAgentsPath();
  if (!fs.existsSync(agentsPath) && userDataDir) {
    agentsPath = materializeLocalAgentsVault(userDataDir);
  }
  const skillsIndexPath = resolveSkillsIndexPath();
  process.env.JARVIS_AGENTS_PATH = agentsPath;
  if (skillsIndexPath) process.env.JARVIS_SKILLS_INDEX = skillsIndexPath;
  return { agentsPath, skillsIndexPath };
}

/**
 * Which files in an agents vault count as an agent definition.
 *
 * The scan used to accept only `*.agent.md`. Real vaults mix three conventions
 * — `*.agent.md`, `*.agent.from-agents.md` and `*.chatmode.md` — so a 421-file
 * vault surfaced exactly one agent and the feature looked broken rather than
 * mis-configured.
 */
export function isAgentFile(name: string): boolean {
  return /\.(agent(\.from-agents)?|chatmode)\.md$/i.test(name);
}
