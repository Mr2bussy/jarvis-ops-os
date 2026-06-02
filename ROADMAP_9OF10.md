# JARVIS Operations OS — Roadmap auf 9/10 (alle Rating-Dimensionen)

> Ziel: Jede Dimension des Audits von ihrem Ist-Stand auf **9/10** heben.
> Dieses Dokument ist abarbeitbar (Checkboxen), priorisiert (P0–P2), mit Aufwand,
> Definition-of-Done (DoD) und Code-Snippets pro Maßnahme.
> Referenz-Audit: siehe Chat-Analyse vom 2026-06-02.

---

## 0. Scorecard — Ist → Ziel

| # | Dimension | Ist | Ziel | Haupt-Hebel |
|---|-----------|-----|------|-------------|
| 1 | Tests / Zuverlässigkeit | 1 | **9** | Vitest + pytest + Playwright, ≥80 % Coverage, CI-Gate |
| 2 | Code-Qualität / Wartbarkeit | 5 | **9** | ESLint+Prettier, God-Files splitten, Generator-Müll raus |
| 3 | Electron-Security | 6 | **9** | RCE entschärfen, MT5-Auth, zod-IPC, sandbox, Signing |
| 4 | Distribution / Prod-Readiness | 3 | **9** | Code-Signing, Auto-Update, CI-Release, Python bundeln |
| 5 | Doku / DX | 6 | **9** | `dev`-Script fix, Arch-Docs, vollständige `.env.example` |
| 6 | Feature-Vollständigkeit | 7 | **9** | Scheduler persistent, CATALOG↔LIVE trennen, States |
| 7 | Architektur & Stack | 8 | **9** | State-Mgmt, typisierte IPC-Schicht, Module-Boundaries |
| 8 | Ambition & Scope | 9 | **9** | halten — Scope-Creep vermeiden |

### Prioritäts- & Aufwands-Legende
- **P0** = Ship-Blocker / Sicherheit / Fundament. **P1** = Professionalisierung. **P2** = Politur/Skalierung.
- Aufwand: **S** ≤ 0,5 Tag · **M** ≈ 1–2 Tage · **L** ≈ 3–5 Tage · **XL** > 1 Woche.

### Empfohlene Reihenfolge (Phasenplan)
```
Phase 0  Fundament       (P0)  → Tooling, CI-Skeleton, dev-Script           [2–3 Tage]
Phase 1  Sicherheit      (P0)  → RCE, MT5-Auth, zod-IPC, sandbox            [4–6 Tage]
Phase 2  Testnetz        (P0)  → Vitest/pytest/Playwright, ≥80 % Coverage   [5–8 Tage]
Phase 3  Refactor        (P1)  → God-Files splitten (jetzt sicher dank Tests)[5–8 Tage]
Phase 4  Features/State  (P1)  → Scheduler-Persistenz, CATALOG/LIVE, States [4–6 Tage]
Phase 5  Distribution    (P1)  → Signing, Auto-Update, Release-CI, Python   [5–8 Tage]
Phase 6  Doku & Politur  (P1/2)→ Arch-Docs, ADRs, Onboarding, Performance   [3–5 Tage]
```
> **Regel:** Phase 2 (Tests) **vor** Phase 3 (Refactor). Refactoring ohne Tests ist Blindflug.

---

## Dimension 1 — Tests / Zuverlässigkeit (1 → 9)  · **P0**

**Definition of 9/10:** Test-Runner für TS *und* Python eingerichtet; reine Logik (`src/lib`, `electron/` non-UI, `bridge.py`) **≥ 80 % Line-Coverage**; mind. 1 E2E-Smoke-Test, der die App startet und alle Screens ohne Console-Error rendert; CI lässt keinen roten Build mergen.

### 1.1 TS-Test-Infrastruktur (Vitest)  · S
- [ ] `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` installieren.
- [ ] `vitest.config.ts` anlegen:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**', 'electron/**'],
      exclude: ['**/*.d.ts', 'electron/preload.ts'],
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
  },
});
```
- [ ] `package.json` Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:cov": "vitest run --coverage"`.
- **DoD:** `npm test` läuft grün mit ≥ 1 Test.

### 1.2 Unit-Tests für reine Logik (höchster ROI)  · M
Diese Funktionen sind pur und ohne Mocking testbar — sie zuerst:
- [ ] `src/lib/claude.ts` → `extractJson()` (Fenced-/Raw-JSON, kaputtes JSON → `null`), `BRIEFING_KINDS[*].prompt()` (enthält Schema-Keys).
- [ ] `electron/main.ts` → ausgelagert nach `electron/ai/router.ts`: `detectProvider()` (alle Modellpräfixe), `compressSystem()` (Kürzungsgrenze), `compressMsgs()` (schneidet auf User-Turn).
- [ ] `electron/security/paths.ts` → `isPathAllowed()` (erlaubt userData, verweigert `..`-Traversal, case-insensitive auf Windows).
- [ ] `electron/system/metrics.ts` → `cpuUtilAll()` mit gemockten `os.cpus()`-Deltas (Util ∈ [0,1]).
- **DoD:** Jede Funktion hat Happy-Path + ≥ 2 Edge-Cases. Coverage `src/lib` ≥ 85 %.

> **Hinweis:** Diese Tests setzen voraus, dass die Funktionen aus dem 1165-Zeilen-`main.ts` in Module gezogen werden → koppelt direkt an Dimension 2.3. Reihenfolge: erst extrahieren, dann testen.

### 1.3 IPC-Handler-Integrationstests (Electron gemockt)  · M
- [ ] `electron` in Vitest mocken (`vi.mock('electron', ...)`): `safeStorage`, `app.getPath`, `ipcMain.handle`.
- [ ] `config:setKey`/`getKey` Round-Trip: verschlüsselt schreiben → entschlüsselt lesen (mit & ohne `safeStorage.isEncryptionAvailable`).
- [ ] `routedComplete()` Provider-Routing mit `vi.fn()`-gemocktem `fetch` je Provider (OpenAI/Mistral/DeepSeek/Ollama Body-Shape, Anthropic via SDK-Mock).
- [ ] `jarvis:write-file`/`read-file-content`: verweigert Pfad außerhalb Allowlist.
- **DoD:** Provider-Router + Config-Store + File-IO sind abgedeckt.

### 1.4 Python-Bridge-Tests (pytest)  · M
- [ ] `mt5_bridge/requirements-dev.txt`: `pytest`, `pytest-cov`.
- [ ] `MetaTrader5` mit `unittest.mock` faken (kein echtes Terminal nötig).
- [ ] Testen: `resolve_symbol()` (Varianten-Fallback), `corr_json()` → `pearson()` (bekannte Korrelation = 1.0/−1.0), `batch_json()` (24h-Change-Mathe), `close_all_json()` **darf nur bei `_armed=True` Orders senden** (s. Dim. 3.4).
- **DoD:** `pytest --cov=bridge` ≥ 75 %.

### 1.5 E2E-Smoke (Playwright + Electron)  · M
- [ ] `@playwright/test` + Electron-Launcher.
- [ ] Test: App startet → jeder Screen wird angeklickt → **0 `console.error`** → Screenshot-Artefakt.
- [ ] Test: Setup-Wizard erscheint bei leerem `userData`, verschwindet nach Key-Eingabe.
- **DoD:** `npm run test:e2e` startet die gebaute App headless und navigiert fehlerfrei.

### 1.6 Coverage-Gate in CI  · S
- [ ] GitHub Action bricht bei < 80 % oder rotem Test ab (siehe Anhang B).
- **DoD:** PR mit fehlendem Test kann nicht gemergt werden.

---

## Dimension 2 — Code-Qualität / Wartbarkeit (5 → 9)  · **P0/P1**

**Definition of 9/10:** 0 ESLint-Errors bei `strict`-Regelsatz; Prettier erzwungen via Pre-Commit; keine Datei > 600 Zeilen; kein toter/Generator-Code im Repo; DRY bei Provider-Calls; öffentliche Module mit TSDoc.

### 2.1 Linting & Formatting  · S
- [ ] `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-import`, `prettier`, `eslint-config-prettier` installieren.
- [ ] `eslint.config.js` (Flat-Config) mit `@typescript-eslint/recommended-type-checked`, `react-hooks/recommended`, Regel `max-lines: [warn, 600]`, `no-floating-promises: error`.
- [ ] `.prettierrc` (singleQuote, printWidth 110, trailingComma all).
- [ ] Scripts: `"lint": "eslint . --max-warnings 0"`, `"format": "prettier --write ."`.
- **DoD:** `npm run lint` = 0 Errors (Warnings für `max-lines` als Refactor-Backlog ok).

### 2.2 Pre-Commit-Hooks  · S
- [ ] `husky` + `lint-staged`: bei jedem Commit `eslint --fix` + `prettier` + `tsc --noEmit` auf Staged-Files.
```jsonc
// package.json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```
- **DoD:** Kein unformatierter/fehlerhafter Code kann committet werden.

### 2.3 God-Files zerlegen  · L
Aktuelle Monolithen (Refactor **nach** Phase 2/Tests):
- [ ] **`electron/main.ts` (1165 Z.)** → modularisieren:
  ```
  electron/
    main.ts            (nur App-Lifecycle, Window, Bootstrapping)
    config/store.ts    (safeStorage Config-Store)
    ai/router.ts       (routedComplete, detectProvider, compress*)
    ai/providers/      (anthropic.ts, openai-compat.ts, gemini.ts, …)
    system/metrics.ts  (cpuUtilAll, diskInfo)
    system/tools.ts    (SAFE_TOOL_CMDS, procs, netScan, …)
    trading/mt5.ts     (zeus:ping, zeus:mt5, bridge-autostart)
    apps/registry.ts   (apps:* Handler)
    agents/scanner.ts  (scan-agents, live-scan, rebuild-index)
    scheduler/cron.ts  (workflow:* + Persistenz, s. Dim. 6.1)
    security/paths.ts  (isPathAllowed)
    security/ipc.ts    (zod-Schemas + validate(), s. Dim. 3.3)
  ```
- [ ] **`src/screens/TradingContent.tsx` (3372 Z.)** → `GodModeTab.tsx`, `ZeusTab.tsx`, `MarketDataTab.tsx` + `hooks/useMt5Poll.ts`, `hooks/useRates.ts`.
- [ ] **`src/screens/Workflows.tsx` (2349 Z.)** → `WorkflowList`, `WorkflowEditor`, `ScheduleDialog`, `RunHistory`.
- **DoD:** Keine Datei > 600 Z.; jedes Modul hat genau eine Verantwortung; alle Tests bleiben grün.

### 2.4 DRY: OpenAI-kompatible Provider vereinheitlichen  · S
`routedComplete` (main.ts:155–211) wiederholt OpenAI/Mistral/DeepSeek/Ollama nahezu identisch. Eine Helper-Funktion:
```ts
// electron/ai/providers/openai-compat.ts
export async function openAICompatComplete(o: {
  baseUrl: string; apiKey?: string; model: string; label: string;
  messages: { role: string; content: string }[]; system?: string; maxTokens: number;
}): Promise<string> {
  const msgs = o.system ? [{ role: 'system', content: o.system }, ...o.messages] : o.messages;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (o.apiKey) headers.Authorization = `Bearer ${o.apiKey}`;
  const res = await fetch(`${o.baseUrl}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({ model: o.model, max_tokens: o.maxTokens, messages: msgs }),
  });
  if (!res.ok) throw new Error(`${o.label} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json() as any).choices?.[0]?.message?.content ?? '';
}
```
- **DoD:** 4 Provider-Branches → 4 dünne Aufrufe; Verhalten durch Test 1.3 abgesichert.

### 2.5 Generator-Scaffolding entfernen  · S
- [ ] `_assemble.py`, `_patch_*.py`, `_widgets_part_a.py`, `_widgets_part_b.py`, `_cnt_workflows_tab.py`, `_search_transcript.py`, `bridge.py` (Root-Duplikat von `mt5_bridge/bridge.py`) aus dem Repo entfernen.
- [ ] Falls historisch relevant: nach `tools/legacy/` verschieben + in `.gitignore` oder mit `README` „nicht Teil des Builds" markieren.
- **DoD:** Repo-Root enthält nur Source-of-Truth; keine Mehrdeutigkeit, welche Datei „echt" ist.

### 2.6 Strukturierter Logger statt `console.*`  · S
- [ ] `electron-log` im Main-Prozess; Renderer-Errors über bestehenden `console-message`-Hook (main.ts:977) in Datei spiegeln.
- **DoD:** Logs landen in `userData/logs/` mit Leveln; keine nackten `console.log` im Prod-Pfad.

---

## Dimension 3 — Electron-Security (6 → 9)  · **P0**

**Definition of 9/10:** Kein uneingeschränkter RCE-Pfad ohne explizite, geloggte Nutzerfreigabe; alle IPC-Payloads validiert; lokaler Trading-Port authentifiziert; `@doyensec/electronegativity`-Scan ohne High-Findings; App signiert.

### 3.1 RCE entschärfen — `console:runCmd`  · M
`main.ts:905` führt beliebige Shell-Kommandos aus. Maßnahmen:
- [ ] Hinter **explizitem „Advanced Mode"-Toggle** (Default: aus) im Admin-Screen + in `userData`-Config gespeichert.
- [ ] Bei aktivem Modus: **Bestätigungsdialog** (`dialog.showMessageBox`) vor Ausführung + **Audit-Log** (wer/was/wann) ins Activity-Ring + Datei.
- [ ] Timeout/`maxBuffer` bleiben; zusätzlich `shell: false` wo möglich, sonst dokumentierte Ausnahme.
- [ ] Persona-Lüge auflösen: `claude.ts:46` behauptet „cannot execute code" — entweder Fähigkeit ehrlich beschreiben **oder** Capability entfernen. Konsistenz herstellen.
- **DoD:** Ohne Advanced-Mode kein Shell-Zugriff; jede Ausführung ist auditierbar.

### 3.2 MT5-Bridge absichern  · M
`mt5_bridge/bridge.py` lauscht auf `127.0.0.1:1234` mit `Access-Control-Allow-Origin: *` und **ohne Auth** → jede lokale Webseite kann `close_all` feuern.
- [ ] **CORS-Header komplett entfernen.** Die Bridge wird ausschließlich vom Electron-**Main**-Prozess via `fetch` aufgerufen (`zeus:mt5`-Handler) — der unterliegt keiner Same-Origin-Policy. `ACAO:*` öffnet nur unnötig den Browser-CSRF-Vektor.
- [ ] **Shared-Secret-Token:** Main-Prozess generiert beim ersten Start ein Token (in `safeStorage`), startet `bridge.py` mit `env JARVIS_BRIDGE_TOKEN=…`, sendet es als Header `X-JARVIS-Token`:
```python
# bridge.py
import os, hmac
AUTH_TOKEN = os.environ.get("JARVIS_BRIDGE_TOKEN", "")
def _authorized(self) -> bool:
    if not AUTH_TOKEN: return False          # fail-closed: ohne Token kein Zugriff
    return hmac.compare_digest(self.headers.get("X-JARVIS-Token",""), AUTH_TOKEN)
# in do_GET/do_POST ganz am Anfang:
if not self._authorized():
    return self.send_json(401, {"error": "unauthorized"})
```
- [ ] Electron-Seite (`tryStartMt5Bridge` main.ts:763 + `zeus:mt5` main.ts:813): Token in `spawn`-Env setzen und Header mitsenden.
- **DoD:** Aufruf ohne korrektes Token → 401; Browser-Tab kann den Port nicht mehr missbrauchen.

### 3.3 zod-Validierung auf allen IPC-Payloads  · M
- [ ] `zod` installieren; `electron/security/ipc.ts` mit Schemas + `validate()`:
```ts
import { z } from 'zod';
export const CompletePayload = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(100_000),
  })).min(1).max(50),
  system: z.string().max(20_000).optional(),
  maxTokens: z.number().int().positive().max(8192).optional(),
});
export function validate<T>(s: z.ZodType<T>, d: unknown): T {
  const r = s.safeParse(d);
  if (!r.success) throw new Error(`IPC validation: ${r.error.issues[0]?.message}`);
  return r.data;
}
```
- [ ] In **jedem** `ipcMain.handle` Payload zuerst durch `validate(...)` schicken (Completion, Config, MT5, File-IO, Apps, Social, Workflow).
- **DoD:** Kein Handler verarbeitet ungetypte Eingaben; Type-Confusion-Vektor geschlossen.

### 3.4 Trading-Sicherheit (echtes Geld)  · S
- [ ] `close_all_json()` (bridge.py:132) **prüft `_armed`** und verweigert sonst (Default safed).
- [ ] Order-sendende Endpunkte schreiben ins **Trade-Audit-Log** (Symbol, Volumen, Ticket, Zeit, Ergebnis).
- [ ] UI: „PANIC / Close-All" hinter 2-Schritt-Bestätigung.
- **DoD:** Keine Order ohne aktiven Arm-Zustand + Bestätigung + Log.

### 3.5 Window-/Session-Hardening  · S
- [ ] `sandbox: true` setzen (main.ts:939) und Preload darauf prüfen (nur `contextBridge`/`ipcRenderer` nötig → kompatibel).
- [ ] `will-navigate`-Guard: externe Navigation blocken (nur interne Routes erlaubt).
- [ ] **CSP auch im Dev-Modus** aktivieren (aktuell nur `!isDev`, main.ts:962) — sonst testest du eine andere Sicherheitslage als du auslieferst.
- **DoD:** Dev- und Prod-CSP identisch; Sandbox aktiv; keine ungewollte Navigation.

### 3.6 Security-Scan & Pfad-Fix  · S
- [ ] Hardcodierten Pfad `G:\Codingbackup und tools\all ai agents and boosters` aus `isPathAllowed` (main.ts:781) entfernen → ausschließlich über `JARVIS_AGENTS_PATH` + `userData`.
- [ ] `npx @doyensec/electronegativity -i .` in CI; High-Findings = Build-Fail.
- **DoD:** Scan ohne High-Findings; keine maschinenspezifischen Pfade im Code.

---

## Dimension 4 — Distribution / Prod-Readiness (3 → 9)  · **P1**

**Definition of 9/10:** Signiertes Installer-Artefakt baut reproduzierbar in CI für Win (+ optional mac/linux); Auto-Update funktioniert; Crash-Reporting aktiv; Python-Bridge ohne manuelle Installation lauffähig; getestet auf sauberer VM.

### 4.1 Code-Signing  · M
- [ ] Windows: Authenticode-Zertifikat (OV/EV) in `electron-builder` (`win.certificateSubjectName` o. `CSC_LINK`/`CSC_KEY_PASSWORD` als CI-Secrets).
- [ ] macOS (falls Ziel): Notarization (`afterSign`-Hook, `notarytool`).
- **DoD:** Installer löst keine SmartScreen-„Unbekannter Herausgeber"-Warnung aus.

### 4.2 Auto-Update  · M
- [ ] `electron-updater`; Release-Feed über GitHub Releases (`publish: github`).
- [ ] Update-Check beim Start + „Neustarten zum Aktualisieren"-Toast.
- **DoD:** Neue Version wird erkannt, geladen, installiert.

### 4.3 Python-Bridge ohne User-Setup  · L
Aktuell braucht der User Python + `pip install MetaTrader5`. Optionen:
- [ ] **Empfohlen:** Bridge mit **PyInstaller** zu `bridge.exe` einfrieren, als `extraResources` bundeln, `spawn('bridge.exe')` statt `spawn('python', …)`.
- [ ] Fallback-Erkennung: kein Python/keine exe → klare UI-Meldung + Doku-Link statt stillem `catch` (main.ts:772).
- **DoD:** Trading-Bridge startet auf einer Maschine ohne vorinstalliertes Python.

### 4.4 Crash-Reporting & Telemetrie (opt-in)  · S
- [ ] Sentry (`@sentry/electron`) für Main + Renderer; DSN als Env.
- [ ] Opt-in-Dialog beim Erststart (DSGVO-konform, da deutscher Nutzer).
- **DoD:** Crashes erscheinen mit Stacktrace im Dashboard; Nutzer hat zugestimmt.

### 4.5 Versionierung & Release-Hygiene  · S
- [ ] Conventional Commits + `CHANGELOG.md` (z. B. `changesets` oder `standard-version`).
- [ ] SemVer; `productName`/`appId` bleiben stabil.
- **DoD:** Jedes Release hat nachvollziehbares Changelog + Tag.

### 4.6 Clean-VM-Verifikation  · S
- [ ] Frische Windows-10/11-VM (kein Node, kein Dev-Tooling): Installer ausführen, App starten, Setup-Wizard, Voice, System-Metriken, (optional) MT5.
- **DoD:** Dokumentiertes Test-Protokoll „installiert & läuft auf Clean-VM".

---

## Dimension 5 — Doku / DX (6 → 9)  · **P1**

**Definition of 9/10:** Ein neuer Entwickler ist in < 10 min lauffähig; Architektur, IPC-Vertrag und Sicherheitsmodell sind dokumentiert; alle real gelesenen Env-Variablen stehen in `.env.example`.

### 5.1 Kaputten Quickstart fixen  · S
README behauptet `npm run dev` — **existiert nicht** in `package.json`.
- [ ] `concurrently` installieren, Script ergänzen:
```jsonc
"dev": "concurrently -k -n vite,electron -c green,cyan \"npm:dev:vite\" \"wait-on tcp:5173 && npm:dev:electron\""
```
  (`wait-on`, damit Electron erst lädt, wenn Vite auf :5173 bereit ist — sonst `did-fail-load`.)
- **DoD:** `npm run dev` startet Vite **und** Electron mit Hot-Reload in einem Befehl.

### 5.2 `.env.example` vervollständigen  · S
Code liest u. a. `GEMINI_API_KEY`, `GITHUB_TOKEN`, `DASHSCOPE_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `OLLAMA_HOST/MODEL/API_KEY`, `BRAVE_API_KEY`, `N8N_WEBHOOK_URL/API_KEY`, `MT5_HOST/PORT`, neu `JARVIS_BRIDGE_TOKEN` — aktuell stehen nur 4 drin.
- [ ] Alle real referenzierten Variablen mit Kommentar + Quelle-Link aufnehmen.
- **DoD:** `.env.example` ist vollständig; kein „warum geht Feature X nicht?"-Rätselraten.

### 5.3 Architektur- & Sicherheits-Doku  · M
- [ ] `docs/ARCHITECTURE.md`: Prozess-Diagramm (Main ↔ Preload ↔ Renderer ↔ MT5-Bridge ↔ LLM-Provider), Datenflüsse, localStorage-Keys.
- [ ] `SECURITY.md`: Bedrohungsmodell, Advanced-Mode, MT5-Token, Reporting-Kontakt.
- [ ] `docs/adr/` (Architecture Decision Records): z. B. „Warum safeStorage statt .env", „Warum Multi-Provider-Routing".
- **DoD:** Architektur ist ohne Code-Lesen verständlich.

### 5.4 IPC-Vertrag dokumentieren  · S
- [ ] `docs/IPC.md` aus `global.d.ts` ableiten (Tabelle: Channel · Payload · Return · Risiko).
- **DoD:** Jeder IPC-Kanal hat eine dokumentierte Signatur.

### 5.5 README-Politur  · S
- [ ] Screenshots/GIF je Screen, „What's LIVE vs CATALOG"-Tabelle (aus `todo.md`) übernehmen, Troubleshooting-Sektion (Mic, MT5, Rate-Limits).
- **DoD:** README verkauft das Projekt und onboarded gleichzeitig.

---

## Dimension 6 — Feature-Vollständigkeit (7 → 9)  · **P1/P2**

**Definition of 9/10:** Keine stillen Datenverluste; klare visuelle Trennung von Echt- und Katalog-Daten; jeder asynchrone Zustand hat Loading/Empty/Error-States.

### 6.1 Scheduler persistent machen (Bug!)  · M
`scheduledJobs` ist eine In-Memory-`Map` (main.ts:1007) → **alle geplanten Workflows sind nach App-Neustart weg.**
- [ ] Jobs nach `userData/scheduled-jobs.json` serialisieren bei `schedule`/`cancel`.
- [ ] Bei `app.whenReady` aus Datei laden und `cron.schedule` re-registrieren.
- [ ] `lastRun`/`runCount` mitpersistieren; „nächste Ausführung" in UI anzeigen.
- **DoD:** Geplanter Workflow überlebt Neustart und feuert weiter.

### 6.2 CATALOG ↔ LIVE im Datenlayer trennen  · M
- [ ] In `src/data/*` jede Konstante taggen: `// CATALOG — not live` vs. echte Quelle.
- [ ] UI: einheitliches `<CatalogBadge/>` überall, wo Daten nicht live sind (ZEUS-Strategien, statische Listen).
- **DoD:** Nutzer verwechselt nie Demo- mit Echtdaten.

### 6.3 ZEUS / Strategien real verbinden oder klar gaten  · M
- [ ] Entweder echte Strategie-Anbindung an MT5, oder Strategien sichtbar als „nicht verbunden" sperren (kein scheinbar-aktiver Button).
- **DoD:** Kein „Fake-Active"-Zustand.

### 6.4 UI-Zustände vereinheitlichen  · M
- [ ] Generische Komponenten `<Loading/>`, `<EmptyState/>`, `<ErrorState onRetry/>`.
- [ ] In allen async-Screens (Trading-Polling, Agents-Scan, Briefings, Workflows) einsetzen; Offline-/Rate-Limit-Fälle abfangen.
- **DoD:** Kein Screen zeigt im Fehler-/Leerfall ein blankes/eingefrorenes Bild.

---

## Dimension 7 — Architektur & Stack (8 → 9)  · **P2**

**Definition of 9/10:** State-Management entkoppelt von Prop-Drilling; eine typisierte, validierte IPC-Schicht; klare Modulgrenzen; messbare Renderer-Performance.

### 7.1 State-Management einführen  · M
- [ ] `zustand` (leichtgewichtig) für globalen Zustand (Screen, OS-State, Diag, Config-Flags) statt Prop-Drilling durch `App.tsx`.
- **DoD:** Screens ziehen Zustand selektiv; weniger Re-Renders.

### 7.2 Typisierte IPC-Client-Schicht  · M
- [ ] `src/lib/bridge.ts`: dünner, vollständig getypter Wrapper um `window.jarvisBridge` mit zentralem Error-Mapping (statt überall `(window as any).jarvisBridge`, z. B. App.tsx:68).
- **DoD:** Renderer ruft nie `as any`; Fehler einheitlich normalisiert.

### 7.3 Performance-Härtung  · M
- [ ] Lange Listen (Agents, Activity-Feed, Order-Book) virtualisieren (`@tanstack/react-virtual`).
- [ ] Chart-Updates (`lightweight-charts`) drosseln/memoizen; Polling-Intervalle adaptiv (pausieren wenn Screen nicht sichtbar).
- **DoD:** Keine UI-Jank bei 200+ Listeneinträgen oder Live-Charts.

---

## Dimension 8 — Ambition & Scope (9 → halten)

**Definition of 9/10 (bereits erreicht):** Kohärente, ambitionierte Produktvision.
- [ ] **Scope einfrieren** bis Phase 1–3 (Security/Tests/Refactor) abgeschlossen sind — keine neuen Module.
- [ ] `VISION.md`: Was JARVIS *ist* und bewusst *nicht* ist (Anti-Scope), damit Feature-Wünsche bewertbar werden.
- **DoD:** Jede neue Idee wird an `VISION.md` gemessen, nicht reflexartig gebaut.

---

## Anhang A — Tooling-Bootstrap (Copy-paste)

```bash
# Tests
npm i -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @playwright/test
# Lint/Format
npm i -D eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-import prettier eslint-config-prettier husky lint-staged
# DX
npm i -D concurrently wait-on
# Security / Runtime
npm i zod
npm i -D @doyensec/electronegativity
# Distribution / Ops
npm i electron-updater @sentry/electron electron-log
# Python (Dev)
#   pip install pytest pytest-cov pyinstaller
```

## Anhang B — CI/CD (GitHub Actions Skeleton)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc -p tsconfig.json --noEmit
      - run: npx tsc -p electron/tsconfig.json --noEmit
      - run: npm run test:cov          # bricht bei <80% ab (Threshold in vitest.config)
      - run: npx @doyensec/electronegativity -i . || true   # später: kein "|| true"
  python:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r mt5_bridge/requirements-dev.txt
      - run: pytest mt5_bridge --cov=mt5_bridge.bridge
# release.yml (separat, on: tag) → electron-builder --win + signing + publish github
```

## Anhang C — „9/10"-Rubrik (Abnahme-Gates pro Dimension)

| Dim | Hartes Gate für 9/10 |
|-----|----------------------|
| 1 Tests | `npm run test:cov` grün, Coverage ≥ 80 % (lib+electron), pytest ≥ 75 %, 1 E2E-Smoke |
| 2 Code | `npm run lint` 0 Errors, keine Datei > 600 Z., Generator-Skripte entfernt |
| 3 Security | Electronegativity 0 High, RCE hinter Advanced-Mode+Audit, MT5-Token aktiv, alle IPC zod-validiert |
| 4 Distribution | Signierter Installer aus CI, Auto-Update getestet, Bridge ohne Python-Setup, Clean-VM-Protokoll |
| 5 Doku/DX | `npm run dev` startet alles, `.env.example` vollständig, ARCHITECTURE+SECURITY+IPC docs |
| 6 Features | Scheduler überlebt Neustart, CATALOG/LIVE überall gebadged, Loading/Empty/Error überall |
| 7 Architektur | zustand-Store, getypter IPC-Wrapper (kein `as any`), Listen virtualisiert |
| 8 Scope | VISION.md vorhanden, Scope bis Phase 3 eingefroren |

---

### Aufwandssumme (grobe Schätzung)
| Phase | Aufwand |
|-------|---------|
| 0 Fundament | 2–3 Tage |
| 1 Sicherheit | 4–6 Tage |
| 2 Testnetz | 5–8 Tage |
| 3 Refactor | 5–8 Tage |
| 4 Features/State | 4–6 Tage |
| 5 Distribution | 5–8 Tage |
| 6 Doku & Politur | 3–5 Tage |
| **Gesamt** | **~5–7 Wochen** (1 Vollzeit-Entwickler) |

> **Kürzester Pfad zu „fühlt sich pro an":** Phase 0 → 3.1/3.2 (RCE+MT5-Auth) → 1.1/1.2 (Tests für reine Logik) → 5.1/5.2 (dev-Script + env). Das adressiert die drei tiefsten Audit-Befunde in ~1 Woche.
