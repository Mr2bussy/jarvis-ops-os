import { useEffect, useMemo, useState } from 'react';
import { HoloPanel } from '../components/primitives';
import { ScreenHeader } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, VIOLET, JADE, ROSE } from '../theme';

type App = { slug: string; name: string; categories: string[] };

// Composio's published category sizes (shown as reference until the live catalog
// loads). Live counts replace these once connected — nothing here is faked.
const CATS: { name: string; ref: number; color: string }[] = [
  { name: 'Productivity', ref: 131, color: CYAN },
  { name: 'Business', ref: 124, color: AMBER },
  { name: 'Google Suite', ref: 85, color: JADE },
  { name: 'Messaging', ref: 87, color: VIOLET },
  { name: 'Social Media', ref: 58, color: ROSE },
];
const TOTAL_REF = CATS.reduce((n, c) => n + c.ref, 0); // 485

export default function IntegrationsScreen() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [byCat, setByCat] = useState<Record<string, App[]>>({});
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const jb = window.jarvisBridge;
      if (!jb?.composio) {
        setConnected(false);
        return;
      }
      const has = await jb.composio.has().catch(() => false);
      if (!alive) return;
      setConnected(has);
      if (!has) return;
      setLoading(true);
      try {
        const res = await jb.composio.catalog();
        if (!alive) return;
        setApps(res.apps);
        setByCat(res.byCategory);
      } catch (e: any) {
        if (alive) setErr(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return byCat;
    const out: Record<string, App[]> = {};
    for (const [cat, list] of Object.entries(byCat)) {
      out[cat] = list.filter((a) => `${a.slug} ${a.name}`.toLowerCase().includes(needle));
    }
    return out;
  }, [byCat, q]);

  const statusChip = (
    <span
      className="hud-label"
      style={{
        fontSize: 9,
        color: connected ? JADE : ROSE,
        border: `1px solid ${connected ? JADE : ROSE}50`,
        background: `${connected ? JADE : ROSE}10`,
        padding: '4px 10px',
        letterSpacing: '0.2em',
      }}
    >
      {connected === null
        ? '…'
        : connected
          ? `● CONNECTED${apps.length ? ` · ${apps.length} LIVE` : ''}`
          : '○ NOT CONNECTED'}
    </span>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <ScreenHeader
        tag="INTEGRATIONS"
        title="COMPOSIO · 485 APPS"
        subtitle="Productivity · Business · Google Suite · Messaging · Social Media"
        right={statusChip}
      />

      {connected === false && (
        <HoloPanel label="CONNECT COMPOSIO" code="CMP-0" status="warn">
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.6 }}>
            Composio bündelt <b style={{ color: CYAN_BRIGHT }}>{TOTAL_REF}+</b> App-Integrationen über 5
            Kategorien. Trage <code style={{ color: AMBER }}>COMPOSIO_API_KEY</code> unter{' '}
            <b>Admin → Models</b> ein, um den
            <b> Live-Katalog</b> zu laden und Aktionen auszuführen.
            <br />
            Key holen: <span style={{ color: CYAN }}>https://app.composio.dev</span>
          </div>
        </HoloPanel>
      )}

      {err && (
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            color: ROSE,
            padding: 8,
            border: `1px solid ${ROSE}30`,
            background: `${ROSE}08`,
          }}
        >
          ✗ {err}
        </div>
      )}

      {connected && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={loading ? 'Lade Live-Katalog…' : 'Apps filtern…'}
          disabled={loading}
          style={{
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${CYAN}33`,
            color: 'var(--fg)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            outline: 'none',
          }}
        />
      )}

      <div
        className="nx-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
          alignContent: 'start',
        }}
      >
        {CATS.map((c) => {
          const live = filtered[c.name] || [];
          return (
            <HoloPanel key={c.name} label={c.name.toUpperCase()} code="CMP" style={{ minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="glow-cyan-sm" style={{ fontSize: 26, fontWeight: 700, color: c.color }}>
                  {connected ? live.length : c.ref}
                </span>
                <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>
                  {connected ? 'live apps' : `≈ ${c.ref} · Composio published`}
                </span>
              </div>
              {connected && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                  {live.slice(0, 40).map((a) => (
                    <span
                      key={a.slug}
                      title={a.slug}
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        padding: '2px 7px',
                        border: `1px solid ${c.color}33`,
                        color: 'rgba(255,255,255,0.7)',
                        background: `${c.color}0d`,
                      }}
                    >
                      {a.name}
                    </span>
                  ))}
                  {live.length > 40 && (
                    <span
                      className="font-mono"
                      style={{ fontSize: 9, color: 'var(--cyan-dim)', padding: '2px 4px' }}
                    >
                      +{live.length - 40}
                    </span>
                  )}
                  {live.length === 0 && !loading && (
                    <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>
                      —
                    </span>
                  )}
                </div>
              )}
            </HoloPanel>
          );
        })}
      </div>
    </div>
  );
}
