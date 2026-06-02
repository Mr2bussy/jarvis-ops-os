import { useEffect, useRef, useState } from 'react';
import { DraggableTabs, DraggableGrid, type DragTab } from '../components/draggable';
import { HoloPanel, Sparkline, ProgressArc, Stat } from '../components/primitives';
import { ScreenHeader } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, VIOLET, ROSE } from '../theme';
import { useSystemMetrics, useRollingHistory } from '../lib/system';

function fmtBytes(gb: number) {
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`;
  return `${gb.toFixed(1)} GB`;
}
function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

type SysTab = 'MONITOR' | 'TOOLS' | 'PROCESSES' | 'NETWORK' | 'BACKUP';

/* ── Tool catalog ─────────────────────────────────────────────────────────── */
interface Tool {
  id: string; icon: string; label: string; desc: string;
  category: 'MEMORY'|'OPTIMIZER'|'SEARCH'|'SYSTEM'|'NETWORK'|'SECURITY';
  action: 'builtin'|'open';
}
const TOOL_CATALOG: Tool[] = [
  { id:'mem-reduce',      icon:'◎', label:'Memory Reducer',      desc:'Flush standby list & GC collect to free RAM',         category:'MEMORY',    action:'builtin' },
  { id:'clear-temp',      icon:'◉', label:'Temp File Cleaner',   desc:'Delete all files in %TEMP% — frees disk space',       category:'OPTIMIZER', action:'builtin' },
  { id:'file-search',     icon:'◈', label:'Everything Search',   desc:'Fast file/folder search across all drives',           category:'SEARCH',    action:'builtin' },
  { id:'net-scan',        icon:'◆', label:'Port Scanner',        desc:'List all listening ports on this machine',             category:'NETWORK',   action:'builtin' },
  { id:'task-manager',    icon:'▣', label:'Task Manager',        desc:'Windows Task Manager — processes & performance',      category:'SYSTEM',    action:'open'    },
  { id:'resource-monitor',icon:'▤', label:'Resource Monitor',    desc:'CPU, Memory, Disk, Network drill-down',               category:'SYSTEM',    action:'open'    },
  { id:'event-viewer',    icon:'▦', label:'Event Viewer',        desc:'Windows Event Log — system & application events',     category:'SYSTEM',    action:'open'    },
  { id:'disk-cleanup',    icon:'◌', label:'Disk Cleanup',        desc:'Windows built-in disk cleanup wizard',                category:'OPTIMIZER', action:'open'    },
  { id:'device-manager',  icon:'⬡', label:'Device Manager',      desc:'Manage hardware drivers & devices',                   category:'SYSTEM',    action:'open'    },
  { id:'services',        icon:'◇', label:'Services Manager',    desc:'Start / stop / configure Windows services',          category:'SYSTEM',    action:'open'    },
  { id:'task-scheduler',  icon:'◫', label:'Task Scheduler',      desc:'Create and manage scheduled tasks',                   category:'SYSTEM',    action:'open'    },
  { id:'system-info',     icon:'◎', label:'System Info',         desc:'Full hardware & software information report',        category:'SYSTEM',    action:'open'    },
  { id:'env-vars',        icon:'◬', label:'Env Variables',       desc:'Edit user & system environment variables',           category:'SYSTEM',    action:'open'    },
  { id:'windows-update',  icon:'↑', label:'Windows Update',      desc:'Check for & install OS updates',                     category:'OPTIMIZER', action:'open'    },
  { id:'startup-apps',    icon:'▶', label:'Startup Manager',     desc:'Enable / disable apps at startup (ms-settings)',     category:'OPTIMIZER', action:'open'    },
  { id:'storage-sense',   icon:'◫', label:'Storage Sense',       desc:'Automatic disk space management settings',           category:'OPTIMIZER', action:'open'    },
  { id:'network-adapter', icon:'⬡', label:'Network Adapters',    desc:'View & configure network interface cards',           category:'NETWORK',   action:'open'    },
  { id:'firewall',        icon:'◈', label:'Firewall Settings',   desc:'Windows Defender Firewall configuration panel',      category:'SECURITY',  action:'open'    },
];

const CAT_COLOR: Record<Tool['category'], string> = {
  MEMORY:    CYAN_BRIGHT,
  OPTIMIZER: JADE,
  SEARCH:    AMBER,
  SYSTEM:    VIOLET,
  NETWORK:   '#4fc3f7',
  SECURITY:  ROSE,
};

/* ── TOOLS Tab ──────────────────────────────────────────────────────────────── */
function ToolsTab() {
  const [busy, setBusy]         = useState<string|null>(null);
  const [log, setLog]           = useState<string[]>([]);
  const [searchQ, setSearchQ]   = useState('');
  const [searchRes, setSearchRes] = useState<string[]|null>(null);

  const append = (msg: string) => setLog(p => [...p.slice(-49), msg]);

  async function runTool(tool: Tool) {
    if (busy) return;
    setBusy(tool.id);
    append(`[${new Date().toLocaleTimeString()}] ${tool.label} — starting…`);
    try {
      if (tool.action === 'open') {
        const r = await (window as any).jarvisBridge.systemTools.openTool(tool.id);
        append(r.ok ? `✓ ${tool.label} launched` : `✗ ${r.err}`);
      } else if (tool.id === 'mem-reduce') {
        const r = await (window as any).jarvisBridge.systemTools.memReduce();
        append(r.ok ? `✓ Memory reduce complete` : `✗ ${r.err}`);
      } else if (tool.id === 'clear-temp') {
        const r = await (window as any).jarvisBridge.systemTools.clearTemp();
        append(r.ok ? `✓ ${r.freed}` : `✗ ${r.err}`);
      } else if (tool.id === 'net-scan') {
        const r = await (window as any).jarvisBridge.systemTools.netScan();
        if (r.ok) {
          r.data.forEach((l: string) => append(`  ${l}`));
          append(`✓ Port scan complete — ${r.data.length} listening ports`);
        } else { append(`✗ ${r.err}`); }
      }
    } catch (e: any) { append(`✗ Error: ${e?.message||String(e)}`); }
    setBusy(null);
  }

  async function doSearch() {
    if (!searchQ.trim()) return;
    setBusy('file-search');
    append(`[${new Date().toLocaleTimeString()}] File search: "${searchQ}"…`);
    try {
      const r = await (window as any).jarvisBridge.systemTools.fileSearch(searchQ);
      if (r.ok) { setSearchRes(r.results); append(`✓ Found ${r.results.length} results`); }
      else { append(`✗ ${r.err}`); }
    } catch (e: any) { append(`✗ ${e?.message||String(e)}`); }
    setBusy(null);
  }

  const cats = ['ALL', 'MEMORY', 'OPTIMIZER', 'SEARCH', 'SYSTEM', 'NETWORK', 'SECURITY'] as const;
  const [filter, setFilter] = useState<typeof cats[number]>('ALL');
  const shown = filter === 'ALL' ? TOOL_CATALOG : TOOL_CATALOG.filter(t => t.category === filter);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:12, flex:1, minHeight:0 }}>
      {/* Left: Tool grid */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {/* Category filter */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} className="hud-label"
              style={{ padding:'3px 9px', fontSize:7.5, cursor:'pointer', letterSpacing:'0.16em',
                border:`1px solid ${filter===c ? (c==='ALL' ? CYAN : CAT_COLOR[c as Tool['category']]) : 'rgba(255,255,255,0.1)'}`,
                color: filter===c ? (c==='ALL' ? CYAN : CAT_COLOR[c as Tool['category']]) : 'rgba(255,255,255,0.3)',
                background: filter===c ? `${(c==='ALL' ? CYAN : CAT_COLOR[c as Tool['category']])}12` : 'transparent' }}>
              {c}
            </button>
          ))}
        </div>

        {/* Tool cards */}
        <DraggableGrid
          storageKey="jarvis.grid.systemtools"
          items={shown}
          columns={3}
          gap={8}
          renderItem={tool => {
            const cc = CAT_COLOR[tool.category];
            const isRunning = busy === tool.id;
            return (
              <button onClick={() => runTool(tool)} disabled={!!busy}
                style={{ width:'100%', padding:'12px 14px', border:`1px solid ${cc}33`, background:isRunning ? `${cc}18` : `${cc}08`,
                  cursor: busy ? 'wait' : 'pointer', textAlign:'left', display:'flex', flexDirection:'column', gap:6,
                  transition:'all 0.15s', opacity: busy && !isRunning ? 0.5 : 1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:18, color:cc, lineHeight:1 }}>{tool.icon}</span>
                  <span className="hud-label" style={{ fontSize:6.5, color:cc, border:`1px solid ${cc}40`, padding:'1px 3px', letterSpacing:'0.12em' }}>{tool.category}</span>
                </div>
                <div className="hud-label" style={{ fontSize:9.5, color:cc, letterSpacing:'0.14em' }}>{isRunning ? '◌ Running…' : tool.label}</div>
                <div className="font-mono" style={{ fontSize:8, color:'rgba(255,255,255,0.4)', lineHeight:1.4 }}>{tool.desc}</div>
              </button>
            );
          }}
        />

        {/* Everything file search */}
        <HoloPanel label="◈ EVERYTHING FILE SEARCH" code="FS-Δ">
          <div style={{ display:'flex', gap:6 }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key==='Enter' && doSearch()}
              placeholder="filename pattern…"
              style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${AMBER}44`, color:'rgba(255,255,255,0.8)',
                fontFamily:'var(--font-mono)', fontSize:11, padding:'6px 10px', outline:'none' }} />
            <button onClick={doSearch} disabled={!!busy} className="hud-label"
              style={{ padding:'6px 16px', fontSize:8, color:AMBER, border:`1px solid ${AMBER}`, cursor:'pointer', background:`${AMBER}12`, letterSpacing:'0.2em' }}>
              {busy==='file-search' ? '◌ …' : '▶ SEARCH'}
            </button>
          </div>
          {searchRes && (
            <div style={{ marginTop:8, maxHeight:100, overflowY:'auto' }} className="nx-scroll">
              {searchRes.length === 0 ? (
                <div className="font-mono" style={{ fontSize:9, color:'rgba(255,255,255,0.3)' }}>No results found.</div>
              ) : searchRes.map((r,i) => (
                <div key={i} className="font-mono" style={{ fontSize:8.5, color:JADE, padding:'1px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{r}</div>
              ))}
            </div>
          )}
        </HoloPanel>
      </div>

      {/* Right: Activity log */}
      <HoloPanel label="◎ ACTIVITY LOG" code="LOG-Δ" style={{ display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }} className="nx-scroll">
          {log.length === 0 && (
            <div className="font-mono" style={{ fontSize:9, color:'rgba(255,255,255,0.2)', textAlign:'center', paddingTop:20 }}>
              Click any tool to begin
            </div>
          )}
          {log.map((line, i) => (
            <div key={i} className="font-mono" style={{ fontSize:8.5, color: line.startsWith('✓') ? JADE : line.startsWith('✗') ? ROSE : line.startsWith('  ') ? CYAN_BRIGHT : 'rgba(255,255,255,0.55)', lineHeight:1.5 }}>
              {line}
            </div>
          ))}
        </div>
        {log.length > 0 && (
          <button onClick={() => setLog([])} className="hud-label"
            style={{ marginTop:8, padding:'4px', fontSize:7.5, color:'rgba(255,255,255,0.3)', border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer', background:'transparent', letterSpacing:'0.18em' }}>
            CLEAR LOG
          </button>
        )}
      </HoloPanel>
    </div>
  );
}

/* ── PROCESSES Tab ─────────────────────────────────────────────────────────── */
function ProcessesTab() {
  const [procs, setProcs] = useState<{name:string;pid:number;cpu:number;mem_mb:number}[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function refresh() {
    setLoading(true); setErr('');
    try {
      const r = await (window as any).jarvisBridge.systemTools.getProcs();
      if (r.ok) setProcs(r.data as any[]); else setErr(r.err || 'Failed');
    } catch (e: any) { setErr(String(e?.message||e)); }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  return (
    <HoloPanel label="◎ TOP PROCESSES · BY CPU" code="PROC-Δ" status={loading ? 'warn' : 'live'}
      style={{ display:'flex', flexDirection:'column', flex:1 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span className="font-mono" style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{procs.length} processes</span>
        <button onClick={refresh} disabled={loading} className="hud-label"
          style={{ padding:'3px 10px', fontSize:7.5, color:CYAN, border:`1px solid ${CYAN}40`, cursor:'pointer', background:'transparent', letterSpacing:'0.16em' }}>
          {loading ? '◌ LOADING…' : '↺ REFRESH'}
        </button>
      </div>
      {err && <div className="font-mono" style={{ fontSize:9, color:ROSE, marginBottom:8 }}>✗ {err}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 80px 90px', gap:0 }}>
        {['PROCESS', 'PID', 'CPU%', 'MEM MB'].map(h => (
          <div key={h} className="hud-label" style={{ fontSize:7.5, color:'rgba(255,255,255,0.3)', padding:'4px 6px', borderBottom:'1px solid rgba(255,255,255,0.1)', letterSpacing:'0.18em' }}>{h}</div>
        ))}
        {procs.map((p, i) => {
          const cpuC = p.cpu > 20 ? ROSE : p.cpu > 5 ? AMBER : JADE;
          const memC = p.mem_mb > 500 ? ROSE : p.mem_mb > 100 ? AMBER : 'rgba(255,255,255,0.6)';
          return [
            <div key={`n${i}`} className="font-mono" style={{ fontSize:9, color:'rgba(255,255,255,0.8)', padding:'3px 6px', borderBottom:'1px solid rgba(255,255,255,0.04)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>,
            <div key={`p${i}`} className="font-mono" style={{ fontSize:8.5, color:'rgba(255,255,255,0.35)', padding:'3px 6px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{p.pid}</div>,
            <div key={`c${i}`} className="font-mono" style={{ fontSize:9, color:cpuC, padding:'3px 6px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{p.cpu.toFixed(1)}</div>,
            <div key={`m${i}`} className="font-mono" style={{ fontSize:9, color:memC, padding:'3px 6px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{p.mem_mb}</div>,
          ];
        })}
      </div>
    </HoloPanel>
  );
}

/* ── NETWORK Tab ─────────────────────────────────────────────────────────────── */
function NetworkTab({ sys }: { sys: any }) {
  const [ports, setPorts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function scanPorts() {
    setLoading(true);
    try {
      const r = await (window as any).jarvisBridge.systemTools.netScan();
      if (r.ok) setPorts(r.data);
    } catch {}
    setLoading(false);
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, flex:1, minHeight:0 }}>
      <HoloPanel label="◎ NETWORK INTERFACES" code="NET-Δ" status="live">
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <Stat label="INTERFACES" value={String(sys?.net_ifaces ?? '—')} />
          <Stat label="HOSTNAME"   value={sys?.host ?? '—'} />
          <Stat label="PLATFORM"   value={`${sys?.platform ?? '—'} · ${sys?.arch ?? '—'}`} />
          {sys && [
            ['IPv4 (Est.)',   '192.168.x.x'],
            ['DNS',          'auto-detect'],
            ['Gateway',      'auto-detect'],
            ['Firewall',     'Windows Defender'],
          ].map(([l,v]) => <Stat key={l} label={l} value={v} />)}
        </div>
        <button onClick={() => (window as any).jarvisBridge.systemTools.openTool('network-adapter')} className="hud-label"
          style={{ marginTop:12, padding:'6px', fontSize:8, color:CYAN, border:`1px solid ${CYAN}40`, cursor:'pointer', background:'transparent', letterSpacing:'0.2em', width:'100%' }}>
          ⬡ OPEN NETWORK ADAPTERS
        </button>
      </HoloPanel>

      <HoloPanel label="◆ LISTENING PORTS" code="PRT-Δ">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span className="font-mono" style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{ports.length} ports</span>
          <button onClick={scanPorts} disabled={loading} className="hud-label"
            style={{ padding:'3px 10px', fontSize:7.5, color:JADE, border:`1px solid ${JADE}40`, cursor:'pointer', background:'transparent', letterSpacing:'0.16em' }}>
            {loading ? '◌ SCANNING…' : '▶ SCAN NOW'}
          </button>
        </div>
        <div style={{ maxHeight:240, overflowY:'auto' }} className="nx-scroll">
          {ports.length === 0 ? (
            <div className="font-mono" style={{ fontSize:9, color:'rgba(255,255,255,0.2)', textAlign:'center', paddingTop:16 }}>Click SCAN NOW to check listening ports</div>
          ) : ports.map((p,i) => (
            <div key={i} className="font-mono" style={{ fontSize:8.5, color:CYAN_BRIGHT, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{p}</div>
          ))}
        </div>
        <button onClick={() => (window as any).jarvisBridge.systemTools.openTool('firewall')} className="hud-label"
          style={{ marginTop:10, padding:'6px', fontSize:8, color:ROSE, border:`1px solid ${ROSE}40`, cursor:'pointer', background:'transparent', letterSpacing:'0.2em', width:'100%' }}>
          ◈ OPEN FIREWALL SETTINGS
        </button>
      </HoloPanel>
    </div>
  );
}

/* ── MONITOR Tab (original view) ─────────────────────────────────────────────── */
function MonitorTab({ sys, cpuHist, memHist }: { sys: any; cpuHist: number[]; memHist: number[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12, flex: 1, minHeight: 0 }}>
      <HoloPanel label="CPU · LIVE" code="CPU-Σ" status="live" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Stat label="UTIL"   value={`${Math.round(sys.cpu_util * 100)}%`} />
          <Stat label="CORES"  value={String(sys.cpu_count)} />
          <Stat label="SPEED"  value={`${(sys.cpu_speed_mhz / 1000).toFixed(2)} GHz`} />
          <Stat label="LOAD"   value={sys.load_avg.map((n: number) => n.toFixed(2)).join(' ')} />
        </div>
        <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sys.cpu_model}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
          {Array.from({ length: sys.cpu_count }).map((_, i) => {
            const v = sys.cpu_per_core?.[i] ?? sys.cpu_util;
            return (
              <div key={i} style={{ position: 'relative', height: 36, background: `oklch(0.78 0.13 215 / ${0.18 + v * 0.65})`, border: '1px solid var(--line-soft)' }}>
                <span className="font-mono" style={{ position: 'absolute', top: 2, left: 3, fontSize: 7.5, color: CYAN_BRIGHT }}>{String(i + 1).padStart(2, '0')}</span>
                <div style={{ position: 'absolute', bottom: 2, left: 3, right: 3, height: 3, background: CYAN_BRIGHT, opacity: 0.7, transform: `scaleX(${v})`, transformOrigin: 'left' }} />
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
          <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', marginBottom: 6 }}>UTIL · {cpuHist.length}s ROLLING</div>
          <Sparkline data={cpuHist.length ? cpuHist : [0]} height={56} color={CYAN} />
        </div>
      </HoloPanel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <HoloPanel label="MEMORY" code="MEM-Δ">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ProgressArc value={sys.mem_pct} sub="USED" size={94} label={`${Math.round(sys.mem_pct * 100)}%`} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Stat label="USED"  value={fmtBytes(sys.mem_used_gb)} />
              <Stat label="TOTAL" value={fmtBytes(sys.mem_total_gb)} />
              <Stat label="FREE"  value={fmtBytes(sys.mem_total_gb - sys.mem_used_gb)} />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Sparkline data={memHist.length ? memHist : [0]} height={36} color={JADE} />
          </div>
        </HoloPanel>

        <HoloPanel label="STORAGE · DRIVES" code="DSK-Δ" style={{ flex: 1, minHeight: 0 }} bodyClassName="nx-scroll">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Stat label="USED"  value={fmtBytes(sys.disk_used_gb)} />
            <Stat label="TOTAL" value={fmtBytes(sys.disk_total_gb)} />
            <Stat label="PCT"   value={`${Math.round(sys.disk_pct * 100)}%`} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sys.disk_drives.map((d: any) => (
              <div key={d.caption}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span className="hud-label" style={{ fontSize: 9.5, color: CYAN_BRIGHT, letterSpacing: '0.28em' }}>{d.caption}</span>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)' }}>{fmtBytes(d.used_gb)} / {fmtBytes(d.total_gb)}</span>
                </div>
                <div style={{ height: 5, background: 'oklch(0.78 0.13 215 / 0.10)' }}>
                  <div style={{ height: '100%', width: `${(d.used_gb / d.total_gb) * 100}%`, background: d.used_gb / d.total_gb > 0.85 ? AMBER : CYAN, boxShadow: `0 0 6px ${CYAN}` }} />
                </div>
              </div>
            ))}
          </div>
        </HoloPanel>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <HoloPanel label="HOST" code="HST-Δ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Stat label="HOSTNAME" value={sys.host} />
            <Stat label="USER"     value={sys.user} />
            <Stat label="OS"       value={`${sys.platform} · ${sys.release}`} />
            <Stat label="ARCH"     value={sys.arch} />
            <Stat label="HOME"     value={sys.home} />
            <Stat label="UPTIME"   value={fmtUptime(sys.uptime)} />
            <Stat label="NET IF"   value={String(sys.net_ifaces)} />
          </div>
        </HoloPanel>

        <HoloPanel label="THROUGHPUT · ROLLING" code="THP-Δ" style={{ flex: 1, minHeight: 0 }}>
          <Sparkline data={cpuHist.length ? cpuHist.map(v => 50 + v * 50) : [50]} height={120} color={VIOLET} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <Stat label="TS"     value={new Date(sys.ts).toLocaleTimeString()} />
            <Stat label="WINDOW" value={`${cpuHist.length}s`} />
            <Stat label="POLL"   value="1.5s" />
          </div>
        </HoloPanel>
      </div>
    </div>
  );
}

/* ── Backup/Restore Tab ─────────────────────────────────────────────────────── */
function BackupTab() {
  const [status, setStatus] = useState('');
  const [err, setErr]       = useState('');

  function getBackupData() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('jarvis'));
    const data: Record<string, string> = {};
    for (const k of keys) data[k] = localStorage.getItem(k) ?? '';
    return { version: 1, exportedAt: new Date().toISOString(), data };
  }

  function exportBackup() {
    try {
      const blob = new Blob([JSON.stringify(getBackupData(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `jarvis-backup-${new Date().toISOString().slice(0,10)}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Backup exported successfully.'); setErr('');
    } catch (e: any) { setErr(String(e?.message || e)); }
    setTimeout(() => setStatus(''), 4000);
  }

  function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed.data || typeof parsed.data !== 'object') { setErr('Invalid backup file.'); return; }
        let count = 0;
        for (const [k, v] of Object.entries(parsed.data as Record<string, string>)) {
          if (k.startsWith('jarvis')) { localStorage.setItem(k, v); count++; }
        }
        setStatus(`Restored ${count} keys. Reload the app to see changes.`); setErr('');
        setTimeout(() => setStatus(''), 6000);
      } catch (e: any) { setErr(String(e?.message || e)); }
    };
    input.click();
  }

  const lsKeys = Object.keys(localStorage).filter(k => k.startsWith('jarvis'));
  const lsSize = lsKeys.reduce((s, k) => s + (localStorage.getItem(k)?.length ?? 0), 0);

  return (
    <HoloPanel label="BACKUP & RESTORE · JARVIS DATA" code="BCK" status="live" style={{ flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, padding: '12px 16px', border: '1px solid rgba(255,180,0,0.2)', background: 'rgba(255,180,0,0.04)' }}>
            <div className="hud-label" style={{ fontSize: 8, color: AMBER, letterSpacing: '0.2em', marginBottom: 4 }}>LOCAL STORAGE</div>
            <div className="font-mono" style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>{lsKeys.length} keys</div>
            <div className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{(lsSize / 1024).toFixed(1)} KB stored</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={exportBackup} className="hud-label"
            style={{ padding: '10px 20px', fontSize: 9.5, cursor: 'pointer', letterSpacing: '0.22em',
              color: JADE, border: `1px solid ${JADE}`, background: `${JADE}12` }}>
            ⬇ EXPORT BACKUP
          </button>
          <button onClick={importBackup} className="hud-label"
            style={{ padding: '10px 20px', fontSize: 9.5, cursor: 'pointer', letterSpacing: '0.22em',
              color: AMBER, border: `1px solid ${AMBER}`, background: `${AMBER}12` }}>
            ⬆ IMPORT BACKUP
          </button>
        </div>
        {status && <div className="font-mono" style={{ fontSize: 10, color: JADE }}>{status}</div>}
        {err    && <div className="font-mono" style={{ fontSize: 10, color: ROSE }}>{err}</div>}
        <div style={{ marginTop: 8 }}>
          <div className="hud-label" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: 8 }}>STORED KEYS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' }} className="nx-scroll">
            {lsKeys.map(k => (
              <div key={k} style={{ display: 'flex', gap: 10, padding: '3px 0', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
                <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', flex: 1 }}>{k}</span>
                <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{((localStorage.getItem(k)?.length ?? 0) / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </HoloPanel>
  );
}

/* ── Main SystemScreen ──────────────────────────────────────────────────────── */
export default function SystemScreen() {
  const sys = useSystemMetrics(1500);
  const cpuHist = useRollingHistory(sys?.cpu_util ?? null, 80);
  const memHist = useRollingHistory(sys?.mem_pct ?? null, 80);
  const [tab, setTab] = useState<SysTab>('MONITOR');

  if (!sys) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="font-mono anim-pulse-soft" style={{ fontSize: 12, color: CYAN_BRIGHT }}>// connecting to system bridge…</div>
      </div>
    );
  }

  const SYS_DEFAULT_TABS: DragTab[] = [
    { id:'MONITOR',   label:'◎ MONITOR',   color: CYAN,      pinned: true },
    { id:'TOOLS',     label:'⚙ TOOLS',     color: JADE },
    { id:'PROCESSES', label:'▣ PROCESSES', color: AMBER },
    { id:'NETWORK',   label:'⬡ NETWORK',   color: '#4fc3f7' },
    { id:'BACKUP',    label:'⬇ BACKUP',    color: AMBER },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <ScreenHeader
        tag="SYSTEM"
        title={`${sys.host.toUpperCase()} · LIVE`}
        subtitle={`${sys.platform} ${sys.arch} · ${sys.release} · ${sys.cpu_count} cores · user ${sys.user}`}
        right={
          <div style={{ display: 'flex', gap: 12 }}>
            <Stat label="UPTIME" value={fmtUptime(sys.uptime)} />
            <Stat label="CPU" value={`${Math.round(sys.cpu_util * 100)}%`} />
            <Stat label="RAM" value={`${Math.round(sys.mem_pct * 100)}%`} />
          </div>
        }
      />

      <DraggableTabs
        storageKey="jarvis.tabs.system"
        defaultTabs={SYS_DEFAULT_TABS}
        active={tab}
        onActivate={id => setTab(id as SysTab)}
      />

      {tab === 'MONITOR'   && <MonitorTab   sys={sys} cpuHist={cpuHist} memHist={memHist} />}
      {tab === 'TOOLS'     && <ToolsTab />}
      {tab === 'PROCESSES' && <ProcessesTab />}
      {tab === 'NETWORK'   && <NetworkTab sys={sys} />}
      {tab === 'BACKUP'    && <BackupTab />}
    </div>
  );
}
