// @ts-nocheck
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

/**
 * Builds the artefacts the E2E suite launches.
 *
 * The specs run `electron .`, which resolves `main` → `dist-electron/main.js` and
 * loads `dist/index.html`. Testing a stale `dist/` would mean asserting on code
 * that no longer exists in `src/`, so both halves are rebuilt here rather than
 * being assumed to be current.
 *
 * The binaries are invoked through `process.execPath` (the Node that is already
 * running the test) instead of a shell: no dependency on pnpm/npx being on PATH,
 * no shell quoting of the repo path — which on this machine contains spaces.
 */
function run(label: string, scriptRelPath: string, args: string[]): void {
  const script = path.join(repoRoot, scriptRelPath);
  if (!fs.existsSync(script)) {
    throw new Error(`[e2e] cannot build: ${scriptRelPath} is missing — run \`pnpm install\` first.`);
  }
  const started = Date.now();
  process.stdout.write(`[e2e] ${label}\n`);
  execFileSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    // A cold TypeScript + Vite build behind a virus scanner is slow, but it is
    // not "hung" — fail only after 15 minutes.
    timeout: 15 * 60_000,
  });
  process.stdout.write(`[e2e] ${label} done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
}

export default function globalSetup(): void {
  // Escape hatch while iterating on the specs themselves. Opt-in only: a run that
  // silently skipped the build could report green for code that was never built.
  if (process.env.JARVIS_E2E_SKIP_BUILD === '1' || process.env.JARVIS_E2E_STUB === '1') {
    process.stdout.write(
      `[e2e] skip build (${process.env.JARVIS_E2E_STUB === '1' ? 'JARVIS_E2E_STUB' : 'JARVIS_E2E_SKIP_BUILD'}=1)\n`,
    );
    return;
  }

  run('building main process (tsc -p electron/tsconfig.json)', 'node_modules/typescript/bin/tsc', [
    '-p',
    'electron/tsconfig.json',
  ]);
  run('building renderer (vite build)', 'node_modules/vite/bin/vite.js', ['build']);

  for (const artefact of ['dist-electron/main.js', 'dist/index.html']) {
    if (!fs.existsSync(path.join(repoRoot, artefact))) {
      throw new Error(`[e2e] build finished but ${artefact} is missing`);
    }
  }
}
