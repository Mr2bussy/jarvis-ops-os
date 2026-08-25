#!/usr/bin/env node
// @ts-nocheck
/**
 * Electron security audit gate (D2) — blocking substitute for electronegativity
 * when the Doyensec CLI is unavailable or too noisy to promote wholesale.
 *
 * Checks (fail on HIGH):
 *   - nodeIntegration: true / contextIsolation: false / sandbox: false in electron/**
 *   - enableRemoteModule / webviewTag: true
 *   - CSP module must deny unsafe-eval and lock object-src/base-uri/frame-ancestors
 *   - If @doyensec/electronegativity is installed: run it at severity=high and
 *     fail on any finding not listed in .electronegativity-allow.json
 *
 * Wire: pnpm verify + CI (no `|| true`).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOW_PATH = resolve(ROOT, '.electronegativity-allow.json');

/** @param {string} dir @param {string[]} out */
function walkTs(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'dist-electron') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTs(p, out);
    else if (/\.(ts|js|mjs|cjs)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

function staticElectronAudit() {
  /** @type {{ file: string, line: number, id: string, match: string }[]} */
  const findings = [];
  const files = walkTs(resolve(ROOT, 'electron'));
  const rules = [
    { id: 'nodeIntegration-true', re: /nodeIntegration\s*:\s*true\b/g },
    { id: 'contextIsolation-false', re: /contextIsolation\s*:\s*false\b/g },
    { id: 'sandbox-false', re: /sandbox\s*:\s*false\b/g },
    { id: 'enableRemoteModule-true', re: /enableRemoteModule\s*:\s*true\b/g },
    { id: 'webviewTag-true', re: /webviewTag\s*:\s*true\b/g },
  ];

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (rel.includes('/security/') && rel.endsWith('.test.ts')) continue;
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;
      for (const rule of rules) {
        rule.re.lastIndex = 0;
        if (rule.re.test(line)) {
          findings.push({ file: rel, line: i + 1, id: rule.id, match: line.trim().slice(0, 80) });
        }
      }
    }
  }
  return findings;
}

function cspModuleAudit() {
  const cspPath = resolve(ROOT, 'electron/security/csp.ts');
  /** @type {string[]} */
  const errs = [];
  if (!existsSync(cspPath)) {
    errs.push('missing electron/security/csp.ts');
    return errs;
  }
  const src = readFileSync(cspPath, 'utf8');
  if (/unsafe-eval/.test(src) && !/'wasm-unsafe-eval'/.test(src)) {
    // bare unsafe-eval without wasm-only form
  }
  if (src.includes("'unsafe-eval'") && !src.includes("'wasm-unsafe-eval'")) {
    errs.push("csp.ts mentions 'unsafe-eval' without wasm-only form");
  }
  // Ensure production buildCsp denies classic XSS footguns (string presence)
  for (const needle of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"]) {
    if (!src.includes(needle)) errs.push(`csp.ts missing required directive fragment: ${needle}`);
  }
  if (!src.includes("script-src 'self'")) {
    errs.push("csp.ts must constrain script-src to 'self'");
  }
  return errs;
}

function loadAllow() {
  if (!existsSync(ALLOW_PATH)) return { findings: [] };
  try {
    return JSON.parse(readFileSync(ALLOW_PATH, 'utf8'));
  } catch {
    return { findings: [] };
  }
}

function runElectronegativityIfPresent() {
  const pkgRoot = resolve(ROOT, 'node_modules/@doyensec/electronegativity');
  if (!existsSync(pkgRoot)) {
    console.log(
      'electron-security-audit: @doyensec/electronegativity not installed — static CSP/webPreferences gate is the blocking substitute (documented).',
    );
    return { skipped: true, findings: [] };
  }

  // Prefer pnpm exec so Windows paths with spaces do not break spawn.
  const r = spawnSync('pnpm', ['exec', 'electronegativity', '-i', '.', '-s', 'high', '-r'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    timeout: 180_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (/nicht gefunden|not recognized|ENOENT|is either misspelled/i.test(out) && (r.status ?? 1) !== 0) {
    console.log(
      'electron-security-audit: electronegativity CLI failed to launch (path/tooling) — static gate remains blocking substitute.',
    );
    return { skipped: true, findings: [], launchError: out.slice(0, 500) };
  }
  const lines = out.split(/\r?\n/).filter((l) => /\bHIGH\b/i.test(l) || /\bCRITICAL\b/i.test(l));
  return { skipped: false, exit: r.status ?? 1, raw: out.slice(0, 4000), highLines: lines };
}

function main() {
  const staticFindings = staticElectronAudit();
  const cspErrs = cspModuleAudit();
  const allow = loadAllow();
  const allowed = new Set((allow.findings || []).map((f) => `${f.id}|${f.file}|${f.line || ''}`));

  const blockingStatic = staticFindings.filter((f) => !allowed.has(`${f.id}|${f.file}|${f.line}`));

  let failed = false;

  if (cspErrs.length) {
    failed = true;
    console.error('electron-security-audit: CSP module failures:');
    for (const e of cspErrs) console.error(`  - ${e}`);
  }

  if (blockingStatic.length) {
    failed = true;
    console.error('electron-security-audit: dangerous webPreferences / Electron API findings:');
    for (const f of blockingStatic) {
      console.error(`  ${f.file}:${f.line} [${f.id}] ${f.match}`);
    }
  } else {
    console.log(
      `electron-security-audit: static webPreferences ok (${staticFindings.length} raw, ${staticFindings.length - blockingStatic.length} allowed)`,
    );
  }

  const en = runElectronegativityIfPresent();
  if (!en.skipped) {
    const allowIds = new Set((allow.electronegativity || []).map((x) => String(x)));
    const novel = (en.highLines || []).filter((l) => ![...allowIds].some((id) => l.includes(id)));
    if (novel.length || (en.exit !== 0 && novel.length === 0 && (en.highLines || []).length === 0 && en.exit !== 0)) {
      // If exit non-zero with high lines not all allowed → fail
      if (novel.length) {
        failed = true;
        console.error('electron-security-audit: electronegativity HIGH findings not in allowlist:');
        for (const l of novel.slice(0, 40)) console.error(`  ${l}`);
      } else if (en.exit !== 0 && (en.highLines || []).length === 0) {
        // tool crashed — fail closed unless allow.toolErrors
        if (!allow.ignoreToolErrors) {
          failed = true;
          console.error('electron-security-audit: electronegativity exited non-zero with no parseable HIGH lines');
          console.error(en.raw?.slice(0, 1500));
        }
      }
    } else {
      console.log('electron-security-audit: electronegativity HIGH findings within allowlist (or clean)');
    }
  }

  // Prove lock file exists for CI documentation tooth
  if (!existsSync(ALLOW_PATH)) {
    writeFileSync(
      ALLOW_PATH,
      `${JSON.stringify(
        {
          note: 'Allowlisted findings for electron-security-audit / electronegativity. Empty = fail on any HIGH static hit.',
          findings: [],
          electronegativity: [],
          ignoreToolErrors: false,
        },
        null,
        2,
      )}\n`,
    );
  }

  if (failed) {
    console.error('electron-security-audit: FAILED');
    return 1;
  }
  console.log('electron-security-audit: ok (blocking)');
  return 0;
}

process.exit(main());
