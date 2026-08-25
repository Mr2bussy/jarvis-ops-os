// @ts-nocheck
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET } from '../../theme';
import {
  ADMIN_CONNECTIONS,
  connectionsByDomain,
  setAtKey,
  type AdminConnection,
  type ConnectionDomain,
} from '../../data/admin-connections';
import { getJarvisBridge } from '../../lib/bridge';

export type ConnStatus = 'missing' | 'connected' | 'error' | 'needs_rotate' | 'checking';

function statusColor(s: ConnStatus): string {
  switch (s) {
    case 'connected':
      return JADE;
    case 'error':
      return ROSE;
    case 'needs_rotate':
      return AMBER;
    case 'checking':
      return VIOLET;
    default:
      return 'var(--cyan-dim)';
  }
}

function statusLabel(s: ConnStatus): string {
  switch (s) {
    case 'connected':
      return '◆ CONNECTED';
    case 'error':
      return '◇ ERROR';
    case 'needs_rotate':
      return '⟳ NEEDS ROTATE';
    case 'checking':
      return '… CHECKING';
    default:
      return '○ MISSING';
  }
}

async function keyPresent(name: string, aliases?: string[]): Promise<boolean> {
  const cfg = getJarvisBridge()?.config;
  if (!cfg?.hasKey) return false;
  const names = [name, ...(aliases ?? [])];
  for (const n of names) {
    try {
      if (await cfg.hasKey(n)) return true;
    } catch {
      /* continue */
    }
  }
  return false;
}

async function readKey(name: string, aliases?: string[]): Promise<string> {
  const cfg = getJarvisBridge()?.config;
  if (!cfg?.getKey) return '';
  const names = [name, ...(aliases ?? [])];
  for (const n of names) {
    try {
      const v = await cfg.getKey(n);
      if (v) return v;
    } catch {
      /* continue */
    }
  }
  return '';
}

async function probeConnection(c: AdminConnection): Promise<ConnStatus> {
  const b = getJarvisBridge();
  if (!b?.config) return 'missing';

  try {
    if (c.auth === 'oauth' && c.composioToolkit && c.keys.length === 0) {
      const has = await b.composio?.has?.().catch(() => false);
      if (!has) return 'missing';
      const res = await b.composio?.connections?.().catch(() => null);
      const rows = (res as { items?: { toolkit: string; status: string }[] } | null)?.items ?? [];
      const hit = rows.some(
        (r) => r.toolkit?.toLowerCase() === c.composioToolkit!.toLowerCase() && /active/i.test(r.status),
      );
      return hit ? 'connected' : 'missing';
    }

    if (c.probe === 'mt5') {
      const mt5 = await b.config.getMt5();
      const r = await b.mt5({ host: mt5.host, port: mt5.port, endpoint: '/ping', method: 'GET' });
      return r.ok ? 'connected' : mt5.host ? 'error' : 'missing';
    }

    if (c.probe === 'ollama') {
      const ok = await b.hasOllama?.();
      if (ok) return 'connected';
      const host = await readKey('OLLAMA_HOST', ['OLLAMA_BASE_URL']);
      return host ? 'error' : 'missing';
    }

    if (c.probe === 'composio') {
      const ok = await b.composio?.has?.();
      return ok ? 'connected' : 'missing';
    }

    if (c.probe === 'imap') {
      const host = await keyPresent('IMAP_HOST');
      const user = await keyPresent('IMAP_USER');
      const pass = await keyPresent('IMAP_PASSWORD');
      if (!host || !user || !pass) return 'missing';
      const idle = await b.production?.imapIdleStatus?.().catch(() => null);
      const state = (idle as { state?: string } | null)?.state;
      if (state === 'error') return 'error';
      if (state === 'listening' || state === 'idle') return 'connected';
      return 'connected'; // keys present; IDLE may be disabled/unavailable
    }

    if (c.probe === 'gateway-tg') {
      const tok = await keyPresent('TELEGRAM_BOT_TOKEN');
      const ch = (await keyPresent('TELEGRAM_CHANNEL')) || (await keyPresent('TELEGRAM_CHAT_ID'));
      if (!tok || !ch) return 'missing';
      return 'connected';
    }

    if (c.probe === 'piper') {
      const st = await b.voice?.piperStatus?.().catch(() => null);
      if (st && typeof st === 'object' && 'ok' in st && (st as { ok: boolean }).ok) return 'connected';
      const pathOk = await keyPresent('PIPER_PATH');
      return pathOk ? 'error' : 'missing';
    }

    if (c.probe === 'search') {
      const brave = (await keyPresent('BRAVE_API_KEY')) || (await keyPresent('BRAVE_SEARCH_API_KEY'));
      return brave ? 'connected' : 'missing';
    }

    if (c.probe === 'vault') {
      const paths = await b.getVaultPaths?.().catch(() => []);
      const agents = (paths ?? []).find((p) => /AGENTS/i.test(p.label));
      if (agents?.exists) return 'connected';
      const p = await keyPresent('JARVIS_AGENTS_PATH');
      return p ? 'error' : 'missing';
    }

    if (c.auth === 'auto') {
      const has = await keyPresent(c.keys[0]?.key ?? '');
      return has ? 'connected' : 'missing';
    }

    // Default: all secret/primary keys present (skip empty optional non-secret extras if primary secrets set)
    const primary = c.keys.filter((f) => f.secret || c.keys.length <= 2);
    const check = primary.length ? primary : c.keys;
    if (!check.length) return 'missing';
    let anyMissing = false;
    let anyPresent = false;
    let needsRotate = false;
    for (const f of check) {
      const aliases = c.aliases?.[f.key];
      const present = await keyPresent(f.key, aliases);
      if (present) anyPresent = true;
      else anyMissing = true;
      if (present && f.secret && c.rotateDays) {
        const at = await readKey(setAtKey(f.key));
        if (at) {
          const age = Date.now() - Date.parse(at);
          if (Number.isFinite(age) && age > (c.rotateDays ?? 90) * 86400000) needsRotate = true;
        }
      }
    }
    if (!anyPresent) return 'missing';
    if (anyMissing && c.priority === 'required') return 'missing';
    if (needsRotate) return 'needs_rotate';
    return 'connected';
  } catch {
    return 'error';
  }
}

export default function ConnectionsPanel() {
  const groups = useMemo(() => connectionsByDomain(), []);
  const [filter, setFilter] = useState<ConnectionDomain | 'ALL'>('ALL');
  const [status, setStatus] = useState<Record<string, ConnStatus>>({});
  const [vals, setVals] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [composioAccounts, setComposioAccounts] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const next: Record<string, ConnStatus> = {};
    for (const c of ADMIN_CONNECTIONS) next[c.id] = 'checking';
    setStatus(next);

    const loaded: Record<string, string> = {};
    for (const c of ADMIN_CONNECTIONS) {
      for (const f of c.keys) {
        const v = await readKey(f.key, c.aliases?.[f.key]);
        if (v) loaded[f.key] = f.secret ? '' : v; // don't echo secrets into inputs
        if (v && f.secret) loaded[`${f.key}__HAS`] = '1';
      }
      if (c.probe === 'mt5') {
        try {
          const mt5 = await getJarvisBridge()!.config.getMt5();
          loaded.MT5_HOST = mt5.host;
          loaded.MT5_PORT = String(mt5.port);
        } catch {
          /* ignore */
        }
      }
    }
    setVals((prev) => ({ ...prev, ...loaded }));

    const results = await Promise.all(
      ADMIN_CONNECTIONS.map(async (c) => [c.id, await probeConnection(c)] as const),
    );
    setStatus(Object.fromEntries(results));

    try {
      const res = await getJarvisBridge()?.composio?.connections?.();
      const items = (res as { items?: { toolkit: string; status: string }[] } | undefined)?.items ?? [];
      setComposioAccounts(items.filter((i) => /active/i.test(i.status)).map((i) => i.toolkit.toLowerCase()));
    } catch {
      setComposioAccounts([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const list = Object.values(status);
    return {
      connected: list.filter((s) => s === 'connected' || s === 'needs_rotate').length,
      missing: list.filter((s) => s === 'missing').length,
      error: list.filter((s) => s === 'error').length,
      rotate: list.filter((s) => s === 'needs_rotate').length,
      total: ADMIN_CONNECTIONS.length,
    };
  }, [status]);

  async function saveConn(c: AdminConnection) {
    const b = getJarvisBridge();
    if (!b?.config?.setKey) return;
    setBusy(c.id);
    try {
      if (c.probe === 'mt5') {
        const host = vals.MT5_HOST || 'localhost';
        const port = parseInt(vals.MT5_PORT || '1234', 10);
        await b.config.setMt5(host, port);
        if (vals.MT5_TOKEN?.trim()) {
          await b.config.setKey('MT5_TOKEN', vals.MT5_TOKEN.trim());
          await b.config.setKey(setAtKey('MT5_TOKEN'), new Date().toISOString());
        }
      } else {
        for (const f of c.keys) {
          const raw = vals[f.key];
          if (raw === undefined) continue;
          const trimmed = raw.trim();
          if (!trimmed && f.secret && vals[`${f.key}__HAS`]) continue; // keep existing
          if (!trimmed) {
            await b.config.deleteKey?.(f.key);
            continue;
          }
          await b.config.setKey(f.key, trimmed);
          if (f.secret) {
            await b.config.setKey(setAtKey(f.key), new Date().toISOString());
          }
          // write primary alias so probe + legacy Social tabs stay in sync
          const alts = c.aliases?.[f.key];
          if (alts?.[0] && alts[0] !== f.key) {
            await b.config.setKey(alts[0], trimmed);
          }
        }
      }
      await b.config.reloadKeys?.();
      setFlash((f) => ({ ...f, [c.id]: 'SAVED' }));
      setTimeout(() => setFlash((f) => ({ ...f, [c.id]: '' })), 1800);
      const st = await probeConnection(c);
      setStatus((s) => ({ ...s, [c.id]: st }));
    } catch {
      setStatus((s) => ({ ...s, [c.id]: 'error' }));
      setFlash((f) => ({ ...f, [c.id]: 'ERROR' }));
    } finally {
      setBusy(null);
    }
  }

  async function testConn(c: AdminConnection) {
    setBusy(c.id);
    setStatus((s) => ({ ...s, [c.id]: 'checking' }));
    try {
      const b = getJarvisBridge();
      if (c.id === 'anthropic' || c.id === 'openai' || c.id === 'qwen' || c.id === 'n8n') {
        const map: Record<string, string> = {
          anthropic: 'anthropic',
          openai: 'openai',
          qwen: 'qwen',
          n8n: 'n8n',
        };
        if (c.id === 'anthropic') {
          const has = await b?.config.hasKey('ANTHROPIC_API_KEY');
          setStatus((s) => ({ ...s, [c.id]: has ? 'connected' : 'missing' }));
        } else {
          const r = await b?.testProvider?.(map[c.id]);
          setStatus((s) => ({ ...s, [c.id]: r?.ok ? 'connected' : 'error' }));
        }
      } else {
        const st = await probeConnection(c);
        setStatus((s) => ({ ...s, [c.id]: st }));
      }
    } catch {
      setStatus((s) => ({ ...s, [c.id]: 'error' }));
    } finally {
      setBusy(null);
    }
  }

  async function oauthConn(c: AdminConnection) {
    if (!c.composioToolkit) return;
    const b = getJarvisBridge();
    setBusy(c.id);
    try {
      const has = await b?.composio?.has?.();
      if (!has) {
        setFlash((f) => ({ ...f, [c.id]: 'SET COMPOSIO KEY FIRST' }));
        setStatus((s) => ({ ...s, composio: 'missing' }));
        return;
      }
      const r = await b!.composio.initiate(c.composioToolkit);
      if (!r?.ok) throw new Error(r?.err ?? 'OAuth failed');
      setFlash((f) => ({ ...f, [c.id]: 'BROWSER OPENED' }));
      setTimeout(() => void refresh(), 2500);
    } catch (e) {
      setFlash((f) => ({ ...f, [c.id]: String((e as Error)?.message ?? e).slice(0, 40) }));
      setStatus((s) => ({ ...s, [c.id]: 'error' }));
    } finally {
      setBusy(null);
    }
  }

  function openDocs(url?: string) {
    if (!url) return;
    getJarvisBridge()?.shell?.openExternal?.(url) ?? window.open(url, '_blank');
  }

  const visible = groups
    .map((g) => ({
      ...g,
      items: filter === 'ALL' ? g.items : g.items.filter((i) => i.domain === filter),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          className="font-mono"
          style={{ fontSize: 9.5, color: 'var(--cyan-dim)', letterSpacing: '0.1em' }}
        >
          <span style={{ color: CYAN_BRIGHT }}>{counts.total} CONNECTIONS</span>
          <span style={{ color: JADE, marginLeft: 10 }}>{counts.connected} ok</span>
          <span style={{ color: 'var(--cyan-dim)', marginLeft: 8 }}>{counts.missing} missing</span>
          {counts.error > 0 && <span style={{ color: ROSE, marginLeft: 8 }}>{counts.error} error</span>}
          {counts.rotate > 0 && <span style={{ color: AMBER, marginLeft: 8 }}>{counts.rotate} rotate</span>}
          {composioAccounts.length > 0 && (
            <span style={{ color: VIOLET, marginLeft: 10 }}>
              Composio OAuth: {composioAccounts.join(', ')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="hud-label"
            onClick={() => void refresh()}
            style={{
              padding: '4px 10px',
              fontSize: 8,
              cursor: 'pointer',
              color: CYAN,
              border: `1px solid ${CYAN}55`,
              background: `${CYAN}10`,
              letterSpacing: '0.14em',
            }}
          >
            REFRESH STATUS
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
        <FilterChip label="ALL" active={filter === 'ALL'} color={CYAN} onClick={() => setFilter('ALL')} />
        {groups.map((g) => (
          <FilterChip
            key={g.domain}
            label={g.meta.label}
            active={filter === g.domain}
            color={g.meta.color}
            onClick={() => setFilter(g.domain)}
          />
        ))}
      </div>

      <div className="nx-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {visible.map((g) => (
          <div key={g.domain} style={{ marginBottom: 18 }}>
            <div
              className="hud-label"
              style={{
                fontSize: 9,
                color: g.meta.color,
                letterSpacing: '0.26em',
                marginBottom: 8,
                paddingBottom: 4,
                borderBottom: `1px solid ${g.meta.color}33`,
              }}
            >
              {g.meta.label}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 8,
              }}
            >
              {g.items.map((c) => {
                const st = status[c.id] ?? 'missing';
                const expanded = openId === c.id;
                const sc = statusColor(st);
                return (
                  <div
                    key={c.id}
                    className="holo"
                    style={{
                      padding: '12px 14px',
                      border: `1px solid ${sc}44`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          className="hud-label"
                          style={{ fontSize: 11, color: g.meta.color, letterSpacing: '0.12em' }}
                        >
                          {c.label}
                          {c.priority === 'required' && (
                            <span style={{ color: ROSE, marginLeft: 6, fontSize: 7 }}>REQ</span>
                          )}
                        </div>
                        <div
                          className="font-mono"
                          style={{ fontSize: 8.5, color: 'var(--cyan-dim)', marginTop: 3, lineHeight: 1.4 }}
                        >
                          {c.blurb}
                        </div>
                      </div>
                      <span
                        className="font-mono"
                        style={{ fontSize: 7.5, color: sc, letterSpacing: '0.08em', flexShrink: 0 }}
                      >
                        {statusLabel(st)}
                      </span>
                    </div>

                    {c.maturity !== 'live' && (
                      <div
                        className="font-mono"
                        style={{
                          fontSize: 8,
                          color: AMBER,
                          lineHeight: 1.45,
                          padding: '5px 8px',
                          border: `1px solid ${AMBER}40`,
                          background: `${AMBER}0a`,
                        }}
                      >
                        {c.maturity === 'scaffold' ? 'SCAFFOLD' : 'PARTIAL'}
                        {c.scaffoldNote ? ` · ${c.scaffoldNote}` : ''}
                      </div>
                    )}

                    {c.auth === 'oauth' && (
                      <div className="font-mono" style={{ fontSize: 8, color: VIOLET }}>
                        OAuth via Composio{c.keys.length ? ' · token fallback below' : ''}
                      </div>
                    )}

                    {expanded && c.keys.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {c.keys.map((f) => (
                          <div key={f.key}>
                            <div
                              className="hud-label"
                              style={{ fontSize: 7.5, color: 'var(--cyan-dim)', marginBottom: 3 }}
                            >
                              {f.label}
                              {vals[`${f.key}__HAS`] && !vals[f.key] ? ' · stored' : ''}
                            </div>
                            <div style={{ position: 'relative' }}>
                              <input
                                type={f.secret && !shown.has(`${c.id}:${f.key}`) ? 'password' : 'text'}
                                value={vals[f.key] ?? ''}
                                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                                placeholder={
                                  vals[`${f.key}__HAS`] && f.secret
                                    ? '•••••••• (leave blank to keep)'
                                    : f.placeholder
                                }
                                disabled={c.auth === 'auto'}
                                style={{
                                  width: '100%',
                                  padding: '6px 32px 6px 10px',
                                  fontSize: 9.5,
                                  background: 'oklch(0.05 0.01 240)',
                                  border: `1px solid ${g.meta.color}33`,
                                  color: 'var(--fg)',
                                  outline: 'none',
                                  fontFamily: 'var(--font-mono)',
                                  boxSizing: 'border-box',
                                  opacity: c.auth === 'auto' ? 0.55 : 1,
                                }}
                              />
                              {f.secret && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShown((prev) => {
                                      const s = new Set(prev);
                                      const k = `${c.id}:${f.key}`;
                                      s.has(k) ? s.delete(k) : s.add(k);
                                      return s;
                                    })
                                  }
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
                    )}

                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
                      <button
                        type="button"
                        className="hud-label"
                        onClick={() => setOpenId(expanded ? null : c.id)}
                        style={chipBtn(CYAN)}
                      >
                        {expanded ? '▲' : '▼'} CONFIG
                      </button>
                      {c.keys.length > 0 && c.auth !== 'auto' && (
                        <button
                          type="button"
                          className="hud-label"
                          disabled={busy === c.id}
                          onClick={() => void saveConn(c)}
                          style={chipBtn(JADE)}
                        >
                          {busy === c.id ? '…' : flash[c.id] === 'SAVED' ? '◆ SAVED' : 'SAVE'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="hud-label"
                        disabled={busy === c.id}
                        onClick={() => void testConn(c)}
                        style={chipBtn(AMBER)}
                      >
                        TEST
                      </button>
                      {(c.auth === 'oauth' || c.composioToolkit) && (
                        <button
                          type="button"
                          className="hud-label"
                          disabled={busy === c.id}
                          onClick={() => void oauthConn(c)}
                          style={chipBtn(VIOLET)}
                        >
                          OAUTH ↗
                        </button>
                      )}
                      {c.docsUrl && (
                        <button
                          type="button"
                          className="hud-label"
                          onClick={() => openDocs(c.docsUrl)}
                          style={chipBtn('var(--cyan-dim)')}
                        >
                          DOCS
                        </button>
                      )}
                    </div>
                    {flash[c.id] && flash[c.id] !== 'SAVED' && (
                      <div className="font-mono" style={{ fontSize: 8, color: AMBER }}>
                        {flash[c.id]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div
          className="font-mono"
          style={{ fontSize: 8, color: 'var(--cyan-dim)', padding: '8px 2px 16px', opacity: 0.65 }}
        >
          AES-256 safeStorage · packaged builds ignore plaintext .env · rotate secrets ~90d · see
          docs/ADMIN-CONNECTIONS.md
        </div>
      </div>
    </div>
  );
}

function chipBtn(color: string): CSSProperties {
  return {
    padding: '4px 8px',
    fontSize: 7.5,
    cursor: 'pointer',
    color,
    border: `1px solid ${color}55`,
    background: `${color}10`,
    letterSpacing: '0.12em',
  };
}

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hud-label"
      style={{
        padding: '3px 9px',
        fontSize: 7,
        cursor: 'pointer',
        letterSpacing: '0.12em',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
        color: active ? color : 'rgba(255,255,255,0.35)',
        background: active ? `${color}14` : 'transparent',
      }}
    >
      {label}
    </button>
  );
}
