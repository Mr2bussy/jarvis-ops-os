#!/usr/bin/env node
// @ts-nocheck
/**
 * Secret scanner ÔÇö blocks credentials from entering the history.
 *
 * Default mode reads the *staged* blob of every added/copied/modified file, not the
 * working tree, so a `git add -p` that stages only part of a file is judged on what
 * would actually be committed. `--all` walks every tracked file instead (CI).
 *
 * `--fail-on-new` with optional `--baseline <file>`: only findings not listed in the
 * baseline fail the run (ratchet). Baseline entries: "file:line:rule".
 *
 * Node-only by design: the pre-commit hook must work on a fresh clone before any
 * install, so this cannot depend on a package.
 *
 * Usage:
 *   node scripts/scan-secrets.mjs [--all] [--fail-on-new] [--baseline .secret-baseline.json]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALLOW_MARKER, MAX_SCAN_BYTES, scanText, shouldSkipPath } from './secret-patterns.mjs';

const SCAN_ALL = process.argv.includes('--all');
const FAIL_ON_NEW = process.argv.includes('--fail-on-new');
const MAX_BUFFER = 64 * 1024 * 1024;
const BINARY_SNIFF_BYTES = 8192;

function baselinePathFromArgv() {
  const idx = process.argv.indexOf('--baseline');
  if (idx >= 0 && process.argv[idx + 1]) return resolve(process.argv[idx + 1]);
  return resolve('.secret-baseline.json');
}

/** @param {string[]} args @param {'utf8'|'buffer'} encoding */
function git(args, encoding) {
  return execFileSync('git', args, { encoding, maxBuffer: MAX_BUFFER });
}

function listCandidates() {
  const args = SCAN_ALL
    ? ['ls-files', '-z']
    : ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'];
  return git(args, 'utf8').split('\0').filter(Boolean);
}

/**
 * @param {string} root
 * @param {string} file
 * @returns {string | null}
 */
function readTrackedFile(root, file) {
  let buffer;
  try {
    buffer = readFileSync(resolve(root, file));
  } catch {
    return null;
  }
  if (buffer.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return null;
  if (buffer.length > MAX_SCAN_BYTES) return null;
  return buffer.toString('utf8');
}

/**
 * Read staged index blobs in one git cat-file --batch call (avoids N subprocess spawns).
 * @param {string[]} files repo-relative staged paths
 * @returns {Map<string, Buffer>}
 */
function readStagedBatch(files) {
  /** @type {Map<string, Buffer>} */
  const out = new Map();
  if (files.length === 0) return out;
  const input = `${files.map((f) => `:${f}`).join('\n')}\n`;
  let raw;
  try {
    raw = execFileSync('git', ['cat-file', '--batch'], { input, maxBuffer: MAX_BUFFER });
  } catch {
    return out;
  }
  let offset = 0;
  for (let i = 0; i < files.length && offset < raw.length; i += 1) {
    const lineEnd = raw.indexOf(0x0a, offset);
    if (lineEnd < 0) break;
    const header = raw.subarray(offset, lineEnd).toString('utf8');
    offset = lineEnd + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.split(' ')[2]);
    if (!Number.isFinite(size)) continue;
    const content = raw.subarray(offset, offset + size);
    offset += size + 1;
    if (content.length > MAX_SCAN_BYTES) continue;
    if (content.subarray(0, BINARY_SNIFF_BYTES).includes(0)) continue;
    out.set(files[i], content);
  }
  return out;
}

/** @param {string} filePath */
function loadBaseline(filePath) {
  if (!existsSync(filePath)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.findings;
    if (!Array.isArray(list)) return new Set();
    return new Set(list.map(String));
  } catch {
    console.error(`secret-scan: could not parse baseline ${filePath}`);
    process.exit(2);
  }
}

/** @param {{ file: string, line: number, rule: string }} f */
function findingKey(f) {
  return `${f.file.replace(/\\/g, '/')}:${f.line}:${f.rule}`;
}

function main() {
  let root;
  try {
    root = git(['rev-parse', '--show-toplevel'], 'utf8').trim();
  } catch {
    console.error('secret-scan: not a git repository ÔÇö cannot determine what to scan.');
    return 1;
  }

  const findings = [];
  const candidates = listCandidates().filter((file) => !shouldSkipPath(file));

  if (SCAN_ALL) {
    for (const file of candidates) {
      const text = readTrackedFile(root, file);
      if (text === null) continue;
      for (const hit of scanText(text)) findings.push({ file, ...hit });
    }
  } else {
    const staged = readStagedBatch(candidates);
    for (const [file, buffer] of staged) {
      const text = buffer.toString('utf8');
      for (const hit of scanText(text)) findings.push({ file, ...hit });
    }
  }

  const baselineFile = baselinePathFromArgv();
  const baseline = FAIL_ON_NEW ? loadBaseline(baselineFile) : new Set();

  /** @type {typeof findings} */
  let report = findings;
  if (FAIL_ON_NEW) {
    report = findings.filter((f) => !baseline.has(findingKey(f)));
    if (report.length === 0) {
      if (SCAN_ALL || FAIL_ON_NEW) {
        console.log(
          `secret-scan: clean (${findings.length} known baseline, 0 new)${existsSync(baselineFile) ? '' : ' ÔÇö empty/missing baseline'}.`,
        );
      }
      return 0;
    }
  } else if (findings.length === 0) {
    if (SCAN_ALL) console.log('secret-scan: clean (full tree).');
    return 0;
  }

  const label = report.length === 1 ? 'match' : 'matches';
  const outcome = SCAN_ALL || FAIL_ON_NEW ? 'build failed' : 'commit blocked';
  const kind = FAIL_ON_NEW ? 'new credential' : 'possible credential';
  console.error(`\nsecret-scan: ${report.length} ${kind} ${label} ÔÇö ${outcome}.\n`);
  for (const { file, line, rule } of report) {
    console.error(`  ${file}:${line}  [${rule}]`);
  }
  console.error(
    [
      '',
      'Remove the credential and rotate it ÔÇö a staged secret is already on disk.',
      'Runtime keys belong in safeStorage (main process) or an untracked .env.',
      `Deliberate fixture? Append the marker comment "${ALLOW_MARKER}" to that line.`,
      FAIL_ON_NEW
        ? `To accept after triage: add keys to ${baselineFile} (file:line:rule) or re-run without --fail-on-new.`
        : '',
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  return 1;
}

// Hidden helper for operators: node scripts/scan-secrets.mjs --write-baseline
if (process.argv.includes('--write-baseline')) {
  let root;
  try {
    root = git(['rev-parse', '--show-toplevel'], 'utf8').trim();
  } catch {
    console.error('secret-scan: not a git repository');
    process.exit(1);
  }
  const findings = [];
  for (const file of git(['ls-files', '-z'], 'utf8').split('\0').filter(Boolean)) {
    if (shouldSkipPath(file)) continue;
    const text = readTrackedFile(root, file);
    if (text === null) continue;
    for (const hit of scanText(text)) findings.push({ file, ...hit });
  }
  const keys = findings.map(findingKey).sort();
  const out = baselinePathFromArgv();
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), findings: keys }, null, 2) + '\n');
  console.log(`secret-scan: wrote baseline ${out} (${keys.length} findings)`);
  process.exit(0);
}

process.exit(main());
