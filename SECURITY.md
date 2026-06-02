# Security Model — JARVIS Operations OS

JARVIS is a single-operator desktop app with real capabilities (shell, file IO,
live trading). This document states the threat model and the controls in place.

## Trust boundaries

- **Renderer (Chromium):** untrusted-ish. Runs app UI; holds no secrets; cannot call
  Node. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **Main (Node):** trusted. Owns secrets, filesystem, shell, child processes.
- **MT5 bridge (localhost):** trusted-but-isolated; bound to `127.0.0.1` only.

## Controls

| Risk                          | Control                                                                      | Where                   |
| ----------------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| API keys in plaintext         | `safeStorage` (OS keychain) encrypted blobs                                  | `main.ts` config store  |
| Renderer exfiltrating secrets | keys never sent to renderer; `getKey` decrypts in main                       | `config:*`              |
| Local CSRF on trading bridge  | `X-JARVIS-Token` shared secret; CORS removed; localhost-only                 | `bridge.py`, `zeus:mt5` |
| Accidental liquidation        | `close_all` requires the expert to be **armed**                              | `bridge.py`             |
| Path traversal on file IO     | `isPathInRoots()` allow-list with separator-boundary check                   | `security/paths.ts`     |
| Type-confusion via IPC        | zod validation on sensitive handlers                                         | `security/ipc.ts`       |
| Arbitrary shell (RCE)         | `console:runCmd` gated behind **Advanced Mode** (off by default) + audit log | `main.ts`, Console UI   |
| Renderer navigation/popups    | `will-navigate` + `setWindowOpenHandler` deny external nav                   | `createWindow`          |
| Injected content execution    | strict CSP in production (`script-src 'self'`)                               | `onHeadersReceived`     |

## Advanced Mode

The raw shell (`console:runCmd`) is **disabled by default**. The operator enables it
explicitly via the Terminal toggle (🔒/🔓 ADV), which flips a persisted `ADVANCED_MODE`
flag. Every executed command is written to the activity audit ring.

## Bridge auth

On first run the main process generates a 24-byte token, stores it encrypted, injects
it into the bridge via `JARVIS_BRIDGE_TOKEN`, and sends it as `X-JARVIS-Token` on every
request. The bridge enforces it when set (fail-closed) and warns loudly if run
standalone without one.

## Known residual risks (tracked in ROADMAP_9OF10.md / PATH_TO_9.md)

- CSP is not applied in dev (conflicts with Vite HMR) — prod CSP is present.
- zod is wired into the highest-risk handlers; extending to all handlers is in progress.
- Distribution artifacts are not yet code-signed.

## Reporting

This is a personal project. Report issues to the repository owner.
