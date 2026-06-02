# JARVIS FULLSTACK PREMORTEM
## Vollständige Analyse: Was ist real, was ist Theater, wie wird alles 100% funktionsfähig

---

## ✅ BEREITS VOLLSTÄNDIG REAL (keine Änderung nötig)

| Feature | Technisch | Status |
|---|---|---|
| Claude AI (alle Modelle) | `jarvis:complete` → Anthropic SDK | ✅ LIVE |
| Gemini AI | `jarvis:gemini` → Google REST | ✅ LIVE |
| GitHub Models (GPT-4.1-mini) | `jarvis:github` → GitHub REST | ✅ LIVE |
| Qwen / DashScope | `jarvis:qwen` → DashScope REST | ✅ LIVE |
| Ollama (lokale LLMs) | `jarvis:ollama` → localhost:11434 | ✅ LIVE |
| Voice / STT | `jarvis:gemini-audio`, `jarvis:ollama-transcribe` | ✅ LIVE |
| System Metrics | real os.cpus() delta, WMIC disk, RAM | ✅ LIVE |
| Activity Ring Buffer | real IPC ring buffer, 200 Einträge | ✅ LIVE |
| Agent Scanner | real .agent.md Filesystem-Scan | ✅ LIVE |
| Binance Market Data | real REST klines/orderbook/CVD/funding | ✅ LIVE |
| MT5 Live Positions | zeus:mt5 IPC → HTTP :1234 | ✅ LIVE (wenn bridge läuft) |
| Terminal / Shell | consoleRun → real child_process | ✅ LIVE |
| safeStorage API Keys | Electron-verschlüsselt | ✅ LIVE |
| Admin → API Keys speichern/laden | config:setKey/getKey | ✅ LIVE |
| ContentModule Workflow Builder | runResearch/runContent → real AI | ✅ LIVE |
| Briefings generieren | composeBriefing → Claude | ✅ LIVE |
| JARVIS Chat (Console) | real Claude via IPC | ✅ LIVE |
| Arsenal DISCOVER tab | GitHub Trending API + HackerNews API | ✅ LIVE |
| Arsenal ORCHESTRA | Katalog mit echten Agent-Dateien | ✅ LIVE |
| Apps Registry | starten/hinzufügen/scannen | ✅ LIVE |

---

## 🔧 IN DIESER SESSION IMPLEMENTIERT

### FIX 1: Multi-Provider Routing (KRITISCHSTE LÜCKE)
**Problem:** Admin-Screen speicherte OPENAI_API_KEY, MISTRAL_API_KEY, DEEPSEEK_API_KEY korrekt via safeStorage — aber `jarvis:complete` routete immer nur zu Anthropic Claude. User stellte GPT-4.1 als aktives Modell ein → Anruf ging trotzdem an Claude.

**Fix:** `electron/main.ts` → neue Funktionen `detectProvider()` + `routedComplete()`.
- Claude → Anthropic SDK
- gpt-*/o1/o3/o4/chatgpt → OpenAI REST (api.openai.com/v1)
- mistral/codestral → Mistral REST (api.mistral.ai/v1)
- deepseek → DeepSeek REST (api.deepseek.com/v1)
- llama/phi/qwen + OLLAMA_BASE_URL → Ollama /api/chat
- gemini → bereits separater Handler, bleibt
- `jarvis:has-key` jetzt true wenn ANY Provider konfiguriert

### FIX 2: Content Pipeline & Schedule Persistence
**Problem:** `CONTENT_PIPELINE` (8 Einträge) und `SCHEDULE_SLOTS` (12 Einträge) waren TypeScript-Konstanten. Kein State, kein Tracking.

**Fix:** `src/screens/ContentModule.tsx`
- `DEFAULT_PIPELINE` → seed data
- `useState + useEffect + localStorage` → Pipeline-State persistent
- `cyclePipelineStatus(id)` → Klick wechselt Status: QUEUED→DRAFTING→SCRIPTING→EDITING→RENDERING→DONE
- `DEFAULT_SCHEDULE` → seed data
- `cycleSchedStatus(i)` → Klick wechselt: queued→scheduled→live
- Beide States überleben App-Restart

### FIX 3: Agent Status Tracking
**Problem:** `assignStatus(i: number)` = `i % 7` — kompletter Fake basierend auf Array-Index.

**Fix:** `src/screens/Agents.tsx`
- `localStorage['jarvis.agent-lastused']` → `{ agentId: timestamp }` Map
- `assignStatus(id)` nutzt echte last-used Zeit:
  - < 24h → **ONLINE** (glow grün)
  - < 7 Tage → **BUSY** (glow amber)
  - älter / noch nie → **STANDBY** (gedimmt)
- `markAgentUsed(id)` exportiert → kann von Console/Arsenal aufgerufen werden

### FIX 4: Workflow Scheduler Backend (node-cron)
**Problem:** SCHEDULED-Workflows in Workflows.tsx hatten UI mit cron-Expressions — aber kein Backend-Scheduler.

**Fix:** `electron/main.ts` + `electron/preload.ts`
- `node-cron` installiert
- Neue IPC Handler:
  - `workflow:schedule` → validiert cron, startet Task, speichert in Map
  - `workflow:cancel` → stoppt und entfernt Job
  - `workflow:list-scheduled` → gibt alle aktiven Jobs zurück
- Jobs rufen `routedComplete()` auf → echte AI-Ausführung
- Activity Ring Buffer bekommt SCHEDULER/RUN/DONE/ERROR Einträge
- Preload: `workflowSchedule()`, `workflowCancel()`, `workflowListScheduled()`

---

## ⚠️ VERBLEIBENDE THEATER-FEATURES (noch nicht functional)

### TIER A: Klein, schnell fixbar (je 1-4h)

#### A1: ZEUS Strategies — "RUN" Button ohne Funktion
**Datei:** `TradingContent.tsx` ~135-160
**Problem:** Strategie-Karten "Deploy", "Run ZEUS" → kein IPC-Aufruf. Badge `[CATALOG · NOT CONNECTED TO MT5]` bereits gesetzt.
**Fix nötig:**
```typescript
// In TradingContent.tsx, ZeusStrategyCard onClick:
async function deployStrategy(s: ZeusStrategy) {
  const res = await window.jarvisBridge.mt5({
    host, port,
    endpoint: '/api/v1/strategy/deploy',
    method: 'POST',
    body: { id: s.id, symbol: s.symbol, timeframe: s.timeframe, params: s.params }
  });
}
```
Benötigt: MT5 bridge.py muss `/api/v1/strategy/deploy` implementieren.

#### A2: Workflows.tsx → Scheduled Button wired zu neuem Backend
**Datei:** `Workflows.tsx`
**Problem:** Scheduled Workflows haben UI mit cron-Expressions, aber kein `workflowSchedule()` Aufruf.
**Fix nötig:**
```typescript
// In WorkflowCard onClick "Schedule":
await window.jarvisBridge.workflowSchedule({
  id: wf.id,
  expression: wf.cronExpression,  // e.g. "0 9 * * 1" = Mondays 9am
  workflowId: wf.id,
  workflowName: wf.name,
  prompt: wf.prompt,
  channel: wf.channel,
});
```

#### A3: Agents.tsx → "Run Agent" Knopf wired zu AI
**Datei:** `Agents.tsx`
**Problem:** "SELECT A MISSION OR LAUNCH A NEW ONE" ist nur ein Display-String. Kein Deployment passiert.
**Fix nötig (30 Min):**
```typescript
async function runAgent(agent: AgentEntry) {
  markAgentUsed(agent.id);
  // Read .agent.md file content via IPC
  const content = await window.jarvisBridge.readFileContent(agent.path);
  // Send to Claude as system prompt with user prompt
  const result = await window.jarvisBridge.complete({
    messages: [{ role: 'user', content: missionInput }],
    system: content,  // .agent.md IS the system prompt
    maxTokens: 2000,
  });
  setAgentOutput(result);
}
```

#### A4: Admin CONNECTORS Tab → Keys werden gespeichert aber nicht für neue Provider genutzt
**Problem:** Connectors Tab für OpenAI/Mistral/DeepSeek speichert API keys, aber die IPC-Handler mussten vorher manuell im Admin Models Tab gesetzt werden.
**Status nach Fix 1:** ✅ BEHOBEN — `routedComplete()` liest diese Keys jetzt automatisch.
**Noch offen:** Admin Connectors Tab zeigt "CONNECTED" Status — der ist noch statisch. Echte Ping-Tests fehlen.
**Fix (30 Min):** Für jeden Connector `config:hasKey` prüfen und Live-Ping machen.

### TIER B: Mittlere Aufwand (je 1-3 Tage)

#### B1: MT5 Bridge (bridge.py)
**Problem:** `tryStartMt5Bridge()` in main.ts sucht `bridge.py` im app directory. Diese Datei muss existieren und Python muss installiert sein.
**Was bridge.py braucht:**
- FastAPI Server auf Port 1234
- Endpoint `GET /api/v1/rates?symbol=BTCUSD&tf=M1&n=1`
- Endpoint `GET /api/v1/positions`
- Endpoint `GET /api/v1/equity`
- Endpoint `POST /api/v1/strategy/deploy`
- Endpoint `POST /api/v1/orders/flatten`
- Kommuniziert mit MT5 via MetaTrader 5 Python package (`pip install MetaTrader5`)

**Minimalimplementierung:**
```python
# bridge.py
from fastapi import FastAPI
import MetaTrader5 as mt5
app = FastAPI()
mt5.initialize()

@app.get("/api/v1/rates")
def rates(symbol: str, tf: str, n: int):
    bars = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, n)
    return [{"time": b[0], "open": b[1], "high": b[2], "low": b[3], "close": b[4]} for b in bars]

@app.get("/api/v1/positions")
def positions():
    return [{"ticket": p.ticket, "symbol": p.symbol, "profit": p.profit} for p in mt5.positions_get()]
```

#### B2: Content Posting APIs (Twitter, YouTube, Instagram)
**Problem:** Content wird erstellt (AI-generiert), aber nicht gepostet. ContentModule hat Platform-Buttons aber keinen Post-IPC.
**Was fehlt in main.ts:**
```typescript
// Twitter/X API v2
ipcMain.handle('social:post-x', async (_, { text, token }) => { ... });
// YouTube Data API v3 — Video upload/thumbnail
ipcMain.handle('social:post-yt', async (_, { title, desc, videoPath, token }) => { ... });
// Instagram Graph API
ipcMain.handle('social:post-ig', async (_, { imageUrl, caption, token }) => { ... });
```
**Aufwand:** 2-5 Tage pro Platform (OAuth flows, Rate limits, Format-Unterschiede).

#### B3: Briefings Auto-Schedule
**Problem:** Morning Intel, Market Brief etc. werden manuell ausgelöst. node-cron ist jetzt installiert.
**Fix:** Beim App-Start regelmäßige Briefings schedulen:
```typescript
// In main.ts, app.whenReady():
cron.schedule('0 7 * * *', async () => {  // 07:00 täglich
  pushActivity('JARVIS', 'BRIEFING', 'Morning Intel');
  const brief = await routedComplete({ messages: [{ role: 'user', content: MORNING_PROMPT }] });
  // Store to jarvis.briefings in localStorage via mainWindow.webContents.send()
  mainWindow?.webContents.send('briefing:new', { type: 'MORNING', text: brief, ts: Date.now() });
});
```

#### B4: Admin "Active Model" wirklich nutzen
**Problem:** Wenn User "SET AS ACTIVE" klickt → setzt JARVIS_MODEL. Aber claude.ts `askJarvis()` nutzt immer `jarvis:complete` (= routedComplete → JARVIS_MODEL). Für direkte Gemini-Calls wird `jarvis:gemini` separat aufgerufen.
**Was noch fehlt:** claude.ts `askJarvis()` sollte prüfen ob Gemini als aktives Modell gesetzt ist und dann zu `geminiComplete()` routen.
**Fix (15 Min in claude.ts):**
```typescript
export async function askJarvis(userMsg: string, opts?: ...) {
  const model = await window.jarvisBridge.config?.getKey('JARVIS_MODEL');
  if (model?.startsWith('gemini')) {
    return window.jarvisBridge.geminiComplete({ messages: [...], system });
  }
  return window.jarvisBridge.complete({ messages: [...], system });
}
```

### TIER C: Große Features (neu implementieren)

#### C1: Echter Notification-Pusher
**Problem:** `pushActivity()` schreibt in Ring Buffer aber es gibt keine Browser-Notifications wenn etwas Wichtiges passiert (Bridge reconnect, MT5 Stop Loss getriggert, Workflow fertig).
**Fix:** 
```typescript
// main.ts: Electron Notifications
new Notification({ title: 'ZEUS BOT', body: 'Stop Loss getriggert — EURUSD @ 1.0842' }).show();
```

#### C2: Echter Content Tracker (statt localStorage Pipeline)
**Problem:** Content Pipeline in localStorage ist besser als hardcoded, aber ein echter SQLite-basierter Content Tracker wäre robuster.
**Stack:** `better-sqlite3` als Dependency, IPC für CRUD:
```typescript
ipcMain.handle('content:create', async (_, item) => db.prepare('INSERT INTO pipeline ...').run(item));
ipcMain.handle('content:list', async () => db.prepare('SELECT * FROM pipeline ORDER BY createdAt DESC').all());
ipcMain.handle('content:update-status', async (_, { id, status }) => db.prepare('UPDATE pipeline SET status=? WHERE id=?').run(status, id));
```

#### C3: Agent Execution mit echtem Output-Panel
**Problem (nach Fix A3):** Agent Output wird irgendwo angezeigt, aber kein dedizierter "Agent Run" Screen mit Streaming-Output, Stop-Button, History.
**Fix:** Neuer `AgentRunner.tsx` Screen mit:
- Streaming von Claude via `jarvis:complete` mit partiellem Rendering
- Stop-Button → AbortController
- Run-History in localStorage
- Copy/Export-Output

---

## 🎯 REALISTISCHES 100% FÜR PERSONAL TOOL

### Was "100% funktionsfähig" bedeutet für dieses Tool:

**100% = Alles, was in der UI sichtbar ist, tut auch was es verspricht.**

| Kategorie | Aktuell | Nach allen Fixes |
|---|---|---|
| AI Inference (alle Provider) | 70% (Claude+Gemini+GitHub real, OpenAI/Mistral/DeepSeek key gespeichert aber not routed) | **100%** (nach Fix 1) |
| Content Pipeline | 20% (AI generiert, Pipeline hardcoded) | **85%** (nach Fix 2, ohne Social API) |
| Market Data | 90% (Binance real, MT5 wenn bridge läuft) | **90%** |
| Agent System | 50% (scan+display real, run = nur Text) | **80%** (nach Fix A3) |
| Workflows | 40% (live workflows real, scheduled = UI) | **75%** (nach Fix 4 + A2 wire-up) |
| Briefings | 80% (manuell real, auto-schedule fehlt) | **90%** (nach Fix B3) |
| System Tools | 95% | **95%** |
| Admin / Config | 85% (keys gespeichert, active model nicht routed für Gemini) | **95%** (nach Fix A4/B4) |

---

## 📋 EXECUTION PLAN — PRIORITÄT NACH IMPACT/AUFWAND

### Woche 1 (jetzt erledigt ✅)
- [x] FIX 1: Multi-provider routing (OPENAI/MISTRAL/DEEPSEEK)
- [x] FIX 2: Content Pipeline localStorage Persistence
- [x] FIX 3: Agent Status echtes Tracking
- [x] FIX 4: node-cron Scheduler Backend

### Woche 2 (nächste Schritte, empfohlen)
- [ ] A2: Wire Scheduled Workflows UI zu neuem Backend
- [ ] A3: Agent "Run" wirklich an Claude schicken
- [ ] A4: Connector Status Live-Ping
- [ ] B4: claude.ts activeModel routing für Gemini

### Woche 3-4 (wenn MT5 wichtig)
- [ ] B1: bridge.py implementieren (MetaTrader5 + FastAPI)
- [ ] B3: Auto-Morning Briefing via cron

### Optional / Nice-to-have
- [ ] B2: Social Media Posting APIs (Twitter v2, YouTube API)
- [ ] C1: Electron Notifications für kritische Events
- [ ] C3: Echter Agent Execution Screen mit Streaming

---

## 🔑 WICHTIGE API KEYS (was wo einzutragen ist)

| Provider | Admin Screen | Key Name | Route in main.ts |
|---|---|---|---|
| Anthropic | Models → Claude | ANTHROPIC_API_KEY | `jarvis:complete` wenn model=claude-* |
| OpenAI | Models → GPT-4.1 | OPENAI_API_KEY | `jarvis:complete` wenn model=gpt-* |
| Google | Models → Gemini | GEMINI_API_KEY | `jarvis:gemini` (direkt) |
| Mistral | Models → Mistral | MISTRAL_API_KEY | `jarvis:complete` wenn model=mistral-* |
| DeepSeek | Models → DeepSeek | DEEPSEEK_API_KEY | `jarvis:complete` wenn model=deepseek-* |
| GitHub | Models → GitHub | GITHUB_TOKEN | `jarvis:github` (direkt) |
| Qwen | Models → Qwen | DASHSCOPE_API_KEY | `jarvis:qwen` (direkt) |
| Ollama | Models → Ollama | OLLAMA_BASE_URL | `jarvis:complete` wenn model=llama/phi |

**JARVIS_MODEL** (Admin → Models → SET AS ACTIVE) = welches Modell `jarvis:complete` nutzt.
Beispiel: `claude-haiku-4-5`, `gpt-4.1`, `deepseek-v3`, `gemini-2.5-flash`

---

## 📁 DATEIEN DIE GEÄNDERT WURDEN (diese Session)

| Datei | Änderung |
|---|---|
| `electron/main.ts` | +detectProvider() +routedComplete() mit OpenAI/Mistral/DeepSeek/Ollama, +WorkflowScheduler (node-cron) |
| `electron/preload.ts` | +workflowSchedule/Cancel/ListScheduled |
| `src/screens/ContentModule.tsx` | DEFAULT_PIPELINE+DEFAULT_SCHEDULE → localStorage state, Status klickbar |
| `src/screens/Agents.tsx` | assignStatus(i%7) → assignStatus(id) basierend auf last-used |
| `build-assets/icon.ico` | Multi-size ICO (16/32/48/256px) |
| `build-assets/icon.png` | 256px PNG |

**Build Status:** `✔ built in 3.19s` — clean, keine Fehler.
