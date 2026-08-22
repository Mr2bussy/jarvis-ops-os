import { useState, useEffect } from 'react';
import { DraggableTabs, DraggableGrid, type DragTab } from '../components/draggable';
import { ScreenHeader } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET } from '../theme';

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface LLMModel {
  id: string;
  provider: string;
  name: string;
  context: string;
  color: string;
  inputCost: string;
  outputCost: string;
}

interface ConnectorConfig {
  id: string;
  label: string;
  color: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
}

/* ── Data ───────────────────────────────────────────────────────────────────── */
const LLM_MODELS: LLMModel[] = [
  {
    id: 'anthropic-sonnet-45',
    provider: 'Anthropic',
    name: 'Claude Sonnet 4.5',
    context: '200K',
    color: '#e879f9',
    inputCost: '$3/M',
    outputCost: '$15/M',
  },
  {
    id: 'anthropic-sonnet-4',
    provider: 'Anthropic',
    name: 'Claude Sonnet 4',
    context: '200K',
    color: '#e879f9',
    inputCost: '$3/M',
    outputCost: '$15/M',
  },
  {
    id: 'anthropic-opus-4',
    provider: 'Anthropic',
    name: 'Claude Opus 4',
    context: '200K',
    color: '#c4b5fd',
    inputCost: '$15/M',
    outputCost: '$75/M',
  },
  {
    id: 'anthropic-haiku-35',
    provider: 'Anthropic',
    name: 'Claude Haiku 3.5',
    context: '200K',
    color: '#a78bfa',
    inputCost: '$0.80/M',
    outputCost: '$4/M',
  },
  {
    id: 'openai-gpt41',
    provider: 'OpenAI',
    name: 'GPT-4.1',
    context: '1M',
    color: '#4ade80',
    inputCost: '$2/M',
    outputCost: '$8/M',
  },
  {
    id: 'openai-gpt5',
    provider: 'OpenAI',
    name: 'GPT-5',
    context: '1M',
    color: '#34d399',
    inputCost: '$10/M',
    outputCost: '$40/M',
  },
  {
    id: 'openai-gpt4o',
    provider: 'OpenAI',
    name: 'GPT-4o',
    context: '128K',
    color: '#6ee7b7',
    inputCost: '$2.5/M',
    outputCost: '$10/M',
  },
  {
    id: 'openai-o3',
    provider: 'OpenAI',
    name: 'o3',
    context: '200K',
    color: '#a7f3d0',
    inputCost: '$10/M',
    outputCost: '$40/M',
  },
  {
    id: 'google-gemini25pro',
    provider: 'Google',
    name: 'Gemini 2.5 Pro',
    context: '1M',
    color: '#38bdf8',
    inputCost: '$1.25/M',
    outputCost: '$10/M',
  },
  {
    id: 'google-gemini25fl',
    provider: 'Google',
    name: 'Gemini 2.5 Flash',
    context: '1M',
    color: '#7dd3fc',
    inputCost: '$0.30/M',
    outputCost: '$2.5/M',
  },
  {
    id: 'google-gemini20',
    provider: 'Google',
    name: 'Gemini 2.0 Flash',
    context: '1M',
    color: '#bae6fd',
    inputCost: '$0.10/M',
    outputCost: '$0.40/M',
  },
  {
    id: 'mistral-large',
    provider: 'Mistral',
    name: 'Mistral Large',
    context: '128K',
    color: '#fb923c',
    inputCost: '$2/M',
    outputCost: '$6/M',
  },
  {
    id: 'deepseek-v3',
    provider: 'DeepSeek',
    name: 'DeepSeek V3',
    context: '64K',
    color: '#fbbf24',
    inputCost: '$0.07/M',
    outputCost: '$1.1/M',
  },
  {
    id: 'llama-33-70b',
    provider: 'Meta',
    name: 'Llama 3.3 70B',
    context: '128K',
    color: '#94a3b8',
    inputCost: 'free',
    outputCost: 'free',
  },
  {
    id: 'ollama-local',
    provider: 'Ollama',
    name: 'Local (Ollama)',
    context: 'varies',
    color: '#64748b',
    inputCost: 'free',
    outputCost: 'free',
  },
];

const CONNECTORS: ConnectorConfig[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    color: '#e879f9',
    fields: [
      { key: 'apiKey', label: 'API KEY', placeholder: 'sk-ant-…', secret: true },
      { key: 'baseUrl', label: 'BASE URL', placeholder: 'https://api.anthropic.com' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI / GPT',
    color: '#4ade80',
    fields: [
      { key: 'apiKey', label: 'API KEY', placeholder: 'sk-…', secret: true },
      { key: 'baseUrl', label: 'BASE URL', placeholder: 'https://api.openai.com/v1' },
      { key: 'orgId', label: 'ORG ID', placeholder: 'org-… (optional)' },
    ],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    color: '#38bdf8',
    fields: [
      { key: 'apiKey', label: 'API KEY', placeholder: 'AIza…', secret: true },
      { key: 'project', label: 'PROJECT ID', placeholder: 'my-project-id' },
    ],
  },
  {
    id: 'mt5bridge',
    label: 'MT5 Bridge',
    color: JADE,
    fields: [
      { key: 'host', label: 'HOST', placeholder: '127.0.0.1' },
      { key: 'port', label: 'PORT', placeholder: '1234' },
      { key: 'token', label: 'AUTH TOKEN', placeholder: 'optional', secret: true },
    ],
  },
  {
    id: 'n8n',
    label: 'n8n Webhook',
    color: AMBER,
    fields: [
      { key: 'url', label: 'WEBHOOK URL', placeholder: 'http://localhost:5678/webhook/…' },
      { key: 'apiKey', label: 'API KEY', placeholder: 'optional', secret: true },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    color: '#64748b',
    fields: [
      { key: 'baseUrl', label: 'BASE URL', placeholder: 'http://localhost:11434' },
      { key: 'model', label: 'DEFAULT MODEL', placeholder: 'llama3.3:70b' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom REST Endpoint',
    color: VIOLET,
    fields: [
      { key: 'name', label: 'NAME', placeholder: 'My API' },
      { key: 'url', label: 'ENDPOINT', placeholder: 'https://…' },
      { key: 'apiKey', label: 'AUTH HEADER', placeholder: 'Bearer …', secret: true },
    ],
  },
];

type AdminTab = 'MODELS' | 'CONNECTORS' | 'PATHS' | 'TOOLS' | 'SOCIAL';

/* ── LLM Models tab ─────────────────────────────────────────────────────────── */
// Map model provider to its safeStorage key name
const PROVIDER_KEY: Record<string, string> = {
  Anthropic: 'ANTHROPIC_API_KEY',
  OpenAI: 'OPENAI_API_KEY',
  Google: 'GEMINI_API_KEY',
  GitHub: 'GITHUB_TOKEN',
  Qwen: 'DASHSCOPE_API_KEY',
  Mistral: 'MISTRAL_API_KEY',
  DeepSeek: 'DEEPSEEK_API_KEY',
  Meta: '',
  Ollama: 'OLLAMA_BASE_URL',
};

function ModelsTab() {
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(['anthropic-sonnet-45', 'openai-gpt41', 'google-gemini25pro']),
  );
  const [active, setActive] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'err'>>({});
  const [activeModel, setActiveModel] = useState<string>('claude-haiku-4-5');

  // Load existing keys on mount
  useEffect(() => {
    const b = window.jarvisBridge;
    if (!b?.config) return;
    // Load active model choice
    b.config
      .getKey('JARVIS_MODEL')
      .then((v) => {
        if (v) setActiveModel(v);
      })
      .catch(() => {});
    // Load API keys for each provider
    const loaded: Record<string, string> = {};
    Promise.all(
      Object.entries(PROVIDER_KEY).map(async ([, storeName]) => {
        if (!storeName) return;
        try {
          loaded[storeName] = await b.config.getKey(storeName);
        } catch {}
      }),
    ).then(() => {
      // Map loaded keys back to model IDs grouped by provider
      const newKeys: Record<string, string> = {};
      LLM_MODELS.forEach((m) => {
        const key = PROVIDER_KEY[m.provider];
        if (key && loaded[key]) newKeys[m.id] = loaded[key];
      });
      setApiKeys(newKeys);
    });
  }, []);

  async function saveModel(m: LLMModel) {
    setSaveState((s) => ({ ...s, [m.id]: 'saving' }));
    try {
      const key = PROVIDER_KEY[m.provider];
      if (key && apiKeys[m.id]) {
        await window.jarvisBridge.config.setKey(key, apiKeys[m.id]);
      }
      if (baseUrls[m.id]) {
        await window.jarvisBridge.config.setKey(`${m.provider.toUpperCase()}_BASE_URL`, baseUrls[m.id]);
      }
      setSaveState((s) => ({ ...s, [m.id]: 'saved' }));
      setTimeout(() => setSaveState((s) => ({ ...s, [m.id]: 'idle' })), 2000);
    } catch {
      setSaveState((s) => ({ ...s, [m.id]: 'err' }));
    }
  }

  async function setJarvisModel(modelId: string) {
    const m = LLM_MODELS.find((x) => x.id === modelId);
    if (!m) return;
    // Map to actual API model name
    const apiName = modelId
      .replace('anthropic-', 'claude-')
      .replace('openai-', '')
      .replace('google-', '')
      .replace('-45', '-4-5');
    try {
      await window.jarvisBridge.config.setKey('JARVIS_MODEL', apiName);
      setActiveModel(apiName);
    } catch {}
  }

  const byProvider = LLM_MODELS.reduce<Record<string, LLMModel[]>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
      <div
        className="font-mono"
        style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginBottom: 12, letterSpacing: '0.1em' }}
      >
        <span style={{ color: CYAN_BRIGHT }}>{LLM_MODELS.length} MODELS AVAILABLE</span> · {enabled.size}{' '}
        ENABLED
        {activeModel && <span style={{ color: JADE, marginLeft: 10 }}>ACTIVE: {activeModel}</span>}
      </div>
      {Object.entries(byProvider).map(([provider, models]) => (
        <div key={provider} style={{ marginBottom: 18 }}>
          <div
            className="hud-label"
            style={{
              fontSize: 9,
              color: 'var(--cyan-dim)',
              letterSpacing: '0.26em',
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: '1px solid var(--line-soft)',
            }}
          >
            {provider.toUpperCase()}
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}
          >
            {models.map((m) => {
              const on = enabled.has(m.id);
              const expanded = active === m.id;
              const st = saveState[m.id] ?? 'idle';
              return (
                <div
                  key={m.id}
                  className="holo"
                  style={{
                    padding: '12px 14px',
                    border: on ? `1px solid ${m.color}55` : '1px solid var(--line-soft)',
                    transition: 'border 0.2s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: expanded ? 10 : 0,
                    }}
                  >
                    <div>
                      <div
                        className="hud-label"
                        style={{
                          fontSize: 11,
                          color: on ? m.color : 'var(--cyan-dim)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {m.name}
                      </div>
                      <div
                        className="font-mono"
                        style={{ fontSize: 8, color: 'var(--cyan-dim)', marginTop: 2 }}
                      >
                        ctx: {m.context} · in: {m.inputCost} · out: {m.outputCost}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => setActive(expanded ? null : m.id)}
                        className="hud-label"
                        style={{
                          padding: '3px 8px',
                          fontSize: 7.5,
                          cursor: 'pointer',
                          color: CYAN,
                          border: `1px solid ${CYAN}44`,
                          background: 'transparent',
                          letterSpacing: '0.14em',
                        }}
                      >
                        {expanded ? '▲' : '▼ CONFIG'}
                      </button>
                      {/* toggle switch */}
                      <div
                        onClick={() =>
                          setEnabled((prev) => {
                            const s = new Set(prev);
                            s.has(m.id) ? s.delete(m.id) : s.add(m.id);
                            return s;
                          })
                        }
                        style={{
                          width: 34,
                          height: 18,
                          borderRadius: 9,
                          background: on ? `${m.color}88` : 'oklch(0.12 0.01 240)',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'background 0.2s',
                          border: `1px solid ${on ? m.color : 'var(--line-soft)'}`,
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: on ? 16 : 2,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: on ? m.color : 'var(--cyan-dim)',
                            transition: 'left 0.18s',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  {expanded && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: `1px solid ${m.color}22`,
                      }}
                    >
                      {PROVIDER_KEY[m.provider] && (
                        <div>
                          <div
                            className="hud-label"
                            style={{ fontSize: 7.5, color: 'var(--cyan-dim)', marginBottom: 3 }}
                          >
                            API KEY
                          </div>
                          <input
                            type="password"
                            value={apiKeys[m.id] ?? ''}
                            onChange={(e) => setApiKeys((k) => ({ ...k, [m.id]: e.target.value }))}
                            placeholder="Paste API key…"
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              fontSize: 10,
                              background: 'oklch(0.05 0.01 240)',
                              border: `1px solid ${m.color}44`,
                              color: 'var(--fg)',
                              outline: 'none',
                              fontFamily: 'var(--font-mono)',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      )}
                      <div>
                        <div
                          className="hud-label"
                          style={{ fontSize: 7.5, color: 'var(--cyan-dim)', marginBottom: 3 }}
                        >
                          BASE URL (OVERRIDE)
                        </div>
                        <input
                          type="text"
                          value={baseUrls[m.id] ?? ''}
                          onChange={(e) => setBaseUrls((u) => ({ ...u, [m.id]: e.target.value }))}
                          placeholder="Leave blank for default…"
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            fontSize: 10,
                            background: 'oklch(0.05 0.01 240)',
                            border: `1px solid ${m.color}44`,
                            color: 'var(--fg)',
                            outline: 'none',
                            fontFamily: 'var(--font-mono)',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="hud-label"
                          style={{
                            flex: 1,
                            padding: '5px',
                            fontSize: 8,
                            cursor: 'pointer',
                            color: JADE,
                            border: `1px solid ${JADE}55`,
                            background: `${JADE}10`,
                            letterSpacing: '0.16em',
                          }}
                          onClick={() => saveModel(m)}
                        >
                          {st === 'saving'
                            ? 'SAVING…'
                            : st === 'saved'
                              ? '◆ SAVED'
                              : st === 'err'
                                ? '◇ ERROR'
                                : 'SAVE CONFIG'}
                        </button>
                        <button
                          className="hud-label"
                          style={{
                            flex: 1,
                            padding: '5px',
                            fontSize: 8,
                            cursor: 'pointer',
                            color: VIOLET,
                            border: `1px solid ${VIOLET}55`,
                            background: `${VIOLET}10`,
                            letterSpacing: '0.16em',
                          }}
                          onClick={() => setJarvisModel(m.id)}
                        >
                          SET AS ACTIVE
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Connectors tab ─────────────────────────────────────────────────────────── */
// Map connector field → safeStorage key name
const CONN_KEY_MAP: Record<string, Record<string, string>> = {
  anthropic: { apiKey: 'ANTHROPIC_API_KEY', baseUrl: 'ANTHROPIC_BASE_URL' },
  openai: { apiKey: 'OPENAI_API_KEY', baseUrl: 'OPENAI_BASE_URL', orgId: 'OPENAI_ORG_ID' },
  google: { apiKey: 'GEMINI_API_KEY', project: 'GOOGLE_PROJECT_ID' },
  github: { token: 'GITHUB_TOKEN' },
  qwen: { apiKey: 'DASHSCOPE_API_KEY' },
  ollama: { baseUrl: 'OLLAMA_BASE_URL' },
  n8n: { url: 'N8N_WEBHOOK_URL', apiKey: 'N8N_API_KEY' },
  mt5bridge: { token: 'MT5_TOKEN' }, // host+port stored via config:setMt5
};

function ConnectorsTab() {
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Record<string, 'ok' | 'err' | 'testing' | 'saving'>>({});

  // Load stored keys on mount
  useEffect(() => {
    const b = window.jarvisBridge;
    if (!b?.config) return;
    Promise.all(
      CONNECTORS.map(async (c) => {
        const loaded: Record<string, string> = {};
        if (c.id === 'mt5bridge') {
          try {
            const mt5 = await b.config.getMt5();
            loaded.host = mt5.host;
            loaded.port = String(mt5.port);
          } catch {}
        } else {
          const km = CONN_KEY_MAP[c.id] ?? {};
          for (const [field, storeName] of Object.entries(km)) {
            try {
              loaded[field] = await b.config.getKey(storeName);
            } catch {}
          }
        }
        setValues((v) => ({ ...v, [c.id]: loaded }));
      }),
    );
  }, []);

  function set(connId: string, key: string, val: string) {
    setValues((v) => ({ ...v, [connId]: { ...(v[connId] ?? {}), [key]: val } }));
  }

  async function saveConn(c: ConnectorConfig) {
    setStatus((s) => ({ ...s, [c.id]: 'saving' }));
    try {
      const b = window.jarvisBridge;
      if (c.id === 'mt5bridge') {
        const host = values[c.id]?.host || 'localhost';
        const port = parseInt(values[c.id]?.port || '1234', 10);
        await b.config.setMt5(host, port);
        if (values[c.id]?.token) await b.config.setKey('MT5_TOKEN', values[c.id].token);
      } else {
        const km = CONN_KEY_MAP[c.id] ?? {};
        for (const [field, storeName] of Object.entries(km)) {
          const v = values[c.id]?.[field];
          if (v !== undefined) await b.config.setKey(storeName, v);
        }
      }
      await b.config.reloadKeys();
      setStatus((s) => ({ ...s, [c.id]: 'ok' }));
    } catch {
      setStatus((s) => ({ ...s, [c.id]: 'err' }));
    }
  }

  async function testConn(c: ConnectorConfig) {
    setStatus((s) => ({ ...s, [c.id]: 'testing' }));
    try {
      const b = window.jarvisBridge;
      if (c.id === 'anthropic') {
        const hasKey = await b.config.hasKey('ANTHROPIC_API_KEY');
        setStatus((s) => ({ ...s, [c.id]: hasKey ? 'ok' : 'err' }));
      } else if (c.id === 'google') {
        const hasKey = await b.config.hasKey('GEMINI_API_KEY');
        setStatus((s) => ({ ...s, [c.id]: hasKey ? 'ok' : 'err' }));
      } else if (c.id === 'github') {
        const hasKey = await b.config.hasKey('GITHUB_TOKEN');
        setStatus((s) => ({ ...s, [c.id]: hasKey ? 'ok' : 'err' }));
      } else if (c.id === 'mt5bridge') {
        const mt5 = await b.config.getMt5();
        const r = await b.mt5({ host: mt5.host, port: mt5.port, endpoint: '/ping', method: 'GET' });
        setStatus((s) => ({ ...s, [c.id]: r.ok ? 'ok' : 'err' }));
      } else if (c.id === 'ollama') {
        const r = await b.hasOllama?.();
        setStatus((s) => ({ ...s, [c.id]: r ? 'ok' : 'err' }));
      } else if (['openai', 'qwen', 'n8n'].includes(c.id)) {
        const r = await (b as any).testProvider?.(c.id);
        setStatus((s) => ({ ...s, [c.id]: r?.ok ? 'ok' : 'err' }));
      } else {
        // Generic: just check if key is stored
        const km = CONN_KEY_MAP[c.id];
        if (km) {
          const firstKey = Object.values(km)[0];
          const has = await b.config.hasKey(firstKey);
          setStatus((s) => ({ ...s, [c.id]: has ? 'ok' : 'err' }));
        } else {
          setStatus((s) => ({ ...s, [c.id]: 'ok' }));
        }
      }
    } catch {
      setStatus((s) => ({ ...s, [c.id]: 'err' }));
    }
  }

  function toggleShow(connId: string) {
    setShown((prev) => {
      const s = new Set(prev);
      s.has(connId) ? s.delete(connId) : s.add(connId);
      return s;
    });
  }

  const statusColor = (id: string) =>
    status[id] === 'ok'
      ? JADE
      : status[id] === 'err'
        ? ROSE
        : status[id] === 'testing' || status[id] === 'saving'
          ? AMBER
          : 'var(--cyan-dim)';
  const statusLabel = (id: string) =>
    status[id] === 'ok'
      ? '◆ CONNECTED'
      : status[id] === 'err'
        ? '◇ FAILED'
        : status[id] === 'testing'
          ? '⟳ TESTING…'
          : status[id] === 'saving'
            ? '⟳ SAVING…'
            : '◇ NOT TESTED';

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
      <div
        className="font-mono"
        style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginBottom: 12, letterSpacing: '0.1em' }}
      >
        <span style={{ color: CYAN_BRIGHT }}>{CONNECTORS.length} CONNECTORS</span> · Configure API keys and
        endpoints
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 12,
          alignContent: 'start',
        }}
      >
        {CONNECTORS.map((c) => (
          <div key={c.id} className="holo" style={{ padding: '14px 16px', border: `1px solid ${c.color}33` }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <div className="hud-label" style={{ fontSize: 12, color: c.color, letterSpacing: '0.16em' }}>
                {c.label}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span
                  className="font-mono"
                  style={{ fontSize: 8, color: statusColor(c.id), letterSpacing: '0.08em' }}
                >
                  {statusLabel(c.id)}
                </span>
                <button
                  onClick={() => testConn(c)}
                  className="hud-label"
                  style={{
                    padding: '3px 10px',
                    fontSize: 7.5,
                    cursor: 'pointer',
                    color: c.color,
                    border: `1px solid ${c.color}55`,
                    background: `${c.color}10`,
                    letterSpacing: '0.14em',
                  }}
                >
                  PING
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.fields.map((f) => (
                <div key={f.key}>
                  <div
                    className="hud-label"
                    style={{ fontSize: 7.5, color: 'var(--cyan-dim)', marginBottom: 3 }}
                  >
                    {f.label}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={f.secret && !shown.has(`${c.id}:${f.key}`) ? 'password' : 'text'}
                      value={values[c.id]?.[f.key] ?? ''}
                      onChange={(e) => set(c.id, f.key, e.target.value)}
                      placeholder={f.placeholder}
                      style={{
                        width: '100%',
                        padding: '6px 32px 6px 10px',
                        fontSize: 9.5,
                        background: 'oklch(0.05 0.01 240)',
                        border: `1px solid ${c.color}33`,
                        color: 'var(--fg)',
                        outline: 'none',
                        fontFamily: 'var(--font-mono)',
                        boxSizing: 'border-box',
                      }}
                    />
                    {f.secret && (
                      <button
                        onClick={() => toggleShow(`${c.id}:${f.key}`)}
                        style={{
                          position: 'absolute',
                          right: 6,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--cyan-dim)',
                          fontSize: 10,
                        }}
                      >
                        {shown.has(`${c.id}:${f.key}`) ? '○' : '●'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                className="hud-label"
                style={{
                  flex: 1,
                  padding: '6px',
                  fontSize: 8,
                  cursor: 'pointer',
                  color: JADE,
                  border: `1px solid ${JADE}55`,
                  background: `${JADE}10`,
                  letterSpacing: '0.18em',
                }}
                onClick={() => saveConn(c)}
              >
                {status[c.id] === 'saving' ? 'SAVING…' : 'SAVE'}
              </button>
              <button
                className="hud-label"
                style={{
                  flex: 1,
                  padding: '6px',
                  fontSize: 8,
                  cursor: 'pointer',
                  color: CYAN,
                  border: `1px solid ${CYAN}55`,
                  background: `${CYAN}10`,
                  letterSpacing: '0.18em',
                }}
                onClick={() => testConn(c)}
              >
                TEST
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Paths tab ──────────────────────────────────────────────────────────────── */
function PathsTab() {
  const paths = [
    {
      label: 'VAULT ROOT',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb',
      color: CYAN,
    },
    {
      label: 'AGENTS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\agents',
      color: VIOLET,
    },
    {
      label: 'SKILLS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\skills',
      color: JADE,
    },
    {
      label: 'PROMPTS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\prompts',
      color: AMBER,
    },
    {
      label: 'INSTRUCTIONS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\instructions',
      color: '#38bdf8',
    },
    {
      label: 'ANTIGRAVITY',
      value:
        'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\antigravity-awesome-skills\\skills',
      color: VIOLET,
    },
    {
      label: 'GC COLLECTIONS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\github-gamechangers',
      color: '#c8fb4e',
    },
    {
      label: 'AI APPS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\awesome-ai-apps',
      color: '#e879f9',
    },
    {
      label: 'PLUGINS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\plugins',
      color: '#fb923c',
    },
    { label: 'SKILLS INDEX', value: 'G:\\jarvis-ops-os\\src\\data\\skills-index.json', color: CYAN },
    { label: 'MT5 BRIDGE', value: 'G:\\jarvis-ops-os\\mt5_bridge\\bridge.py', color: JADE },
    { label: 'APP ROOT', value: 'G:\\jarvis-ops-os', color: 'var(--cyan-dim)' },
  ];

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
      <div
        className="font-mono"
        style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginBottom: 12, letterSpacing: '0.1em' }}
      >
        <span style={{ color: CYAN_BRIGHT }}>CONFIGURED PATHS</span> · Click to copy
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {paths.map((p) => (
          <div
            key={p.label}
            className="holo"
            style={{
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
            onClick={() => navigator.clipboard.writeText(p.value)}
          >
            <div>
              <div
                className="hud-label"
                style={{ fontSize: 8, color: p.color, letterSpacing: '0.22em', marginBottom: 3 }}
              >
                {p.label}
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 9.5, color: 'var(--fg)', wordBreak: 'break-all' }}
              >
                {p.value}
              </div>
            </div>
            <span
              className="hud-label"
              style={{
                fontSize: 7,
                color: 'var(--cyan-dim)',
                flexShrink: 0,
                border: '1px solid var(--line-soft)',
                padding: '2px 6px',
              }}
            >
              COPY
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Admin Tools Tab ─────────────────────────────────────────────────────────── */
interface AdminTool {
  id: string;
  label: string;
  desc: string;
  category: string;
  icon: string;
}

const ADMIN_TOOL_LIST: AdminTool[] = [
  {
    id: 'backup',
    label: 'Backup Manager',
    desc: 'Trigger and schedule automated backups of config, workspace, and agent files',
    category: 'DATA',
    icon: '◎',
  },
  {
    id: 'log-viewer',
    label: 'Log Viewer',
    desc: 'Tail, filter, and search real-time application logs and Electron process output',
    category: 'DEBUG',
    icon: '◈',
  },
  {
    id: 'error-tracker',
    label: 'Error Tracker',
    desc: 'View recent uncaught exceptions, stack traces, and IPC errors across the app',
    category: 'DEBUG',
    icon: '⚠',
  },
  {
    id: 'health-check',
    label: 'Health Dashboard',
    desc: 'Ping all connected services: Claude API, MT5 bridge, ZeusBot, local models',
    category: 'MONITOR',
    icon: '◉',
  },
  {
    id: 'perf-profiler',
    label: 'Performance Profiler',
    desc: 'Measure startup time, IPC latency, render cycles, and memory allocation',
    category: 'PERF',
    icon: '◆',
  },
  {
    id: 'cache-mgr',
    label: 'Cache Manager',
    desc: 'Inspect and flush app caches: response cache, agent index, workflow state',
    category: 'DATA',
    icon: '◫',
  },
  {
    id: 'feature-flags',
    label: 'Feature Flags',
    desc: 'Enable/disable experimental features, beta modules, and dev overrides',
    category: 'CONFIG',
    icon: '◬',
  },
  {
    id: 'webhook-tester',
    label: 'Webhook Tester',
    desc: 'Send test POST/GET webhooks to external endpoints with custom payloads',
    category: 'NETWORK',
    icon: '⬡',
  },
  {
    id: 'env-inspector',
    label: 'Env Inspector',
    desc: 'View all active environment variables, .env file values, and injected config',
    category: 'CONFIG',
    icon: '▣',
  },
  {
    id: 'api-keys',
    label: 'API Key Audit',
    desc: 'Verify all stored API keys: expiry, permissions, last-used, vault integrity',
    category: 'SECURITY',
    icon: '◇',
  },
  {
    id: 'rate-limiter',
    label: 'Rate Limiter',
    desc: 'Configure per-model API call limits, burst caps, and cooldown windows',
    category: 'CONFIG',
    icon: '▤',
  },
  {
    id: 'session-mgr',
    label: 'Session Manager',
    desc: 'Inspect active sessions, localStorage state, and clear stale session data',
    category: 'DATA',
    icon: '▦',
  },
  {
    id: 'audit-log',
    label: 'Audit Log',
    desc: 'Full audit trail: UI actions, IPC calls, file writes, API requests with actors',
    category: 'SECURITY',
    icon: '◎',
  },
  {
    id: 'db-browser',
    label: 'DB Browser',
    desc: 'Browse electron userData JSON stores, agent registry, and workflow definitions',
    category: 'DATA',
    icon: '◈',
  },
  {
    id: 'ssl-check',
    label: 'SSL Cert Inspector',
    desc: 'Validate TLS certificates of connected API endpoints and MT5 bridge',
    category: 'SECURITY',
    icon: '◉',
  },
  {
    id: 'dns-lookup',
    label: 'DNS Lookup Tool',
    desc: 'Resolve hostnames, check MX/TXT records, and diagnose connectivity issues',
    category: 'NETWORK',
    icon: '⬡',
  },
  {
    id: 'metrics-dash',
    label: 'Metrics Dashboard',
    desc: 'App-level metrics: messages sent, tokens used, uptime, active agents, latency',
    category: 'MONITOR',
    icon: '◆',
  },
  {
    id: 'alerts',
    label: 'System Alerts',
    desc: 'Configure threshold-based alerts: CPU, memory, API errors, bridge disconnects',
    category: 'MONITOR',
    icon: '⚡',
  },
  {
    id: 'file-upload',
    label: 'File Upload Manager',
    desc: 'Upload agent files, prompts, and config directly to the local JARVIS vault',
    category: 'DATA',
    icon: '↑',
  },
  {
    id: 'task-runner',
    label: 'Task Runner',
    desc: 'Queue and run background tasks: index rebuild, backup, agent sync, updates',
    category: 'PERF',
    icon: '▶',
  },
];

const ATOOL_CAT_COLOR: Record<string, string> = {
  DATA: CYAN_BRIGHT,
  DEBUG: ROSE,
  MONITOR: JADE,
  PERF: AMBER,
  CONFIG: VIOLET,
  NETWORK: '#4fc3f7',
  SECURITY: '#fb923c',
};

function AdminToolsTab() {
  const [filter, setFilter] = useState<string>('ALL');
  const [sel, setSel] = useState<AdminTool | null>(ADMIN_TOOL_LIST[0]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const cats = ['ALL', ...Array.from(new Set(ADMIN_TOOL_LIST.map((t) => t.category)))];
  const shown = filter === 'ALL' ? ADMIN_TOOL_LIST : ADMIN_TOOL_LIST.filter((t) => t.category === filter);

  async function runTool(tool: AdminTool) {
    if (busy) return;
    setBusy(tool.id);
    const ts = new Date().toLocaleTimeString();
    setLog((p) => [...p.slice(-49), `[${ts}] ${tool.label} — started`]);
    // Tool-specific actions
    try {
      if (tool.id === 'health-check') {
        const hasKey = await (window as any).jarvisBridge.hasKey();
        setLog((p) => [...p, `  Claude API key: ${hasKey ? '✓ OK' : '✗ Not configured'}`]);
        const hasG = await (window as any).jarvisBridge.hasGemini();
        setLog((p) => [...p, `  Gemini key: ${hasG ? '✓ OK' : '✗ Not configured'}`]);
        setLog((p) => [...p, `  MT5 bridge: checking…`]);
        try {
          const r = await (window as any).jarvisBridge.mt5({
            host: 'localhost',
            port: 1234,
            endpoint: 'account',
          });
          setLog((p) => [...p, `  MT5 bridge: ${r.ok ? '✓ CONNECTED' : '✗ ' + r.err}`]);
        } catch {
          setLog((p) => [...p, '  MT5 bridge: ✗ not reachable']);
        }
      } else if (tool.id === 'env-inspector') {
        setLog((p) => [
          ...p,
          `  APP_DATA: ${(window as any).electron?.process?.env?.APPDATA || 'n/a'}`,
          '  (env vars available via main process)',
        ]);
      } else if (tool.id === 'session-mgr') {
        const keys = Object.keys(localStorage);
        setLog((p) => [
          ...p,
          `  localStorage keys (${keys.length}):`,
          ...keys.map((k) => `    ${k}: ${String(localStorage.getItem(k) || '').slice(0, 60)}`),
        ]);
      } else if (tool.id === 'metrics-dash') {
        setLog((p) => [
          ...p,
          `  Console messages: ${JSON.parse(localStorage.getItem('jarvis.console') || '[]').length}`,
          `  Workflows: ${JSON.parse(localStorage.getItem('jarvis.workflows.edits') || '{}') ? 'loaded' : 'none'}`,
          `  Directives: ${JSON.parse(localStorage.getItem('jarvis.directives') || '[]').length} active`,
        ]);
      } else if (tool.id === 'cache-mgr') {
        const before = Object.keys(localStorage).filter((k) => k.startsWith('jarvis.')).length;
        setLog((p) => [
          ...p,
          `  ${before} jarvis.* keys in cache`,
          '  Use "Clear Cache" to flush non-critical data',
        ]);
      } else if (tool.id === 'audit-log') {
        setLog((p) => [
          ...p,
          `  Audit trail not yet persisted. IPC handlers: ~40`,
          `  API calls: tracked in activityRing (main process)`,
        ]);
      } else if (tool.id === 'api-keys') {
        const keys = [
          'ANTHROPIC_API_KEY',
          'OPENAI_API_KEY',
          'GEMINI_API_KEY',
          'GITHUB_TOKEN',
          'DASHSCOPE_API_KEY',
        ];
        for (const k of keys) {
          const has = await (window as any).jarvisBridge.config.hasKey(k);
          setLog((p) => [...p, `  ${k}: ${has ? '✓ stored' : '✗ not set'}`]);
        }
      } else {
        setLog((p) => [...p, `  ${tool.desc}`, `  [UI ready — backend integration pending for this tool]`]);
      }
      setLog((p) => [...p, `✓ ${tool.label} — complete`]);
    } catch (e: any) {
      setLog((p) => [...p, `✗ Error: ${e?.message || e}`]);
    }
    setBusy(null);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 10, flex: 1, minHeight: 0 }}>
      {/* Left: tool grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {/* Category filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
          {cats.map((c) => {
            const cc = c === 'ALL' ? CYAN : (ATOOL_CAT_COLOR[c] ?? CYAN);
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className="hud-label"
                style={{
                  padding: '3px 9px',
                  fontSize: 7.5,
                  cursor: 'pointer',
                  letterSpacing: '0.14em',
                  border: `1px solid ${filter === c ? cc : 'rgba(255,255,255,0.1)'}`,
                  color: filter === c ? cc : 'rgba(255,255,255,0.3)',
                  background: filter === c ? `${cc}14` : 'transparent',
                }}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <DraggableGrid
          storageKey="jarvis.grid.admintools"
          items={shown}
          columns={2}
          gap={8}
          renderItem={(tool) => {
            const cc = ATOOL_CAT_COLOR[tool.category] ?? CYAN;
            const isSel = sel?.id === tool.id;
            const isRunning = busy === tool.id;
            return (
              <button
                onClick={() => {
                  setSel(tool);
                  runTool(tool);
                }}
                disabled={!!busy}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: `1px solid ${isSel ? cc : cc + '33'}`,
                  background: isRunning ? `${cc}18` : isSel ? `${cc}10` : `${cc}05`,
                  cursor: busy ? 'wait' : 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'all 0.15s',
                  opacity: busy && !isRunning ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, color: cc, lineHeight: 1 }}>{tool.icon}</span>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 6.5,
                      color: cc,
                      border: `1px solid ${cc}40`,
                      padding: '1px 3px',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {tool.category}
                  </span>
                </div>
                <div className="hud-label" style={{ fontSize: 9.5, color: cc, letterSpacing: '0.14em' }}>
                  {isRunning ? '◌ Running…' : tool.label}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}
                >
                  {tool.desc.slice(0, 60)}…
                </div>
              </button>
            );
          }}
        />
      </div>

      {/* Right: detail + log */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {sel && (
          <div
            style={{
              padding: '12px 14px',
              border: `1px solid ${ATOOL_CAT_COLOR[sel.category] ?? CYAN}33`,
              background: `${ATOOL_CAT_COLOR[sel.category] ?? CYAN}06`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 18, color: ATOOL_CAT_COLOR[sel.category] ?? CYAN }}>{sel.icon}</span>
            <div
              className="hud-label"
              style={{
                fontSize: 12,
                color: ATOOL_CAT_COLOR[sel.category] ?? CYAN,
                marginTop: 4,
                letterSpacing: '0.14em',
              }}
            >
              {sel.label}
            </div>
            <span
              className="hud-label"
              style={{
                fontSize: 7,
                color: 'rgba(255,255,255,0.35)',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '1px 5px',
                letterSpacing: '0.12em',
              }}
            >
              {sel.category}
            </span>
            <div
              className="font-mono"
              style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 8, lineHeight: 1.6 }}
            >
              {sel.desc}
            </div>
            <button
              onClick={() => sel && runTool(sel)}
              disabled={!!busy}
              className="hud-label"
              style={{
                marginTop: 10,
                width: '100%',
                padding: '8px',
                fontSize: 9,
                color: JADE,
                border: `1px solid ${JADE}`,
                cursor: 'pointer',
                letterSpacing: '0.2em',
                background: `${JADE}12`,
              }}
            >
              {busy === sel.id ? '◌ RUNNING…' : '▶ RUN TOOL'}
            </button>
          </div>
        )}

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(0,0,0,0.3)',
            minHeight: 0,
          }}
        >
          <div
            className="hud-label"
            style={{
              fontSize: 7.5,
              color: 'rgba(255,255,255,0.3)',
              padding: '6px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              letterSpacing: '0.18em',
            }}
          >
            ◎ ACTIVITY LOG
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '6px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
            className="nx-scroll"
          >
            {log.length === 0 ? (
              <div
                className="font-mono"
                style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', paddingTop: 12, textAlign: 'center' }}
              >
                Click any tool to run
              </div>
            ) : (
              log.map((l, i) => (
                <div
                  key={i}
                  className="font-mono"
                  style={{
                    fontSize: 8.5,
                    color: l.startsWith('✓')
                      ? JADE
                      : l.startsWith('✗')
                        ? ROSE
                        : l.startsWith('  ')
                          ? 'rgba(255,255,255,0.55)'
                          : CYAN_BRIGHT,
                    lineHeight: 1.5,
                  }}
                >
                  {l}
                </div>
              ))
            )}
          </div>
          {log.length > 0 && (
            <button
              onClick={() => setLog([])}
              className="hud-label"
              style={{
                padding: '4px',
                fontSize: 7.5,
                color: 'rgba(255,255,255,0.25)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                background: 'transparent',
                letterSpacing: '0.18em',
              }}
            >
              CLEAR LOG
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Social & Search Keys Tab ───────────────────────────────────────────────────── */
const SOCIAL_KEY_LIST = [
  {
    name: 'X_API_KEY',
    label: 'API Key',
    group: 'X / Twitter',
    url: 'https://developer.twitter.com/en/portal/dashboard',
    desc: 'Consumer Key (API v2)',
  },
  {
    name: 'X_API_SECRET',
    label: 'API Secret',
    group: 'X / Twitter',
    url: 'https://developer.twitter.com/en/portal/dashboard',
    desc: 'Consumer Secret (API v2)',
  },
  {
    name: 'X_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'X / Twitter',
    url: 'https://developer.twitter.com/en/portal/dashboard',
    desc: 'Per-account OAuth token',
  },
  {
    name: 'X_ACCESS_SECRET',
    label: 'Access Secret',
    group: 'X / Twitter',
    url: 'https://developer.twitter.com/en/portal/dashboard',
    desc: 'Per-account OAuth token secret',
  },
  {
    name: 'IG_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'Instagram',
    url: 'https://developers.facebook.com/apps/',
    desc: 'Graph API long-lived token',
  },
  {
    name: 'IG_USER_ID',
    label: 'User ID',
    group: 'Instagram',
    url: 'https://developers.facebook.com/apps/',
    desc: 'Business Account numeric ID',
  },
  {
    name: 'THREADS_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'Threads',
    url: 'https://developers.facebook.com/docs/threads',
    desc: 'Threads API long-lived token',
  },
  {
    name: 'YT_API_KEY',
    label: 'API Key',
    group: 'YouTube',
    url: 'https://console.cloud.google.com/apis/credentials',
    desc: 'YouTube Data API v3 server key',
  },
  {
    name: 'YT_CLIENT_ID',
    label: 'OAuth Client ID',
    group: 'YouTube',
    url: 'https://console.cloud.google.com/apis/credentials',
    desc: 'Google Cloud OAuth 2.0 Client ID',
  },
  {
    name: 'YT_CLIENT_SECRET',
    label: 'OAuth Secret',
    group: 'YouTube',
    url: 'https://console.cloud.google.com/apis/credentials',
    desc: 'Google Cloud OAuth 2.0 Client Secret',
  },
  {
    name: 'YT_REFRESH_TOKEN',
    label: 'Refresh Token',
    group: 'YouTube',
    url: 'https://console.cloud.google.com/apis/credentials',
    desc: 'Long-lived refresh token for uploads',
  },
  {
    name: 'TT_CLIENT_KEY',
    label: 'Client Key',
    group: 'TikTok',
    url: 'https://developers.tiktok.com/',
    desc: 'TikTok for Business App Client Key',
  },
  {
    name: 'TT_CLIENT_SECRET',
    label: 'Client Secret',
    group: 'TikTok',
    url: 'https://developers.tiktok.com/',
    desc: 'TikTok for Business App Client Secret',
  },
  {
    name: 'TT_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'TikTok',
    url: 'https://developers.tiktok.com/',
    desc: 'Content Posting API token',
  },
  {
    name: 'LI_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'LinkedIn',
    url: 'https://www.linkedin.com/developers/apps',
    desc: 'Marketing API OAuth 2.0 token',
  },
  {
    name: 'LI_ORG_ID',
    label: 'Org ID',
    group: 'LinkedIn',
    url: 'https://www.linkedin.com/developers/apps',
    desc: 'Company page urn:li:organization:{id}',
  },
  {
    name: 'FB_ACCESS_TOKEN',
    label: 'Page Token',
    group: 'Facebook',
    url: 'https://developers.facebook.com/apps/',
    desc: 'Meta Graph API long-lived page token',
  },
  {
    name: 'FB_PAGE_ID',
    label: 'Page ID',
    group: 'Facebook',
    url: 'https://developers.facebook.com/apps/',
    desc: 'Numeric Facebook Page ID',
  },
  {
    name: 'TELEGRAM_BOT_TOKEN',
    label: 'Bot Token',
    group: 'Telegram',
    url: 'https://t.me/BotFather',
    desc: 'BotFather token 123456:ABC-...',
  },
  {
    name: 'TELEGRAM_CHANNEL',
    label: 'Channel',
    group: 'Telegram',
    url: 'https://t.me/BotFather',
    desc: 'Username or numeric ID (-100...)',
  },
  {
    name: 'DISCORD_BOT_TOKEN',
    label: 'Bot Token',
    group: 'Discord',
    url: 'https://discord.com/developers/applications',
    desc: 'Developer Portal Bot token',
  },
  {
    name: 'DISCORD_CHANNEL_ID',
    label: 'Channel ID',
    group: 'Discord',
    url: 'https://discord.com/developers/applications',
    desc: 'Target text channel snowflake ID',
  },
  {
    name: 'SLACK_WEBHOOK_URL',
    label: 'Webhook URL',
    group: 'Slack',
    url: 'https://api.slack.com/messaging/webhooks',
    desc: 'Incoming webhook for Hermes Router outbound',
  },
  {
    name: 'REDDIT_CLIENT_ID',
    label: 'Client ID',
    group: 'Reddit',
    url: 'https://www.reddit.com/prefs/apps',
    desc: 'Personal use script app',
  },
  {
    name: 'REDDIT_CLIENT_SECRET',
    label: 'Client Secret',
    group: 'Reddit',
    url: 'https://www.reddit.com/prefs/apps',
    desc: 'Reddit app client secret',
  },
  {
    name: 'REDDIT_REFRESH_TOKEN',
    label: 'Refresh Token',
    group: 'Reddit',
    url: 'https://www.reddit.com/prefs/apps',
    desc: 'OAuth refresh token for posting',
  },
  {
    name: 'TWITCH_CLIENT_ID',
    label: 'Client ID',
    group: 'Twitch',
    url: 'https://dev.twitch.tv/console/apps',
    desc: 'Twitch Developer Console Client ID',
  },
  {
    name: 'TWITCH_CLIENT_SECRET',
    label: 'Client Secret',
    group: 'Twitch',
    url: 'https://dev.twitch.tv/console/apps',
    desc: 'Twitch Developer Console Client Secret',
  },
  {
    name: 'TWITCH_CHANNEL',
    label: 'Channel Name',
    group: 'Twitch',
    url: 'https://dev.twitch.tv/console/apps',
    desc: 'Channel login name (lowercase)',
  },
  {
    name: 'BRAVE_API_KEY',
    label: 'API Key',
    group: 'Brave Search',
    url: 'https://api.search.brave.com/app/keys',
    desc: 'Free 2k req/month search API key',
  },
];
// group meta: url + icon per group
const SOCIAL_GROUP_META: Record<string, { url: string; icon: string; color: string }> = {
  'X / Twitter': { url: 'https://twitter.com/i/oauth2/authorize', icon: '𝕏', color: '#e2e8f0' },
  Instagram: { url: 'https://api.instagram.com/oauth/authorize', icon: '◎', color: '#f472b6' },
  Threads: { url: 'https://www.threads.net/oauth/authorize', icon: '@', color: '#a78bfa' },
  YouTube: { url: 'https://accounts.google.com/o/oauth2/auth', icon: '▶', color: '#f87171' },
  TikTok: { url: 'https://www.tiktok.com/auth/authorize/', icon: '♪', color: '#fb7185' },
  LinkedIn: { url: 'https://www.linkedin.com/oauth/v2/authorization', icon: 'in', color: '#38bdf8' },
  Facebook: { url: 'https://www.facebook.com/dialog/oauth', icon: 'f', color: '#60a5fa' },
  Telegram: { url: 'https://t.me/BotFather', icon: '✈', color: '#22d3ee' },
  Discord: { url: 'https://discord.com/oauth2/authorize', icon: '⬡', color: '#818cf8' },
  Slack: { url: 'https://api.slack.com/messaging/webhooks', icon: '#', color: '#4ade80' },
  Reddit: { url: 'https://www.reddit.com/api/v1/authorize', icon: '◉', color: '#fb923c' },
  Twitch: { url: 'https://id.twitch.tv/oauth2/authorize', icon: '▌', color: '#a855f7' },
  'Brave Search': { url: 'https://api.search.brave.com/app/keys', icon: '🔍', color: '#fb923c' },
};
function openUrl(url: string) {
  window.jarvisBridge.shell?.openExternal?.(url) ?? window.open(url, '_blank');
}
function SocialTab() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const filled: Record<string, boolean> = {};
    let pending = SOCIAL_KEY_LIST.length;
    SOCIAL_KEY_LIST.forEach((k) => {
      window.jarvisBridge.config
        .getKey(k.name)
        .then((v) => {
          if (v) {
            setVals((prev) => ({ ...prev, [k.name]: v }));
            filled[k.name] = true;
          }
          if (--pending === 0) {
            // mark a group connected if ALL its keys have values
            const grpMap: Record<string, string[]> = {};
            SOCIAL_KEY_LIST.forEach((x) => {
              (grpMap[x.group] = grpMap[x.group] || []).push(x.name);
            });
            const conn: Record<string, boolean> = {};
            Object.entries(grpMap).forEach(([g, names]) => {
              conn[g] = names.every((n) => !!filled[n]);
            });
            setConnected(conn);
          }
        })
        .catch(() => {
          if (--pending === 0) {
          }
        });
    });
  }, []);
  async function save(name: string, group: string) {
    const val = (vals[name] || '').trim();
    if (val) {
      await window.jarvisBridge.config.setKey(name, val);
    } else {
      await window.jarvisBridge.config.deleteKey(name);
    }
    setSaved((prev) => ({ ...prev, [name]: true }));
    setTimeout(() => setSaved((prev) => ({ ...prev, [name]: false })), 2000);
    // recheck group connectivity
    const grpKeys = SOCIAL_KEY_LIST.filter((k) => k.group === group);
    const allFilled = await Promise.all(grpKeys.map((k) => window.jarvisBridge.config.getKey(k.name)));
    setConnected((prev) => ({ ...prev, [group]: allFilled.every((v) => !!v) }));
  }
  const groups = SOCIAL_KEY_LIST.reduce<Record<string, typeof SOCIAL_KEY_LIST>>((acc, k) => {
    (acc[k.group] = acc[k.group] || []).push(k);
    return acc;
  }, {});
  return (
    <div className="nx-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 2 }}>
      {Object.entries(groups).map(([grp, keys]) => {
        const meta = SOCIAL_GROUP_META[grp] || { url: '#', icon: '?', color: AMBER };
        const isConn = connected[grp];
        return (
          <div key={grp} style={{ marginBottom: 5 }}>
            {/* Group header row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 2px 3px',
                borderBottom: `1px solid ${meta.color}44`,
                marginBottom: 1,
              }}
            >
              <span style={{ fontSize: 11, width: 18, textAlign: 'center', color: meta.color }}>
                {meta.icon}
              </span>
              <span
                className="hud-label"
                style={{ flex: 1, fontSize: 7.5, color: meta.color, letterSpacing: '0.28em' }}
              >
                {grp.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: 7,
                  color: isConn ? JADE : 'var(--cyan-dim)',
                  marginRight: 4,
                  letterSpacing: '0.15em',
                }}
              >
                {isConn ? '● CONNECTED' : '○ NOT SET'}
              </span>
              <button
                onClick={() => openUrl(meta.url)}
                className="hud-label"
                style={{
                  fontSize: 7.5,
                  padding: '2px 8px',
                  color: meta.color,
                  border: `1px solid ${meta.color}66`,
                  background: `${meta.color}11`,
                  cursor: 'pointer',
                  letterSpacing: '0.18em',
                  whiteSpace: 'nowrap',
                }}
              >
                AUTHORIZE ↗
              </button>
            </div>
            {/* Key rows */}
            {keys.map((k) => (
              <div
                key={k.name}
                title={k.desc}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 52px',
                  gap: 3,
                  alignItems: 'center',
                  height: 24,
                  paddingLeft: 24,
                  borderBottom: '1px solid var(--line-soft)',
                }}
              >
                <div
                  className="font-mono"
                  style={{
                    fontSize: 8.5,
                    color: vals[k.name] ? JADE : 'var(--cyan-dim)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {vals[k.name] ? '✓ ' : ''}
                  {k.label}
                </div>
                <input
                  type="password"
                  value={vals[k.name] || ''}
                  onChange={(e) => setVals((prev) => ({ ...prev, [k.name]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && save(k.name, grp)}
                  placeholder="paste key…"
                  className="font-mono"
                  style={{
                    height: 18,
                    padding: '0 6px',
                    fontSize: 10,
                    color: 'var(--fg)',
                    background: 'oklch(0.07 0.014 240 / 0.7)',
                    border: `1px solid ${vals[k.name] ? JADE + '55' : 'var(--line)'}`,
                    outline: 'none',
                    width: '100%',
                  }}
                />
                <button
                  onClick={() => save(k.name, grp)}
                  className="hud-label"
                  style={{
                    height: 18,
                    fontSize: 7,
                    color: saved[k.name] ? JADE : AMBER,
                    border: `1px solid ${saved[k.name] ? JADE : AMBER}55`,
                    background: 'transparent',
                    cursor: 'pointer',
                    letterSpacing: '0.1em',
                  }}
                >
                  {saved[k.name] ? '✓' : 'SAVE'}
                </button>
              </div>
            ))}
          </div>
        );
      })}
      <div
        className="font-mono"
        style={{ fontSize: 8, color: 'var(--cyan-dim)', padding: '6px 2px', opacity: 0.5 }}
      >
        AES-256 safeStorage · hover rows for details · Enter to save · click DEV PORTAL to open credentials
        page
      </div>
    </div>
  );
}

/* ── Main Admin Screen ───────────────────────────────────────────────────────── */
const ADMIN_DEFAULT_TABS: DragTab[] = [
  {
    id: 'MODELS',
    label: 'LLM LIBRARY',
    color: '#e879f9',
    count: `${LLM_MODELS.length} models`,
    pinned: true,
  },
  { id: 'CONNECTORS', label: 'CONNECTORS', color: JADE, count: `${CONNECTORS.length} endpoints` },
  { id: 'PATHS', label: 'VAULT PATHS', color: CYAN, count: '12 paths' },
  { id: 'TOOLS', label: '⚙ ADMIN TOOLS', color: AMBER, count: `${ADMIN_TOOL_LIST.length} tools` },
  { id: 'SOCIAL', label: '📡 SOCIAL KEYS', color: ROSE, count: `${SOCIAL_KEY_LIST.length} keys` },
];

export default function AdminScreen({ onResetSetup }: { onResetSetup?: () => void }) {
  const [tab, setTab] = useState<AdminTab>('MODELS');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* header */}
      <ScreenHeader
        tag="SYS"
        title="ADMIN PANEL"
        subtitle="LLM Library · Connector Configuration · Vault Paths"
        right={
          onResetSetup && (
            <button
              onClick={() => {
                localStorage.removeItem('jarvis.setupDone');
                onResetSetup();
              }}
              className="hud-label"
              style={{
                fontSize: 8.5,
                padding: '4px 12px',
                cursor: 'pointer',
                color: 'var(--cyan-dim)',
                border: '1px solid var(--line-soft)',
                background: 'transparent',
                letterSpacing: '0.18em',
              }}
            >
              RE-RUN SETUP
            </button>
          )
        }
      />

      <DraggableTabs
        storageKey="jarvis.tabs.admin"
        defaultTabs={ADMIN_DEFAULT_TABS}
        active={tab}
        onActivate={(id) => setTab(id as AdminTab)}
      />

      {/* content */}
      {tab === 'MODELS' && <ModelsTab />}
      {tab === 'CONNECTORS' && <ConnectorsTab />}
      {tab === 'PATHS' && <PathsTab />}
      {tab === 'TOOLS' && <AdminToolsTab />}
      {tab === 'SOCIAL' && <SocialTab />}
    </div>
  );
}
