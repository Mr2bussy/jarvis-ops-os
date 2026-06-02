# JARVIS OPS OS — FINAL MASTER PROMPT
### "Ship it as a professional Electron desktop product. Zero mock data. Maximum security. Full first-run wizard. EXE installer."

---

## YOUR ROLE

You are a **senior fullstack Electron/React/TypeScript engineer** with 20+ years of experience shipping production desktop apps. You are given the **JARVIS Ops OS** codebase (`g:\main jarvis project og og og`). Your job is to take it from **60% prototype** to **100% professional shippable product** — a signed Windows EXE installer with a first-run wizard, all data live-connected, all security holes closed, and zero mock/fake data left visible to the user.

You will work **file by file, feature by feature**, test your changes, and not stop until every item in the task list is checked off. You read every file before editing it. You do not guess — you verify.

---

## AUDIT FINDINGS — ROOT CAUSES (read first, fix second)

### 🔴 CRITICAL: Security Violations

| # | Location | Problem | Fix |
|---|----------|---------|-----|
| S1 | `electron/main.ts:14` | `app.commandLine.appendSwitch('disable-web-security', 'false')` — string `'false'` is truthy in Node, so this **actually disables web security**. | Remove this line entirely. |
| S2 | `electron/main.ts:10` | `use-fake-ui-for-media-stream` bypasses OS microphone consent dialog — OWASP A01 broken access control. | Remove. Request mic permission properly via `navigator.mediaDevices.getUserMedia`. |
| S3 | `electron/main.ts` — `jarvis:write-file` handler | No path validation. Renderer can write any file on the filesystem (path traversal / arbitrary file write). | Validate that `filePath` is inside the allowed workspace dirs using `path.resolve` + `startsWith`. Reject all others. |
| S4 | `electron/main.ts` — `jarvis:read-file-content` | Same issue — reads any file on disk. | Same allowlist fix. Restrict to workspace + user config dir only. |
| S5 | `electron/main.ts` — `spawn`/`exec` calls | Shell commands without input sanitization. | Validate all inputs, never pass user-supplied strings to shell. Use `spawn` with argument arrays, never `exec` with string interpolation. |
| S6 | `.env` file — API keys in plaintext | Keys in plain text on disk, no encryption. | Migrate key storage to `electron.safeStorage` (OS keychain-backed encryption). The Admin screen already has the UI for connectors — wire it to `safeStorage`. On first run, wizard saves keys via IPC → `safeStorage.encryptString`. On load, `safeStorage.decryptString`. Remove `ANTHROPIC_API_KEY` etc. from `.env` and from `loadDotEnv`. Only keep non-secret config (MODEL names, URLs) in `.env`. |
| S7 | `preload.ts` — no input schema validation | IPC payloads pass directly to main with no type checking at the boundary. | Add `zod` (or manual) validation in main.ts for every `ipcMain.handle` payload before processing. |
| S8 | `BrowserWindow` — no CSP | No Content Security Policy header set. | Set `webPreferences.additionalArguments` + `session.defaultSession.webRequest.onHeadersReceived` to inject strict CSP. |
| S9 | `MT5 host/port` in `localStorage` | Connection secrets stored in plain localStorage. | Move to `safeStorage` via IPC. |

### 🟠 HIGH: Mock Data — Every Instance

| # | File | Fake/Mock | Real replacement |
|---|------|-----------|------------------|
| M1 | `src/data/jarvis-data.ts` — `TEAMS`, `DIRECTIVE`, `TRANSCRIPT` | 100% hardcoded theater — static KPIs, pct values, status. | Keep as UI showcase/demo data BUT add a `[DEMO]` badge. Persist user-modified team notes via `lsSet`. Add a real "active mission" state tied to user-created workflows. |
| M2 | `src/data/os-data.ts` — `BRIEFINGS`, `CONSOLE_LOG`, `WORKFLOWS` | Static seed briefings, static log history, static DAGs. | `BRIEFINGS`: replace seed with empty array — briefings only exist after the user generates them via the AI. Remove hardcoded BRF-* from the source. `CONSOLE_LOG`: keep as empty `[]` seed. `WORKFLOWS`: DAG data is fine as templates — mark clearly as "TEMPLATE". |
| M3 | `src/screens/Bridge.tsx` — `LiveDispatchTicker` | Cycles through static `AGENT_EVENTS` array on a timer — pure fake animation. | Replace with real IPC poll: `window.jarvisBridge.getRecentActivity()` → new IPC handler in main.ts that reads the last N entries from an in-memory ring buffer. Every real IPC call (AI complete, file scan, MT5 poll) appends to this ring buffer. This makes the ticker genuinely reflect real activity. |
| M4 | `src/screens/Agents.tsx` — `ActivityFeed` | Same fake `AGENT_EVENTS` cycling — identical problem. | Same fix as M3 — shared `getRecentActivity` IPC. |
| M5 | `src/screens/System.tsx` — CPU per-core view | `Math.random()` used for per-core utilization bars — visually deceptive. | Real fix: Add per-CPU utilization to the `system:metrics` IPC response. In main.ts use `os.cpus()` which provides per-core times. Calculate utilization delta between polls. |
| M6 | `src/screens/TradingContent.tsx` — `ZEUS_STRATEGIES` | Strategy `status`, `winRate`, `avgReturn` are hardcoded static strings. | Mark as "CONFIGURED" state, not live. Add `[CONFIGURED · NOT LIVE]` label unless MT5 is connected and strategy ID is returned in positions data. |
| M7 | `src/data/agents-catalog.ts` — `AGENT_COUNT`, `AGENTS` fallback | `AGENT_COUNT = 192` is a hardcoded constant. When `scanAgents` fails, UI shows 192 as if real. | When source === 'fallback', show `[CATALOG]` badge next to count, not a raw number. Make it clear these are catalog entries, not live scanned files. |
| M8 | `src/lib/live-data.ts` — `useJarvisLive` fallback | When IPC fails, shows `FALLBACK` data (all zeros). | Add `status: 'live' | 'offline' | 'fallback'` to return value. All components display a subtle `[OFFLINE]` indicator when status !== 'live'. |

### 🟡 MEDIUM: Missing Features / Not Wired

| # | What's missing | Where to add it |
|---|----------------|-----------------|
| F1 | **First-run wizard** | New screen `src/screens/Setup.tsx` — full onboarding flow |
| F2 | **EXE / NSIS installer** | `package.json` electron-builder config |
| F3 | **MT5 bridge auto-start** | `electron/main.ts` — auto-spawn `bridge.py` on app start |
| F4 | **Admin screen saves keys** | Wire `Admin.tsx` connector forms to `safeStorage` IPC |
| F5 | **Settings persistence** | Admin model selector must write `JARVIS_MODEL` to safeStorage/config |
| F6 | **Window state persistence** | Save/restore window bounds in `electron-store` or json config |
| F7 | **Native OS notifications** | Add `Notification` API calls for important events |
| F8 | **Keyboard shortcuts** | Register `globalShortcut` in main.ts: Alt+Space = voice, Alt+J = show/hide |
| F9 | **Error boundaries** | Wrap every screen in React `ErrorBoundary` component |
| F10 | **`window.jarvisBridge` null guard** | Every component that calls `window.jarvisBridge` must check it exists first |

---

## TASK LIST — EXECUTE IN ORDER

Work through each task completely before moving to the next. Mark each `[x]` as you finish.

### PHASE 1 — SECURITY HARDENING (do this first, nothing ships without it)

```
[ ] TASK 1.1 — Remove insecure Chromium flags
    File: electron/main.ts
    - DELETE line: app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
    - DELETE line: app.commandLine.appendSwitch('disable-web-security', 'false')
    - ADD: app.commandLine.appendSwitch('enable-speech-dispatcher') — keep this one, it's harmless

[ ] TASK 1.2 — Add CSP to BrowserWindow
    File: electron/main.ts — inside createWindow(), after win = new BrowserWindow(...)
    Add:
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
              "connect-src 'self' https://api.anthropic.com https://generativelanguage.googleapis.com " +
              "https://models.inference.ai.azure.com https://api.dashscope.aliyuncs.com " +
              "http://localhost:* http://127.0.0.1:*; img-src 'self' data:; font-src 'self' data:;"
            ],
          },
        });
      });

[ ] TASK 1.3 — Migrate API key storage to safeStorage
    File: electron/main.ts
    - ADD new IPC handlers:
        ipcMain.handle('config:setKey', async (_evt, { name, value }: { name: string; value: string }) => {
          if (!safeStorage.isEncryptionAvailable()) {
            // fallback: write to encrypted json in userData
          }
          const encrypted = safeStorage.encryptString(value);
          const store = getConfigStore(); // simple json file in app.getPath('userData')
          store[name] = encrypted.toString('base64');
          saveConfigStore(store);
        });
        ipcMain.handle('config:getKey', async (_evt, name: string) => {
          const store = getConfigStore();
          if (!store[name]) return '';
          const buf = Buffer.from(store[name], 'base64');
          return safeStorage.decryptString(buf);
        });
        ipcMain.handle('config:hasKey', async (_evt, name: string) => {
          const store = getConfigStore();
          return Boolean(store[name]);
        });
        ipcMain.handle('config:deleteKey', async (_evt, name: string) => {
          const store = getConfigStore();
          delete store[name];
          saveConfigStore(store);
        });
    
    - MODIFY getClient() / gemini / github / qwen / ollama handlers:
      Instead of reading from process.env, call getDecryptedKey('ANTHROPIC_API_KEY') which:
      1. Checks safeStorage config first
      2. Falls back to process.env (for dev/CI compatibility)
      3. Throws clear error if neither exists
    
    - ADD to preload.ts:
        config: {
          setKey: (name: string, value: string) => ipcRenderer.invoke('config:setKey', { name, value }),
          getKey: (name: string) => ipcRenderer.invoke('config:getKey', name),
          hasKey: (name: string) => ipcRenderer.invoke('config:hasKey', name),
          deleteKey: (name: string) => ipcRenderer.invoke('config:deleteKey', name),
        },

[ ] TASK 1.4 — Validate file IPC paths (path traversal fix)
    File: electron/main.ts — jarvis:write-file and jarvis:read-file-content handlers
    ADD at the top of each handler:
      const ALLOWED_ROOTS = [
        app.getPath('userData'),
        path.resolve(app.getAppPath(), '..'), // workspace root
        'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb', // boost dir
      ];
      const resolved = path.resolve(payload.filePath);
      const allowed = ALLOWED_ROOTS.some(root => resolved.startsWith(path.resolve(root)));
      if (!allowed) throw new Error('Access denied: path outside allowed directories');

[ ] TASK 1.5 — Move MT5 config out of localStorage
    File: electron/main.ts
    - ADD ipcMain.handle('config:getMt5', ...) → returns { host, port } from safeStorage config
    - ADD ipcMain.handle('config:setMt5', ...) → saves to safeStorage config
    File: src/screens/TradingContent.tsx
    - Replace all localStorage.getItem('mt5.host') calls with await window.jarvisBridge.config.getMt5()
    File: preload.ts — add getMt5/setMt5 to bridge
```

### PHASE 2 — REAL DATA (replace every mock/fake display)

```
[ ] TASK 2.1 — Real activity ring buffer (replaces AGENT_EVENTS ticker)
    File: electron/main.ts
    - ADD module-level ring buffer:
        const activityRing: { ts: number; who: string; action: string; target: string }[] = [];
        function pushActivity(who: string, action: string, target: string) {
          activityRing.push({ ts: Date.now(), who, action, target });
          if (activityRing.length > 200) activityRing.shift();
        }
    - CALL pushActivity() inside every real IPC handler:
        - jarvis:complete → pushActivity('JARVIS', 'RESPOND', msg preview)
        - jarvis:gemini → pushActivity('GEMINI', 'RESPOND', msg preview)
        - jarvis:scan-agents → pushActivity('JARVIS', 'SCAN', `${count} agents`)
        - zeus:mt5 → pushActivity('MT5-BRIDGE', 'POLL', endpoint)
        - jarvis:rebuild-index → pushActivity('ARSENAL', 'INDEX', 'full rebuild')
    - ADD: ipcMain.handle('jarvis:recent-activity', () => activityRing.slice(-50).reverse())
    File: preload.ts — add: recentActivity: () => ipcRenderer.invoke('jarvis:recent-activity')
    File: src/screens/Bridge.tsx — LiveDispatchTicker:
    - Replace setInterval fake cycling with polling useEffect:
        useEffect(() => {
          async function poll() {
            const acts = await window.jarvisBridge.recentActivity();
            setLines(acts.map((a, i) => ({
              id: i, who: a.who, action: a.action, target: a.target,
              ts: new Date(a.ts).toTimeString().slice(0,8)
            })));
          }
          poll();
          const iv = setInterval(poll, 3000);
          return () => clearInterval(iv);
        }, []);
    File: src/screens/Agents.tsx — ActivityFeed: same replacement

[ ] TASK 2.2 — Real per-core CPU metrics
    File: electron/main.ts — system:metrics handler
    - REPLACE the single cpu_util with per-core data:
        const cpus = os.cpus();
        // Store previous tick for delta calculation (module-level Map)
        const perCore = cpus.map((cpu, i) => {
          const prev = cpuPrev.get(i) || cpu.times;
          const deltaIdle = cpu.times.idle - prev.idle;
          const deltaTotal = Object.values(cpu.times).reduce((a,b)=>a+b,0) - Object.values(prev).reduce((a,b)=>a+b,0);
          cpuPrev.set(i, { ...cpu.times });
          return deltaTotal > 0 ? 1 - deltaIdle / deltaTotal : 0;
        });
        // Include in response: cpu_per_core: perCore
    File: src/screens/System.tsx
    - Replace Math.random() with real per-core value from sys.cpu_per_core[i]

[ ] TASK 2.3 — Remove hardcoded BRIEFINGS seed data
    File: src/data/os-data.ts
    - CHANGE: export const BRIEFINGS: Briefing[] = []  // empty — generated by user on demand
    File: src/screens/Briefings.tsx
    - When live === [] (no briefings yet), show a CTA panel:
        "No briefings yet. Hit 'Morning Intel' to generate your first one."

[ ] TASK 2.4 — Remove hardcoded CONSOLE_LOG seed
    File: src/data/os-data.ts
    - CHANGE: export const CONSOLE_LOG: ConsoleLine[] = []
    File: src/screens/Console.tsx — already loads from localStorage, just needs empty seed

[ ] TASK 2.5 — Add [DEMO] badge to Teams/Directive view
    File: src/screens/Bridge.tsx
    - Add a small `DEMO DATA` warning chip next to the ACTIVE DIRECTIVE header.
    - Add a `?` tooltip: "This mission data is illustrative. Connect a workflow to create a real directive."
    - Do NOT remove the TEAMS data — it's valuable UI showcase.

[ ] TASK 2.6 — [CATALOG] badge for fallback agent count
    File: src/screens/Agents.tsx — AgentsTab and header count
    - When source === 'fallback': show count with `[CATALOG]` suffix
    - When source === 'live': show count with `[LIVE]` suffix
    - When source === 'loading': show spinner

[ ] TASK 2.7 — Strategy [CONFIGURED · NOT LIVE] label
    File: src/screens/TradingContent.tsx — ZEUS_STRATEGIES render
    - When MT5 NOT connected: all strategy status shows as `CONFIGURED` not `live/testing`
    - Only when MT5 connected AND strategy ID found in active positions: show `LIVE`
```

### PHASE 3 — FIRST-RUN WIZARD (most impactful user-facing feature)

```
[ ] TASK 3.1 — Create Setup screen: src/screens/Setup.tsx
    This is a multi-step wizard rendered INSTEAD of the main OS on first launch.
    "First launch" = when NO API key is saved in safeStorage AND jarvis.setupDone !== true in localStorage.

    WIZARD STEPS:

    Step 1 — WELCOME
      - Large JARVIS logo/wordmark
      - "JARVIS Ops OS — Initial Configuration"
      - "This will take 3 minutes. You can skip any step and configure later in Admin."
      - [BEGIN SETUP] button

    Step 2 — AI ENGINE (primary LLM)
      - Header: "CONNECT YOUR AI BRAIN"
      - Show radio cards for: Anthropic Claude, OpenAI GPT, Google Gemini, GitHub Models (free), Ollama (local/free)
      - Each card shows: logo color, model name, cost estimate, required key name
      - Input field: API KEY (password type, never shown in plaintext)
      - [TEST CONNECTION] button → calls IPC to test the key with a minimal request
      - Status: ✓ CONNECTED / ✗ FAILED (with error message)
      - [NEXT →] only enabled after successful test OR user clicks [SKIP]

    Step 3 — VOICE ENGINE
      - Header: "ENABLE VOICE COMMAND"
      - Shows available options in priority order:
          1. Browser Web Speech API (free, built-in, works now — green checkmark if available)
          2. Gemini Audio (needs Gemini key — show status)
          3. Ollama (local — show if Ollama running)
      - [TEST VOICE] button → opens mic, records 3 seconds, plays back transcript
      - User can select preferred engine via radio
      - [SKIP] available

    Step 4 — TRADING BRIDGE (optional)
      - Header: "CONNECT MT5 TRADING BRIDGE"
      - Explanation: "Start bridge.py on your MetaTrader machine, then enter the address below."
      - Show `bridge.py` location in the app directory
      - Fields: Host (default: localhost), Port (default: 1234)
      - [TEST CONNECTION] → calls zeus:ping
      - Status: ✓ BRIDGE ACTIVE / ✗ NOT REACHABLE
      - [SKIP] available — trading works without this

    Step 5 — WORKSPACE
      - Header: "YOUR AGENT WORKSPACE"
      - Auto-detected: shows the agents/ folder count if jarvisBridge.workspace() returns data
      - Optional: pick a custom agents folder
      - Shows: X agents found, Y skills, Z prompts
      - [SCAN NOW] button → triggers rebuild-index
      - [NEXT →]

    Step 6 — READY
      - Big "JARVIS IS READY" cinematic display
      - Summary: AI ✓, Voice ✓ (or ✗), Bridge ✓ (or ✗), Workspace: 192 agents
      - [ENTER OPS OS] → sets jarvis.setupDone = true, navigates to 'bridge' screen

    IMPLEMENTATION NOTES:
    - All key inputs use type="password" with show/hide toggle
    - All test calls must have a timeout (5s) and clear error display
    - Wizard state is in React useState, not localStorage (fresh each launch)
    - On skip: store { skipped: true, step: N } so user can return to wizard from Admin

[ ] TASK 3.2 — Wire Setup into App.tsx
    File: src/App.tsx
    - ADD: const [setupDone, setSetupDone] = useState(() => localStorage.getItem('jarvis.setupDone') === 'true')
    - In render: if (!setupDone) return <SetupScreen onComplete={() => { localStorage.setItem('jarvis.setupDone', 'true'); setSetupDone(true); }} />
    - Import SetupScreen

[ ] TASK 3.3 — "Re-run Setup" button in Admin screen
    File: src/screens/Admin.tsx
    - Add a [RESET SETUP WIZARD] button at the bottom that:
      localStorage.removeItem('jarvis.setupDone') → navigate back to setup
```

### PHASE 4 — EXE PACKAGING & INSTALLER

```
[ ] TASK 4.1 — Add electron-builder to package.json
    File: package.json
    - ADD to devDependencies: "electron-builder": "^24.13.3"
    - ADD scripts:
        "build:win": "tsc -p electron/tsconfig.json && vite build && electron-builder --win --x64",
        "build:win:portable": "tsc -p electron/tsconfig.json && vite build && electron-builder --win portable --x64",
        "build:dir": "tsc -p electron/tsconfig.json && vite build && electron-builder --dir"
    - ADD top-level "build" config:
        {
          "build": {
            "appId": "com.zaxco.jarvis-ops-os",
            "productName": "JARVIS Ops OS",
            "copyright": "Copyright © 2026 ZAXCO",
            "directories": {
              "output": "dist-installer",
              "buildResources": "build-assets"
            },
            "files": [
              "dist_new/**/*",
              "dist-electron/**/*",
              "mt5_bridge/**/*",
              "!node_modules/**/*",
              "!src/**/*",
              "!electron/**/*.ts"
            ],
            "extraFiles": [
              { "from": "mt5_bridge", "to": "mt5_bridge", "filter": ["**/*"] }
            ],
            "win": {
              "target": [
                { "target": "nsis", "arch": ["x64"] },
                { "target": "portable", "arch": ["x64"] }
              ],
              "icon": "build-assets/icon.ico",
              "requestedExecutionLevel": "requireAdministrator"
            },
            "nsis": {
              "oneClick": false,
              "allowToChangeInstallationDirectory": true,
              "allowElevation": true,
              "installerIcon": "build-assets/icon.ico",
              "uninstallerIcon": "build-assets/icon.ico",
              "installerHeaderIcon": "build-assets/icon.ico",
              "createDesktopShortcut": true,
              "createStartMenuShortcut": true,
              "shortcutName": "JARVIS Ops OS",
              "perMachine": false,
              "deleteAppDataOnUninstall": false,
              "include": "build-assets/installer.nsh"
            },
            "publish": null
          }
        }

[ ] TASK 4.2 — Create build-assets/installer.nsh (custom NSIS page)
    File: build-assets/installer.nsh
    Content:
      !macro customInstallMode
        ; Default to per-user install
        SetShellVarContext current
      !macroend
      !macro customWelcomePage
        ; Custom welcome message showing JARVIS branding
      !macroend

[ ] TASK 4.3 — Create app icon
    - Create build-assets/icon.ico (256x256, 128x128, 64x64, 32x32, 16x16 multi-size ICO)
    - Use existing JARVIS cyan/dark theme: dark background (#060d14), cyan glyph (◈ or J)
    - If no design tool available: use electron-icon-builder or just reference an existing PNG

[ ] TASK 4.4 — Fix main.ts for packaged app
    File: electron/main.ts
    - The `distIndex` / `distIndexFallback` / `isDev` logic must correctly detect both:
      a) dev mode (vite dev server on port 5173)
      b) built-but-unpackaged (dist_new/index.html exists)
      c) packaged EXE (__dirname inside app.asar)
    - ADD: const distIndexAsar = path.join(process.resourcesPath || '', 'app.asar', 'dist_new', 'index.html')
    - Correct isDev logic:
        const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && !fs.existsSync(distIndex));
    - When packaged: win.loadFile(path.join(__dirname, '..', 'dist_new', 'index.html'))

[ ] TASK 4.5 — Auto-start MT5 bridge.py when packaged
    File: electron/main.ts
    - ADD function tryStartMt5Bridge():
        function tryStartMt5Bridge() {
          const bridgePath = app.isPackaged
            ? path.join(process.resourcesPath, 'mt5_bridge', 'bridge.py')
            : path.join(app.getAppPath(), 'mt5_bridge', 'bridge.py');
          if (!fs.existsSync(bridgePath)) return;
          const proc = spawn('python', [bridgePath], { detached: true, stdio: 'ignore' });
          proc.unref();
        }
    - Call tryStartMt5Bridge() inside app.whenReady()
    - ADD IPC: ipcMain.handle('mt5:start-bridge', () => { tryStartMt5Bridge(); return true; })
```

### PHASE 5 — MISSING SETTINGS & TOOLS

```
[ ] TASK 5.1 — Wire Admin screen connector forms to safeStorage
    File: src/screens/Admin.tsx
    - On mount: load existing key values via window.jarvisBridge.config.getKey(keyName)
      Show "●●●●●● (saved)" if key exists, empty if not
    - On Save button click: window.jarvisBridge.config.setKey(keyName, value)
      Show ✓ SAVED status for 2 seconds
    - On Clear button: window.jarvisBridge.config.deleteKey(keyName)
    - After saving ANTHROPIC_API_KEY: call window.jarvisBridge.reloadKeys() so main.ts picks it up
    - ADD IPC: ipcMain.handle('config:reload-keys', () => { /* reload from safeStorage into module vars */ })

[ ] TASK 5.2 — Model selector must persist
    File: src/screens/Admin.tsx — LLM model selector
    - Currently: selecting a model does nothing persisted
    - Fix: on model select, call window.jarvisBridge.config.setKey('JARVIS_MODEL', model.id)
    - In main.ts: MODEL variable reads from safeStorage config first, then env, then default

[ ] TASK 5.3 — Window state persistence
    File: electron/main.ts
    - Save window bounds to userData/window-state.json on 'close' event
    - Load and restore on createWindow()
    - Default: 1400x900, centered

[ ] TASK 5.4 — Global keyboard shortcuts
    File: electron/main.ts — inside app.whenReady():
    - globalShortcut.register('Alt+Space', () => { win?.webContents.send('shortcut:voice') })
    - globalShortcut.register('Alt+J', () => { if (win?.isVisible()) win.hide(); else win?.show(); })
    - globalShortcut.register('Escape', ...) — close voice overlay via IPC
    File: preload.ts — add: onShortcut: (cb: (key: string) => void) => ipcRenderer.on('shortcut:voice', () => cb('voice'))
    File: src/App.tsx — listen for shortcut:voice → call openVoice()

[ ] TASK 5.5 — Native OS notifications
    File: electron/main.ts
    - ADD function sendNotification(title: string, body: string):
        new Notification({ title, body, icon: path.join(app.getAppPath(), 'build-assets', 'icon.png') }).show()
    - ADD IPC: ipcMain.handle('app:notify', (_evt, { title, body }) => sendNotification(title, body))
    File: preload.ts — add: notify: (title: string, body: string) => ipcRenderer.invoke('app:notify', { title, body })
    Usage in renderer:
    - After AI briefing generated: window.jarvisBridge.notify('JARVIS', 'Briefing ready')
    - After MT5 connects: window.jarvisBridge.notify('MT5 Bridge', 'Trading bridge connected')

[ ] TASK 5.6 — Error boundaries around every screen
    File: src/components/ErrorBoundary.tsx (new)
    - Standard React class ErrorBoundary component
    - Shows HUD-styled error panel with: error message, stack trace (dev only), [RELOAD] button
    File: src/App.tsx
    - Wrap every <ScreenName ...> in <ErrorBoundary key={screen}>

[ ] TASK 5.7 — jarvisBridge null guard utility
    File: src/lib/bridge-guard.ts (new)
    - Export: export const bridge = () => { if (!window.jarvisBridge) throw new Error('Bridge unavailable'); return window.jarvisBridge; }
    - Replace all raw window.jarvisBridge calls in components with bridge()
    - This ensures clear error messages instead of crashes when bridge is missing

[ ] TASK 5.8 — Add Settings quick-access to Sidebar
    File: src/components/shell.tsx — Sidebar nav items
    - Add '⚙ SETTINGS' nav item at the bottom pointing to 'admin' screen
    - Add badge on Settings icon if no API key is configured: orange dot

[ ] TASK 5.9 — In-app tutorial overlay (post-wizard)
    File: src/components/TutorialOverlay.tsx (new)
    - One-time walkthrough triggered after Setup wizard completes
    - 6 steps with highlighted UI areas and tooltips:
        1. Bridge screen — "Your command center. Real-time mission overview."
        2. Console — "Type any command. JARVIS responds via Claude."
        3. Voice button — "Click or press Alt+Space to speak."
        4. Briefings — "Generate live intelligence briefings on demand."
        5. Arsenal — "Your complete agent + skill library."
        6. Admin — "Add more API keys and configure models anytime."
    - Use a semi-transparent overlay with spotlight cutout effect
    - [SKIP] and [NEXT] buttons
    - Store completion in localStorage: jarvis.tutorialDone
```

### PHASE 6 — POLISH & FINAL VERIFICATION

```
[ ] TASK 6.1 — Verify all IPC handlers have corresponding preload.ts exposures
    Cross-check every ipcMain.handle('X', ...) in main.ts with preload.ts
    Add any missing ones.

[ ] TASK 6.2 — Add loading states to all data-dependent screens
    - System: already has a loading state ✓
    - Agents: add skeleton loader when source === 'loading'
    - Arsenal: add loading spinner during scan
    - Bridge: add "connecting..." state for first 2s

[ ] TASK 6.3 — Run TypeScript compilation, fix all errors
    pnpm exec tsc --noEmit
    Fix every type error before build.

[ ] TASK 6.4 — Test full build pipeline
    pnpm build:win:portable
    Verify the portable EXE:
    - Launches without crash
    - Setup wizard appears on first run
    - API key saves to safeStorage (not plaintext)
    - Console chat works
    - Voice button triggers mic request properly
    - System screen shows real CPU data
    - Activity ticker shows real IPC events

[ ] TASK 6.5 — Test installer (NSIS)
    pnpm build:win
    Verify:
    - Installer runs without errors
    - Desktop shortcut created
    - App launches from shortcut
    - Uninstaller works
    - No plaintext API keys in app directory after uninstall

[ ] TASK 6.6 — Final security scan
    - No process.env.API_KEY usage in main.ts (all via safeStorage)
    - No disable-web-security flag
    - No Math.random() in metrics display
    - No hardcoded BRIEFINGS in os-data.ts
    - All file access IPC handlers have path validation
    - window-state.json in userData, not in app directory
```

---

## ARCHITECTURE REFERENCE

```
electron/
  main.ts           ← Node process: IPC handlers, safeStorage, bridge auto-start
  preload.ts        ← contextBridge: exposes ONLY jarvisBridge.* to renderer (no direct Node access)

src/
  App.tsx           ← Root: Setup wizard check, screen routing, voice state
  screens/
    Setup.tsx       ← NEW: first-run wizard (Steps 1-6)
    Bridge.tsx      ← Command center: real activity ring, mission overview
    Console.tsx     ← AI chat: fully live (already works)
    Agents.tsx      ← Agent roster: live scan with [LIVE/CATALOG] badge
    Arsenal.tsx     ← Skills index: live scan + collections
    System.tsx      ← Real metrics: per-core CPU (no Math.random)
    Briefings.tsx   ← On-demand AI briefings (empty seed)
    Workflows.tsx   ← Workflow templates + live runner
    Trading.tsx     ← MT5 live + strategy config
    Admin.tsx       ← API key manager (safeStorage wired)
    Apps.tsx        ← App launcher (already works)
  components/
    ErrorBoundary.tsx  ← NEW: wraps every screen
    TutorialOverlay.tsx ← NEW: post-wizard 6-step tour
  lib/
    bridge-guard.ts  ← NEW: safe wrapper for window.jarvisBridge

build-assets/
  icon.ico          ← App icon (multi-size)
  installer.nsh     ← Custom NSIS script
```

---

## QUALITY STANDARDS

Every output must meet these bars:

| Dimension | Standard |
|-----------|----------|
| **TypeScript** | Zero `any` in new code. All IPC payloads typed with interfaces. |
| **Security** | No user input concatenated into shell commands. No arbitrary file read/write. Keys in safeStorage only. |
| **UX** | Every async operation has a visible loading state. Every error has a visible, readable message. No silent failures. |
| **Honesty** | Every widget that shows data must clearly indicate if it's LIVE, DEMO, or OFFLINE. No fake-looking real data. |
| **Packaging** | EXE must launch cold in under 3 seconds on a mid-range machine. No visible console window. |
| **Code style** | Match existing style: no tailwind, inline styles only, HUD color variables from theme.ts, font-mono / hud-label classes. |

---

## START HERE

Begin with **TASK 1.1** (remove insecure flags). Read `electron/main.ts` first. Make the change. Verify it compiles. Then proceed to TASK 1.2. Do not skip tasks. Do not ask for permission between tasks. Run `pnpm exec tsc -p electron/tsconfig.json --noEmit` after each main.ts change to catch errors immediately.

When all 30 tasks are complete, run `pnpm build:win` and confirm the installer builds without errors. That is the definition of done.
