# ADR 0004: IPC channel registry as single source of truth

**Status:** Accepted (2026-08-25)

## Context

IPC channels were documented in three places (`main.ts`, `preload.ts`, `src/global.d.ts`) with no mechanical link. Missing handlers, orphan preload keys, and undocumented channels were found only by tests or manual review.

## Decision

1. **`electron/ipc/registry.ts`** lists every `ipcMain.handle` channel with risk class, handler location, and optional `preloadKey`.
2. **`pnpm gen:ipc`** generates `docs/IPC.md` and `electron/ipc/generated/preload-channels.d.ts`.
3. **`pnpm gen:ipc --check`** runs in CI and fails on generated drift or when handlers/preload invoke channels are absent from the registry.
4. Handler wiring migrates incrementally into `register*Ipc()` modules (first: `register-config.ts`).

## Consequences

- Adding a channel requires a registry row + `pnpm gen:ipc` — CI enforces this.
- `preload.ts` and `global.d.ts` remain hand-written until a later pass generates them; the registry + drift scan closes the “unknown channel” gap today.
- Employee (`employee:*`) channels are registry-documented but not exposed in preload (main/harness only).

## Alternatives considered

- **Big-bang rewrite of `main.ts` to registry-driven handlers** — rejected; too risky for one PR.
- **Tests-only contract checks** — rejected; D4 requires construction, not discovery.

## Follow-up

- Generate preload wrappers from registry.
- Split remaining `main.ts` IPC into domain `register-*` modules until bootstrap < 400 lines.
