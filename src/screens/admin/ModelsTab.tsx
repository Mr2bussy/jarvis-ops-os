// @ts-nocheck
import { useState, useEffect } from 'react';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET } from '../../theme';
import { LLM_MODELS, type LLMModel } from './admin-data';

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

export { ModelsTab };
