# Runbook — Invoice Employee

## Path

Prefer `employee:invoice-extract-path` with a PDF path (path-not-blob). Worker uses `pdf-parse`; empty text → Tesseract OCR fallback.

## Checks

1. Flags `invoice.enabled`, `invoice.liveMode`
2. Worker script compiled (`dist-electron/workers/pdf-worker.js`)
3. `tesseract.js` / `pdf-parse` in dependencies

## Recovery

- Re-run extract after OCR; check language `deu+eng`
- If worker timeout: fall back to pasted text extract
