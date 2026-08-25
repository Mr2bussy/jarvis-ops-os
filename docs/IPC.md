# IPC channel registry

> **Generated** by `pnpm gen:ipc` from `electron/ipc/registry.ts`.
> Do not edit by hand — run `pnpm gen:ipc` after changing the registry.
> CI: `pnpm gen:ipc --check` (ironclad: handlers ↔ registry ↔ preloadKey coverage).

## Migration path

1. Add a row to `CHANNELS` in `electron/ipc/registry.ts` when you add `ipcMain.handle`.
2. Run `pnpm gen:ipc` — updates IPC.md, preload-channels.d.ts, preload-channel-map.ts, **preload-invokes.ts**.
3. Wire handlers in `register*Ipc()` modules; bootstrap calls them from `main.ts`.
4. `electron/preload.ts` merges `GENERATED_PRELOAD_INVOKES` with hand-written overrides (events + arg shaping).
5. Employee channels without preloadKey stay main-only.

## Drift status

✅ Registry covers all scanned handlers; every preloadKey channel is invoked in preload surface.
### Registered without preloadKey (main/harness only — expected)

- `employee:calendar-propose`
- `employee:calendar-status`
- `employee:email-classify`
- `employee:email-draft`
- `employee:email-imap-status`
- `employee:invoice-extract`
- `employee:invoice-extract-path`
- `employee:invoice-preview`
- `employee:shop-list`
- `employee:shop-refund-draft`
- `employee:shop-social-draft`
- `jarvis:gemini-transcribe`

## Channels (129)

| Channel | Preload | Risk | Purpose | Handler |
|---|---|---|---|---|
| `app:notify` | `notify` | A | app · notify | `electron/main.ts` |
| `apps:add` | `appsAdd` | C | apps · add | `electron/main.ts` |
| `apps:launch` | `appsLaunch` | D | apps · launch | `electron/main.ts` |
| `apps:list` | `appsList` | A | apps · list | `electron/main.ts` |
| `apps:pick` | `appsPick` | A | apps · pick | `electron/main.ts` |
| `apps:remove` | `appsRemove` | C | apps · remove | `electron/main.ts` |
| `apps:scan-common` | `appsScanCommon` | A | apps · scan-common | `electron/main.ts` |
| `browser:install` | `browser.install` | C | browser · install | `electron/ipc/register-domain.ts` |
| `browser:start` | `browser.start` | A | browser · start | `electron/ipc/register-domain.ts` |
| `browser:status` | `browser.status` | A | browser · status | `electron/ipc/register-domain.ts` |
| `commerce:sync` | `commerce.sync` | B | Shopify catalog/orders via Composio tool slugs | `electron/ipc/register-commerce.ts` |
| `composio:catalog` | `composio.catalog` | A | composio · catalog | `electron/main.ts` |
| `composio:connections` | `composio.connections` | A | composio · connections | `electron/main.ts` |
| `composio:execute` | `composio.execute` | B | composio · execute | `electron/main.ts` |
| `composio:has` | `composio.has` | A | composio · has | `electron/main.ts` |
| `composio:initiate` | `composio.initiate` | B | composio · initiate | `electron/ipc/register-domain.ts` |
| `config:deleteKey` | `config.deleteKey` | C | config · deleteKey | `electron/ipc/register-config.ts` |
| `config:getAdvancedMode` | `config.getAdvancedMode` | A | config · getAdvancedMode | `electron/ipc/register-config.ts` |
| `config:getKey` | `config.getKey` | A | config · getKey | `electron/ipc/register-config.ts` |
| `config:getMt5` | `config.getMt5` | A | config · getMt5 | `electron/ipc/register-config.ts` |
| `config:hasKey` | `config.hasKey` | A | config · hasKey | `electron/ipc/register-config.ts` |
| `config:reload-keys` | `config.reloadKeys` | B | config · reload-keys | `electron/ipc/register-config.ts` |
| `config:setAdvancedMode` | `config.setAdvancedMode` | C | config · setAdvancedMode | `electron/ipc/register-config.ts` |
| `config:setKey` | `config.setKey` | C | config · setKey | `electron/ipc/register-config.ts` |
| `config:setMt5` | `config.setMt5` | C | config · setMt5 | `electron/ipc/register-config.ts` |
| `config:test-provider` | `testProvider` | B | config · test-provider | `electron/main.ts` |
| `content:publish` | `content.publish` | B | Cross-platform publish gate — live X when OAuth1 keys present | `electron/ipc/register-content.ts` |
| `console:runCmd` | `consoleRun` | D | console · runCmd | `electron/main.ts` |
| `employee:calendar-propose` | — | C | employee · calendar-propose | `electron/employees/ipc.ts` |
| `employee:calendar-status` | — | C | employee · calendar-status | `electron/employees/ipc.ts` |
| `employee:email-classify` | — | C | employee · email-classify | `electron/employees/ipc.ts` |
| `employee:email-draft` | — | C | employee · email-draft | `electron/employees/ipc.ts` |
| `employee:email-fetch-inbox` | `employees.emailFetchInbox` | B | IMAP fetch + rule-based classify when imapflow + creds present | `electron/employees/ipc.ts` |
| `employee:email-imap-status` | — | C | employee · email-imap-status | `electron/employees/ipc.ts` |
| `employee:invoice-extract` | — | C | employee · invoice-extract | `electron/employees/ipc.ts` |
| `employee:invoice-extract-path` | — | C | employee · invoice-extract-path | `electron/employees/ipc.ts` |
| `employee:invoice-preview` | — | C | employee · invoice-preview | `electron/employees/ipc.ts` |
| `employee:shop-list` | — | C | employee · shop-list | `electron/employees/ipc.ts` |
| `employee:shop-refund-draft` | — | C | employee · shop-refund-draft | `electron/employees/ipc.ts` |
| `employee:shop-social-draft` | — | C | employee · shop-social-draft | `electron/employees/ipc.ts` |
| `gateway:config-get` | `gateway.configGet` | A | gateway · config-get | `electron/gateway/ipc.ts` |
| `gateway:config-set` | `gateway.configSet` | C | gateway · config-set | `electron/gateway/ipc.ts` |
| `gateway:deliver` | `gateway.deliver` | A | gateway · deliver | `electron/gateway/ipc.ts` |
| `gateway:start` | `gateway.start` | C | gateway · start | `electron/gateway/ipc.ts` |
| `gateway:status` | `gateway.status` | A | gateway · status | `electron/gateway/ipc.ts` |
| `gateway:stop` | `gateway.stop` | A | gateway · stop | `electron/gateway/ipc.ts` |
| `harness:bench-smoke` | `harness.benchSmoke` | A | harness · bench-smoke | `electron/harness/ipc.ts` |
| `harness:hitl-pending` | `harness.hitlPending` | A | harness · hitl-pending | `electron/harness/ipc.ts` |
| `harness:hitl-resolve` | `harness.hitlResolve` | A | harness · hitl-resolve | `electron/harness/ipc.ts` |
| `harness:memory-search` | `harness.memorySearch` | A | harness · memory-search | `electron/harness/ipc.ts` |
| `harness:refine` | `harness.refine` | C | harness · refine | `electron/harness/ipc.ts` |
| `harness:run` | `harness.run` | C | harness · run | `electron/harness/ipc.ts` |
| `harness:status` | `harness.status` | A | harness · status | `electron/harness/ipc.ts` |
| `harness:swarm-plan` | `harness.swarmPlan` | A | harness · swarm-plan | `electron/harness/ipc.ts` |
| `harness:weekly-run` | `harness.weeklyRun` | A | harness · weekly-run | `electron/harness/ipc.ts` |
| `jarvis:activate-vault-agents` | `activateVaultAgents` | C | jarvis · activate-vault-agents | `electron/ipc/register-domain.ts` |
| `jarvis:complete` | `complete` | B | jarvis · complete | `electron/main.ts` |
| `jarvis:complete-stream` | `completeStream` | B | jarvis · complete-stream | `electron/main.ts` |
| `jarvis:free-transcribe` | `freeTranscribe` | B | jarvis · free-transcribe | `electron/ipc/register-domain.ts` |
| `jarvis:gemini` | `geminiComplete` | B | jarvis · gemini | `electron/main.ts` |
| `jarvis:gemini-audio` | `geminiAudio` | B | jarvis · gemini-audio | `electron/main.ts` |
| `jarvis:gemini-transcribe` | — | B | jarvis · gemini-transcribe | `electron/main.ts` |
| `jarvis:get-vault-paths` | `getVaultPaths` | A | jarvis · get-vault-paths | `electron/ipc/register-domain.ts` |
| `jarvis:github` | `githubComplete` | B | jarvis · github | `electron/main.ts` |
| `jarvis:has-gemini` | `hasGemini` | B | jarvis · has-gemini | `electron/main.ts` |
| `jarvis:has-github` | `hasGithub` | B | jarvis · has-github | `electron/main.ts` |
| `jarvis:has-key` | `hasKey` | A | jarvis · has-key | `electron/main.ts` |
| `jarvis:has-ollama` | `hasOllama` | B | jarvis · has-ollama | `electron/main.ts` |
| `jarvis:has-qwen` | `hasQwen` | B | jarvis · has-qwen | `electron/main.ts` |
| `jarvis:live-scan` | `liveScan` | A | jarvis · live-scan | `electron/main.ts` |
| `jarvis:ollama` | `ollamaComplete` | B | jarvis · ollama | `electron/main.ts` |
| `jarvis:ollama-transcribe` | `ollamaTranscribe` | B | jarvis · ollama-transcribe | `electron/main.ts` |
| `jarvis:qwen` | `qwenComplete` | B | jarvis · qwen | `electron/main.ts` |
| `jarvis:read-file-content` | `readFileContent` | A | jarvis · read-file-content | `electron/main.ts` |
| `jarvis:rebuild-index` | `rebuildIndex` | C | jarvis · rebuild-index | `electron/main.ts` |
| `jarvis:recent-activity` | `recentActivity` | A | jarvis · recent-activity | `electron/main.ts` |
| `jarvis:scan-agents` | `scanAgents` | A | jarvis · scan-agents | `electron/main.ts` |
| `jarvis:set-agents-path` | `setAgentsPath` | C | jarvis · set-agents-path | `electron/ipc/register-domain.ts` |
| `jarvis:system-selftest` | `systemSelfTest` | A | jarvis · system-selftest | `electron/ipc/register-domain.ts` |
| `jarvis:voice-diag` | `voiceDiag` | A | jarvis · voice-diag | `electron/main.ts` |
| `jarvis:voice-selftest` | `voiceSelfTest` | A | jarvis · voice-selftest | `electron/ipc/register-domain.ts` |
| `jarvis:voice-session` | `voiceSession` | A | jarvis · voice-session | `electron/ipc/register-domain.ts` |
| `jarvis:workspace` | `workspace` | A | jarvis · workspace | `electron/main.ts` |
| `jarvis:write-file` | `writeFile` | C | jarvis · write-file | `electron/main.ts` |
| `memory:embed-search` | `memory.embedSearch` | A | memory · embed-search | `electron/ipc/register-domain.ts` |
| `memory:embed-upsert` | `memory.embedUpsert` | C | memory · embed-upsert | `electron/ipc/register-domain.ts` |
| `mt5:start-bridge` | `startBridge` | C | mt5 · start-bridge | `electron/main.ts` |
| `production:audit-trail` | `production.auditTrail` | A | production · audit-trail | `electron/ipc/register-production.ts` |
| `production:check-updates` | `production.checkUpdates` | A | production · check-updates | `electron/ipc/register-production.ts` |
| `production:crash-dumps-path` | `production.crashDumpsPath` | A | production · crash-dumps-path | `electron/ipc/register-production.ts` |
| `production:download-update` | `production.downloadUpdate` | A | production · download-update | `electron/ipc/register-production.ts` |
| `production:dry-run` | `production.dryRun` | A | production · dry-run | `electron/ipc/register-production.ts` |
| `production:employee-execute` | `production.employeeExecute` | D | production · employee-execute | `electron/ipc/register-production.ts` |
| `production:employee-health` | `production.employeeHealth` | A | production · employee-health | `electron/ipc/register-production.ts` |
| `production:error-budget` | `production.errorBudget` | A | production · error-budget | `electron/ipc/register-production.ts` |
| `production:export-config` | `production.exportConfig` | A | production · export-config | `electron/ipc/register-production.ts` |
| `production:flags` | `production.flags` | A | production · flags | `electron/ipc/register-production.ts` |
| `production:imap-idle-status` | `production.imapIdleStatus` | A | production · imap-idle-status | `electron/ipc/register-production.ts` |
| `production:install-update` | `production.installUpdate` | D | production · install-update | `electron/ipc/register-production.ts` |
| `production:kill-switch` | `production.killSwitch` | A | production · kill-switch | `electron/ipc/register-production.ts` |
| `production:record-voice-latency` | `production.recordVoiceLatency` | A | production · record-voice-latency | `electron/ipc/register-production.ts` |
| `production:setFlag` | `production.setFlag` | A | production · setFlag | `electron/ipc/register-production.ts` |
| `search:web` | `searchWeb` | B | search · web | `electron/main.ts` |
| `shell:openExternal` | `shell.openExternal` | B | shell · openExternal | `electron/main.ts` |
| `social:post-ig` | `postToInstagram` | D | social · post-ig | `electron/main.ts` |
| `social:post-x` | `postToX` | D | social · post-x | `electron/main.ts` |
| `system:clearTemp` | `systemTools.clearTemp` | D | system · clearTemp | `electron/main.ts` |
| `system:fileSearch` | `systemTools.fileSearch` | B | system · fileSearch | `electron/main.ts` |
| `system:getProcs` | `systemTools.getProcs` | A | system · getProcs | `electron/main.ts` |
| `system:memReduce` | `systemTools.memReduce` | D | system · memReduce | `electron/main.ts` |
| `system:metrics` | `systemMetrics` | A | system · metrics | `electron/main.ts` |
| `system:netScan` | `systemTools.netScan` | B | system · netScan | `electron/main.ts` |
| `system:openTool` | `systemTools.openTool` | D | system · openTool | `electron/main.ts` |
| `trading:ccxt-ohlcv` | `trading.ccxtOhlcv` | A | trading · ccxt-ohlcv | `electron/ipc/register-domain.ts` |
| `trading:ccxt-status` | `trading.ccxtStatus` | A | trading · ccxt-status | `electron/ipc/register-domain.ts` |
| `trading:ccxt-ticker` | `trading.ccxtTicker` | A | trading · ccxt-ticker | `electron/ipc/register-domain.ts` |
| `trading:econ-calendar` | `trading.econCalendar` | A | trading · econ-calendar | `electron/ipc/register-domain.ts` |
| `trading:in-news-window` | `trading.inNewsWindow` | A | trading · in-news-window | `electron/ipc/register-domain.ts` |
| `trading:journal-add` | `trading.journalAdd` | C | trading · journal-add | `electron/ipc/register-domain.ts` |
| `trading:journal-list` | `trading.journalList` | A | trading · journal-list | `electron/ipc/register-domain.ts` |
| `trading:journal-weekly` | `trading.journalWeekly` | A | trading · journal-weekly | `electron/ipc/register-domain.ts` |
| `voice:pickFiles` | `voicePickFiles` | A | voice · pickFiles | `electron/ipc/register-domain.ts` |
| `voice:piper-speak` | `voice.piperSpeak` | B | voice · piper-speak | `electron/ipc/register-domain.ts` |
| `voice:piper-status` | `voice.piperStatus` | A | voice · piper-status | `electron/ipc/register-domain.ts` |
| `workflow:cancel` | `workflowCancel` | A | workflow · cancel | `electron/main.ts` |
| `workflow:list-scheduled` | `workflowListScheduled` | A | workflow · list-scheduled | `electron/main.ts` |
| `workflow:schedule` | `workflowSchedule` | A | workflow · schedule | `electron/main.ts` |
| `zeus:mt5` | `mt5` | D | zeus · mt5 | `electron/main.ts` |
| `zeus:ping` | `zeusPing` | D | zeus · ping | `electron/main.ts` |

## Risk legend

- **A** — read-only / status
- **B** — LLM / network egress
- **C** — filesystem or config mutation
- **D** — shell, trading, or privileged side effects

