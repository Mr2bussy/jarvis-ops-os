#!/usr/bin/env node
// @ts-nocheck
/**
 * pnpm verify ÔÇö chains the Sperrklinken that exist; skips missing tools with a clear note.
 * Fails hard on doctor / secrets / tsc / gen:ipc --check / unit tests when those files exist.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} label
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ optional?: boolean, requiredFile?: string }} [opts]
 */
function run(label, cmd, args, opts = {}) {
  if (opts.requiredFile && !existsSync(resolve(ROOT, opts.requiredFile))) {
    console.log(`verify: SKIP ${label} (missing ${opts.requiredFile})`);
    return 0;
  }
  console.log(`\nÔöÇÔöÇ verify: ${label} ÔöÇÔöÇ`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true });
  const code = r.status ?? 1;
  if (code !== 0) {
    if (opts.optional) {
      console.warn(`verify: optional step failed (${label}) ÔÇö continuing`);
      return 0;
    }
    console.error(`verify: FAILED at ${label} (exit ${code})`);
  }
  return code;
}

function main() {
  const steps = [
    () => run('doctor --tree', 'node', ['scripts/doctor.mjs', '--tree'], { requiredFile: 'scripts/doctor.mjs' }),
    () =>
      run(
        'scan-secrets --fail-on-new',
        'node',
        ['scripts/scan-secrets.mjs', '--all', '--fail-on-new'],
        { requiredFile: 'scripts/scan-secrets.mjs' },
      ),
    () => run('eslint', 'pnpm', ['exec', 'eslint', '.', '--max-warnings=9999']),
    () => run('tsc renderer', 'pnpm', ['exec', 'tsc', '-p', 'tsconfig.json', '--noEmit']),
    () => run('tsc electron', 'pnpm', ['exec', 'tsc', '-p', 'electron/tsconfig.json', '--noEmit']),
    () =>
      run('gen:ipc --check', 'node', ['scripts/gen-ipc.mjs', '--check'], {
        requiredFile: 'scripts/gen-ipc.mjs',
      }),
    () => run('vitest + coverage', 'pnpm', ['test:cov']),
    () =>
      run('coverage-ratchet', 'node', ['scripts/coverage-ratchet.mjs'], {
        requiredFile: 'scripts/coverage-ratchet.mjs',
      }),
    () =>
      run('depcruise', 'pnpm', ['depcruise'], {
        requiredFile: '.dependency-cruiser.cjs',
      }),
    () =>
      run('check-file-size', 'node', ['scripts/check-file-size.mjs'], {
        requiredFile: 'scripts/check-file-size.mjs',
      }),
    () => runPlaywrightOptional(),
  ];

  for (const step of steps) {
    const code = step();
    if (code !== 0) process.exit(code);
  }
  console.log('\nverify: all required gates green');
  return 0;
}

/**
 * Playwright is optional in verify:
 * - Default SKIP (Electron e2e is slow; set VERIFY_E2E=1 to run)
 * - Also skip when SKIP_E2E / package / electron missing
 * - Failures never fail verify (optional: true)
 */
function runPlaywrightOptional() {
  if (process.env.SKIP_E2E === '1' || process.env.VERIFY_SKIP_E2E === '1') {
    console.log('verify: SKIP playwright (SKIP_E2E / VERIFY_SKIP_E2E)');
    return 0;
  }
  if (process.env.VERIFY_E2E !== '1') {
    console.log(
      'verify: SKIP playwright (set VERIFY_E2E=1 to run optional Electron e2e gate)',
    );
    return 0;
  }
  if (!existsSync(resolve(ROOT, 'playwright.config.ts'))) {
    console.log('verify: SKIP playwright (missing playwright.config.ts)');
    return 0;
  }
  if (!existsSync(resolve(ROOT, 'node_modules/@playwright/test'))) {
    console.log('verify: SKIP playwright (package not installed)');
    return 0;
  }
  if (!existsSync(resolve(ROOT, 'node_modules/electron'))) {
    console.log('verify: SKIP playwright (electron package missing ÔÇö no browser host)');
    return 0;
  }
  return run('playwright e2e (optional)', 'pnpm', ['exec', 'playwright', 'test'], {
    optional: true,
  });
}

process.exit(main());
