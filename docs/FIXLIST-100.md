# JARVIS Ops OS — Fixliste auf 100 %

> Erstellt: 24.08.2026 · Basis: laufende Instanz (PID 18220, gestartet 07:39) + Quellstand `master jarvis app project oggg`
> Methode: IPC-Vertragsdiff (Skript), Typecheck beider Projekte, komplette Testsuite, Live-Render des Renderers, Port-/Dienst-Probes, Konfig-Audit.

---

## 0. Kurzdiagnose

**Die Module scheitern nicht am Code. Sie scheitern an ihren Enden.**

Was gemessen wurde — und grün ist:

| Prüfung                        | Ergebnis                                              |
| ------------------------------ | ----------------------------------------------------- |
| IPC-Vertrag `preload` ⇄ `main` | **87 Handler / 86 Invokes — 0 Lücken**, 0 tote Events |
| `tsc -p electron` + `tsc -p .` | **beide fehlerfrei**                                  |
| `pnpm test`                    | **431/431 Tests grün** (37 Dateien, 6,8 s)            |
| Renderer-Boot (Vite :5173)     | **0 Konsolenfehler**, vollständiges Layout            |
| Secret-Handling                | safeStorage/DPAPI aktiv, keine Klartext-Keys im Store |

Was **nicht** grün ist, sind die Anschlüsse: das Standardmodell zeigt auf einen Anbieter ohne Schlüssel, der letzte Fallback ist strukturell tot, drei fertige Screens haben keine Route, und mehrere Panels zeigen Katalogzahlen statt Messwerte.

---

## 1. Modul-Statusmatrix (Ist-Zustand)

| #   | Modul                      | UI                 | Backend                                                      | Live              | Blockierende Ursache                                                                 |
| --- | -------------------------- | ------------------ | ------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------ |
| 1   | Bridge (Chat + Widgets)    | ✅                 | ✅                                                           | ⚠️ degradiert     | RC1 + RC2                                                                            |
| 2   | Agents                     | ✅                 | ✅ `jarvis:scan-agents`                                      | ⚠️ unehrlich      | RC5 (192/342 statt 121)                                                              |
| 3   | Workflows                  | ✅                 | ✅ `askJarvis`, `workflow:schedule` (node-cron, persistiert) | ⚠️                | RC1 + RC2                                                                            |
| 4   | Briefings                  | ✅                 | ✅ `composeBriefing`                                         | ⚠️                | RC1 + RC2                                                                            |
| 5   | Trading / ZeusBot          | ✅                 | ✅ `zeus:mt5` (+`X-JARVIS-Token`)                            | ⚠️ prüfen         | Bridge läuft auf :1234, MetaTrader5-Paket + terminal64 aktiv — Kontostatus ungeprüft |
| 6   | Content Oracle             | ✅                 | ⚠️ nur `searchWeb`                                           | ❌ dauerhaft leer | RC4 (0/5 Plattform-Keys)                                                             |
| 7   | My Apps                    | ✅                 | ✅                                                           | ✅                | —                                                                                    |
| 8   | Integrations (Composio)    | ✅                 | ✅ `composio:*`                                              | ⚠️                | Key gesetzt, Netzabruf ungeprüft; `browser-use` fehlt                                |
| 9   | Admin (+ Arsenal)          | ✅                 | ✅                                                           | ✅                | —                                                                                    |
| 10  | Harness Evals              | ✅                 | ✅                                                           | ⚠️                | RC1 + RC2 (jeder Eval-Lauf braucht LLM)                                              |
| 11  | Hermes Router              | ✅                 | ✅ aktiv (`enabled: true`, Poll 4 s)                         | ⚠️                | Discord aktiviert, aber kein `DISCORD_BOT_TOKEN` im Store                            |
| 12  | E-Commerce                 | ✅                 | Composio                                                     | ⚠️                | wie #8                                                                               |
| 13  | Prop Maxing                | ✅                 | lokal                                                        | ✅                | rein lokal, 20 Tests grün                                                            |
| —   | **Console** (1.247 Z.)     | ❌ **keine Route** | ✅ `console:runCmd`, `jarvis:complete-stream`                | ❌ unerreichbar   | RC3                                                                                  |
| —   | **System-Tools** (540 Z.)  | ❌ **keine Route** | ✅ `system:getProcs/memReduce/netScan/clearTemp/fileSearch`  | ❌ unerreichbar   | RC3                                                                                  |
| —   | **CodeAnimation** (810 Z.) | ❌ **keine Route** | —                                                            | ❌ unerreichbar   | RC3                                                                                  |
| —   | Voice                      | ✅                 | ✅ whisper-tiny gecacht (42 MB), ffmpeg im PATH              | ⚠️                | Antwortpfad hängt an RC1/RC2                                                         |

---

## 2. Root Causes

### RC1 — Das Standardmodell zeigt auf einen Anbieter ohne Schlüssel

`JARVIS_MODEL = claude-haiku-4-5` → `detectProviderFrom()` liefert `anthropic` → `ANTHROPIC_API_KEY` ist **leer in `.env` und nicht im safeStorage-Store** (`jarvis-config.json` enthält GEMINI, OLLAMA, MT5, TELEGRAM, COMPOSIO, BRIDGE_TOKEN — kein Anthropic, kein GitHub).
Folge: `pushPreferred()` legt gar keinen Versuch an ([electron/main.ts:397](../electron/main.ts#L397)), die Kette fällt auf Gemini (`gemini-2.0-flash`, Free-Tier-Limits), dann GitHub Models, dann Ollama — und Ollama ist tot (RC2). Letzte Stufe: `offlineJarvisReply()` ([main.ts:501](../electron/main.ts#L501)) — eine Konservenantwort, die aussieht, als sei JARVIS dumm geworden, statt zu sagen: kein Anbieter verfügbar.
**Betroffen: Bridge-Chat, Briefings, Workflows-Runner, Content-Recherche, Agents-Chat, Harness Evals, Voice-Antwort — also „die meisten Module".**

### RC2 — Der Ollama-Fallback kann nicht funktionieren (echter Bug)

`OLLAMA_HOST = https://api.ollama.com` (Ollama **Cloud**), aber `tryOllamaChat()` ([electron/main.ts:285–325](../electron/main.ts#L285)) sendet **keinen `Authorization: Bearer`-Header** — obwohl `OLLAMA_API_KEY` gesetzt ist. Jeder Cloud-Request endet in 401. Lokal lauscht ebenfalls nichts auf :11434.
Verschärfend: Weil `OLLAMA_BASE_URL` gesetzt ist, routet `detectProviderFrom(model, hasOllamaBase=true)` **jedes nicht eindeutige Modell** nach Ollama ([electron/ai/router.ts:22](../electron/ai/router.ts#L22)) — also ins Nichts.

### RC3 — Fertige Features ohne UI-Eingang

`Console.tsx`, `System.tsx`, `CodeAnimation.tsx` (zusammen **2.597 Zeilen**) werden **nirgends importiert**. `NAV` und der `ScreenId`-Union in [src/components/shell.tsx:11–43](../src/components/shell.tsx#L11) kennen nur 13 Einträge, `App.tsx:360–372` rendert nur diese 13.
Das Bittere: Die Backends sind **vollständig implementiert und gehärtet** — Shell-Ausführung mit Advanced-Mode-Gate und Audit-Log, Streaming-Completion, fünf System-Tools. Bezahlte Funktionalität, die im UI nicht existiert.

### RC4 — Externe Abhängigkeiten fehlen (kein Code-Fehler, wirkt aber wie einer)

- `browser-use` **nicht installiert** → Browser-Bridge :1237 tot → Browser-Automation im Harness unbenutzbar.
- **0/5 Content-Keys** (YOUTUBE / INSTAGRAM / TIKTOK / TWITTER / LINKEDIN) → Content-Modul zeigt strukturell Nullen.
- `JARVIS_SKILLS_INDEX` leer → Skills-Check meldet dauerhaft „skip".
- Discord im Hermes Router aktiviert, Token fehlt → Adapter läuft leer.

### RC5 — Katalogzahlen statt Messwerten

Sidebar: „42 cells · 192 agents" ([shell.tsx:28](../src/components/shell.tsx#L28), Quelle `AGENT_COUNT` aus `src/data/agents-catalog.ts`), Radar: „32/42 CELLS · 342 AGENTS", Integrations: „485 apps". Real im Vault (`G:\jarvis the og project\agents`): **121 Agent-Dateien**.
Das verletzt die eigene Verfassung — `AGENTS.md`, _IMMUTABLE: data honesty_, Regel 1. Und es ist der Hauptgrund, warum sich die App auch dort „kaputt" anfühlt, wo sie funktioniert: Wenn eine sichtbare Zahl nachweislich erfunden ist, glaubt man auch den echten nicht mehr.

### RC6 — Die laufende Instanz ist nicht der Quellstand

`dist-electron/main.js` kompiliert **07:39:05**, `electron/main.ts` zuletzt geändert **12:00:47** — 4,5 Stunden Main-Prozess-Änderungen laufen nicht mit. Der Renderer ist über Vite-HMR aktuell, der Main-Prozess nicht. (Die Handler-_Namen_ sind identisch, es fehlt also kein Kanal — aber jede Änderung an Handler-_Logik_ ist unsichtbar.)
Dazu: **158 uncommittete Änderungen, 96 unversionierte Dateien**, letzter Commit 22.08. `git diff` gegen HEAD: +12.642 / −19.200 Zeilen.

### RC7 — Zwei divergierende Kopien teilen einen Zustand

Die Logs unter `%APPDATA%\jarvis-ops-os\logs` zeigen einen zweiten Build mit `Company.tsx`, `ContextMenu.tsx`, `lib/toast.tsx`, `usePrefs.tsx` aus `G:\jarvis the og project\master jarvis app project oggg` — Dateien, die es im Desktop-Projekt nicht gibt. Beide Builds benutzen dieselbe `appId` und damit **denselben userData-Ordner**: gemeinsame Keys, gemeinsame DB, gemeinsame Scheduler-Jobs.
Zusätzlich: **12 `.bak`-Dateien mit 1,01 MB** liegen im `src`/`electron`-Baum (u. a. `TradingContent.tsx.bak`, `.bak2`, `.bak3`). Vite kompiliert sie nicht, aber jede Suche und jeder Agent stolpert darüber.

---

## 3. Fixliste

Reihenfolge = Ausführungsreihenfolge. Jeder Punkt hat ein prüfbares Abnahmekriterium.

### P0 — Ohne das ist die App nicht benutzbar (≈ 1 Arbeitstag)

**P0-1 · LLM-Kette reparieren** — _behebt RC1, betrifft 8 Module_

- In Admin → Connectors entweder `ANTHROPIC_API_KEY` hinterlegen **oder** `JARVIS_MODEL` auf `gemini-2.0-flash` umstellen (Key ist vorhanden).
- Code: In `resolveModelAndProvider()` einen Guard ergänzen — wenn das bevorzugte Modell einen Anbieter ohne Schlüssel verlangt, **sofort** auf den ersten Anbieter mit Schlüssel umschalten _und_ den Grund im UI anzeigen (nicht nur `pushActivity`).
- Abnahme: Bridge-Chat antwortet, Kopfzeile zeigt den **tatsächlich benutzten** Anbieter, `jarvis:voice-selftest` meldet `ok`.

**P0-2 · Ollama-Auth-Header nachrüsten** — _behebt RC2_

- `tryOllamaChat()` ([main.ts:285](../electron/main.ts#L285)) und `jarvis:ollama-transcribe`: `Authorization: Bearer ${getDecryptedKey('OLLAMA_API_KEY')}` senden, wenn die Base-URL nicht auf localhost zeigt.
- Test ergänzen: Cloud-Host ⇒ Header gesetzt, localhost ⇒ kein Header.
- Abnahme: `curl`-Äquivalent gegen `https://api.ollama.com/api/tags` liefert 200; Fallback-Kette erreicht Ollama.

**P0-3 · Kein stiller Offline-Fallback** — _macht RC1/RC2 sichtbar statt peinlich_

- `offlineJarvisReply()` darf nicht mehr als normale Antwort erscheinen. Rückgabe um ein Feld `degraded: true` + Grund erweitern, im Chat als Warnbanner rendern („Kein LLM-Anbieter erreichbar — Gemini 429, GitHub 401, Ollama 401").
- Abnahme: Bei abgeschalteten Keys zeigt die UI eine Diagnose, keine erfundene Antwort.

**P0-4 · Drei tote Screens anschließen** — _behebt RC3, +2.597 Zeilen fertige Funktion_

- `ScreenId` um `'console' | 'system'` erweitern, `NAV` um zwei Einträge, `App.tsx` um zwei `lazy()`-Routen.
- `CodeAnimation.tsx` entscheiden: als Easter-Egg/Screensaver einhängen **oder** löschen. Nicht liegen lassen.
- Abnahme: Console führt einen Befehl mit Advanced-Mode-Gate aus, System-Screen listet echte Prozesse über `system:getProcs`.

**P0-5 · Neustart-Disziplin** — _behebt RC6_

- `pnpm dev` beenden, `dist-electron` löschen, neu starten. Danach: Regel „nach jeder `electron/**`-Änderung Neustart, Renderer-Änderungen laufen über HMR".
- Optional: `nodemon`/`electronmon`-Watcher auf `electron/**` in `dev:electron`.
- Abnahme: `dist-electron/main.js` ist nie älter als `electron/main.ts`.

### P1 — Ehrlichkeit und Datenlage (≈ 1–2 Tage)

**P1-1 · Katalogzahlen durch Messwerte ersetzen** — _behebt RC5_

- `AGENT_COUNT`/`TEAMS.length` in `NAV` durch das Ergebnis von `jarvis:scan-agents` ersetzen (asynchron nachladen, bis dahin `—`).
- Radar-Kopfzeile („32/42 CELLS · 342 AGENTS") an dieselbe Quelle hängen.
- Integrations „485 apps" nur anzeigen, wenn der Live-Katalog geladen wurde, sonst „Katalog nicht geladen".
- Abnahme: Jede sichtbare Zahl stammt aus einer Messung oder trägt sichtbar das Label `KATALOG`.

**P1-2 · Content-Connectors: ehrlicher Leerzustand + echter Pfad**

- Pro Plattform eine Karte mit „nicht verbunden → hier Key hinterlegen" (Deep-Link nach Admin).
- Mindestens **einen** echten Connector fertigstellen (YouTube Data API ist am günstigsten) statt fünf halbe.
- Abnahme: Ein Kanal zeigt echte Abrufzahlen; die anderen vier sagen klar, dass sie nicht verbunden sind.

**P1-3 · Hermes Router aufräumen**

- Discord-Adapter deaktivieren, solange kein Token existiert; Statusleiste zeigt pro Plattform `bereit / kein Token / Fehler`.
- Abnahme: `gateway:status` und UI stimmen überein.

**P1-4 · Self-Test prominent machen**

- `jarvis:system-selftest` (bereits implementiert, [electron/system/selftest.ts](../electron/system/selftest.ts)) beim ersten Start automatisch ausführen und als Health-Karte auf der Bridge zeigen — nicht versteckt in Admin.
- Abnahme: Nach dem Start sieht der Operator in ≤ 3 Sekunden, welche Subsysteme grün/gelb/rot sind.

**P1-5 · MT5-Pfad verifizieren**

- Ende-zu-Ende prüfen: Terminal → `bridge.py` (:1234, Token) → `zeus:mt5` → UI. Kontostand, offene Positionen, ein Testauftrag im Demo-Konto.
- Abnahme: ZeusBot-Panel zeigt echte Kontodaten oder einen präzisen Fehler („MT5 nicht eingeloggt"), niemals `—`.

### P2 — Hygiene und Struktur (≈ 2–3 Tage)

**P2-1 · `.bak`-Dateien entfernen** — 12 Dateien, 1,01 MB. Git ist die Versionierung; `TradingContent.tsx.bak3` ist keine.
**P2-2 · Zwei Kopien zusammenführen** (RC7) — Desktop-Projekt zur einzigen Quelle erklären, die G:-Variante archivieren. Falls Features nur dort existieren (Company-Screen, Toast-System, Kontextmenü): portieren, dann archivieren.
**P2-3 · Arbeit committen** — 158 Änderungen / 96 unversionierte Dateien in thematische Commits. Ohne das ist kein Rollback möglich.
**P2-4 · `browser-use` installieren** oder das Browser-Bridge-Feature im UI als „nicht installiert" markieren (mit Ein-Klick-Setup wie in `browser-setup.tsx` bereits vorbereitet).
**P2-5 · Monolithen aufteilen** — `TradingContent.tsx` (3.081 Z.), `Admin.tsx` (2.074 Z.), `main.ts` (94 KB). Reihenfolge: Trading zuerst, dort ist die höchste Änderungsrate.

### P3 — Auslieferung (≈ 1–2 Tage)

**P3-1 · `npm run build:win`** ausführen und den NSIS-Installer auf einer sauberen VM testen (kein Node, keine Dev-Tools).
**P3-2 · Packaged-Build-Test der Key-Kette** — `app.isPackaged` schaltet die `.env`-Lesung ab ([config/store.ts:55](../electron/config/store.ts#L55)). Alle Schlüssel müssen im safeStorage liegen, sonst ist die gepackte App **leer**, obwohl die Dev-Version läuft. **Das trifft aktuell `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `GEMINI_MODEL`, `JARVIS_MODEL` und `JARVIS_AGENTS_PATH` — sie stehen teils nur in `.env`.**
**P3-3 · Code-Signing** oder dokumentierter SmartScreen-Hinweis.
**P3-4 · Erststart auf fremdem Rechner** — Setup-Wizard, Vault-Pfad, MT5-Bridge, Voice-Modell-Download.

---

## 4. Definition von 100 %

1. Jeder Sidebar-Eintrag führt zu einem Screen, der **entweder** echte Daten zeigt **oder** exakt benennt, was fehlt und wo man es hinterlegt.
2. Kein sichtbarer Zahlenwert ohne Quelle: gemessen, oder sichtbar als `KATALOG` markiert.
3. Kein stiller Fallback: Jede Degradation erscheint als Zustand im UI, nicht als erfundene Antwort.
4. `pnpm test` grün, `tsc` beider Projekte grün, `pnpm lint` ohne Fehler.
5. Self-Test meldet `healthy: true` oder listet ausschließlich bewusst akzeptierte Warnungen.
6. Der gepackte Installer startet auf einer sauberen VM und führt durch Setup bis zur ersten echten LLM-Antwort.
7. Ein Commit auf `main`, Arbeitsbaum sauber, eine einzige Projektkopie.

---

## 5. Sofortmaßnahmen (die nächsten 30 Minuten)

```powershell
cd "C:\Users\Administrator\Desktop\master jarvis app project oggg"
# 1. Dev-Prozesse beenden, damit der Main-Prozess neu kompiliert
Get-Process electron,node | Where-Object { $_.Path -like "*master jarvis*" } | Stop-Process -Force
Remove-Item dist-electron -Recurse -Force
# 2. Ballast raus
Get-ChildItem src,electron -Recurse -Include *.bak,*.bak2,*.bak3 | Remove-Item -Force
# 3. Stand sichern, bevor irgendetwas repariert wird
git add -A; git commit -m "chore: snapshot before fixlist execution"
# 4. Neu starten
pnpm dev
```

Danach in der App: **Admin → Connectors** → `JARVIS_MODEL` auf `gemini-2.0-flash` setzen (oder Anthropic-Key hinterlegen) → **Self-Test** ausführen.
