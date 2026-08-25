#!/usr/bin/env node
// @ts-nocheck
/**
 * Project hygiene doctor ÔÇö Sperrklinke D1.
 *
 * `node scripts/doctor.mjs --tree` fails the build when the working tree drifts:
 * unknown top-level directories, tracked *.bak* paths, oversized tracked blobs,
 * optional `.jarvis-home` canonical-path mismatch, and a soft git object budget.
 *
 * Dependency-free so pre-commit / CI can run before `pnpm install`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const MAX_TRACKED_BYTES = 5 * 1024 * 1024;
/** Soft budget for `git count-objects` size-pack (MiB). Warning only unless --strict-budget. */
const REPO_PACK_BUDGET_MIB = 200;

/**
 * Allowed top-level directory names. Everything else on disk is an error.
 * Includes common gitignored build/cache dirs so a normal checkout still passes.
 */
export const ALLOWED_TOP_LEVEL_DIRS = new Set([
  '.git',
  '.github',
  '.husky',
  '.cursor',
  '.vscode',
  '.idea',
  '.jarvis-undo',
  '.pytest_cache',
  '.vite',
  '_archive',
  'benchmarks',
  'browser_bridge',
  'build-assets',
  'coverage',
  'design-previews',
  'dist',
  'dist_new',
  'dist-electron',
  'docs',
  'e2e',
  'electron',
  'mt5_bridge',
  'node_modules',
  'playwright-report',
  'prompts',
  'release',
  'scripts',
  'src',
  'test-results',
]);

const TREE = process.argv.includes('--tree');
const STRICT_BUDGET = process.argv.includes('--strict-budget');

/** @param {string[]} args @param {'utf8'|'buffer'} encoding */
function git(args, encoding = 'utf8') {
  return execFileSync('git', args, { encoding, maxBuffer: 64 * 1024 * 1024 });
}

function repoRoot() {
  try {
    return git(['rev-parse', '--show-toplevel'], 'utf8').trim();
  } catch {
    console.error('doctor: not a git repository');
    process.exit(1);
  }
}

/**
 * @param {string} root
 * @returns {{ bad: string[], ignored: string[] }}
 */
function classifyTopLevelDirs(root) {
  const bad = [];
  const ignored = [];
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (ALLOWED_TOP_LEVEL_DIRS.has(ent.name)) continue;
    // Gitignored vendor dumps (.compare, _compare, ÔÇª) are local Phase-0 leftovers ÔÇö
    // fail only when they could enter the index (not ignored).
    try {
      git(['check-ignore', '-q', ent.name]);
      ignored.push(ent.name);
    } catch {
      bad.push(ent.name);
    }
  }
  return { bad: bad.sort(), ignored: ignored.sort() };
}

/**
 * @param {string[]} files
 * @returns {string[]}
 */
function bakTracked(files) {
  return files.filter((f) => {
    const parts = f.replace(/\\/g, '/').split('/');
    return parts.some((p) => /\.bak/i.test(p) || p.endsWith('.bak'));
  });
}

/**
 * @param {string} root
 * @param {string[]} files
 * @returns {{ path: string, bytes: number }[]}
 */
function oversizedTracked(root, files) {
  const hits = [];
  for (const file of files) {
    // Skip historical bak trees still lingering in the index ÔÇö bak rule catches them.
    if (/\.bak/i.test(file)) continue;
    const abs = resolve(root, file);
    if (!existsSync(abs)) continue;
    try {
      const st = statSync(abs);
      if (!st.isFile()) continue;
      if (st.size > MAX_TRACKED_BYTES) hits.push({ path: file, bytes: st.size });
    } catch {
      /* unreadable ÔÇö ignore */
    }
  }
  return hits;
}

/**
 * @param {string} root
 * @returns {{ ok: boolean, message: string, level: 'ok'|'warn'|'fail' }}
 */
function checkJarvisHome(root) {
  const homeFile = resolve(root, '.jarvis-home');
  if (!existsSync(homeFile)) {
    return {
      ok: true,
      level: 'warn',
      message: 'doctor: no .jarvis-home ÔÇö skip canonical path check (optional)',
    };
  }
  const canonical = readFileSync(homeFile, 'utf8').trim().replace(/[/\\]+$/, '');
  const cwd = resolve(process.cwd()).replace(/[/\\]+$/, '');
  const norm = (p) => p.replace(/\\/g, '/').toLowerCase();
  if (norm(cwd) !== norm(resolve(canonical))) {
    return {
      ok: true,
      level: 'warn',
      message: `doctor: zweite Kopie? cwd=${cwd} Ôëá .jarvis-home=${canonical}`,
    };
  }
  return {
    ok: true,
    level: 'ok',
    message: `doctor: .jarvis-home matches cwd (${relative(root, cwd) || '.'})`,
  };
}

/**
 * @returns {{ ok: boolean, message: string, level: 'ok'|'warn'|'fail' }}
 */
function checkRepoBudget() {
  try {
    const out = git(['count-objects', '-vH'], 'utf8');
    const mibMatch = out.match(/size-pack:\s+([\d.]+)\s*MiB/i);
    const kibMatch = out.match(/size-pack:\s+([\d.]+)\s*KiB/i);
    let mib = 0;
    if (mibMatch) mib = Number(mibMatch[1]);
    else if (kibMatch) mib = Number(kibMatch[1]) / 1024;
    if (mib > REPO_PACK_BUDGET_MIB) {
      return {
        ok: !STRICT_BUDGET,
        level: STRICT_BUDGET ? 'fail' : 'warn',
        message: `doctor: pack size ${mib.toFixed(1)} MiB exceeds budget ${REPO_PACK_BUDGET_MIB} MiB`,
      };
    }
    return { ok: true, level: 'ok', message: `doctor: pack size ok (~${mib.toFixed(1)} MiB)` };
  } catch (err) {
    return {
      ok: true,
      level: 'warn',
      message: `doctor: could not read git count-objects (${String(err?.message ?? err)})`,
    };
  }
}

function main() {
  if (!TREE) {
    console.error('Usage: node scripts/doctor.mjs --tree [--strict-budget]');
    return 1;
  }

  const root = repoRoot();
  const errors = [];
  const warnings = [];

  const { bad: unknown, ignored: ignoredUnknown } = classifyTopLevelDirs(root);
  if (ignoredUnknown.length) {
    warnings.push(
      `doctor: gitignored unknown top-level dir(s) (not failing): ${ignoredUnknown.join(', ')}`,
    );
  }
  if (unknown.length) {
    errors.push(
      `unknown top-level director${unknown.length === 1 ? 'y' : 'ies'}: ${unknown.join(', ')}\n` +
        `  (whitelist in scripts/doctor.mjs ÔÇö remove foreign trees or add to .gitignore)`,
    );
  }

  let tracked = [];
  try {
    tracked = git(['ls-files', '-z'], 'utf8').split('\0').filter(Boolean);
  } catch (err) {
    errors.push(`git ls-files failed: ${String(err?.message ?? err)}`);
  }

  const bak = bakTracked(tracked);
  if (bak.length) {
    const sample = bak.slice(0, 8).join('\n    ');
    errors.push(
      `${bak.length} tracked path(s) match *.bak* ÔÇö remove from the index (git rm -r --cached ÔÇª)\n    ${sample}` +
        (bak.length > 8 ? `\n    ÔÇª +${bak.length - 8} more` : ''),
    );
  }

  const huge = oversizedTracked(root, tracked);
  if (huge.length) {
    for (const h of huge) {
      errors.push(`tracked file > 5 MB: ${h.path} (${(h.bytes / (1024 * 1024)).toFixed(2)} MiB)`);
    }
  }

  const home = checkJarvisHome(root);
  if (home.level === 'warn') warnings.push(home.message);
  else if (home.level === 'ok') console.log(home.message);

  const budget = checkRepoBudget();
  if (budget.level === 'fail') errors.push(budget.message);
  else if (budget.level === 'warn') warnings.push(budget.message);
  else console.log(budget.message);

  for (const w of warnings) console.warn(w);

  if (errors.length) {
    console.error('\ndoctor --tree: FAILED\n');
    for (const e of errors) console.error(`  Ô£ù ${e}\n`);
    return 1;
  }

  console.log(`doctor --tree: ok (${tracked.length} tracked paths, top-level clean)`);
  return 0;
}

const exitCode = main();
process.exit(exitCode);
