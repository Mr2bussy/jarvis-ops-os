import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('jarvisBridge', {
  complete: (payload: {
    messages: { role: 'user' | 'assistant'; content: string }[];
    system?: string;
    maxTokens?: number;
  }) => ipcRenderer.invoke('jarvis:complete', payload),
  hasKey: () => ipcRenderer.invoke('jarvis:has-key'),

  // System
  systemMetrics: () => ipcRenderer.invoke('system:metrics'),
  recentActivity: () => ipcRenderer.invoke('jarvis:recent-activity'),

  // Native OS
  notify: (title: string, body: string) => ipcRenderer.invoke('app:notify', { title, body }),
  onShortcut: (cb: (key: string) => void) => {
    ipcRenderer.on('shortcut:voice', () => cb('voice'));
  },

  // Config / safeStorage
  config: {
    setKey: (name: string, value: string) => ipcRenderer.invoke('config:setKey', { name, value }),
    getKey: (name: string) => ipcRenderer.invoke('config:getKey', name),
    hasKey: (name: string) => ipcRenderer.invoke('config:hasKey', name),
    deleteKey: (name: string) => ipcRenderer.invoke('config:deleteKey', name),
    getMt5: () => ipcRenderer.invoke('config:getMt5'),
    setMt5: (h: string, p: number) => ipcRenderer.invoke('config:setMt5', { host: h, port: p }),
    reloadKeys: () => ipcRenderer.invoke('config:reload-keys'),
    getAdvancedMode: () => ipcRenderer.invoke('config:getAdvancedMode'),
    setAdvancedMode: (on: boolean) => ipcRenderer.invoke('config:setAdvancedMode', on),
  },

  // MT5 bridge auto-start
  startBridge: () => ipcRenderer.invoke('mt5:start-bridge'),

  // Apps
  appsList: () => ipcRenderer.invoke('apps:list'),
  appsAdd: (entry: { name: string; path: string; kind: 'exe' | 'url' | 'folder' | 'cmd'; tag?: string }) =>
    ipcRenderer.invoke('apps:add', entry),
  appsRemove: (id: string) => ipcRenderer.invoke('apps:remove', id),
  appsPick: (kind: 'exe' | 'folder') => ipcRenderer.invoke('apps:pick', kind),
  appsLaunch: (entry: any) => ipcRenderer.invoke('apps:launch', entry),
  appsScanCommon: () => ipcRenderer.invoke('apps:scan-common'),

  // Workspace & agents filesystem
  workspace: () => ipcRenderer.invoke('jarvis:workspace'),
  scanAgents: () => ipcRenderer.invoke('jarvis:scan-agents'),
  liveScan: () => ipcRenderer.invoke('jarvis:live-scan'),
  rebuildIndex: () => ipcRenderer.invoke('jarvis:rebuild-index'),
  writeFile: (p: { filePath: string; content: string }) => ipcRenderer.invoke('jarvis:write-file', p),
  readFileContent: (filePath: string) => ipcRenderer.invoke('jarvis:read-file-content', filePath),

  // ZeusBot
  zeusPing: (url: string) => ipcRenderer.invoke('zeus:ping', url),

  // MT5 REST Bridge
  mt5: (payload: { host: string; port: number; endpoint: string; method?: 'GET' | 'POST'; body?: unknown }) =>
    ipcRenderer.invoke('zeus:mt5', payload),

  // Gemini LLM (voice mode)
  geminiComplete: (payload: { messages: { role: 'user' | 'model'; text: string }[]; system?: string }) =>
    ipcRenderer.invoke('jarvis:gemini', payload),
  geminiAudio: (payload: { audioBase64: string; mimeType: string; system?: string }) =>
    ipcRenderer.invoke('jarvis:gemini-audio', payload),
  geminiTranscribe: (payload: { audioBase64: string; mimeType: string }) =>
    ipcRenderer.invoke('jarvis:gemini-transcribe', payload),
  hasGemini: () => ipcRenderer.invoke('jarvis:has-gemini'),
  voiceDiag: () => ipcRenderer.invoke('jarvis:voice-diag'),
  // GitHub Models (voice fallback — GitHub Pro ~50 RPM)
  githubComplete: (payload: {
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    system?: string;
    maxTokens?: number;
  }) => ipcRenderer.invoke('jarvis:github', payload),
  hasGithub: () => ipcRenderer.invoke('jarvis:has-github'),
  // Qwen / DashScope (OpenAI-compatible, free tier)
  qwenComplete: (payload: {
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    system?: string;
    maxTokens?: number;
  }) => ipcRenderer.invoke('jarvis:qwen', payload),
  hasQwen: () => ipcRenderer.invoke('jarvis:has-qwen'),
  // Ollama (local, zero cost, zero rate-limits)
  ollamaComplete: (payload: {
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    system?: string;
    maxTokens?: number;
  }) => ipcRenderer.invoke('jarvis:ollama', payload),
  hasOllama: () => ipcRenderer.invoke('jarvis:has-ollama'),
  ollamaTranscribe: (payload: { audioBase64: string; mimeType: string }) =>
    ipcRenderer.invoke('jarvis:ollama-transcribe', payload),

  // System Tools
  systemTools: {
    openTool: (toolId: string) => ipcRenderer.invoke('system:openTool', toolId),
    getProcs: () => ipcRenderer.invoke('system:getProcs'),
    clearTemp: () => ipcRenderer.invoke('system:clearTemp'),
    memReduce: () => ipcRenderer.invoke('system:memReduce'),
    fileSearch: (query: string) => ipcRenderer.invoke('system:fileSearch', query),
    netScan: () => ipcRenderer.invoke('system:netScan'),
  },

  // Console / Developer tools
  consoleRun: (cmd: string) => ipcRenderer.invoke('console:runCmd', cmd),

  // Workflow Scheduler (node-cron backend)
  workflowSchedule: (config: {
    id: string;
    expression: string;
    workflowId: string;
    workflowName: string;
    prompt: string;
    channel: string;
  }) => ipcRenderer.invoke('workflow:schedule', config),
  workflowCancel: (id: string) => ipcRenderer.invoke('workflow:cancel', id),
  workflowListScheduled: () => ipcRenderer.invoke('workflow:list-scheduled'),

  // Provider live ping (A4)
  testProvider: (provider: string) => ipcRenderer.invoke('config:test-provider', provider),

  // Social Media posting (B2)
  postToX: (payload: {
    text: string;
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  }) => ipcRenderer.invoke('social:post-x', payload),
  postToInstagram: (payload: { imageUrl: string; caption: string; accessToken: string; igUserId: string }) =>
    ipcRenderer.invoke('social:post-ig', payload),

  // Streaming (P1)
  completeStream: (
    payload: { messages: { role: string; content: string }[]; system?: string; maxTokens?: number },
    streamId: string,
  ) => ipcRenderer.invoke('jarvis:complete-stream', { ...payload, streamId }),
  onStreamChunk: (cb: (d: { id: string; text: string }) => void) =>
    ipcRenderer.on('stream:chunk', (_e, d) => cb(d)),
  offStreamChunk: () => ipcRenderer.removeAllListeners('stream:chunk'),
  onStreamDone: (cb: (d: { id: string }) => void) => ipcRenderer.on('stream:done', (_e, d) => cb(d)),
  offStreamDone: () => ipcRenderer.removeAllListeners('stream:done'),

  // Web search (P3)
  searchWeb: (query: string) => ipcRenderer.invoke('search:web', { query }),

  // Composio integrations (live catalog + action execution)
  composio: {
    has: () => ipcRenderer.invoke('composio:has'),
    catalog: () => ipcRenderer.invoke('composio:catalog'),
    execute: (payload: {
      slug: string;
      arguments?: Record<string, unknown>;
      userId?: string;
      connectedAccountId?: string;
    }) => ipcRenderer.invoke('composio:execute', payload),
    connections: () => ipcRenderer.invoke('composio:connections'),
  },

  // Shell utilities
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
});
