// @ts-nocheck
import { useState, useEffect } from 'react';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET } from '../../theme';
import { CONNECTORS } from './admin-data';

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

export { ConnectorsTab };
