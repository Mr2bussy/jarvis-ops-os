import { useState } from 'react';
import { HoloPanel, Stat } from '../components/primitives';
import { ScreenHeader, Chip } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE } from '../theme';
import { EXTERNAL_PROJECTS } from '../data/collections-catalog';
import type { AppEntry } from '../global';

/* ── My Built Apps (with health badges) ─────────────────────────────────────── */
type HealthStatus = 'HEALTHY' | 'WARNING' | 'BROKEN' | 'ALPHA';
interface BuiltApp {
  id: string; name: string; desc: string; tag: string;
  status: HealthStatus; issues: string[]; version: string; path?: string;
}

const HEALTH_COLOR: Record<HealthStatus, string> = {
  HEALTHY: JADE, WARNING: AMBER, BROKEN: ROSE, ALPHA: '#a78bfa',
};
const HEALTH_ICON: Record<HealthStatus, string> = {
  HEALTHY: '◉', WARNING: '⚠', BROKEN: '✕', ALPHA: '◈',
};

const MY_BUILT_APPS: BuiltApp[] = [
  {
    id: 'jarvis-ops',
    name: 'JARVIS Ops OS',
    desc: 'Main Electron AI desktop OS — this app',
    tag: 'flagship', version: '0.9.4-beta',
    status: 'WARNING',
    issues: ['ContentModule automation not wired', 'MT5 bridge intermittent disconnects', 'Voice overlay cuts on long responses'],
  },
  {
    id: 'zeusbot',
    name: 'ZeusBot Trading',
    desc: 'Automated forex/crypto execution bot with MT5',
    tag: 'trading', version: '2.1.0',
    status: 'HEALTHY',
    issues: [],
  },
  {
    id: 'mig-suite',
    name: 'MIG Suite',
    desc: 'Sierra Chart + MIG signals + Telegram bridge',
    tag: 'trading', version: '1.4.2',
    status: 'WARNING',
    issues: ['Telegram message queue occasionally drops signals', 'CPP indicator refresh lag at 1-min TF'],
  },
  {
    id: 'content-engine',
    name: 'Content Engine',
    desc: 'AI content creation + auto-post pipeline',
    tag: 'content', version: '0.3.1',
    status: 'BROKEN',
    issues: ['YouTube API OAuth token expired', 'Post scheduler CRON not persisting across restarts', 'IG graph API rate limited — needs new token'],
  },
  {
    id: 'arsenal-kg',
    name: 'Arsenal Knowledge Graph',
    desc: 'Local semantic search + agent index over 2100+ files',
    tag: 'ai', version: '1.0.0',
    status: 'HEALTHY',
    issues: [],
  },
  {
    id: 'antigravity',
    name: 'AntiGravity Agent',
    desc: 'Deep research + autonomous multi-step AI agent',
    tag: 'ai', version: '0.8.0',
    status: 'ALPHA',
    issues: ['Long tasks occasionally lose context > 64k tokens', 'Web scraper blocked by Cloudflare on some sites'],
  },
  {
    id: 'openjarvis',
    name: 'OpenJARVIS',
    desc: 'Open-source JARVIS variant for public release',
    tag: 'ai', version: '0.1.0-alpha',
    status: 'ALPHA',
    issues: ['No auth system yet', 'Missing 70% of private features', 'Needs public API key setup flow'],
  },
];

const KIND_LABEL: Record<AppEntry['kind'], string> = {
  exe: 'EXECUTABLE', url: 'WEB / URL', folder: 'FOLDER', cmd: 'COMMAND',
};
const KIND_COLOR: Record<AppEntry['kind'], string> = {
  exe: CYAN_BRIGHT, url: AMBER, folder: JADE, cmd: ROSE,
};

const SUGGESTED: { name: string; path: string; kind: AppEntry['kind']; tag: string }[] = [
  { name: 'TradingView',     path: 'https://www.tradingview.com/',           kind: 'url', tag: 'trading' },
  { name: 'ChatGPT',         path: 'https://chatgpt.com/',                   kind: 'url', tag: 'ai' },
  { name: 'Claude',          path: 'https://claude.ai/',                     kind: 'url', tag: 'ai' },
  { name: 'YouTube Studio',  path: 'https://studio.youtube.com/',            kind: 'url', tag: 'content' },
  { name: 'X / Twitter',     path: 'https://x.com/home',                     kind: 'url', tag: 'content' },
  { name: 'Twitch Studio',   path: 'https://dashboard.twitch.tv/',           kind: 'url', tag: 'content' },
  { name: 'Binance',         path: 'https://www.binance.com/',               kind: 'url', tag: 'trading' },
  { name: 'GitHub',          path: 'https://github.com/',                    kind: 'url', tag: 'dev' },
  { name: 'Notion',          path: 'https://www.notion.so/',                 kind: 'url', tag: 'workspace' },
];

function BuiltAppCard({ app }: { app: BuiltApp }) {
  const [expanded, setExpanded] = useState(false);
  const hc = HEALTH_COLOR[app.status];
  const hi = HEALTH_ICON[app.status];
  return (
    <div onClick={() => setExpanded(e => !e)}
      style={{ flexShrink:0, minWidth:180, maxWidth:220, padding:'10px 12px', cursor:'pointer',
        border:`1px solid ${hc}${app.status === 'BROKEN' ? 'cc' : '55'}`,
        background:`${hc}${app.status === 'BROKEN' ? '14' : '08'}`,
        position:'relative', transition:'all 0.15s' }}>
      {/* Health badge */}
      <div style={{ position:'absolute', top:6, right:8, display:'flex', alignItems:'center', gap:3 }}>
        <span style={{ fontSize:11, color:hc, lineHeight:1 }}>{hi}</span>
        {app.issues.length > 0 && (
          <span className="hud-label" style={{ fontSize:8, color:ROSE, background:`${ROSE}22`, padding:'0 4px', border:`1px solid ${ROSE}66` }}>
            {app.issues.length}
          </span>
        )}
      </div>
      <div className="hud-label" style={{ fontSize:9.5, color:hc, letterSpacing:'0.12em', paddingRight:28 }}>{app.name}</div>
      <div className="font-mono" style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{app.version} · {app.tag}</div>
      <div className="font-mono" style={{ fontSize:7.5, color:'rgba(255,255,255,0.3)', marginTop:3, lineHeight:1.3 }}>{app.desc.slice(0,48)}{app.desc.length>48?'…':''}</div>
      {/* Issues dropdown */}
      {expanded && app.issues.length > 0 && (
        <div style={{ marginTop:8, borderTop:`1px dashed ${ROSE}44`, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
          {app.issues.map((issue,i) => (
            <div key={i} className="font-mono" style={{ fontSize:7.5, color:ROSE, lineHeight:1.3 }}>⚠ {issue}</div>
          ))}
        </div>
      )}
    </div>
  );
}

const APPS_KEY = 'jarvis.apps';
function loadApps(): AppEntry[] {
  try { return JSON.parse(localStorage.getItem(APPS_KEY) || '[]'); } catch { return []; }
}
function persistApps(list: AppEntry[]) {
  localStorage.setItem(APPS_KEY, JSON.stringify(list));
}
const LS_FREQ = 'jarvis.apps.freq';
function getFreq(): Record<string, { count: number }> {
  try { return JSON.parse(localStorage.getItem(LS_FREQ) || '{}'); } catch { return {}; }
}
function bumpFreq(id: string) {
  const f = getFreq(); f[id] = { count: (f[id]?.count || 0) + 1 };
  localStorage.setItem(LS_FREQ, JSON.stringify(f));
}

export default function AppsScreen() {
  const [apps, setApps] = useState<AppEntry[]>(loadApps);
  const [scan, setScan] = useState<{ name: string; path: string }[]>([]);
  const [busyScan, setBusyScan] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [form, setForm] = useState<{ name: string; path: string; kind: AppEntry['kind']; tag: string }>({
    name: '', path: '', kind: 'url', tag: '',
  });
  const [launchMsg, setLaunchMsg] = useState<string>('');

  function refresh() { setApps(loadApps()); }

  function add(entry: { name: string; path: string; kind: AppEntry['kind']; tag?: string }) {
    if (!entry.name.trim() || !entry.path.trim()) return;
    const newEntry: AppEntry = { id: `app-${Date.now()}`, name: entry.name.trim(), path: entry.path.trim(), kind: entry.kind, tag: entry.tag || '', addedAt: Date.now() };
    const list = [...loadApps(), newEntry];
    persistApps(list);
    setApps(list);
    setForm({ name: '', path: '', kind: form.kind, tag: '' });
  }
  function remove(id: string) {
    const list = loadApps().filter(a => a.id !== id);
    persistApps(list);
    setApps(list);
  }
  async function launch(e: AppEntry) {
    bumpFreq(e.id);
    setLaunchMsg(`launching ${e.name}…`);
    try {
      if (e.kind === 'url') {
        window.open(e.path, '_blank', 'noopener,noreferrer');
        setLaunchMsg(`► opened ${e.name}`);
      } else {
        const r = await window.jarvisBridge.appsLaunch(e);
        setLaunchMsg(r.ok ? `► launched ${e.name}` : `⚠ ${r.err || 'failed'}`);
      }
    } catch {
      if (e.kind === 'url') {
        window.open(e.path, '_blank', 'noopener,noreferrer');
        setLaunchMsg(`► opened ${e.name}`);
      } else {
        setLaunchMsg(`⚠ path: ${e.path}`);
      }
    }
    setTimeout(() => setLaunchMsg(''), 3500);
  }
  async function pickPath(kind: 'exe'|'folder') {
    const p = await window.jarvisBridge.appsPick(kind);
    if (p) setForm(f => ({ ...f, path: p, kind, name: f.name || p.split(/[\\/]/).pop() || p }));
  }
  async function doScan() {
    setBusyScan(true);
    try { setScan(await window.jarvisBridge.appsScanCommon()); } finally { setBusyScan(false); }
  }

  const freq = getFreq();
  const sortedApps = [...apps].sort((a, b) => (freq[b.id]?.count || 0) - (freq[a.id]?.count || 0));
  const tags = Array.from(new Set(['all', ...apps.map(a => a.tag).filter(Boolean) as string[]]));
  const filtered = sortedApps.filter(a => filter === 'all' || a.tag === filter);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <ScreenHeader
        tag="MY APPS"
        title="CONNECT · LAUNCH · ORCHESTRATE"
        subtitle="Register your own apps — websites, executables, folders, scripts. JARVIS launches them via your OS."
        right={<div style={{ display: 'flex', gap: 12 }}><Stat label="REGISTERED" value={String(apps.length)} /><Stat label="STATUS" value={launchMsg || 'idle'} /></div>}
      />

      {/* ── MY BUILT APPS HEALTH BAR ───────────────────────── */}
      <div style={{ flexShrink:0 }}>
        <div className="hud-label" style={{ fontSize:8, color:'rgba(255,255,255,0.35)', letterSpacing:'0.24em', marginBottom:6 }}>◆ MY BUILT APPS · HEALTH STATUS</div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }} className="nx-scroll">
          {MY_BUILT_APPS.map(app => <BuiltAppCard key={app.id} app={app} />)}
        </div>
      </div>
      {/* ── EXTERNAL REPO PROJECTS ───────────────── */}
      <div style={{ flexShrink:0 }}>
        <div className="hud-label" style={{ fontSize:8, color:'rgba(255,255,255,0.35)', letterSpacing:'0.24em', marginBottom:6 }}>⊕ EXTERNAL REPO PROJECTS · {EXTERNAL_PROJECTS.length}</div>
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }} className="nx-scroll">
          {EXTERNAL_PROJECTS.map(p => (
            <div key={p.id} style={{ flexShrink:0, width:200, padding:'10px 12px', border:`1px solid ${p.color}44`, background:`${p.color}09` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span className="hud-label" style={{ fontSize:7, color:p.color, border:`1px solid ${p.color}44`, padding:'1px 5px' }}>{p.tag}</span>
                <span className="font-mono" style={{ fontSize:7, color:'rgba(255,255,255,0.22)' }}>{p.id}</span>
              </div>
              <div className="hud-label" style={{ fontSize:9.5, color:p.color, letterSpacing:'0.1em' }}>{p.name}</div>
              <div className="font-mono" style={{ fontSize:7.5, color:'rgba(255,255,255,0.3)', marginTop:3, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.desc}</div>
              <div className="font-mono" style={{ fontSize:7, color:`${p.color}55`, marginTop:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>📁 {p.path}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, flex: 1, minHeight: 0 }}>

        {/* ── ADD APP ─────────────────────────────────────────── */}
        <HoloPanel label="ADD APP · CONNECT" code="ADD-Δ" status="live" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {(['url','exe','folder','cmd'] as AppEntry['kind'][]).map(k => (
              <Chip key={k} active={form.kind === k} onClick={() => setForm(f => ({ ...f, kind: k }))}>{KIND_LABEL[k]}</Chip>
            ))}
          </div>

          <label className="hud-label" style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.28em' }}>NAME</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="My Trading Bot"
            className="font-mono"
            style={{ marginTop: 4, marginBottom: 10, padding: '8px 10px', fontSize: 11, color: 'var(--fg)', background: 'oklch(0.07 0.014 240 / 0.7)', border: `1px solid ${CYAN}55`, outline: 'none' }} />

          <label className="hud-label" style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.28em' }}>
            {form.kind === 'url' ? 'URL' : form.kind === 'cmd' ? 'COMMAND' : 'PATH'}
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input value={form.path} onChange={e => setForm(f => ({ ...f, path: e.target.value }))}
              placeholder={
                form.kind === 'url' ? 'https://…' :
                form.kind === 'exe' ? 'C:\\Program Files\\…\\app.exe' :
                form.kind === 'folder' ? 'C:\\Projects\\…' :
                'pwsh -Command "Start-Process …"'
              }
              className="font-mono"
              style={{ flex: 1, padding: '8px 10px', fontSize: 11, color: 'var(--fg)', background: 'oklch(0.07 0.014 240 / 0.7)', border: `1px solid ${CYAN}55`, outline: 'none' }} />
            {(form.kind === 'exe' || form.kind === 'folder') && (
              <button onClick={() => pickPath(form.kind as 'exe'|'folder')} className="hud-label"
                style={{ padding: '0 12px', fontSize: 9, color: CYAN_BRIGHT, border: `1px solid ${CYAN}80`, letterSpacing: '0.28em', background: 'oklch(0.78 0.13 215 / 0.10)' }}>📂 PICK</button>
            )}
          </div>

          <label className="hud-label" style={{ marginTop: 10, fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.28em' }}>TAG (optional)</label>
          <input value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
            placeholder="trading · content · dev · ai · workspace"
            className="font-mono"
            style={{ marginTop: 4, padding: '8px 10px', fontSize: 11, color: 'var(--fg)', background: 'oklch(0.07 0.014 240 / 0.7)', border: `1px solid ${CYAN}55`, outline: 'none' }} />

          <button onClick={() => add(form)} disabled={!form.name.trim() || !form.path.trim()} className="hud-label"
            style={{
              marginTop: 12, padding: '10px', fontSize: 10.5, letterSpacing: '0.32em',
              color: CYAN_BRIGHT, border: `1px solid ${CYAN}`, background: 'oklch(0.78 0.13 215 / 0.14)',
              opacity: (!form.name.trim() || !form.path.trim()) ? 0.4 : 1,
              boxShadow: `0 0 12px ${CYAN}55`,
            }}>
            ◆ REGISTER APP
          </button>

          <div style={{ marginTop: 16 }}>
            <div className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.32em' }}>◆ QUICK PICKS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxHeight: 160, overflowY: 'auto' }} className="nx-scroll">
              {SUGGESTED.map(s => (
                <button key={s.path} onClick={() => add(s)} className="hud-label"
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontSize: 9.5, color: 'var(--fg)', border: '1px solid var(--line-soft)', background: 'oklch(0.10 0.018 240 / 0.35)', textAlign: 'left' }}>
                  <span>{s.name}</span>
                  <span style={{ color: AMBER, fontSize: 9 }}>+ ADD</span>
                </button>
              ))}
            </div>
          </div>
        </HoloPanel>

        {/* ── REGISTERED ──────────────────────────────────────── */}
        <HoloPanel label="REGISTERED · LAUNCHPAD" code="REG-Σ" status="live" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }} bodyClassName="nx-scroll">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {tags.map(t => <Chip key={t} active={filter === t} onClick={() => setFilter(t)}>{t}</Chip>)}
          </div>

          {filtered.length === 0 && (
            <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--cyan-dim)', lineHeight: 1.5, padding: '12px 0' }}>
              No apps yet. Register one on the left, or use a quick-pick.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(a => {
              const c = KIND_COLOR[a.kind];
              return (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, padding: '8px 10px', border: '1px solid var(--line-soft)', background: 'oklch(0.10 0.018 240 / 0.35)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: c, boxShadow: `0 0 6px ${c}` }} />
                      <span className="hud-label" style={{ fontSize: 10.5, color: CYAN_BRIGHT, letterSpacing: '0.18em' }}>{a.name}</span>
                      {a.tag && <span className="font-mono" style={{ fontSize: 8.5, color: AMBER, padding: '1px 5px', border: `1px solid ${AMBER}66` }}>{a.tag}</span>}
                    </div>
                    <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      [{KIND_LABEL[a.kind]}] {a.path}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button onClick={() => launch(a)} className="hud-label"
                      style={{ padding: '6px 10px', fontSize: 9, color: CYAN_BRIGHT, border: `1px solid ${CYAN}`, background: 'oklch(0.78 0.13 215 / 0.14)', letterSpacing: '0.24em' }}>
                      ▶ LAUNCH
                    </button>
                    <button onClick={() => remove(a.id)} className="hud-label"
                      style={{ padding: '6px 8px', fontSize: 9, color: ROSE, border: `1px solid ${ROSE}66`, background: 'transparent', letterSpacing: '0.24em' }}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </HoloPanel>

        {/* ── DISCOVER ───────────────────────────────────────── */}
        <HoloPanel label="DISCOVER · SCAN PC" code="SCN-Δ" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }} bodyClassName="nx-scroll">
          <button onClick={doScan} disabled={busyScan} className="hud-label"
            style={{ padding: '10px', fontSize: 10.5, letterSpacing: '0.32em',
              color: busyScan ? 'var(--cyan-dim)' : CYAN_BRIGHT,
              border: `1px solid ${CYAN}`, background: 'oklch(0.78 0.13 215 / 0.10)',
              cursor: busyScan ? 'wait' : 'pointer' }}>
            {busyScan ? '◌ SCANNING…' : '◆ SCAN PROGRAM FILES'}
          </button>

          <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginTop: 8, lineHeight: 1.4 }}>
            Scans Program Files + Local Programs, surfaces the first .exe in each subfolder.
          </div>

          {scan.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {scan.map(s => (
                <div key={s.path} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, padding: '5px 8px', border: '1px solid var(--line-soft)', background: 'oklch(0.10 0.018 240 / 0.35)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="hud-label" style={{ fontSize: 10, color: 'var(--fg)' }}>{s.name}</div>
                    <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.path}</div>
                  </div>
                  <button onClick={() => add({ name: s.name, path: s.path, kind: 'exe', tag: 'discovered' })} className="hud-label"
                    style={{ padding: '4px 10px', fontSize: 9, color: AMBER, border: `1px solid ${AMBER}80`, background: 'transparent', letterSpacing: '0.24em' }}>
                    + ADD
                  </button>
                </div>
              ))}
            </div>
          )}
        </HoloPanel>
      </div>
    </div>
  );
}
