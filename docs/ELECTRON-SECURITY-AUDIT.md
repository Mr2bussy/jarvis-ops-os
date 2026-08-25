# Electronegativity / Electron security audit (D2)

## Intent

PLAN 12 asks for **blocking** `electronegativity` (or equivalent) in CI/verify.

## What ships

1. **`scripts/electron-security-audit.mjs`** — **blocking** in `pnpm verify` and `.github/workflows/ci.yml`.
   - Static scan of `electron/**` for `nodeIntegration: true`, `contextIsolation: false`, `sandbox: false`, `enableRemoteModule`, `webviewTag: true`.
   - CSP module must keep `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, and must not introduce bare `'unsafe-eval'`.
   - Allowlist: `.electronegativity-allow.json` (empty by default).
2. **Optional** `@doyensec/electronegativity` — if installable and the CLI launches, HIGH findings must be allowlisted. On this Windows workspace the CLI fails to spawn (path/`C:\Program` quoting); the static gate remains the required lock.

## Why not only electronegativity

The Doyensec CLI is not reliably runnable here; a substitute that **fails the build** on Electron security anti-patterns is the honest D2=12 tooth.
