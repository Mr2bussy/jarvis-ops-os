#!/usr/bin/env node
/**
 * Surgical diff scorer for coding golden cases.
 *
 * Usage:
 *   node scripts/bench/diff-scope.mjs --allow=electron/security/ipc.ts -- git diff --name-only
 */
import { spawnSync } from 'node:child_process';

const allowArg = process.argv.find((a) => a.startsWith('--allow='));
const allow = allowArg
  ? allowArg
      .slice('--allow='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

const gitIdx = process.argv.indexOf('--');
const gitArgs = gitIdx >= 0 ? process.argv.slice(gitIdx + 1) : ['diff', '--name-only'];

const diff = spawnSync('git', gitArgs, { encoding: 'utf8' });
if (diff.status !== 0) {
  console.error(diff.stderr || 'git diff failed');
  process.exit(diff.status ?? 1);
}

const files = diff.stdout
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

if (allow.length === 0) {
  console.log(JSON.stringify({ files, surgical: 100, note: 'no allowlist — report only' }, null, 2));
  process.exit(0);
}

const normalize = (p) => p.replace(/\\/g, '/');
const allowNorm = allow.map(normalize);
const outOfScope = files.filter((f) => !allowNorm.some((a) => normalize(f) === a || normalize(f).endsWith('/' + a)));

let surgical = 100;
if (outOfScope.length === 1) surgical = 75;
if (outOfScope.length > 1) surgical = 50;
if (files.length > allow.length * 2) surgical = 25;

console.log(
  JSON.stringify(
    {
      files,
      allow: allowNorm,
      outOfScope,
      surgical,
    },
    null,
    2,
  ),
);

process.exit(outOfScope.length > 0 ? 2 : 0);
