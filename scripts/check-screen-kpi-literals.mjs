#!/usr/bin/env node
// @ts-nocheck
/**
 * D5 complement — fails on bare agent-count / fake $ KPI literals in src/screens.
 * Mirrors honesty-report fail rules with a dedicated verify step (eslint also bans).
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const r = spawnSync(
  process.execPath,
  [resolve(ROOT, 'scripts/honesty-report.mjs'), '--fail'],
  { cwd: ROOT, stdio: 'inherit' },
);
process.exit(r.status ?? 1);
