# FULL-SCOPE Gap-Audit — Elite-Tips #1–50 + Arsenal-Dump

**Projekt:** JARVIS Operations OS  
**Pfad:** `G:\JAvis og rn`  
**Datum:** 25. August 2026  
**Adressat:** Operator Zac  
**Methode:** Adversarial Spot-Check gegen Quellcode, `package.json`, Laufzeit-Deps — **nicht** gegen Statusdokumente vertraut  
**Auftrag:** Audit only — keine Implementierung

---

## 0. Urteil (eine Zeile)

**Nein — nicht alles fertig.** Nach Implementation-Pass 25.08.2026: Tips **38 DONE / 12 SCAFFOLD**; Arsenal **~16 DONE / 16 PARTIAL / 23 MISSING**. Geschätzter Gesamtfortschritt: **~51–55 % produktionsreif**, verbleibend **~45–49 %**.

> Früherer Stand (Audit-only): Tips 32/18, Arsenal 4/13/38, Gesamt ~35–40 %.

---

## 0b. Update nach Implementation-Pass

Siehe `docs/FULL-SCOPE-IMPLEMENTATION-PASS.md` für TRUE DONE vs PARTIAL vs MISSING je Top-15-Item.

## 1. Was die Statusdokumente behaupten

| Dokument                                     | Claim                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `docs/PRODUCTION-IMPLEMENTATION-STATUS.md`   | **50 DONE / 0 PARTIAL / 0 DEFERRED**                                   |
| `docs/IMPLEMENTATION-VERIFICATION-REPORT.md` | Session hat 8 DEFERRED + 12 PARTIAL auf DONE gebracht; Phasen ~90–95 % |

**Kritik:** Beide Dokumente bewerten nur die **nummerierten Elite-Tips**. Der zweite Block („💣 Alles raus — Der komplette Arsenal-Dump“) fehlt in der Completion-Logik. Zusätzlich werden mehrere Tips als DONE geführt, obwohl der Code selbst `scaffold`/`stub`/`unavailable` signalisiert oder Module **nicht verdrahtet** sind.

Ehrliche Caveats im Statusdoc (IMAP ohne `imapflow`, PDF-Worker-Stub, Placeholder-Updater-URL, NSSM-Scaffold) widersprechen bereits dem Label „0 PARTIAL“.

---

## 2. Spot-Check-Evidenz (Auswahl)

| Claim / Item                                                                             | Befund                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `better-sqlite3` / `pino` / `zod`                                                        | In `package.json`; `require()` zur Laufzeit **OK**                                               |
| `imapflow`                                                                               | **MISSING** — IMAP IDLE bleibt Scaffold                                                          |
| `pdf-parse` / `tesseract.js` / `duckdb` / `sqlite-vec` / `ccxt` / `biome` / `llamaindex` | **MISSING** in Dependencies                                                                      |
| `electron/workers/pdf-worker.ts`                                                         | Explizite **Stubs** (`engine: 'stub'`, Embed `stub: true`)                                       |
| `TokenBucketRateLimiter`                                                                 | Implementiert + getestet, aber **nirgends importiert/verdrahtet** außerhalb eigener Datei        |
| Employee → `llm-provider`                                                                | DI in `main.ts` gesetzt; **Employees rufen `getLlmProvider()` nicht auf** (Regel-Klassifikation) |
| `golden-fixtures.json`                                                                   | **6** Cases (4 email / 1 invoice / 1 calendar) — Tip forderte ~20/Agent                          |
| Digest-Handler                                                                           | `registerHandler('digest')` loggt nur `'catch-up'` — kein Telegram-Tagesdigest                   |
| State-Machine                                                                            | Typen enthalten `watching` / `awaiting_gate`; `BaseEmployee` nutzt sie **nicht**                 |
| `pnpm-workspace.yaml`                                                                    | Nur `allowBuilds:` — **kein** Monorepo `/shared`                                                 |
| `docs/adr/`, `docs/runbooks/`                                                            | **fehlen**                                                                                       |
| `crashReporter` / Tray / `JARVIS_DRY_RUN` / Cloudflare / UPS                             | **keine** Treffer im App-Code                                                                    |
| Whisper                                                                                  | `Xenova/whisper-base` / tiny — **nicht** `large-v3-turbo`                                        |
| Economic Calendar                                                                        | UI-Kommentar: _„no provider wired yet — stays empty“_                                            |
| Walk-Forward                                                                             | `purgedWalkForward` in `quant.ts` vorhanden; **kein** Deflated Sharpe                            |
| Backup-Tool Admin                                                                        | Text: _„use OS backup or manual copy“_                                                           |

---

## 3. Elite-Tips #1–50 — ehrliche Neubewertung

Legende:

- **DONE** — Intent des Tips erfüllt, verdrahtet, produktionsnah nutzbar
- **SCAFFOLD** — Datei/Claim existiert, aber Stub, unwired, Platzhalter oder deutlich unter Tip-Intent
- **MISSING** — kein Artefakt (bei #1–50: keines)

### 3.1 Architektur & Kern (1–10)

| #   | Tipp                 | Status-Doc | Audit        | Begründung                                                   |
| --- | -------------------- | ---------- | ------------ | ------------------------------------------------------------ |
| 1   | Employee-Contract    | DONE       | **DONE**     | `types.ts` + `BaseEmployee` + Registry                       |
| 2   | Event-Bus            | DONE       | **DONE**     | `event-bus.ts` verdrahtet                                    |
| 3   | State-Machine        | DONE       | **SCAFFOLD** | Zustände im Typ; Runtime nur idle/working/done/failed/paused |
| 4   | Outbox               | DONE       | **DONE**     | Persistenz + Restart-Tests                                   |
| 5   | Worker-Threads       | DONE       | **DONE**     | Pool + pdf-parse + tesseract OCR (embed job dims stub)       |
| 6   | Scheduler + Catch-up | DONE       | **DONE**     | `HarnessScheduler` + `catchUpOnStart`                        |
| 7   | Feature-Flags        | DONE       | **DONE**     | `flags.ts`                                                   |
| 8   | LLM DI               | DONE       | **SCAFFOLD** | Provider in Main; Employees nutzen ihn nicht                 |
| 9   | Idempotency          | DONE       | **DONE**     | `idempotency.ts`                                             |
| 10  | Graceful Shutdown    | DONE       | **DONE**     | SIGTERM/`will-quit`                                          |

### 3.2 Sicherheit (11–18)

| #   | Tipp                         | Status-Doc | Audit        | Begründung                                                |
| --- | ---------------------------- | ---------- | ------------ | --------------------------------------------------------- |
| 11  | Audit-Trail Hash-Chain       | DONE       | **DONE**     | `audit-trail.ts`                                          |
| 12  | Rate-Limiter                 | DONE       | **DONE**     | Klasse verdrahtet in search/composio/STT/MT5/employee IPC |
| 13  | Gate-Timeout + Eskalation    | DONE       | **DONE**     | `hitl-hub.ts`                                             |
| 14  | Secret-Rotation              | DONE       | **SCAFFOLD** | UI-Hinweis, keine echte Rotation/Invalidierung            |
| 15  | Path-Traversal-Fuzz          | DONE       | **DONE**     | Allowlist-Tests                                           |
| 16  | Renderer-CSP                 | DONE       | **DONE**     | `csp.ts` + Tests                                          |
| 17  | Anti-Early-Victory Employees | DONE       | **SCAFFOLD** | Key-Check ≠ SMTP-Ack / Live-Validierung                   |
| 18  | Kill-Switch                  | DONE       | **DONE**     | `/panic` + IPC                                            |

### 3.3 Performance (19–26)

| #   | Tipp                   | Status-Doc | Audit    | Begründung                                  |
| --- | ---------------------- | ---------- | -------- | ------------------------------------------- |
| 19  | Voice-Latency-Metriken | DONE       | **DONE** | `voice-metrics.ts` + Widget                 |
| 20  | Hermes Warm-Pool       | DONE       | **DONE** | `warmHermesSession`                         |
| 21  | Streaming TTS          | DONE       | **DONE** | Chunking über SpeechSynthesis (Tip-konform) |
| 22  | Embedding LRU          | DONE       | **DONE** | 256er Cache                                 |
| 23  | IMAP IDLE              | DONE       | **DONE** | `imapflow` dep; live wenn Flag+Creds        |
| 24  | Virtual Lists HITL     | DONE       | **DONE** | `VirtualList` in Modal                      |
| 25  | React.lazy Screens     | DONE       | **DONE** | `App.tsx`                                   |
| 26  | IPC path-not-blob      | DONE       | **DONE** | Zod + Assert                                |

### 3.4 KI-Qualität (27–33)

| #   | Tipp                     | Status-Doc | Audit        | Begründung                                     |
| --- | ------------------------ | ---------- | ------------ | ---------------------------------------------- |
| 27  | Eval-Suite pro Employee  | DONE       | **SCAFFOLD** | 6 Fixtures ≪ 20/Agent; Classifier regelbasiert |
| 28  | Zod-Validierung          | DONE       | **DONE**     | IPC/Security (nicht „überall“)                 |
| 29  | Router-Confidence        | DONE       | **DONE**     | `routeByTierWithConfidence`                    |
| 30  | Prompt-Versionierung     | DONE       | **DONE**     | `prompts/` + Loader                            |
| 31  | Few-Shot aus Korrekturen | DONE       | **DONE**     | Hook aus HITL                                  |
| 32  | Token-Budget             | DONE       | **DONE**     | `token-budget.ts`                              |
| 33  | Model-Health-Probe       | DONE       | **DONE**     | Cron + probe                                   |

### 3.5 Testing (34–40)

| #   | Tipp                    | Status-Doc | Audit        | Begründung                                                    |
| --- | ----------------------- | ---------- | ------------ | ------------------------------------------------------------- |
| 34  | Contract/API-Fixtures   | DONE       | **SCAFFOLD** | Employee-Contract-Tests ≠ Polly für Telegram/IMAP/Shopify/MT5 |
| 35  | Chaos Outbox-Restart    | DONE       | **DONE**     | `outbox.test.ts`                                              |
| 36  | Playwright Screenshots  | DONE       | **SCAFFOLD** | Specs vorhanden; kein verifizierter Pixel-Diff-CI-Lauf        |
| 37  | IPC-Fuzz                | DONE       | **DONE**     | 33 Cases                                                      |
| 38  | Structured Logging pino | DONE       | **SCAFFOLD** | pino da; keine Correlation-ID-Propagation End-to-End          |
| 39  | Error-Budget            | DONE       | **DONE**     | Metrics + Widget                                              |
| 40  | Launch-Smoke            | DONE       | **SCAFFOLD** | Employee/IMAP-Smoke; Tip forderte LLM/Telegram/Roots          |

### 3.6 Product UX (41–46)

| #   | Tipp                   | Status-Doc | Audit        | Begründung                                                  |
| --- | ---------------------- | ---------- | ------------ | ----------------------------------------------------------- |
| 41  | Onboarding-Wizard      | DONE       | **SCAFFOLD** | Teilschritte; kein voller Telegram→IMAP→Calendar-OAuth-Flow |
| 42  | Transparenz-Panel      | DONE       | **DONE**     | Panel + ErrorBudget                                         |
| 43  | Undo-First             | DONE       | **SCAFFOLD** | E-Mail-Drafts; nicht Shop/Cleanup flächendeckend            |
| 44  | Daily Digest           | DONE       | **SCAFFOLD** | Digest-Handler Stub; Morning-Briefing ≠ Tip-Digest          |
| 45  | Golden-Demo Playwright | DONE       | **SCAFFOLD** | Spec; Video/regenerierbarer Nachweis nicht bestätigt        |
| 46  | Command Palette Ctrl+K | DONE       | **DONE**     | `CommandPalette.tsx`                                        |

### 3.7 Deployment (47–50)

| #   | Tipp                  | Status-Doc | Audit        | Begründung                                       |
| --- | --------------------- | ---------- | ------------ | ------------------------------------------------ |
| 47  | electron-builder NSIS | DONE       | **DONE**     | Build-Config + Release-Workflow                  |
| 48  | Windows Service       | DONE       | **SCAFFOLD** | PS1 + Docs; nicht live verifiziert               |
| 49  | electron-updater      | DONE       | **DONE**     | Feed-URL konfigurierbar + check/download/install |
| 50  | Config Export/Import  | DONE       | **DONE**     | `export-import.ts` + IPC                         |

### 3.8 Tips — Zählung

| Kategorie                |                Anzahl |
| ------------------------ | --------------------: |
| **Wahrhaft DONE**        |                **38** |
| **SCAFFOLD / Overclaim** |                **12** |
| **MISSING**              |                 **0** |
| Status-Doc (ehrlich)     | 38 DONE / 12 SCAFFOLD |

**Tips-Fortschritt (streng):** 38/50 = **76 %**.

---

## 4. Arsenal-Dump — Kategorie für Kategorie

Quelle: Original-Prompt „💣 Alles raus — Der komplette Arsenal-Dump“ (nach Tip #50).

### 4.1 Tooling & Libraries — Electron/Node-Core

| Item                                 | Status      | Evidenz                                                              |
| ------------------------------------ | ----------- | -------------------------------------------------------------------- |
| better-sqlite3 (WAL statt JSON-only) | **DONE**    | Dep + `electron/db/sqlite.ts`, Native OK                             |
| pino + pino-electron + Rotation      | **PARTIAL** | pino ja; kein `pino-electron`, keine Rotation                        |
| zod überall (IPC/LLM/Config/Env)     | **PARTIAL** | IPC stark; kein t3-env; LLM-Outputs nicht flächendeckend             |
| electron-store / conf mit Schema     | **MISSING** | Custom `config/store.ts`; weder `conf` noch `electron-store` in deps |
| tsx für Scripts                      | **MISSING** | nicht in `package.json`                                              |
| execa                                | **DONE**    | Dependency vorhanden                                                 |

### 4.2 Daten & Memory

| Item                                     | Status      | Evidenz                              |
| ---------------------------------------- | ----------- | ------------------------------------ |
| sqlite-vec                               | **MISSING** | keine Dep, kein Vec-SQL              |
| @xenova/transformers (lokale Embeddings) | **DONE**    | `@huggingface/transformers` + MiniLM |
| pdf-parse                                | **MISSING** | Stub-Worker ohne Library             |
| tesseract.js                             | **MISSING** | OCR-Stub                             |
| duckdb                                   | **MISSING** | keine Dep / keine Analytics-Bindung  |

### 4.3 Browser-Automation

| Item                                           | Status      | Evidenz                                                           |
| ---------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| playwright-core (In-App / Anti-Detect / Video) | **PARTIAL** | E2E via Playwright; kein dediziertes In-App-playwright-core-Stack |
| browser-use (Playwright + LLM + A11y-Tree)     | **PARTIAL** | `browser_bridge` + `browser-use.ts` Sidecar                       |
| storageState Session-Persistenz                | **MISSING** | keine Treffer                                                     |

### 4.4 AI-Stack Upgrades

| Item                                               | Status      | Evidenz                                                |
| -------------------------------------------------- | ----------- | ------------------------------------------------------ |
| MCP Server/Client                                  | **MISSING** | nur Katalog-/Compare-Erwähnungen; kein JARVIS-MCP-Host |
| llamaindex (Retrieval)                             | **MISSING** | —                                                      |
| Hybrid Search BM25 + Embeddings + RRF              | **DONE**    | `search-index.ts` (handgebaut)                         |
| Cross-Encoder Reranker                             | **MISSING** | —                                                      |
| Structured Output / JSON-Mode Feature-Detect       | **MISSING** | kein `response_format`                                 |
| Anthropic Prompt-Caching                           | **MISSING** | kein `cache_control`                                   |
| Whisper large-v3-turbo                             | **MISSING** | base/tiny                                              |
| Silero VAD                                         | **MISSING** | —                                                      |
| Streaming-STT (whisper-streaming / faster-whisper) | **MISSING** | —                                                      |
| Piper TTS                                          | **MISSING** | SpeechSynthesis only                                   |
| Coqui XTTS / Kokoro                                | **MISSING** | —                                                      |

### 4.5 Trading-spezifisch

| Item                                                         | Status      | Evidenz                                                                          |
| ------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------- |
| ccxt                                                         | **MISSING** | —                                                                                |
| Orderbook-Impact vor Trade (Spread/Depth/Slippage-Schätzung) | **MISSING** | TCA post-fill existiert (`quant.ts` / `mt5_bridge/tca.py`) ≠ Pre-Trade-Orderbook |
| Economic Calendar Feed                                       | **MISSING** | UI leer, kein Provider                                                           |
| Trade-Journaling (Chart-Screenshot + Tags + Wochenreport)    | **MISSING** | —                                                                                |
| Walk-Forward + Deflated Sharpe                               | **PARTIAL** | `purgedWalkForward` ja; Deflated Sharpe nein                                     |

### 4.6 Observability & Debugging

| Item                                          | Status      | Evidenz                                              |
| --------------------------------------------- | ----------- | ---------------------------------------------------- |
| electron-devtools-installer (Dev only)        | **MISSING** | —                                                    |
| crashReporter / Minidumps                     | **MISSING** | —                                                    |
| Perf-Widgets (CPU / Event-Loop-Lag / RAM)     | **MISSING** | —                                                    |
| LangSmith-style Trace-Viewer (Timeline in UI) | **MISSING** | —                                                    |
| Gate-„Zeitreise“ (voller Kontext-Snapshot)    | **PARTIAL** | `gate-memory` Fingerprints ≠ voller Kontext-Snapshot |

### 4.7 Dev Experience & CI

| Item                                       | Status      | Evidenz                                                                          |
| ------------------------------------------ | ----------- | -------------------------------------------------------------------------------- |
| Pre-push: tsc + vitest + bench             | **MISSING** | nur `pre-commit` (Secrets + lint-staged)                                         |
| GitHub Actions Matrix inkl. Build-Artifact | **PARTIAL** | `ci.yml` + `release.yml`; kein tägliches Install-Artifact-Matrix wie beschrieben |
| Renovate / Dependabot                      | **MISSING** | —                                                                                |
| biome statt ESLint+Prettier                | **MISSING** | ESLint + Prettier                                                                |
| Monorepo pnpm workspace `/shared` Types    | **MISSING** | `pnpm-workspace.yaml` = allowBuilds only                                         |

### 4.8 UI/UX Elite

| Item                                             | Status      | Evidenz                                          |
| ------------------------------------------------ | ----------- | ------------------------------------------------ |
| Command-Konfigurator / Widget-Grid generalisiert | **PARTIAL** | Zeus-Layouts; kein generisches App-weites Grid   |
| Sound-Design (Gate/Fehler-Cues)                  | **MISSING** | Toggle ohne echte Cues                           |
| Global Hotkey Overlay (Raycast-Pattern)          | **PARTIAL** | `Alt+Space` / `Alt+J`; kein Mini-Overlay-Capture |
| System-Tray Statusfarbe + Quick-Actions          | **MISSING** | kein Tray                                        |
| Notification-Debounce / Batching                 | **MISSING** | —                                                |

### 4.9 Netzwerk & Infra

| Item                               | Status      | Evidenz                                   |
| ---------------------------------- | ----------- | ----------------------------------------- |
| Cloudflare Tunnel                  | **MISSING** | —                                         |
| Externer Watchdog (geplanter Task) | **MISSING** | Service-Script ≠ externer Health-Watchdog |
| UPS-aware Shutdown                 | **MISSING** | —                                         |
| Backup 3-2-1 für userData          | **MISSING** | Admin verweist auf OS/manuell             |

### 4.10 Wissen & Prozesse

| Item                                    | Status      | Evidenz                                         |
| --------------------------------------- | ----------- | ----------------------------------------------- |
| ADR unter `docs/adr/`                   | **MISSING** | Ordner fehlt                                    |
| Runbook pro Employee                    | **MISSING** | Ordner fehlt                                    |
| Wöchentliches Self-Retrospective-Digest | **MISSING** | Bench-`weekly-report` ≠ Operator-Sonntagsreport |

### 4.11 Bonus-Hebel

| Item                                      | Status      | Evidenz                                           |
| ----------------------------------------- | ----------- | ------------------------------------------------- |
| Undo-Infrastruktur First-Class (vertieft) | **PARTIAL** | E-Mail-Drafts; nicht systemweit                   |
| Simulationsmodus `JARVIS_DRY_RUN`         | **MISSING** | —                                                 |
| Zwei-Instanz-Pattern (getrennte userData) | **MISSING** | FIXLIST warnt sogar vor shared userData-Kollision |

### 4.12 Arsenal — Zählung

| Status                            |  Count |
| --------------------------------- | -----: |
| **DONE**                          | **16** |
| **PARTIAL**                       | **16** |
| **MISSING**                       | **23** |
| **Summe diskreter Arsenal-Items** | **55** |

**Arsenal-Fortschritt (streng DONE):** 16/55 ≈ **29 %**.  
Mit PARTIAL als halbe Credits: ≈ **(16 + 8)/55 ≈ 44 %**.

> Re-count after 25.08 implementation pass (was 4/13/38). Details: `FULL-SCOPE-IMPLEMENTATION-PASS.md`.

---

## 5. Gesamtbild vs. „alles fertig“

| Scope                       | Streng DONE | Scaffold/Partial | Missing | Geschätzter Rest         |
| --------------------------- | ----------: | ---------------: | ------: | ------------------------ |
| Tips 1–50                   |          38 |               12 |       0 | ~24 % Tip-Intent offen   |
| Arsenal                     |          16 |               16 |      23 | ~55–70 % offen           |
| **Kombiniert (~105 Items)** |      **54** |           **28** |  **23** | **~45–49 % verbleibend** |

**Geschätzter Gesamt-Rest:** **≈ 45–49 %** des Originalauftrags („implementiere alles“ inkl. Arsenal).

Die Behauptung „50/50 DONE“ bleibt **überzogen**. Aktuell ehrlich: Tips **76 %** streng DONE; Arsenal **~29 %** streng DONE; kombiniert **~51–55 %**.

---

## 6. Top 15 Highest-Impact Remaining Items

Priorisiert nach Operator-Nutzen × Lücke × Entsperrung weiterer Features:

1. **Live-IMAP (`imapflow` + Credentials)** — Tip #23 + Email-Employee von Scaffold → echt
2. **`JARVIS_DRY_RUN` global** — risikofreies Härten aller Employees in Prod-ähnlichem Betrieb
3. **Zwei-Instanz-Pattern (getrennte userData)** — Prod vs. Experiment; behebt bekannte Kollisionsgefahr
4. **Rate-Limiter verdrahten** — Tip #12 von „Datei“ zu Schutz
5. **pdf-parse + tesseract.js** — Invoice-Employee OCR-Pfad
6. **Whisper large-v3-turbo + Silero VAD** — STT-Qualität/Latenz
7. **Piper TTS (lokal DE)** — jenseits SpeechSynthesis
8. **Economic Calendar Feed** — Prop-News-Ban automatisierbar
9. **Trade-Journaling + Wochenreview** — Edge-Hebel Trading
10. **sqlite-vec oder persistente Vektoren** — Memory ohne Pseudo-Chroma
11. **MCP Host/Client** — Tool-Ökosystem-Standard
12. **System-Tray + Panic/Gate Quick-Actions** — 24/7-Operabilität ohne Fensterfokus
13. **crashReporter + Trace-Timeline** — Debugbarkeit bei sporadic Failures
14. **ADR + Employee-Runbooks** — Solo-Ops-Überlebensfähigkeit
15. **electron-updater echte Publish-URL + verifizierter Auto-Update-Pfad** — Tip #49 produktionsfähig

_(Ehrenvoll knapp darunter: Cross-Encoder-Reranker, ccxt, Cloudflare Tunnel, UPS-Shutdown, biome/Monorepo, Dependabot, Pre-push-Suite.)_

---

## 7. Antwort an Zac

> „Es waren mehr als 50 — bist du dir sicher, du bist mit allem fertig?“

**Nein.** Fertig im Sinne des Statusdocs wären höchstens die **nummerierten Tips**, und selbst dort sind **18 von 50** eher Scaffold/Overclaim als Produktionsabschluss. Der **Arsenal-Dump** (Libraries, Voice-Upgrade, Trading-Feeds, Observability, Infra, Prozess) ist **weitgehend offen** (~7 % streng DONE).

**Empfohlenes Framing für die nächste Session:** nicht „Rest 0 %“, sondern „Tips-Kern ~64 % echt / Arsenal ~7–20 % / Gesamt ~35–40 % — nächste Welle = Top-15“.

---

## 8. Referenzen

- Originalumfang: Elite-Tips + Arsenal-Dump (Operator-Prompt 24.08.2026)
- Geprüfte Statusdocs: `docs/PRODUCTION-IMPLEMENTATION-STATUS.md`, `docs/IMPLEMENTATION-VERIFICATION-REPORT.md`
- Stichproben: `package.json`, `electron/workers/pdf-worker.ts`, `electron/employees/imap-idle.ts`, `electron/security/rate-limiter.ts`, `electron/main.ts` (Digest/Smoke/Updater), `src/lib/quant.ts`, `src/screens/TradingContent.tsx`, `docs/`-Baum

---

_Audit-only · keine Code-Änderungen · Stand 25.08.2026_
