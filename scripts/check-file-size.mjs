#!/usr/bin/env node
// @ts-nocheck
/**
 * File size budget gate (D6) — checks watched monolith paths against documented ceilings.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_PATH = resolve(ROOT, '.file-size-budget.json');

function countLines(file) {
  return readFileSync(file, 'utf8').split(/\r?\n/).length;
}

function main() {
  if (!existsSync(BUDGET_PATH)) {
    console.error('check-file-size: missing .file-size-budget.json');
    return 1;
  }
  const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf8'));
  const defaultMax = budget.maxLines ?? 600;
  const watch = budget.watch ?? [];
  const excepted = new Map((budget.exceptions ?? []).map((e) => [e.path.replace(/\\/g, '/'), e]));

  const violations = [];

  for (const relPath of watch) {
    const rel = relPath.replace(/\\/g, '/');
    const abs = resolve(ROOT, rel);
    if (!existsSync(abs)) {
      violations.push({ rel, lines: 0, reason: 'watched file missing' });
      continue;
    }
    const lines = countLines(abs);
    const ex = excepted.get(rel);
    const ceiling = ex?.maxLines ?? defaultMax;
    if (lines > ceiling) {
      violations.push({
        rel,
        lines,
        reason: ex
          ? `exceeds documented exception ceiling (${ceiling})`
          : `exceeds default max (${defaultMax}) — add to .file-size-budget.json exceptions or split`,
      });
    }
  }

  if (violations.length) {
    console.error('check-file-size: budget violations:');
    for (const v of violations) console.error(`  ${v.rel}: ${v.lines} lines — ${v.reason}`);
    return 1;
  }

  const summary = watch
    .map((p) => {
      const rel = p.replace(/\\/g, '/');
      const lines = countLines(resolve(ROOT, rel));
      const ex = excepted.get(rel);
      const ceiling = ex?.maxLines ?? defaultMax;
      return `${rel} (${lines}/${ceiling})`;
    })
    .join(', ');
  console.log(`check-file-size: ok — watch list within budget: ${summary}`);
  return 0;
}

process.exit(main());
