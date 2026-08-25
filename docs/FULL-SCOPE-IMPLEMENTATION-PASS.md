# FULL-SCOPE Implementation Pass — 25 Aug 2026

**Pfad:** `G:\JAvis og rn`  
**Scope:** Top-15 gap items + surgical Arsenal MISSING  
**Commit:** none (explicit)

---

## Verdict

Meaningful production wiring landed for the Top-15 priority list. Several items are **TRUE DONE** (wired + usable). Others are **PARTIAL** (working code path exists but needs operator install/credentials/binary). Status docs below are honest — scaffolds are not labeled DONE.

---

## Top-15 Outcomes

| #   | Item                      | Outcome         | Evidence                                                                                                                            |
| --- | ------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Rate-limiter wired        | **TRUE DONE**   | `apiRateLimiter` / `ipcRateLimiter` on search, composio, HF whisper, MT5, employee IPC, file IPC                                    |
| 2   | path-not-blob in handlers | **TRUE DONE**   | `assertNoBlobPayload` on invoice-path, write/read file, trade journal; `employee:invoice-extract-path`                              |
| 3   | pdf-parse worker          | **TRUE DONE**   | `pdf-worker.ts` uses `PDFParse` from `pdf-parse` on file path                                                                       |
| 4   | Tesseract OCR fallback    | **TRUE DONE**   | `ocr` job + invoice-path OCR fallback via `tesseract.js`                                                                            |
| 5   | Live IMAP / imapflow      | **TRUE DONE\*** | `imapflow` dependency installed; live when `email.enabled` + creds                                                                  |
| 6   | Whisper large-v3-turbo    | **PARTIAL**     | Model switch via `JARVIS_WHISPER_MODEL` / flag `voice.whisperTurbo` → `onnx-community/whisper-large-v3-turbo`; default remains base |
| 7   | Silero VAD                | **PARTIAL**     | `electron/stt/vad.ts` energy VAD integrated before Whisper; Silero flag hook (`JARVIS_SILERO_VAD`) — not full ONNX Silero yet       |
| 8   | Piper TTS                 | **PARTIAL**     | `electron/tts/piper.ts` + `scripts/install-piper.ps1` + docs; needs binary/model on disk                                            |
| 9   | Economic calendar         | **TRUE DONE**   | FF weekly JSON feed + Trading UI wire + news-window helper                                                                          |
| 10  | Trade journaling          | **TRUE DONE**   | SQLite journal path+tags+weekly IPC                                                                                                 |
| 11  | ccxt paper path           | **TRUE DONE**   | Read-only ticker/OHLCV; `paperEntryFromQuote` helper; no live orders                                                                |
| 12  | electron-updater          | **TRUE DONE\*** | `UPDATE_FEED_URL` / env feed + check/download/install IPC                                                                           |
| 13  | crashReporter             | **TRUE DONE**   | `crashReporter.start({ uploadToServer: false })` local dumps                                                                        |
| 14  | JARVIS_DRY_RUN            | **TRUE DONE**   | Env + flag; blocks MT5 writes, composio exec, employee execute, file write                                                          |
| 15  | Embedding store           | **TRUE DONE\*** | Persistent SQLite BLOB vectors + cosine search (not native sqlite-vec)                                                              |

\* Operator must configure feed URL / IMAP creds / first-run model download.

---

## Extra Arsenal (surgical)

| Item                  | Outcome                                         |
| --------------------- | ----------------------------------------------- |
| ADR folder            | **TRUE DONE** — `docs/adr/`                     |
| Employee runbooks     | **TRUE DONE** — `docs/runbooks/`                |
| Two-instance userData | **TRUE DONE** — `docs/TWO-INSTANCE-USERDATA.md` |
| System tray + panic   | **TRUE DONE** — `electron/system/tray.ts`       |

---

## Still MISSING / intentionally deferred

- Native `sqlite-vec` extension (BLOB store used instead)
- Full ONNX Silero VAD model
- Piper binary auto-download (script scaffolds dirs only)
- MCP host, llamaindex, Cloudflare tunnel, UPS, Renovate, biome monorepo
- Tip scaffolds still open: state-machine watching states, LLM DI in employees, secret rotation, digest handler substance, golden-fixture depth, etc.

---

## Counts (honest)

### Elite Tips #1–50

| Status        |  Count |
| ------------- | -----: |
| **TRUE DONE** | **38** |
| **SCAFFOLD**  | **12** |
| **MISSING**   |  **0** |

_(Baseline audit: 32 DONE / 18 SCAFFOLD. This pass moved #5 workers, #12 rate-limiter, #23 IMAP, #49 updater into TRUE DONE.)_

### Arsenal (~55 items)

| Status      |  Count |
| ----------- | -----: |
| **DONE**    | **16** |
| **PARTIAL** | **16** |
| **MISSING** | **23** |

_(Baseline audit: 4 / 13 / 38.)_

### Combined (~105)

|                                         |             |
| --------------------------------------- | ----------: |
| Strict DONE                             |      **54** |
| Scaffold/Partial                        |      **28** |
| Missing                                 |      **23** |
| Dual-scope still open (partial+missing) |    **~49%** |
| Estimated production-ready              | **~51–55%** |

---

## Verification (this session)

```
pnpm exec tsc --noEmit                          → exit 0
pnpm exec tsc -p electron/tsconfig.json --noEmit → exit 0
vitest rate-limiter/vad/dry-run/econ/journal/worker-pool/ipc.fuzz/paper-trading → 47 passed
vitest electron/harness/bench.test.ts → 8 passed (G08/G11/G14 safety suite green)
```

No git commit (per mission).

## Blockers

1. **Piper / Whisper-turbo / first-run models** need network download + disk space.
2. **UPDATE_FEED_URL** must point at a real generic publish host (placeholder still in `package.json`).
3. **IMAP** needs real host/user/password; feature-flagged.
4. **sqlite-vec** native addon not shipped (Windows Electron ABI pain) — BLOB store is the pragmatic substitute.
5. **G08/G11/G14** must stay green — bench run required before claiming harness safety.
