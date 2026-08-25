#!/usr/bin/env node
// @ts-nocheck
/**
 * pnpm verify — chains Sperrklinken; heavy e2e only when VERIFY_E2E=1.
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
  console.log(`\n── verify: ${label} ──`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true });
  const code = r.status ?? 1;
  if (code !== 0) {
    if (opts.optional) {
      console.warn(`verify: optional step failed (${label}) — continuing`);
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
      run('doctor --self-test', 'node', ['scripts/doctor.mjs', '--self-test'], {
        requiredFile: 'scripts/doctor.mjs',
      }),
    () =>
      run(
        'scan-secrets --fail-on-new',
        'node',
        ['scripts/scan-secrets.mjs', '--all', '--fail-on-new'],
        { requiredFile: 'scripts/scan-secrets.mjs' },
      ),
    () =>
      run('audit-gate (high/critical)', 'node', ['scripts/audit-gate.mjs'], {
        requiredFile: 'scripts/audit-gate.mjs',
      }),
    () => run('eslint', 'pnpm', ['exec', 'eslint', '.', '--max-warnings=9999']),
    () =>
      run('lint:hex-components', 'node', ['scripts/lint-no-hex.mjs'], {
        requiredFile: 'scripts/lint-no-hex.mjs',
      }),
    () => run('tsc renderer', 'pnpm', ['exec', 'tsc', '-p', 'tsconfig.json', '--noEmit']),
    () => run('tsc electron', 'pnpm', ['exec', 'tsc', '-p', 'electron/tsconfig.json', '--noEmit']),
    () =>
      run('gen:ipc --check', 'node', ['scripts/gen-ipc.mjs', '--check'], {
        requiredFile: 'scripts/gen-ipc.mjs',
      }),
    () =>
      run('test:security', 'pnpm', ['test:security'], {
        requiredFile: 'electron/security/threat-model.test.ts',
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
    () =>
      run('honesty-report --fail', 'node', ['scripts/honesty-report.mjs', '--fail'], {
        requiredFile: 'scripts/honesty-report.mjs',
      }),
    () => runEvalOptional(),
    () =>
      run('packaged-migration-smoke', 'node', ['scripts/packaged-migration-smoke.mjs'], {
        requiredFile: 'scripts/packaged-migration-smoke.mjs',
        optional: true,
      }),
    () =>
      run('connections-smoke (packaged checklist)', 'node', ['scripts/connections-smoke.mjs', '--packaged-checklist'], {
        requiredFile: 'scripts/connections-smoke.mjs',
        optional: true,
      }),
    () =>
      run('check-voice-slo (optional)', 'node', ['scripts/check-voice-slo.mjs'], {
        requiredFile: 'scripts/check-voice-slo.mjs',
        optional: true,
      }),
    () => runPlaywrightGate(),
  ];

  for (const step of steps) {
    const code = step();
    if (code !== 0) process.exit(code);
  }
  console.log('\nverify: all required gates green');
  return 0;
}

/**
 * Playwright:
 * - Default SKIP
 * - VERIFY_E2E=1 → golden-five stubs (JARVIS_E2E_STUB=1 default) blocking
 * - JARVIS_E2E_STUB=0 → full playwright suite (needs Electron host)
 */
function runPlaywrightGate() {
  if (process.env.SKIP_E2E === '1' || process.env.VERIFY_SKIP_E2E === '1') {
    console.log('verify: SKIP playwright (SKIP_E2E / VERIFY_SKIP_E2E)');
    return 0;
  }
  if (process.env.VERIFY_E2E !== '1') {
    console.log(
      'verify: SKIP playwright (set VERIFY_E2E=1; stubs via JARVIS_E2E_STUB=1)',
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
  const stub = process.env.JARVIS_E2E_STUB !== '0';
  if (stub) {
    console.log('\n── verify: playwright golden-five stubs (JARVIS_E2E_STUB=1) ──');
    const r = spawnSync(
      'pnpm',
      ['exec', 'playwright', 'test', 'e2e/golden-five-flows.spec.ts'],
      {
        cwd: ROOT,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, JARVIS_E2E_STUB: '1' },
      },
    );
    const code = r.status ?? 1;
    if (code !== 0) console.error(`verify: FAILED at playwright stubs (exit ${code})`);
    return code;
  }
  if (!existsSync(resolve(ROOT, 'node_modules/electron'))) {
    console.log('verify: SKIP full playwright (electron package missing)');
    return 0;
  }
  return run('playwright e2e (VERIFY_E2E=1 full)', 'pnpm', ['exec', 'playwright', 'test'], {
    optional: false,
  });
}

function runEvalOptional() {
  if (process.env.VERIFY_EVAL !== '1') {
    console.log('verify: SKIP eval-score-gate (set VERIFY_EVAL=1 to run)');
    return 0;
  }
  return run('eval-score-gate', 'node', ['scripts/eval-score-gate.mjs'], {
    requiredFile: 'scripts/eval-score-gate.mjs',
  });
}

process.exit(main());
