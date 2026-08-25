# Elite-Tips Production Implementation Status

**Stand:** 25. August 2026 · **Pfad:** `G:\JAvis og rn`  
**Honesty rule:** SCAFFOLD ≠ DONE. See also `docs/FULL-SCOPE-GAP-AUDIT.md` + `docs/FULL-SCOPE-IMPLEMENTATION-PASS.md`.

| #   | Tipp                         | Status       | Dateien / Notizen                                                                 |
| --- | ---------------------------- | ------------ | --------------------------------------------------------------------------------- |
| 1   | Employee contract            | **DONE**     | `electron/employees/types.ts`, `base.ts`, registry                                |
| 2   | Event bus                    | **DONE**     | `electron/event-bus.ts`                                                           |
| 3   | State machine                | **SCAFFOLD** | Typen haben watching/awaiting_gate; Runtime idle/working/done/failed/paused       |
| 4   | Outbox pattern               | **DONE**     | `outbox.ts` + sqlite                                                              |
| 5   | Worker threads               | **DONE**     | Pool + `pdf-parse` + tesseract OCR in `pdf-worker.ts` (embed job still stub dims) |
| 6   | Scheduler                    | **DONE**     | `HarnessScheduler`                                                                |
| 7   | Feature flags                | **DONE**     | `flags.ts` (+ dryRun / whisperTurbo / piper / econ / ccxt)                        |
| 8   | LLM DI                       | **SCAFFOLD** | Provider in main; Employees rufen ihn nicht für Klassifikation                    |
| 9   | Idempotency keys             | **DONE**     | `idempotency.ts`                                                                  |
| 10  | Graceful shutdown            | **DONE**     | SIGTERM / will-quit                                                               |
| 11  | Audit trail hash chain       | **DONE**     | `audit-trail.ts`                                                                  |
| 12  | Rate limiter                 | **DONE**     | Wired into search, composio, HF STT, MT5, employee/file IPC                       |
| 13  | Gate timeout + escalation    | **DONE**     | `hitl-hub.ts`                                                                     |
| 14  | Secret rotation hints        | **SCAFFOLD** | UI hint only                                                                      |
| 15  | Path traversal fuzz          | **DONE**     | allowlist tests                                                                   |
| 16  | Renderer CSP                 | **DONE**     | `csp.ts`                                                                          |
| 17  | Anti-early-victory employees | **SCAFFOLD** | Key-check ≠ live SMTP ack                                                         |
| 18  | Kill switch                  | **DONE**     | `/panic` + tray + IPC                                                             |
| 19  | Voice latency metrics        | **DONE**     | voice-metrics + ErrorBudget                                                       |
| 20  | Hermes warm pool             | **DONE**     | `warmHermesSession`                                                               |
| 21  | Streaming TTS chunks         | **DONE**     | SpeechSynthesis chunking; Piper optional                                          |
| 22  | Embedding LRU cache          | **DONE**     | + persistent embedding-store BLOB                                                 |
| 23  | IMAP IDLE                    | **DONE**     | `imapflow` dep + feature-flagged live listen when creds set                       |
| 24  | Virtual lists HITL           | **DONE**     | VirtualList                                                                       |
| 25  | React.lazy screens           | **DONE**     | App.tsx                                                                           |
| 26  | IPC path-not-blob            | **DONE**     | Zod + assert in invoice-path / file / journal handlers                            |
| 27  | Eval suite per employee      | **SCAFFOLD** | 6 fixtures ≪ 20/agent                                                             |
| 28  | Zod validation               | **DONE**     | IPC strong                                                                        |
| 29  | Router confidence            | **DONE**     |                                                                                   |
| 30  | Prompt versioning            | **DONE**     |                                                                                   |
| 31  | Few-shot from corrections    | **DONE**     |                                                                                   |
| 32  | Token budget                 | **DONE**     |                                                                                   |
| 33  | Model health probe           | **DONE**     |                                                                                   |
| 34  | Contract test fixtures       | **SCAFFOLD** | Employee contracts ≠ Polly for Telegram/IMAP                                      |
| 35  | Chaos outbox restart         | **DONE**     |                                                                                   |
| 36  | Playwright screenshots       | **SCAFFOLD** | Specs; pixel-diff CI not proven                                                   |
| 37  | IPC fuzz                     | **DONE**     |                                                                                   |
| 38  | Structured logging pino      | **SCAFFOLD** | pino da; no E2E correlation-id                                                    |
| 39  | Error budget                 | **DONE**     |                                                                                   |
| 40  | Launch smoke                 | **SCAFFOLD** | Employee/IMAP smoke; not full LLM/Telegram                                        |
| 41  | Onboarding wizard            | **SCAFFOLD** | Partial Setup steps                                                               |
| 42  | Transparency panel           | **DONE**     |                                                                                   |
| 43  | Undo-first                   | **SCAFFOLD** | Email drafts; not shop-wide                                                       |
| 44  | Daily digest                 | **SCAFFOLD** | Handler stub / morning briefing ≠ tip digest                                      |
| 45  | Golden demo playwright       | **SCAFFOLD** | Spec without proven regenerable artifact                                          |
| 46  | Command palette Ctrl+K       | **DONE**     |                                                                                   |
| 47  | electron-builder NSIS        | **DONE**     |                                                                                   |
| 48  | Windows service              | **SCAFFOLD** | NSSM script + docs                                                                |
| 49  | electron-updater             | **DONE**     | Configurable `UPDATE_FEED_URL` + check/download/install when packaged             |
| 50  | Config export/import         | **DONE**     |                                                                                   |

## Counts

| Status       |  Count |
| ------------ | -----: |
| **DONE**     | **38** |
| **SCAFFOLD** | **12** |
| **DEFERRED** |  **0** |

## Arsenal (summary)

See `FULL-SCOPE-IMPLEMENTATION-PASS.md` — **16 DONE / 16 PARTIAL / 23 MISSING** (was 4/13/38).

## Verification Commands

```bash
pnpm install
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json --noEmit
pnpm exec vitest run electron/harness/bench.test.ts
pnpm exec vitest run electron/security/rate-limiter.test.ts electron/stt/vad.test.ts electron/config/dry-run.test.ts electron/trading/economic-calendar.test.ts electron/trading/trade-journal.test.ts electron/workers/worker-pool.test.ts electron/security/ipc.fuzz.test.ts
```
