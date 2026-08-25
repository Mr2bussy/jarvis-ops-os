#!/usr/bin/env node
// @ts-nocheck
/**
 * Project hygiene doctor — Sperrklinke D1.
 *
 * `node scripts/doctor.mjs --tree` fails the build when the working tree drifts:
 * unknown top-level directories, tracked *.bak* paths, oversized tracked blobs,
 * hard-deny compare/bak trees (even if gitignored — zero false negatives),
 * optional `.jarvis-home` canonical-path mismatch, and a soft git object budget.
 *
 * Dependency-free so pre-commit / CI can run before `pnpm install`.
 *
 * Exit codes: 0 = clean, 1 = hygiene failure, 2 = usage / not a git repo.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { tmpdir } from 'node:os';

const MAX_TRACKED_BYTES = 5 * 1024 * 1024;
/** Soft budget for `git count-objects` size-pack (MiB). Warning only unless --strict-budget. */
const REPO_PACK_BUDGET_MIB = 200;

/**
 * Allowed top-level directory names. Everything else on disk is an error
 * unless gitignored — except HARD_DENY names, which always fail.
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
  'reports',
  'scripts',
  'src',
  'stryker-tmp',
  'test-results',
]);

/**
 * Top-level names that must NEVER exist in the project root — even when
 * gitignored. Phase-0 vendor dumps caused 774 MB / index ghosts; warn-only
 * would be a false negative for D1.
 */
export const HARD_DENY_TOP_LEVEL = [
  /^\.compare$/i,
  /^_compare$/i,
  /^node_modules\.partial\.bak/i,
  /\.bak$/i,
  /\.bak\d+$/i,
];

const TREE = process.argv.includes('--tree');
const STRICT_BUDGET = process.argv.includes('--strict-budget');
const STRICT_HOME = process.argv.includes('--strict-home');
const SELF_TEST = process.argv.includes('--self-test');

/** @param {string[]} args @param {'utf8'|'buffer'} encoding */
function git(args, encoding = 'utf8', cwd) {
  return execFileSync('git', args, {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    cwd: cwd || process.cwd(),
  });
}

function repoRoot(cwd) {
  try {
    return git(['rev-parse', '--show-toplevel'], 'utf8', cwd).trim();
  } catch {
    console.error('doctor: not a git repository');
    process.exit(2);
  }
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isHardDenyTopLevel(name) {
  return HARD_DENY_TOP_LEVEL.some((re) => re.test(name));
}

/**
 * @param {string} root
 * @returns {{ bad: string[], ignored: string[], hardDeny: string[] }}
 */
export function classifyTopLevelDirs(root) {
  const bad = [];
  const ignored = [];
  const hardDeny = [];
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (ALLOWED_TOP_LEVEL_DIRS.has(ent.name)) continue;
    if (isHardDenyTopLevel(ent.name)) {
      hardDeny.push(ent.name);
      continue;
    }
    // Gitignored vendor leftovers warn; hard-deny already caught compare/bak.
    try {
      git(['check-ignore', '-q', ent.name], 'utf8', root);
      ignored.push(ent.name);
    } catch {
      bad.push(ent.name);
    }
  }
  return {
    bad: bad.sort(),
    ignored: ignored.sort(),
    hardDeny: hardDeny.sort(),
  };
}

/**
 * Path segment matches bak dump patterns (zero false negatives on *.bak*).
 * @param {string} file
 * @returns {boolean}
 */
export function pathLooksLikeBak(file) {
  const parts = file.replace(/\\/g, '/').split('/');
  return parts.some(
    (p) =>
      /\.bak\d*$/i.test(p) ||
      /\.bak\./i.test(p) ||
      p.toLowerCase().includes('.bak') ||
      /^node_modules\.partial\.bak/i.test(p),
  );
}

/**
 * @param {string[]} files
 * @returns {string[]}
 */
export function bakTracked(files) {
  return files.filter(pathLooksLikeBak);
}

/**
 * @param {string} root
 * @param {string[]} files
 * @returns {{ path: string, bytes: number }[]}
 */
export function oversizedTracked(root, files) {
  const hits = [];
  for (const file of files) {
    // Skip historical bak trees still lingering in the index — bak rule catches them.
    if (pathLooksLikeBak(file)) continue;
    const abs = resolve(root, file);
    if (!existsSync(abs)) continue;
    try {
      const st = statSync(abs);
      if (!st.isFile()) continue;
      if (st.size > MAX_TRACKED_BYTES) hits.push({ path: file, bytes: st.size });
    } catch {
      /* unreadable — ignore */
    }
  }
  return hits;
}

/**
 * Also catch oversized / bak files that are staged but not yet committed
 * (index + worktree), so pre-commit cannot miss a 774 MB dump mid-add.
 * @param {string} root
 * @returns {string[]}
 */
function stagedAndCachedPaths(root) {
  try {
    const staged = git(['diff', '--cached', '--name-only', '-z'], 'utf8', root)
      .split('\0')
      .filter(Boolean);
    const tracked = git(['ls-files', '-z'], 'utf8', root).split('\0').filter(Boolean);
    return [...new Set([...tracked, ...staged])];
  } catch {
    return [];
  }
}

/**
 * @param {string} root
 * @param {{ strictHome?: boolean, cwd?: string }} [opts]
 * @returns {{ ok: boolean, message: string, level: 'ok'|'warn'|'fail' }}
 */
export function checkJarvisHome(root, opts = {}) {
  const homeFile = resolve(root, '.jarvis-home');
  const strict = opts.strictHome ?? STRICT_HOME;
  if (!existsSync(homeFile)) {
    return {
      ok: true,
      level: 'warn',
      message: 'doctor: no .jarvis-home — skip canonical path check (optional)',
    };
  }
  const canonical = readFileSync(homeFile, 'utf8').trim().replace(/[/\\]+$/, '');
  const cwd = resolve(opts.cwd ?? process.cwd()).replace(/[/\\]+$/, '');
  const norm = (p) => p.replace(/\\/g, '/').toLowerCase();
  if (norm(cwd) !== norm(resolve(canonical))) {
    const msg = `doctor: zweite Kopie? cwd=${cwd} ≠ .jarvis-home=${canonical}`;
    if (strict) {
      return { ok: false, level: 'fail', message: msg };
    }
    return { ok: true, level: 'warn', message: msg };
  }
  return {
    ok: true,
    level: 'ok',
    message: `doctor: .jarvis-home matches cwd (${relative(root, cwd) || '.'})`,
  };
}

/**
 * @param {string} [cwd]
 * @returns {{ ok: boolean, message: string, level: 'ok'|'warn'|'fail' }}
 */
export function checkRepoBudget(cwd) {
  try {
    const out = git(['count-objects', '-vH'], 'utf8', cwd);
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

/**
 * Run tree checks against `root`. Returns exit code 0 or 1.
 * @param {string} root
 * @param {{ strictHome?: boolean, cwd?: string, quiet?: boolean }} [opts]
 */
export function runTreeCheck(root, opts = {}) {
  const errors = [];
  const warnings = [];
  const log = opts.quiet ? () => {} : console.log.bind(console);
  const warn = opts.quiet ? () => {} : console.warn.bind(console);
  const err = opts.quiet ? () => {} : console.error.bind(console);

  const { bad: unknown, ignored: ignoredUnknown, hardDeny } = classifyTopLevelDirs(root);
  if (hardDeny.length) {
    errors.push(
      `hard-deny top-level dir(s) (compare/bak dumps — always fail): ${hardDeny.join(', ')}\n` +
        `  remove these directories; gitignore alone is not enough for D1`,
    );
  }
  if (ignoredUnknown.length) {
    warnings.push(
      `doctor: gitignored unknown top-level dir(s) (not failing): ${ignoredUnknown.join(', ')}`,
    );
  }
  if (unknown.length) {
    errors.push(
      `unknown top-level director${unknown.length === 1 ? 'y' : 'ies'}: ${unknown.join(', ')}\n` +
        `  (whitelist in scripts/doctor.mjs — remove foreign trees or add to .gitignore)`,
    );
  }

  let tracked = [];
  try {
    tracked = stagedAndCachedPaths(root);
  } catch (e) {
    errors.push(`git ls-files failed: ${String(e?.message ?? e)}`);
  }

  const bak = bakTracked(tracked);
  if (bak.length) {
    const sample = bak.slice(0, 8).join('\n    ');
    errors.push(
      `${bak.length} tracked/staged path(s) match *.bak* — remove from the index (git rm -r --cached …)\n    ${sample}` +
        (bak.length > 8 ? `\n    … +${bak.length - 8} more` : ''),
    );
  }

  const huge = oversizedTracked(root, tracked);
  if (huge.length) {
    for (const h of huge) {
      errors.push(`tracked file > 5 MB: ${h.path} (${(h.bytes / (1024 * 1024)).toFixed(2)} MiB)`);
    }
  }

  // Untracked-but-present hard-deny files at top level (e.g. foo.bak sitting next to package.json)
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (ent.isDirectory()) continue;
    if (isHardDenyTopLevel(ent.name) || pathLooksLikeBak(ent.name)) {
      // Only fail if not already covered; loose *.bak files at root are Phase-0 risk
      if (!bak.includes(ent.name)) {
        errors.push(`top-level bak/compare artifact on disk: ${ent.name}`);
      }
    }
  }

  const home = checkJarvisHome(root, { strictHome: opts.strictHome, cwd: opts.cwd });
  if (home.level === 'fail') errors.push(home.message);
  else if (home.level === 'warn') warnings.push(home.message);
  else if (home.level === 'ok') log(home.message);

  const budget = checkRepoBudget(root);
  if (budget.level === 'fail') errors.push(budget.message);
  else if (budget.level === 'warn') warnings.push(budget.message);
  else log(budget.message);

  for (const w of warnings) warn(w);

  if (errors.length) {
    err('\ndoctor --tree: FAILED\n');
    for (const e of errors) err(`  ✗ ${e}\n`);
    return 1;
  }

  log(`doctor --tree: ok (${tracked.length} tracked paths, top-level clean)`);
  return 0;
}

/**
 * Synthetic fixtures asserting exit codes (D1 acceptance).
 * Does not touch the real working tree.
 */
function selfTest() {
  const base = join(tmpdir(), `jarvis-doctor-selftest-${Date.now()}`);
  mkdirSync(base, { recursive: true });
  const failures = [];

  /** @param {string} name @param {() => void} fn */
  function assert(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
    } catch (e) {
      failures.push(`${name}: ${e.message || e}`);
      console.error(`  ✗ ${name}: ${e.message || e}`);
    }
  }

  try {
    // --- clean mini-repo ---
    const clean = join(base, 'clean');
    mkdirSync(clean);
    git(['init'], 'utf8', clean);
    git(['config', 'user.email', 'doctor@test'], 'utf8', clean);
    git(['config', 'user.name', 'doctor'], 'utf8', clean);
    writeFileSync(join(clean, 'README.md'), 'ok\n');
    writeFileSync(join(clean, '.jarvis-home'), clean);
    git(['add', 'README.md'], 'utf8', clean);
    git(['commit', '-m', 'init'], 'utf8', clean);

    assert('clean tree exits 0', () => {
      const code = runTreeCheck(clean, { cwd: clean, quiet: true });
      if (code !== 0) throw new Error(`expected 0 got ${code}`);
    });

    assert('zweite Kopie warns (not fail) when cwd mismatches .jarvis-home', () => {
      const other = join(base, 'other-cwd');
      mkdirSync(other);
      const home = checkJarvisHome(clean, { cwd: other, strictHome: false });
      if (home.level !== 'warn') throw new Error(`expected warn got ${home.level}`);
      if (!/zweite Kopie/i.test(home.message)) throw new Error(`missing zweite Kopie: ${home.message}`);
    });

    assert('--strict-home fails on zweite Kopie', () => {
      const other = join(base, 'other-cwd-2');
      mkdirSync(other);
      const home = checkJarvisHome(clean, { cwd: other, strictHome: true });
      if (home.level !== 'fail' || home.ok) throw new Error(`expected fail got ${home.level}`);
    });

    assert('hard-deny .compare exits 1', () => {
      const d = join(base, 'with-compare');
      mkdirSync(d);
      git(['init'], 'utf8', d);
      writeFileSync(join(d, '.gitignore'), '.compare/\n');
      mkdirSync(join(d, '.compare'));
      writeFileSync(join(d, '.compare', 'x.txt'), 'vendor\n');
      writeFileSync(join(d, 'README.md'), 'x\n');
      git(['add', '.gitignore', 'README.md'], 'utf8', d);
      const code = runTreeCheck(d, { cwd: d, quiet: true });
      if (code !== 1) throw new Error(`expected 1 got ${code}`);
    });

    assert('hard-deny _compare exits 1', () => {
      const d = join(base, 'with-compare2');
      mkdirSync(d);
      git(['init'], 'utf8', d);
      writeFileSync(join(d, '.gitignore'), '_compare/\n');
      mkdirSync(join(d, '_compare'));
      writeFileSync(join(d, 'README.md'), 'x\n');
      git(['add', '.gitignore', 'README.md'], 'utf8', d);
      const code = runTreeCheck(d, { cwd: d, quiet: true });
      if (code !== 1) throw new Error(`expected 1 got ${code}`);
    });

    assert('tracked *.bak* exits 1', () => {
      const d = join(base, 'with-bak');
      mkdirSync(d);
      git(['init'], 'utf8', d);
      git(['config', 'user.email', 'doctor@test'], 'utf8', d);
      git(['config', 'user.name', 'doctor'], 'utf8', d);
      // Force-add despite ignore by not ignoring yet
      writeFileSync(join(d, 'leak.bak'), 'secret\n');
      git(['add', '-f', 'leak.bak'], 'utf8', d);
      git(['commit', '-m', 'bad'], 'utf8', d);
      const code = runTreeCheck(d, { cwd: d, quiet: true });
      if (code !== 1) throw new Error(`expected 1 got ${code}`);
    });

    assert('tracked file > 5 MB exits 1', () => {
      const d = join(base, 'with-huge');
      mkdirSync(d);
      git(['init'], 'utf8', d);
      git(['config', 'user.email', 'doctor@test'], 'utf8', d);
      git(['config', 'user.name', 'doctor'], 'utf8', d);
      // 5 MB + 1 byte
      const buf = Buffer.alloc(MAX_TRACKED_BYTES + 1, 0x61);
      writeFileSync(join(d, 'huge.bin'), buf);
      git(['add', 'huge.bin'], 'utf8', d);
      git(['commit', '-m', 'huge'], 'utf8', d);
      const code = runTreeCheck(d, { cwd: d, quiet: true });
      if (code !== 1) throw new Error(`expected 1 got ${code}`);
    });

    assert('pathLooksLikeBak covers nested and bak2', () => {
      if (!pathLooksLikeBak('vendor/foo.bak/x')) throw new Error('nested bak dir');
      if (!pathLooksLikeBak('a.bak2')) throw new Error('bak2');
      if (!pathLooksLikeBak('node_modules.partial.bak/pkg')) throw new Error('partial.bak');
      if (pathLooksLikeBak('src/main.ts')) throw new Error('false positive');
    });
  } finally {
    try {
      rmSync(base, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }

  if (failures.length) {
    console.error(`\ndoctor --self-test: FAILED (${failures.length})`);
    return 1;
  }
  console.log('\ndoctor --self-test: ok');
  return 0;
}

function main() {
  if (SELF_TEST) {
    console.log('doctor --self-test');
    return selfTest();
  }

  if (!TREE) {
    console.error('Usage: node scripts/doctor.mjs --tree [--strict-budget] [--strict-home]');
    console.error('       node scripts/doctor.mjs --self-test');
    return 2;
  }

  const root = repoRoot();
  return runTreeCheck(root, { strictHome: STRICT_HOME, cwd: process.cwd() });
}

const exitCode = main();
process.exit(exitCode);
