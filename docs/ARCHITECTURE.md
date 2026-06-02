# Architecture — JARVIS Operations OS

## Process model

```
┌─────────────────────────────────────────────────────────────────────┐
│ Electron MAIN process (Node)            electron/main.ts              │
│  • BrowserWindow + lifecycle            • config store (safeStorage)  │
│  • IPC handlers (ipcMain.handle)        • multi-provider LLM router   │
│  • system metrics, apps, scheduler      • spawns the MT5 bridge       │
└───────────────▲───────────────────────────────────┬──────────────────┘
                │ contextBridge (preload.ts)         │ child_process.spawn
                │  window.jarvisBridge.* (typed IPC)  │  env: JARVIS_BRIDGE_TOKEN
┌───────────────┴───────────────┐        ┌───────────▼──────────────────┐
│ RENDERER (Chromium)            │        │ Python MT5 bridge             │
│  React 18 + Vite               │        │ mt5_bridge/bridge.py          │
│  src/ screens + components      │  HTTP  │ 127.0.0.1:1234 REST           │
│  NEVER touches Node / secrets  │◀──────▶│ X-JARVIS-Token auth           │
└────────────────────────────────┘ (via   └───────────────┬──────────────┘
                                    main)                  │ official Python API
                                                ┌──────────▼──────────┐
                                                │ MetaTrader 5 terminal │
                                                └───────────────────────┘
        Renderer → external LLM/data APIs are proxied through MAIN
        (Anthropic / OpenAI / Gemini / Mistral / DeepSeek / Ollama /
         GitHub Models / Qwen, plus Binance / Deribit / Yahoo for data).
```

## Key invariants

1. **The renderer never holds secrets and never calls Node directly.** All
   privileged work crosses the `contextBridge` in `electron/preload.ts`, typed in
   `src/global.d.ts` as `window.jarvisBridge`.
2. **The MT5 bridge is reached only by the main process.** Renderer code calls
   `window.jarvisBridge.mt5(...)`; main adds the `X-JARVIS-Token` header. No renderer
   code fetches `:1234` directly (enforced by review + the security model).
3. **API keys live in the OS keychain** via `safeStorage`, in
   `userData/jarvis-config.json` (encrypted blobs), never in the renderer or git.

## Source layout

```
electron/
  main.ts                 app lifecycle, window, IPC registration
  preload.ts              contextBridge → window.jarvisBridge
  ai/router.ts            pure provider routing + prompt/msg compression (tested)
  security/paths.ts       isPathInRoots() path-containment guard (tested)
  security/ipc.ts         zod schemas + validate() for IPC payloads (tested)
src/
  main.tsx                React root + 1920×1080 scale-to-fit stage
  App.tsx                 screen router + voice overlay state machine
  components/             primitives, shell, charts
  screens/                Bridge, Agents, Workflows, Briefings, Trading, …
  lib/claude.ts           persona, briefings, workflow prompts
  lib/extract-json.ts     LLM-output JSON extraction (tested)
  lib/trading-data.ts     live-data hooks (all via the IPC bridge)
  data/                   catalogs (agents, collections, resources)
mt5_bridge/bridge.py      MT5 REST bridge (token-authenticated)
```

## IPC contract

Defined once in `src/global.d.ts` and implemented in `electron/main.ts`. Sensitive
payloads are validated with zod (`electron/security/ipc.ts`) before use. Channels are
grouped: `jarvis:*` (LLM), `config:*` (keys/settings), `system:*`, `apps:*`,
`zeus:*`/`mt5:*` (trading), `workflow:*` (scheduler), `social:*`, `console:runCmd`.

## Persistence (in `app.getPath('userData')`)

- `jarvis-config.json` — encrypted API keys, MT5 host/port, `ADVANCED_MODE`, bridge token
- `scheduled-jobs.json` — cron workflows (reloaded on startup)
- `apps-registry.json`, `window-state.json`
- localStorage (renderer): `jarvis.context`, `jarvis.console`, `jarvis.briefings.live`, `jarvis.workflows.run`
