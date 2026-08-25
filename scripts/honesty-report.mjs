#!/usr/bin/env node
// @ts-nocheck
/**
 * honesty-report.mjs (D5) — fails verify on bare suspicious KPI literals in src/screens/**
 *
 * FAIL rules (exit 1 with --fail / when HONESTY_FAIL=1):
 *   - fabricated-money ($1,234 style amounts)
 *   - bare-agent-count-literal (e.g. "189 agents")
 *   - AGENT_COUNT used as JSX text child without Value/catalog wrapper heuristics
 *
 * Advisory rules still listed but do not fail the gate.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS = resolve(ROOT, 'src/screens');
const FAIL = process.argv.includes('--fail') || process.env.HONESTY_FAIL === '1';

/** @type {{ id: string, re: RegExp, why: string, severity: 'fail' | 'warn' }[]} */
const RULES = [
  {
    id: 'bare-agent-count-literal',
    re: /\b(1[0-9]{2,3}|[2-9][0-9]{2,3})\s*(agents?|AGENTS)\b/g,
    why: 'Large numeric agent count literal — prefer vault-measured Sourced value',
    severity: 'fail',
  },
  {
    id: 'jsx-agent-count-raw',
    re: />\s*\{?\s*AGENT_COUNT\s*\}?\s*</g,
    why: 'AGENT_COUNT rendered raw in JSX — wrap with catalog()/measured() + <Value>',
    severity: 'fail',
  },
  {
    id: 'fabricated-money',
    re: /\$\s?\d{1,3}(,\d{3})+(\.\d+)?/g,
    why: 'Currency amount literal — confirm measured vs demo (mark DEMO or use Sourced)',
    severity: 'fail',
  },
  {
    id: 'catalog-agent-count-import',
    re: /\bAGENT_COUNT\b/g,
    why: 'AGENT_COUNT import/use — OK if labeled catalog via Sourced',
    severity: 'warn',
  },
  {
    id: 'hardcoded-kpi-percent',
    re: /\b(9[0-9]|100)%\b/g,
    why: 'High percent literal in screen — may be decorative/fake KPI',
    severity: 'warn',
  },
  {
    id: 'em-dash-as-metric',
    re: /['"`]—['"`]|['"`]–['"`]|['"`]N\/A['"`]/g,
    why: 'Placeholder metric glyph — OK if labeled none; flag for review',
    severity: 'warn',
  },
];

/** Allowlist: demo/catalog files where fabricated money is intentional & labeled. */
const ALLOW_FABRICATED_MONEY = new Set([
  'src/screens/admin/admin-data.ts', // LLM list prices are catalog quotes
  'src/screens/Admin.tsx',
]);

/** @param {string} dir @param {string[]} out */
function walkTsx(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsx(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

function main() {
  if (!statSync(SCREENS, { throwIfNoEntry: false })?.isDirectory()) {
    console.error('honesty-report: missing src/screens');
    return 1;
  }

  const files = walkTsx(SCREENS);
  /** @type {{ file: string, line: number, id: string, match: string, why: string, severity: string }[]} */
  const findings = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    const rel = relative(ROOT, file).replace(/\\/g, '/');

    for (const rule of RULES) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (rule.id === 'hardcoded-kpi-percent' && /^\s*import\b/.test(line)) continue;
        if (rule.id === 'fabricated-money' && /^\s*import\b/.test(line)) continue;
        if (rule.id === 'em-dash-as-metric' && /^\s*\/\//.test(line)) continue;
        if (rule.id === 'fabricated-money' && /DEMO|catalog|inputCost|outputCost|Simulated/i.test(line)) continue;
        // Multi-line DEMO widgets: skip if any of the prior 3 lines mark DEMO
        if (rule.id === 'fabricated-money' && i > 0) {
          const prev = lines.slice(Math.max(0, i - 3), i).join('\n');
          if (/DEMO|Simulated metrics/i.test(prev)) continue;
        }
        if (rule.id === 'fabricated-money' && ALLOW_FABRICATED_MONEY.has(rel)) continue;
        // Sourced/Value lines are honest
        if (rule.severity === 'fail' && /measured\(|catalog\(|none\(|<Value\b/.test(line)) continue;

        rule.re.lastIndex = 0;
        let m;
        while ((m = rule.re.exec(line))) {
          findings.push({
            file: rel,
            line: i + 1,
            id: rule.id,
            match: m[0].slice(0, 60),
            why: rule.why,
            severity: rule.severity,
          });
        }
      }
    }
  }

  const fails = findings.filter((f) => f.severity === 'fail');
  const warns = findings.filter((f) => f.severity === 'warn');

  console.log(`honesty-report: scanned ${files.length} screen files`);
  console.log(`honesty-report: ${fails.length} FAIL · ${warns.length} warn\n`);

  const byId = new Map();
  for (const f of findings) {
    if (!byId.has(f.id)) byId.set(f.id, []);
    byId.get(f.id).push(f);
  }

  for (const [id, rows] of [...byId.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sev = rows[0].severity;
    console.log(`## ${id} [${sev}] (${rows.length})`);
    console.log(`   ${rows[0].why}`);
    const shown = rows.slice(0, 10);
    for (const r of shown) {
      console.log(`   ${r.file}:${r.line}  ${JSON.stringify(r.match)}`);
    }
    if (rows.length > shown.length) console.log(`   … +${rows.length - shown.length} more`);
    console.log('');
  }

  if (FAIL && fails.length > 0) {
    console.error(`honesty-report: FAIL — ${fails.length} blocking finding(s)`);
    return 1;
  }
  if (fails.length === 0) {
    console.log('honesty-report: no blocking findings');
  }
  return 0;
}

process.exit(main());
