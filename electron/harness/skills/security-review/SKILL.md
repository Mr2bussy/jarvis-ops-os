---
name: security-review
description: JARVIS security checklist for auth, IPC, secrets, HITL, trading, and shell. Aligns with AGENTS.md IMMUTABLE invariants.
triggers: security, auth, secret, xss, injection, csp, hitl, allowlist, owasp, credential, mt5 token
origin: ECC/adapted
---

# Security Review (JARVIS)

Use when changing auth, IPC, file paths, shell, browser automation, Composio execute, or trading bridges.

## IMMUTABLE invariants (never weaken)

1. Renderer never holds secrets — privileged IO via `contextBridge` only.
2. File IPC paths must pass `isPathInRoots`.
3. `console:runCmd` / `apps:launch` kind `cmd` require Advanced Mode + audit.
4. MT5 only from main process with `X-JARVIS-Token`.
5. No destructive trading/shell without HITL when the gate is armed.
6. Browser automation only via harness tool `browser_task`.
7. Packaged builds: secrets from safeStorage only — never `.env`.

## Checklist

### Secrets

- [ ] No hardcoded keys/tokens in source
- [ ] New secrets go through `electron/config/store.ts` (safeStorage)
- [ ] Logs redacted (no bearer/MT5 token echo)

### Input / IPC

- [ ] Zod schemas on new IPC channels
- [ ] Paths allowlisted; no path-as-blob regressions
- [ ] Rate limits on external/search/Composio/MT5 surfaces

### Shell & automation

- [ ] Destructive patterns still HITL-gated
- [ ] Allowlist / Advanced Mode unchanged unless intentionally tightened
- [ ] `browser_task` remains the only browser entry

### Trading

- [ ] Paper caps respected
- [ ] Live orders still require HITL when armed
- [ ] G14 safety case still green after risk-gate edits

### Renderer

- [ ] CSP (`electron/security/csp.ts`) not loosened casually
- [ ] `contextIsolation` + `sandbox` remain on

## Output

List findings with severity (CRITICAL/HIGH/MED/LOW), file hint, and a concrete fix. Skip stylistic noise. Prefer false-negative caution on CRITICAL only when you can cite a failure mode.
