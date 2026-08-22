import { useCallback, useEffect, useState } from 'react';
import { CYAN, CYAN_BRIGHT, AMBER } from '../theme';

type PlatformStatus = { configured: boolean; active: boolean; lastError?: string };

type GatewayStatus = {
  running: boolean;
  brand: string;
  platforms: Record<string, PlatformStatus>;
  messagesHandled: number;
  lastInbound?: { platform: string; preview: string; at: string };
};

export default function HermesRouterScreen() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [testMsg, setTestMsg] = useState('JARVIS Prime online via Hermes Router.');

  const refresh = useCallback(async () => {
    const g = window.jarvisBridge?.gateway;
    if (!g) return;
    const st = await g.status();
    if (st.ok && st.data) setStatus(st.data as GatewayStatus);
    const cfg = await g.configGet();
    if (cfg.ok && cfg.data && typeof cfg.data === 'object' && 'enabled' in cfg.data) {
      setEnabled(Boolean((cfg.data as { enabled: boolean }).enabled));
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  async function toggleRun(start: boolean) {
    setBusy(true);
    setErr('');
    try {
      const g = window.jarvisBridge?.gateway;
      if (!g) throw new Error('Gateway bridge unavailable');
      if (start) {
        await g.configSet({ enabled: true });
        const r = await g.start();
        if (!r.ok) throw new Error(r.err ?? 'start failed');
      } else {
        await g.stop();
      }
      await refresh();
    } catch (e: unknown) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(platform: string) {
    setBusy(true);
    setErr('');
    try {
      const r = await window.jarvisBridge?.gateway?.deliver(platform, testMsg);
      if (!r?.ok) throw new Error(r?.err ?? 'deliver failed');
    } catch (e: unknown) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
      <div>
        <div className="font-display glow-cyan" style={{ fontSize: 22, color: CYAN_BRIGHT }}>
          Hermes Router
        </div>
        <div style={{ color: 'var(--text-dim)', marginTop: 6, fontSize: 13 }}>
          Omnichannel gateway (Hermes rebrand) — Telegram inbound, Discord/Slack/Telegram outbound, cron
          delivery. Configure tokens in <strong>Admin</strong>.
        </div>
      </div>

      {err && (
        <div
          style={{
            color: '#f87171',
            fontSize: 13,
            padding: 10,
            border: '1px solid #f8717133',
            borderRadius: 6,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={() => toggleRun(true)} style={btnStyle(CYAN)}>
          Start gateway
        </button>
        <button type="button" disabled={busy} onClick={() => toggleRun(false)} style={btnStyle('#64748b')}>
          Stop gateway
        </button>
        <span style={{ color: 'var(--text-dim)', fontSize: 13, alignSelf: 'center' }}>
          {status?.running ? 'RUNNING' : 'STOPPED'} · config {enabled ? 'enabled' : 'disabled'} · handled{' '}
          {status?.messagesHandled ?? 0}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {(['telegram', 'discord', 'slack'] as const).map((p) => {
          const ps = status?.platforms?.[p];
          return (
            <div key={p} style={cardStyle}>
              <div style={{ color: CYAN_BRIGHT, textTransform: 'capitalize' }}>{p}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                configured: {ps?.configured ? 'yes' : 'no'} · active: {ps?.active ? 'yes' : 'no'}
              </div>
              {ps?.lastError && (
                <div style={{ fontSize: 11, color: AMBER, marginTop: 4 }}>{ps.lastError.slice(0, 80)}</div>
              )}
              <button
                type="button"
                style={{ ...btnStyle(CYAN), marginTop: 10, width: '100%' }}
                disabled={busy || !ps?.configured}
                onClick={() => sendTest(p)}
              >
                Test send
              </button>
            </div>
          );
        })}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        Test message
        <input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} style={inputStyle} />
      </label>

      {status?.lastInbound && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Last inbound ({status.lastInbound.platform}): {status.lastInbound.preview}
        </div>
      )}
    </div>
  );
}

function btnStyle(color: string) {
  return {
    padding: '8px 14px',
    background: `${color}22`,
    border: `1px solid ${color}55`,
    color,
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as const;
}

const cardStyle = {
  padding: 14,
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: 'oklch(0.06 0.012 240 / 0.6)',
};

const inputStyle = {
  padding: '8px 10px',
  background: 'oklch(0.05 0.012 240)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  color: 'var(--text)',
  fontFamily: 'inherit',
};
