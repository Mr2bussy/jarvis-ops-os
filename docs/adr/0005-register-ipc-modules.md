# ADR 0005: Extract register-\* IPC modules from main.ts

**Status:** Accepted (2026-08-25)

## Context

`electron/main.ts` held bootstrap plus most `ipcMain.handle` registrations (~1.7–2.9k lines). Domain logic for config, production, commerce, content, browser, trading, selftest, and vault lived inline or in unused register files — easy to drift from `registry.ts`.

## Decision

1. Keep `main.ts` as bootstrap + window lifecycle + remaining inline handlers.
2. Register domain handlers via `registerConfigIpc`, `registerProductionIpc`, `registerCommerceIpc`, `registerContentIpc`, `registerDomainIpc` (and existing harness/gateway/employee modules).
3. `pnpm gen:ipc --check` fails if any registry channel lacks a handler or any `preloadKey` lacks preload coverage.

## Consequences

- New IPC belongs in a `register-*.ts` module + registry row + `pnpm gen:ipc`.
- `main.ts` ceiling lowered in `.file-size-budget.json`; further domain extracts continue toward the 600-line goal.

## Alternatives considered

- Big-bang rewrite of all handlers into a single registry-driven dispatcher — deferred (too risky for one pass).
