# ADR 0003 — Global JARVIS_DRY_RUN simulation

**Status:** Accepted  
**Date:** 2026-08-25

## Context

Operators need prod-shaped runs without live side effects (orders, Composio writes, file mutations).

## Decision

`JARVIS_DRY_RUN=1|true|yes` or feature flag `simulation.dryRun` enables `isDryRun()` / `dryRunBlock()`. Destructive paths return simulated OK with reason.

## Consequences

- Safe hardening of employees and MT5 write methods.
- Reads (GET) still execute.
- Two-instance pattern: dry-run experiment profile vs live profile (see `docs/TWO-INSTANCE-USERDATA.md`).
