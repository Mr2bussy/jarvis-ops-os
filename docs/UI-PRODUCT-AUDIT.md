# UI-Produkt-Audit — JARVIS Operations OS

**Pfad:** `G:\JAvis og rn`  
**Datum:** 25. August 2026  
**Adressat:** Operator Zac  
**Scope:** Renderer-Screens, Shell/Navigation, IPC-Verdrahtung, a11y, Interaktionen  
**Methode:** Code-Inspektion (`src/screens/*`, `src/components/shell.tsx`, Employees, bekannte Gap-Docs)  
**Part A:** UI-Polish an 4 dünnsten Screens (siehe Spalte „Part A“)

---

## Legende

| Severity | Bedeutung                                                                            |
| -------- | ------------------------------------------------------------------------------------ |
| **P0**   | Blockiert Kernfluss oder täuscht Live-Daten vor / Dead End ohne Ausweg               |
| **P1**   | Merklich unfertig: fehlende States, schwache a11y, unwired Feature mit sichtbarer UI |
| **P2**   | Polish, Konsistenz, Nice-to-have                                                     |

| Issue type    |                                                     |
| ------------- | --------------------------------------------------- |
| `interaction` | Klicks/Flows dünn, keine Feedback-States, Dead Ends |
| `a11y`        | Labels, Fokus, Tastatur, live-regions, Semantik     |
| `wiring`      | UI ohne IPC / Stub / Scaffold / Seed statt Live     |
| `visual`      | Abweichen vom HUD/Shell-Designsystem                |

---

## Part A — Polierte Screens (Zusammenfassung)

| Screen            | Warum gewählt                                                                | Status                                                   |
| ----------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Hermes Router** | Kein `ScreenHeader`/HoloPanel, generische Buttons, kein Bridge-Offline-State | **Part A fixed** (HUD + States + a11y)                   |
| **Harness Evals** | Roh-Layout, „Critic (stub)“ ohne Idle/Empty, kein Offline-State              | **Part A fixed**                                         |
| **E-Commerce**    | KPIs immer `$0`, keine Probe/Error-States, Fulfill Dead End                  | **Part A fixed** (ehrliche Empties; Wiring bleibt offen) |
| **Integrations**  | Filter ohne Label, schwaches Loading/Empty, IPC-Offline unklar               | **Part A fixed**                                         |

---

## Audit-Tabelle

| Sev | Screen / Modul                | Typ                         | Notes                                                                                                                                                                                          | Part A / offen                                            |
| --- | ----------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| P0  | **E-Commerce**                | wiring                      | Produkt-/Order-Listen nie befüllt — keine gemappte Composio Product/Order-Action; Sync liefert nur Health-Rohbytes. Fulfillment bewusst geblockt.                                              | **offen** (UI ehrlich gemacht in Part A)                  |
| P0  | **Content Module**            | wiring                      | Pipeline/Schedule/DEFAULT_SCHEDULE in `localStorage`; Cross-Post/Publish-Nodes sind Workflow-Canvas, kein Live-YouTube/IG/X-API-Post. Apps-Screen listet „ContentModule automation not wired“. | **offen**                                                 |
| P0  | **Employees · Email/IMAP**    | wiring                      | Rule-based Classifier; IMAP IDLE Scaffold (`imap-idle.ts`, Setup-Schritt: „IDLE scaffold“). Key-Check ≠ Live-SMTP-Ack.                                                                         | **offen**                                                 |
| P0  | **Employees · Invoice**       | wiring                      | Booking-Preview scaffold — immer gated, kein API-Call.                                                                                                                                         | **offen**                                                 |
| P1  | **Hermes Router**             | interaction / visual / a11y | Vorher: Prototyp ohne HUD. Discord/Slack oft ohne Keys → Test Send disabled (korrekt), aber Omnichannel-Claim überschätzt Telegram-only Live-Pfad.                                             | **Part A fixed** (UI); Wiring Discord/Slack **offen**     |
| P1  | **Harness Evals**             | wiring / interaction        | Critic-Score weiterhin Heuristik (nicht LLM). Full Matrix nur in Docs; UI = Smoke + Weekly.                                                                                                    | **Part A fixed** (UI/Idle/Offline); Critic **offen**      |
| P1  | **Integrations**              | wiring                      | OAuth + Katalog live wenn Key da; die meisten App-Chips sind nur Anzeige — kein generisches „Execute any tool“-UI. Nur Quick-Toolkits + GitHub-Test.                                           | **Part A fixed** (a11y/states); deep execute **offen**    |
| P1  | **Prop Maxing**               | wiring / interaction        | Explizit: rendert Plan, platziert keine Orders. Kein „Send to MT5“-Button — Operator muss Execution woanders anstoßen. Wenig a11y an Inputs.                                                   | **offen**                                                 |
| P1  | **Trading · ZeusBot**         | interaction                 | Custom URL erforderlich; kein Demo-Mode in Live-UI. MT5 disconnects als Known Gap (Apps-Screen).                                                                                               | **offen**                                                 |
| P1  | **Shell / Nav**               | a11y                        | Sidebar-Nav-Buttons ohne `aria-current` / aussagekräftige `aria-label`; Fokus-Ringe nicht durchgängig. Command-Palette vorhanden (Ctrl+K). Vault-Agentenzahl jetzt gemessen (Sidebar footer).  | **teilweise** (agent count); aria-current **offen**       |
| P1  | **Setup Wizard**              | wiring                      | Onboarding PARTIAL; IMAP-Schritt als Scaffold markiert. `isSetupDone` nur localStorage-Flag.                                                                                                   | **offen**                                                 |
| P1  | **Admin · Backup**            | wiring                      | Text: „use OS backup or manual copy“ — kein automatisiertes Backup-Tool.                                                                                                                       | **offen**                                                 |
| P1  | **Agents**                    | wiring                      | Fallback auf Seed-Katalog wenn Vault/IPC leer (`CATALOG FALLBACK`).                                                                                                                            | **offen** (Verhalten ehrlich)                             |
| P1  | **Arsenal**                   | wiring / visual             | Catalog Fallback bei fehlendem Vault; Encoding-Glitches in Labels (`â€”`).                                                                                                                     | **offen**                                                 |
| P1  | **Briefings**                 | a11y / interaction          | Error-Banner ohne `role="alert"`; Generation abhängig von Bridge/LLM.                                                                                                                          | **offen**                                                 |
| P1  | **Workflows**                 | interaction                 | Builder + Templates reichhaltig; Live-Runner/Persistenz teils lokal — Operator-Erwartung „deployed automation“ oft nicht erfüllt.                                                              | **offen**                                                 |
| P1  | **Apps · My Built Apps**      | wiring                      | Statische Gesundheitsnotizen (`KNOWN_GAP` / `ALPHA`), kein Live-Health-Probe der gelisteten Apps.                                                                                              | **offen**                                                 |
| P2  | **Harness Evals**             | visual                      | Score-Cards vs. globale `Stat`-Primitive leicht inkonsistent (lokal ok).                                                                                                                       | Part A mitigated                                          |
| P2  | **Ecommerce KPIs**            | visual                      | `<Value>` + ehrliche `none`-Badges wenn keine Live-Orders. Layout weiter schmal vs. große KPI-Karten.                                                                                          | **Part D5 fixed** (provenance); layout **offen**          |
| P2  | **Console / System**          | a11y / wiring               | Console + System in Shell-NAV verdrahtet; DegradedBanner + Bridge-offline States. Inputs ohne Labels teils offen.                                                                              | **Part D8 fixed** (routing/states); a11y labels **offen** |
| P2  | **CodeAnimation**             | visual                      | Eigenständiger Screen-Stil; weniger HUD-Konsistenz.                                                                                                                                            | **offen**                                                 |
| P2  | **browser-setup**             | interaction                 | Gut getrennt (Python / package / sidecar); Install mutiert User-Python — bewusst manuell.                                                                                                      | ok / monitor                                              |
| P2  | **Voice Overlay**             | interaction                 | p95 Latenz-SLO (3s) sichtbar im Overlay; Known Gap: lange Antworten brechen ab.                                                                                                                | **teilweise** (SLO strip)                                 |
| P2  | **Secret rotation**           | wiring                      | Nur UI-Hinweis, keine echte Rotation/Invalidierung.                                                                                                                                            | **offen**                                                 |
| P2  | **Eval suite Employees**      | wiring                      | ~6 Golden Fixtures ≪ ~20/Agent (Tip-Intent).                                                                                                                                                   | **offen**                                                 |
| P2  | **Digest / Daily**            | wiring                      | Handler stub / Morning Briefing ≠ Tip-Digest an Telegram.                                                                                                                                      | **offen**                                                 |
| P2  | **Windows Service / Updater** | wiring                      | NSSM scaffold; Updater braucht `UPDATE_FEED_URL`.                                                                                                                                              | **offen**                                                 |

---

## Modul-Kurzstatus (Navigator)

| Modul         | Reife (UI)     | Bemerkung                                                           |
| ------------- | -------------- | ------------------------------------------------------------------- |
| Bridge        | hoch           | HUD-Referenz; Live-Metriken + Selftest-Karte + `<Value>` provenance |
| Agents        | hoch           | Fallback ehrlich gekennzeichnet                                     |
| Workflows     | mittel–hoch    | Builder stark; Execution/Deploy schwächer                           |
| Briefings     | mittel         | LLM-abhängig; a11y dünn                                             |
| Trading       | hoch           | Floor dicht; Econ Calendar IPC wenn verfügbar                       |
| Content       | mittel         | Generierung ok; Publish/Schedule lokal/stub                         |
| Apps          | mittel         | Launch + Notes; Built-Apps nicht live                               |
| Integrations  | mittel→besser  | Part A; Deep Tools fehlen                                           |
| Admin         | hoch           | Vault/Tools dicht; Backup manuell                                   |
| Harness Evals | niedrig→besser | Part A UI; Critic stub                                              |
| Hermes Router | niedrig→besser | Part A UI; Discord/Slack Keys                                       |
| E-Commerce    | niedrig→besser | Part A + D5 ehrliche KPIs mit provenance; keine Live-Orders         |
| Prop Maxing   | mittel         | Plan-only by design                                                 |

---

## Top offene P0 / P1 (Priorität für nächste Sprints)

1. **P0 E-Commerce Live-Mapping** — Composio Product/Order/Fulfillment-Actions verdrahten oder Modul als „Connector health only“ in Nav-Desc klarstellen.
2. **P0 Content Publish** — Scheduler/Publish an echte Connectoren (YouTube/IG/X) oder UI als „Draft-only“ kennzeichnen.
3. **P0 Employee Email/IMAP** — Live-Fetch + LLM-Classify statt Rule/Scaffold; Setup-Copy anpassen.
4. **P1 Hermes Discord/Slack** — Keys + Deliver-Pfad oder Platforms als „planned“ markieren.
5. **P1 Harness Critic** — LLM-Critic oder Label dauerhaft „heuristic“ (Part A: „CRITIC (HEURISTIC)“).
6. **P1 Prop Maxing → MT5** — Optionaler „Request execution“ über Harness-Risk-Gate.
7. **P1 Shell a11y** — `aria-current` auf Nav, Fokus-Styles, Landmark-Roles.
8. **P1 Arsenal Encoding** — Mojibake in Form-Labels bereinigen.

---

## Part A — Dateien

- `src/screens/HermesRouter.tsx`
- `src/screens/HarnessEvals.tsx`
- `src/screens/Ecommerce.tsx`
- `src/screens/Integrations.tsx`

## Part D5/D8 — Dateien (2026-08-25)

- `src/lib/sourced.ts`, `src/lib/complete-result.ts`, `src/components/Value.tsx`, `src/components/DegradedBanner.tsx`
- `src/components/shell.tsx` (Console/System NAV, vault agent count, voice SLO strip)
- `src/screens/Bridge.tsx`, `src/screens/Console.tsx`, `src/screens/System.tsx`, `src/screens/Ecommerce.tsx`
- `src/styles.css` (responsive shell, no `#stage`)
- `e2e/performance-budget.spec.ts`
- `electron/main.ts` (`CompleteResult` IPC)

**Verifikation:** `pnpm exec tsc --noEmit` (Renderer + Electron) — OK (25.08.2026).

---

## Verwandte Docs

- `docs/FULL-SCOPE-GAP-AUDIT.md` — Elite-Tips + Arsenal (Backend/Infra)
- `docs/PRODUCTION-IMPLEMENTATION-STATUS.md` — Tip-Status
- `docs/FULL-SCOPE-IMPLEMENTATION-PASS.md` — Implementation-Pass Details

Dieses Dokument fokussiert **UI/Produkt-Oberfläche**; Backend-Scaffolds sind nur dort erwähnt, wo sie sichtbare Screens/Flows brechen.
