# ADR 0002 — Path-not-blob IPC policy

**Status:** Accepted  
**Date:** 2026-08-25

## Context

Large base64 payloads over Electron IPC cause UI jank and memory spikes (invoices, screenshots, audio).

## Decision

Handlers must accept filesystem paths (`assertNoBlobPayload` / `PathOnlyPayload`). Main/worker threads read disk under allowlisted roots.

## Consequences

- Invoice PDF/OCR uses `employee:invoice-extract-path`.
- Trade journal stores `screenshotPath`, never image bytes.
- Callers that only have blobs must write a temp file first.
