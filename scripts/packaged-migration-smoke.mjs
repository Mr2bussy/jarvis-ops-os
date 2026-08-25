#!/usr/bin/env node
// @ts-nocheck
/**
 * Packaged safeStorage migration checklist smoke (D7).
 * Presence-only — never prints secret values.
 *
 * Exit 0 always in advisory mode (default).
 * Exit 1 when --strict and required P0 keys missing from env/.env/store.
 *
 * Usage:
 *   node scripts/packaged-migration-smoke.mjs
 *   node scripts/packaged-migration-smoke.mjs --strict
 *   node scripts/packaged-migration-smoke.mjs --config=path/to/jarvis-config.json
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const P0 = [
  'ANTHROPIC_API_KEY',
  'JARVIS_MODEL',
  'JARVIS_AGENTS_PATH',
  'COMPOSIO_API_KEY',
  'UPDATE_FEED_URL',
];

const P1 = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'IMAP_HOST', 'IMAP_USER', 'IMAP_PASSWORD'];

function parseArgs(argv) {
  let configPath = process.env.JARVIS_CONFIG_PATH || '';
  let strict = false;
  for (const a of argv) {
    if (a.startsWith('--config=')) configPath = a.slice('--config='.length);
    if (a === '--strict') strict = true;
  }
  return { configPath, strict };
}

function loadEnvKeyNames() {
  const names = new Set();
  for (const file of ['.env', '.env.local']) {
    const p = join(ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(t);
      if (m) names.add(m[1]);
    }
  }
  return names;
}

function loadStoreKeys(configPath) {
  const names = new Set();
  if (!configPath || !existsSync(configPath)) return names;
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8'));
    for (const k of Object.keys(raw || {})) {
      if (!k.endsWith('__SET_AT') && raw[k]) names.add(k);
    }
  } catch {
    /* ignore */
  }
  return names;
}

function present(key, envNames, storeNames) {
  return Boolean(process.env[key]?.trim()) || envNames.has(key) || storeNames.has(key);
}

function main() {
  const { configPath, strict } = parseArgs(process.argv.slice(2));
  const envNames = loadEnvKeyNames();
  const storeNames = loadStoreKeys(configPath);

  console.log('JARVIS packaged migration smoke (presence only)');
  console.log(`config: ${configPath || '(none — env/.env only)'}`);
  console.log('');

  const missingP0 = [];
  for (const k of P0) {
    const ok = present(k, envNames, storeNames);
    console.log(`[${ok ? 'SET    ' : 'MISSING'}] P0 ${k}`);
    if (!ok) missingP0.push(k);
  }
  for (const k of P1) {
    const ok = present(k, envNames, storeNames);
    console.log(`[${ok ? 'SET    ' : 'MISSING'}] P1 ${k}`);
  }

  // Also run connections-smoke for operator matrix (always exit 0 there).
  const conn = spawnSync(process.execPath, [join(ROOT, 'scripts/connections-smoke.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (conn.stdout) console.log('\n--- connections-smoke ---\n' + conn.stdout.trim());

  console.log('');
  console.log(
    `SUMMARY  P0 missing=${missingP0.length}  (${missingP0.join(', ') || 'none'})  strict=${strict}`,
  );
  console.log('Docs: docs/PACKAGED-SAFESTORAGE-MIGRATION.md');

  if (strict && missingP0.length) {
    console.error('packaged-migration-smoke: FAIL --strict with missing P0 keys');
    process.exit(1);
  }
  console.log('exit 0');
  process.exit(0);
}

main();
