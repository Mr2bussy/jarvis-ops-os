# Path to 9/10 — Execution Guide for the Remaining Dimensions

> Companion to `ROADMAP_9OF10.md`. This is the _precise, step-by-step_ guide for
> the dimensions still below 9, plus a clear marker of what is implemented in-repo
> vs. what is blocked on external infrastructure (a code-signing certificate, a
> clean test VM). Verification commands are listed per section.

Legend: **[IMPL]** done in this pass & verified · **[GUIDE]** documented here,
needs infra/time · **DoD** = Definition of Done (the 9/10 gate).

---

## SECURITY → 9

**DoD:** no unrestricted RCE without explicit, audited opt-in; all IPC payloads
validated; window hardened; secrets never leave main.

### S1 — Extend zod validation to every state-changing handler **[IMPL]**

Schemas live in `electron/security/ipc.ts`; wrap each handler's payload in
`validate(Schema, raw)`. Covered now: `jarvis:complete`, `jarvis:write-file`,
`jarvis:read-file-content`, `zeus:mt5`, `config:setKey`, `apps:add`,
`workflow:schedule`, `social:post-x`, `social:post-ig`.
**Verify:** `pnpm test` (schema unit tests) + `tsc -p electron/tsconfig.json --noEmit`.

### S2 — Gate `console:runCmd` behind an audited "Advanced Mode" **[IMPL]**

- Persist a boolean `ADVANCED_MODE` in the config store (off by default).
- `console:runCmd` returns `{ ok:false, err:'Advanced Mode disabled' }` unless enabled.
- Every executed command is written to the activity ring (`pushActivity('CONSOLE','EXEC',cmd)`).
- New IPC: `config:getAdvancedMode` / `config:setAdvancedMode`, exposed in preload,
  toggled from the Admin screen.
  **Verify:** unit test on the gate decision + typecheck + manual toggle in Admin.

### S3 — `sandbox: true` + navigation hardening **[IMPL]**

- Set `sandbox: true` in `webPreferences` (preload uses only `contextBridge`/
  `ipcRenderer`, so it stays compatible).
- Add a `will-navigate` handler that calls `event.preventDefault()` for any URL
  that is not the app's own origin (defense against renderer-initiated nav).
  **Verify:** `pnpm build` + a manual launch smoke-test (sandbox/nav are runtime
  behaviours; typecheck cannot prove them).

### S4 — Strict CSP in dev **[GUIDE]**

The production CSP (`script-src 'self'`) is already applied. Applying it verbatim
in dev **breaks Vite HMR** (needs `ws:`, `'unsafe-inline'`, `'unsafe-eval'`). If you
want a dev CSP, add a _separate_ dev policy:

```
"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';
 connect-src 'self' ws://localhost:5173 http://localhost:5173 http://localhost:* ...;"
```

Prod CSP is the security-relevant one and is present — dev CSP is optional polish.

### S5 — Electronegativity scan in CI **[IMPL via CI]**

`npx @doyensec/electronegativity -i .` runs in the CI workflow (non-blocking first,
then promote to blocking once findings are triaged).

---

## CODE QUALITY → 9

**DoD:** 0 ESLint errors; Prettier enforced via pre-commit; no file > 600 lines.

### C1 — ESLint (flat) + Prettier **[IMPL]**

- `eslint.config.js`: `typescript-eslint` recommended + `react-hooks`. Real-bug rules
  as **error** (`no-floating-promises` is type-aware → enabled in a scoped pass),
  style as **warn** so the legacy surface doesn't block the gate on day one.
- `.prettierrc`, scripts `lint` / `format`.
  **Verify:** `pnpm lint` runs and reports; fix errors, drive warnings down over time.

### C2 — Pre-commit hooks **[IMPL]**

`husky` + `lint-staged`: `eslint --fix` + `prettier --write` on staged TS.
**Verify:** a staged commit triggers the hook.

### C3 — Split God-files **[GUIDE]**

`TradingContent.tsx` (3372), `Workflows.tsx` (2349) have **no component tests yet**,
so a blind split risks regressions. Correct order:

1. Add React Testing Library smoke tests per screen (render + key interaction).
2. Then extract sub-components (`GodModeTab`, `ZeusTab`, `MarketDataTab`, …) behind
   the test net, one tab per commit, re-running tests each time.
   `main.ts` backend modularization is lower-risk and is already underway
   (`security/`, `ai/router.ts` extracted) — continue that split first.

---

## TESTS → 9

**DoD:** ≥ 80% lines across `src/lib` + `electron` non-UI; ≥ 1 E2E smoke.

### T1 — Extract & test pure logic **[IMPL]**

`electron/ai/router.ts` now holds `detectProviderFrom`, `compressSystem`,
`compressMsgs` (pure), imported back into `main.ts`. Unit-tested in
`electron/ai/router.test.ts`. Also testing the Advanced-Mode gate decision.

### T2 — Raise coverage breadth **[GUIDE]**

The remaining gap is `main.ts`'s IPC handlers. To test them without booting Electron,
inject `ipcMain`/`safeStorage` via a thin adapter or mock `electron` with
`vi.mock('electron', …)` and assert handler behaviour (config round-trip, provider
routing with mocked `fetch`). Expand `vitest.config.ts` `coverage.include` as modules
gain tests; raise the threshold to match.

### T3 — E2E smoke (Playwright + Electron) **[GUIDE]**

`@playwright/test` `_electron.launch({ args:['.'] })`; click each sidebar item;
assert zero `console.error`; screenshot artifact. Add as `pnpm test:e2e`.

---

## ARCHITECTURE → 9

**DoD:** no `(window as any).jarvisBridge`; typed IPC client; less prop-drilling.

### A1 — Typed IPC wrapper **[IMPL]**

`src/lib/bridge.ts` exports a typed `bridge` object + `hasBridge()` guard, wrapping
`window.jarvisBridge` with normalized errors. Renderer code imports it instead of
reaching for `window.jarvisBridge` / `as any`.
**Verify:** `tsc -p tsconfig.json` + migrate hot call-sites.

### A2 — State store (zustand) **[GUIDE]**

Replace the `App.tsx` prop-drilling (`screen`, `state`, `diag`, config flags) with a
`zustand` store (`src/store.ts`). Mechanical migration; do screen-by-screen.

---

## DOC / DX → 9

**DoD:** architecture, security model, and key decisions are documented.

### D1 — `docs/ARCHITECTURE.md`, `SECURITY.md`, `docs/adr/*` **[IMPL]**

Process diagram (main ↔ preload ↔ renderer ↔ MT5 bridge ↔ providers), the threat
model + bridge-token design, and ADRs for the load-bearing decisions.

---

## DISTRIBUTION → 9 **[GUIDE — blocked on infra]**

**DoD:** signed installer from CI; auto-update; bridge without a Python install.

- **CI** `.github/workflows/ci.yml` **[IMPL]** — runs lint + typecheck×2 + tests +
  build + electronegativity on every push (the green commands proven in this repo).
- **Signing** **[GUIDE]** — needs an Authenticode (Windows) / Apple cert. Add
  `CSC_LINK`/`CSC_KEY_PASSWORD` (or notarytool creds) as CI secrets; `release.yml`
  on tag runs `electron-builder --win --publish always`.
- **Auto-update** **[GUIDE]** — `electron-updater`, `publish: github`, check-on-start.
- **Python bridge** **[GUIDE]** — `pyinstaller --onefile bridge.py` → bundle the exe
  as `extraResources`; `spawn('bridge.exe')`. Removes the Python prerequisite.
- **Clean-VM verification** **[GUIDE]** — install the signed exe on a fresh Win VM,
  run the smoke checklist. Cannot be done in this sandbox.

---

## Verification matrix (run after each batch)

```bash
pnpm lint                                   # ESLint
npx tsc -p tsconfig.json                     # renderer types
npx tsc -p electron/tsconfig.json --noEmit   # main/preload types
pnpm test:cov                                # vitest + coverage gate
py -m pytest mt5_bridge -q                    # python bridge
pnpm build                                   # production bundle
```
