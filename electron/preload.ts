/**
 * Preload bridge — generated invoke stubs + hand-written overrides/events (D4).
 */
import { contextBridge, ipcRenderer } from 'electron';
import { GENERATED_PRELOAD_INVOKES } from './ipc/generated/preload-invokes';

/** Shallow-merge nested plain objects; later sources win on leaves. */
function deepMerge<T extends Record<string, unknown>>(base: T, ...overlays: Record<string, unknown>[]): T {
  const out: Record<string, unknown> = { ...base };
  for (const overlay of overlays) {
    for (const [k, v] of Object.entries(overlay)) {
      if (
        v &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        typeof out[k] === 'object' &&
        out[k] &&
        !Array.isArray(out[k])
      ) {
        out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
      } else {
        out[k] = v;
      }
    }
  }
  return out as T;
}

const handWritten = {
  // Arg shaping that differs from generic (...args) => invoke(ch, ...args)
  notify: (title: string, body: string) => ipcRenderer.invoke('app:notify', { title, body }),
  onShortcut: (cb: (key: string) => void) => {
    ipcRenderer.on('shortcut:voice', () => cb('voice'));
  },
  config: {
    setKey: (name: string, value: string) => ipcRenderer.invoke('config:setKey', { name, value }),
    setMt5: (h: string, p: number) => ipcRenderer.invoke('config:setMt5', { host: h, port: p }),
  },
  completeStream: (
    payload: { messages: { role: string; content: string }[]; system?: string; maxTokens?: number },
    streamId: string,
  ) => ipcRenderer.invoke('jarvis:complete-stream', { ...payload, streamId }),
  onStreamChunk: (cb: (d: { id: string; text: string }) => void) =>
    ipcRenderer.on('stream:chunk', (_e, d) => cb(d)),
  offStreamChunk: () => ipcRenderer.removeAllListeners('stream:chunk'),
  onStreamDone: (cb: (d: { id: string }) => void) => ipcRenderer.on('stream:done', (_e, d) => cb(d)),
  offStreamDone: () => ipcRenderer.removeAllListeners('stream:done'),
  searchWeb: (query: string) => ipcRenderer.invoke('search:web', { query }),
  harness: {
    memorySearch: (query: string, limit?: number) =>
      ipcRenderer.invoke('harness:memory-search', { query, limit }),
    hitlResolve: (id: string, approved: boolean) =>
      ipcRenderer.invoke('harness:hitl-resolve', { id, approved }),
    swarmPlan: (message: string) => ipcRenderer.invoke('harness:swarm-plan', { message }),
    onHitlRequest: (
      cb: (entry: {
        id: string;
        reason: string;
        payload: Record<string, unknown>;
        createdAt: string;
      }) => void,
    ) => {
      const handler = (
        _e: unknown,
        entry: { id: string; reason: string; payload: Record<string, unknown>; createdAt: string },
      ) => cb(entry);
      ipcRenderer.on('harness:hitl-request', handler);
      return () => ipcRenderer.removeListener('harness:hitl-request', handler);
    },
    weeklyRun: (useLlmCritic?: boolean) =>
      ipcRenderer.invoke('harness:weekly-run', { useLlmCritic: Boolean(useLlmCritic) }),
  },
  gateway: {
    deliver: (platform: string, text: string) => ipcRenderer.invoke('gateway:deliver', { platform, text }),
  },
  production: {
    recordVoiceLatency: (totalMs: number, ttfbMs?: number) =>
      ipcRenderer.invoke('production:record-voice-latency', { totalMs, ttfbMs }),
    setFlag: (key: string, value: boolean) => ipcRenderer.invoke('production:setFlag', { key, value }),
    killSwitch: (on: boolean) => ipcRenderer.invoke('production:kill-switch', { on }),
  },
  onUpdateFeedStatus: (
    cb: (status: {
      feedUrl: string | null;
      source: string;
      packaged: boolean;
      failClosed: boolean;
      reason?: string;
    }) => void,
  ) => {
    const handler = (
      _e: unknown,
      status: {
        feedUrl: string | null;
        source: string;
        packaged: boolean;
        failClosed: boolean;
        reason?: string;
      },
    ) => cb(status);
    ipcRenderer.on('updater:feed-status', handler);
    return () => ipcRenderer.removeListener('updater:feed-status', handler);
  },
};

contextBridge.exposeInMainWorld(
  'jarvisBridge',
  deepMerge(GENERATED_PRELOAD_INVOKES as unknown as Record<string, unknown>, handWritten),
);
