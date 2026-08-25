# ADR 0001 — SQLite WAL as primary local store

**Status:** Accepted  
**Date:** 2026-08-25

## Context

JSON-only persistence does not scale for outbox, audit trail, trade journal, and embedding vectors.

## Decision

Use `better-sqlite3` with `journal_mode=WAL` via `electron/db/sqlite.ts`, with JSON fallback when native binding fails.

## Consequences

- Faster concurrent reads; durable local state under `userData/jarvis-db/`.
- Native rebuild required after Electron upgrades.
- sqlite-vec extension deferred — vectors stored as BLOB + cosine search in `embedding-store.ts`.
