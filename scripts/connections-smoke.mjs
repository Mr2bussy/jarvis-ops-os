#!/usr/bin/env node
// @ts-nocheck
/**
 * connections-smoke.mjs
 *
 * Reports which Admin → Connections keys / OAuth slots are present without
 * printing secret values.
 *
 * Sources (presence only):
 *   1. process.env
 *   2. project .env / .env.local key names (never values)
 *   3. optional jarvis-config.json path via JARVIS_CONFIG_PATH or --config=
 *
 * Usage:
 *   node scripts/connections-smoke.mjs
 *   node scripts/connections-smoke.mjs --config=%APPDATA%/jarvis-ops-os/jarvis-config.json
 *   node scripts/connections-smoke.mjs --packaged-checklist   # P0 safeStorage migration
 *   node scripts/connections-smoke.mjs --packaged-checklist --strict  # exit 1 if P0 missing
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Packaged migration P0 — docs/PACKAGED-SAFESTORAGE-MIGRATION.md */
const PACKAGED_P0 = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'JARVIS_MODEL',
  'JARVIS_AGENTS_PATH',
  'COMPOSIO_API_KEY',
  'UPDATE_FEED_URL',
];

/** Mirrors src/data/admin-connections.ts — keep in sync when adding keys. */
const CONNECTIONS = [
  { id: 'composio', label: 'Composio API', keys: ['COMPOSIO_API_KEY'], group: 'shop' },
  { id: 'composio-github', label: 'GitHub OAuth (Composio)', keys: [], oauth: 'github', group: 'shop' },
  { id: 'composio-shopify', label: 'Shopify OAuth (Composio)', keys: [], oauth: 'shopify', group: 'shop' },
  { id: 'composio-gmail', label: 'Gmail OAuth (Composio)', keys: [], oauth: 'gmail', group: 'shop' },
  {
    id: 'social-yt',
    label: 'YouTube',
    keys: ['YOUTUBE_API_KEY', 'YOUTUBE_CHANNEL_ID'],
    aliases: { YOUTUBE_API_KEY: ['YT_API_KEY'] },
    group: 'social',
  },
  {
    id: 'social-ig',
    label: 'Instagram',
    keys: ['INSTAGRAM_TOKEN', 'INSTAGRAM_USER_ID'],
    aliases: { INSTAGRAM_TOKEN: ['IG_ACCESS_TOKEN'], INSTAGRAM_USER_ID: ['IG_USER_ID'] },
    group: 'social',
  },
  {
    id: 'social-tt',
    label: 'TikTok',
    keys: ['TIKTOK_TOKEN'],
    aliases: { TIKTOK_TOKEN: ['TT_ACCESS_TOKEN'] },
    group: 'social',
  },
  {
    id: 'social-x',
    label: 'X / Twitter',
    keys: [
      'TWITTER_BEARER_TOKEN',
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET',
    ],
    aliases: { TWITTER_BEARER_TOKEN: ['X_BEARER_TOKEN'] },
    group: 'social',
  },
  {
    id: 'social-li',
    label: 'LinkedIn',
    keys: ['LINKEDIN_TOKEN', 'LINKEDIN_ORG_URN'],
    aliases: { LINKEDIN_TOKEN: ['LI_ACCESS_TOKEN'], LINKEDIN_ORG_URN: ['LI_ORG_ID'] },
    group: 'social',
  },
  { id: 'social-tw', label: 'Twitch (content TW)', keys: ['TWITCH_TOKEN'], group: 'social' },
];

function parseArgs(argv) {
  let configPath = process.env.JARVIS_CONFIG_PATH || '';
  let packagedChecklist = false;
  let strict = false;
  for (const a of argv) {
    if (a.startsWith('--config=')) configPath = a.slice('--config='.length);
    if (a === '--packaged-checklist' || a === '--packaged') packagedChecklist = true;
    if (a === '--strict') strict = true;
  }
  if (process.env.PACKAGED_CHECKLIST === '1') packagedChecklist = true;
  if (process.env.CONNECTIONS_SMOKE_STRICT === '1') strict = true;
  return { configPath, packagedChecklist, strict };
}

/** Collect key names from dotenv-style files — names only. */
function loadEnvKeyNames() {
  const names = new Set();
  for (const file of ['.env', '.env.local', '.env.development']) {
    const p = join(ROOT, file);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(t);
      if (m) names.add(m[1]);
    }
  }
  return names;
}

/** Key names present in encrypted store (values never read). */
function loadStoreKeyNames(configPath) {
  const names = new Set();
  if (!configPath || !existsSync(configPath)) return names;
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const k of Object.keys(raw)) {
        if (k.endsWith('__SET_AT')) continue;
        if (raw[k]) names.add(k);
      }
    }
  } catch {
    /* ignore malformed */
  }
  return names;
}

function isPresent(key, aliases, envNames, storeNames) {
  const candidates = [key, ...(aliases?.[key] ?? [])];
  for (const n of candidates) {
    if (process.env[n]?.trim()) return true;
    if (envNames.has(n)) return true;
    if (storeNames.has(n)) return true;
  }
  return false;
}

function main() {
  const { configPath, packagedChecklist, strict } = parseArgs(process.argv.slice(2));
  const envNames = loadEnvKeyNames();
  const storeNames = loadStoreKeyNames(configPath);

  /** @type {{ id: string, label: string, group: string, status: string, detail: string }[]} */
  const rows = [];

  for (const c of CONNECTIONS) {
    if (c.oauth) {
      const composioOk = isPresent('COMPOSIO_API_KEY', undefined, envNames, storeNames);
      rows.push({
        id: c.id,
        label: c.label,
        group: c.group,
        status: composioOk ? 'key-ready' : 'missing',
        detail: composioOk
          ? `COMPOSIO_API_KEY set · OAuth toolkit "${c.oauth}" needs linked account in-app`
          : 'COMPOSIO_API_KEY missing — Admin → Connections',
      });
      continue;
    }

    const present = [];
    const missing = [];
    for (const k of c.keys) {
      if (isPresent(k, c.aliases, envNames, storeNames)) present.push(k);
      else missing.push(k);
    }
    let status = 'missing';
    if (present.length === c.keys.length) status = 'set';
    else if (present.length > 0) status = 'partial';
    rows.push({
      id: c.id,
      label: c.label,
      group: c.group,
      status,
      detail:
        status === 'set'
          ? `${present.length}/${c.keys.length} keys present`
          : status === 'partial'
            ? `present: ${present.join(', ') || '—'} · missing: ${missing.join(', ')}`
            : `missing: ${missing.join(', ')}`,
    });
  }

  const set = rows.filter((r) => r.status === 'set' || r.status === 'key-ready').length;
  const partial = rows.filter((r) => r.status === 'partial').length;
  const missing = rows.filter((r) => r.status === 'missing').length;

  console.log('JARVIS connections smoke (presence only — secrets never printed)');
  console.log(`config: ${configPath || '(none — env/.env only)'}`);
  console.log('');
  for (const r of rows) {
    const pad = r.status.padEnd(9);
    console.log(`[${pad}] ${r.id.padEnd(20)} ${r.label} — ${r.detail}`);
  }
  console.log('');
  console.log(`SUMMARY  set/ready=${set}  partial=${partial}  missing=${missing}  total=${rows.length}`);

  let packagedFail = false;
  if (packagedChecklist) {
    console.log('');
    console.log('PACKAGED P0 checklist (safeStorage migration):');
    const miss = [];
    for (const key of PACKAGED_P0) {
      const ok = isPresent(key, undefined, envNames, storeNames);
      console.log(`  [${ok ? 'ok' : 'MISSING'}] ${key}`);
      if (!ok) miss.push(key);
    }
    console.log(`PACKAGED P0 missing=${miss.length}/${PACKAGED_P0.length}`);
    if (miss.length && strict) {
      packagedFail = true;
      console.error('STRICT: packaged P0 keys missing — migrate via Admin → Connections before ship');
    }
  }

  console.log('100% live still needs Zac: real API keys + Composio OAuth linked accounts — see docs/ADMIN-CONNECTIONS.md');
  if (packagedFail) process.exit(1);
  console.log('exit 0');
  process.exit(0);
}

main();
