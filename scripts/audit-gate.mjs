#!/usr/bin/env node
// @ts-nocheck
/**
 * D2 audit gate — `pnpm audit --audit-level=high` must be clean OR every
 * remaining high/critical advisory must be listed in `.audit-exceptions.json`
 * (documented in docs/AUDIT-EXCEPTIONS.md).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXCEPTIONS = resolve(ROOT, '.audit-exceptions.json');

function loadAccepted() {
  if (!existsSync(EXCEPTIONS)) {
    console.error('audit-gate: missing .audit-exceptions.json');
    process.exit(2);
  }
  const j = JSON.parse(readFileSync(EXCEPTIONS, 'utf8'));
  return new Set((j.acceptedAdvisoryIds || []).map(String));
}

function main() {
  const accepted = loadAccepted();
  const r = spawnSync('pnpm', ['audit', '--audit-level=high', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 32 * 1024 * 1024,
  });

  let report;
  try {
    report = JSON.parse(r.stdout || '{}');
  } catch (e) {
    console.error('audit-gate: could not parse pnpm audit JSON');
    console.error(r.stderr || r.stdout);
    process.exit(2);
  }

  const advisories = report.advisories || {};
  const blocking = [];
  const waived = [];

  for (const [id, adv] of Object.entries(advisories)) {
    const sev = String(adv.severity || '').toLowerCase();
    if (sev !== 'high' && sev !== 'critical') continue;
    const row = {
      id: String(id),
      severity: sev,
      module: adv.module_name || adv.name || '?',
      title: adv.title || '',
    };
    if (accepted.has(String(id))) waived.push(row);
    else blocking.push(row);
  }

  console.log(
    `audit-gate: high/critical=${waived.length + blocking.length} waived=${waived.length} blocking=${blocking.length}`,
  );
  if (blocking.length) {
    console.error('\naudit-gate: FAILED — undocumented high/critical advisories:\n');
    for (const b of blocking) {
      console.error(`  ✗ [${b.severity}] ${b.id} ${b.module} — ${b.title}`);
    }
    console.error(
      '\n  Fix the dependency, or document the ID in docs/AUDIT-EXCEPTIONS.md + .audit-exceptions.json',
    );
    process.exit(1);
  }

  console.log('audit-gate: ok (no undocumented high/critical)');
  return 0;
}

process.exit(main());
