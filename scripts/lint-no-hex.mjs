#!/usr/bin/env node
// @ts-nocheck
/**
 * D8 — no raw hex color literals in src/components (tokens only).
 *
 * Scans for #RGB / #RRGGBB / #RRGGBBAA outside comments.
 * Existing offenders live in `.hex-baseline.json` (ratchet: fail on NEW only).
 *
 *   node scripts/lint-no-hex.mjs
 *   node scripts/lint-no-hex.mjs --update-baseline
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(ROOT, 'src', 'components');
const BASELINE = join(ROOT, '.hex-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

/** Strip // and /* * / comments roughly so session IDs in comments don't count. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function fingerprint(file, match, line) {
  return createHash('sha256').update(`${file}:${line}:${match}`).digest('hex').slice(0, 16);
}

function scan() {
  /** @type {{ id: string, file: string, line: number, match: string }[]} */
  const hits = [];
  for (const abs of walk(TARGET)) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/');
    const raw = readFileSync(abs, 'utf8');
    const lines = stripComments(raw).split(/\r?\n/);
    lines.forEach((line, i) => {
      // Allow CSS var() and oklch; only flag #hex
      let m;
      const re = new RegExp(HEX_RE.source, 'g');
      while ((m = re.exec(line))) {
        // Ignore pure numeric hashes that look like IDs in strings with letters only? keep all hex colors.
        hits.push({
          id: fingerprint(rel, m[0], i + 1),
          file: rel,
          line: i + 1,
          match: m[0],
        });
      }
    });
  }
  return hits;
}

function main() {
  const hits = scan();
  if (UPDATE) {
    const baseline = {
      generatedAt: new Date().toISOString(),
      note: 'Ratchet baseline for hex literals in src/components — fail on new ids only',
      ids: hits.map((h) => h.id).sort(),
      details: hits,
    };
    writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
    console.log(`lint-no-hex: wrote baseline ${hits.length} hits → .hex-baseline.json`);
    return 0;
  }

  let known = new Set();
  if (existsSync(BASELINE)) {
    try {
      const b = JSON.parse(readFileSync(BASELINE, 'utf8'));
      known = new Set(b.ids || []);
    } catch {
      console.error('lint-no-hex: corrupt .hex-baseline.json — run with --update-baseline');
      return 1;
    }
  }

  const neu = hits.filter((h) => !known.has(h.id));
  console.log(`lint-no-hex: ${hits.length} hex hits in src/components (${known.size} baselined)`);
  if (neu.length) {
    console.error(`lint-no-hex: FAIL ${neu.length} NEW hex literal(s):`);
    for (const h of neu.slice(0, 40)) {
      console.error(`  ${h.file}:${h.line}  ${h.match}`);
    }
    console.error('Use CSS variables / src/theme.ts tokens. Or --update-baseline only for intentional debt.');
    return 1;
  }
  console.log('lint-no-hex: ok (no new hex literals)');
  return 0;
}

process.exit(main());
