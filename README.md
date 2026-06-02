# JARVIS — Operations OS (Electron)

Hi-fi recreation of the JARVIS Operations OS design handoff as a real Electron desktop app.  
React 18 · Vite 5 · TypeScript 5 · Electron 31 · Anthropic Claude (haiku-4-5).

> The Anthropic API key never touches the renderer. Claude calls go through Electron's main process via IPC.

## Quickstart

```bash
cd jarvis-ops-os
cp .env.example .env       # then fill in your ANTHROPIC_API_KEY
npm install
npm run dev                # vite + electron, hot reload renderer
```

Build distributable:

```bash
npm run build              # tsc renderer + electron, vite bundle
npm run start              # launch built app
```

## Architecture

```
electron/
  main.ts        ← BrowserWindow, .env loader, Anthropic SDK, IPC handlers
  preload.ts     ← contextBridge → window.jarvisBridge
src/
  data/          ← jarvis-data, os-data (TEAMS, DIRECTIVE, BRIEFINGS, WORKFLOWS, …)
  lib/claude.ts  ← persona, composeBriefing, runResearch/Content/PlanDay, chatWithJarvis
  components/    ← primitives (HoloPanel, VoiceOrb, Sparkline, …), shell, VariantCinematic
  screens/       ← Bridge, Agents, Workflows, Briefings, Trading, Content, System, Console
  App.tsx        ← screen router + voice overlay
  main.tsx       ← React root + 1920×1080 stage scale-to-fit
```

### IPC contract

```ts
window.jarvisBridge.hasKey()              // → boolean
window.jarvisBridge.complete({            // → { text }
  system: string,
  messages: { role:'user'|'assistant', content:string }[],
  max_tokens?: number,
  temperature?: number,
})
```

## Notes

- 1920×1080 stage, CSS `transform: scale()` to fit any window size.
- All localStorage keys: `jarvis.context`, `jarvis.console`, `jarvis.briefings.live`, `jarvis.workflows.run`.
- Trading screen is a hi-fi mockup. Real broker integration is out of scope.
