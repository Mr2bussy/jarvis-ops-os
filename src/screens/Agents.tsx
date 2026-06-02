import { useState, useEffect, useRef } from 'react';
import { ScreenHeader, Chip } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, VIOLET, JADE, ROSE, colorFor } from '../theme';
import { AGENTS as AGENTS_FALLBACK, AGENT_CATEGORIES, AGENTS_BY_CAT as AGENTS_BY_CAT_FALLBACK, AGENT_COUNT } from '../data/agents-catalog';
import type { AgentCategory, AgentEntry } from '../data/agents-catalog';
import { SKILLS, INSTRUCTIONS, PROMPTS, RESOURCE_TOTAL } from '../data/resources-catalog';
import type { Resource } from '../data/resources-catalog';
import { GAMECHANGERS, ANTIGRAVITY_CATEGORIES, ANTIGRAVITY_TOTAL_SKILLS, GAMECHANGERS_TOTAL, GAMECHANGERS_COUNT, AWESOME_AI_APP_CATEGORIES, AWESOME_AI_APPS_TOTAL, PLUGINS, PLUGINS_COUNT } from '../data/collections-catalog';

const CAT_ORDER: AgentCategory[] = ['META','CONTENT','TRADING','INFRA','SECURITY','FRONTEND','BACKEND','DATA','CLOUD','DEBUG','SPECIALIST'];

const AGENT_LASTUSED_KEY = 'jarvis.agent-lastused';
function getAgentLastUsed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(AGENT_LASTUSED_KEY) ?? '{}'); } catch { return {}; }
}
export function markAgentUsed(id: string) {
  const m = getAgentLastUsed();
  m[id] = Date.now();
  try { localStorage.setItem(AGENT_LASTUSED_KEY, JSON.stringify(m)); } catch {}
}
function assignStatus(id: string): AgentEntry['status'] {
  const lu = getAgentLastUsed()[id];
  if (!lu) return 'standby';
  const age = Date.now() - lu;
  if (age < 24 * 60 * 60 * 1000) return 'online';   // used within last 24h
  if (age < 7 * 24 * 60 * 60 * 1000) return 'busy';  // used within last 7 days
  return 'standby';
}

function useRealAgents() {
  const [agents, setAgents] = useState<AgentEntry[]>(AGENTS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'loading'|'live'|'fallback'>('loading');

  useEffect(() => {
    function run() {
      window.jarvisBridge.scanAgents().then(raw => {
        if (!raw || raw.length === 0) { setSource('fallback'); setLoading(false); return; }
        const mapped: AgentEntry[] = raw.map((r, i) => ({
          id: r.id,
          name: r.name,
          desc: r.desc || 'Agent loaded from local filesystem.',
          model: r.tools.length > 0 ? r.tools.slice(0,3).join(' · ') : 'multi-model',
          cat: (AGENT_CATEGORIES[r.cat as AgentCategory] ? r.cat as AgentCategory : 'SPECIALIST'),
          status: assignStatus(r.id),
        }));
        setAgents(mapped);
        setSource('live');
        setLoading(false);
      }).catch(() => { setSource('fallback'); setLoading(false); });
    }
    run();
    const iv = setInterval(run, 30_000);
    return () => clearInterval(iv);
  }, []);

  const bycat = agents.reduce((acc, a) => {
    if (!acc[a.cat]) acc[a.cat] = [];
    acc[a.cat].push(a);
    return acc;
  }, {} as Record<AgentCategory, AgentEntry[]>);

  return { agents, agentCount: agents.length, agentsBycat: bycat, loading, source };
}

function statusColor(s: AgentEntry['status']) {
  if (s === 'online') return JADE;
  if (s === 'busy')   return AMBER;
  return 'var(--cyan-dim)';
}
function statusDot(s: AgentEntry['status']) {
  return <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background: statusColor(s), boxShadow: s !== 'standby' ? `0 0 6px ${statusColor(s)}` : 'none', flexShrink:0 }} />;
}
function catColor(cat: AgentCategory) {
  return colorFor(AGENT_CATEGORIES[cat].color);
}

// Live activity feed ticker — polls real activity ring buffer
function ActivityFeed() {
  const [lines, setLines] = useState<{ts:number; who:string; action:string; target:string}[]>([]);
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const data = await window.jarvisBridge.recentActivity();
        if (alive) setLines(data.slice(0, 20));
      } catch { /* bridge not ready */ }
    }
    poll();
    const iv = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [lines]);

  return (
    <div ref={feedRef} className="nx-scroll" style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:3, padding:'6px 0' }}>
      {lines.length === 0 && (
        <span className="font-mono" style={{ fontSize:9.5, color:'var(--cyan-dim)', opacity:0.5 }}>// no activity yet — run a workflow or ask JARVIS something</span>
      )}
      {lines.map((l, i) => (
        <div key={i} className="anim-fade-in" style={{ display:'flex', gap:6, alignItems:'baseline', fontSize:9.5, lineHeight:1.35 }}>
          <span className="font-mono" style={{ color:'var(--cyan-dim)', flexShrink:0 }}>{new Date(l.ts).toTimeString().slice(0,8)}</span>
          <span className="font-mono" style={{ color: CYAN_BRIGHT, flexShrink:0, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.who}</span>
          <span className="hud-label" style={{ color: AMBER, fontSize:8, letterSpacing:'0.18em', flexShrink:0 }}>{l.action}</span>
          <span className="font-mono" style={{ color:'var(--fg)', opacity:0.7, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.target}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Agents ───────────────────────────────────────────────────────────────
const BOOST_AGENTS_PATH = 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\agents';

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function AgentsTab() {
  const { agents: AGENTS, agentCount: AGENT_COUNT, agentsBycat: AGENTS_BY_CAT, loading, source } = useRealAgents();
  const [cat, setCat] = useState<'ALL' | AgentCategory>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AgentEntry | null>(null);

  // CREATE / EDIT / IMPORT states
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', cat: 'SPECIALIST' as AgentCategory, model: 'Claude Sonnet 4.5', desc: '', content: '' });
  const [createSaving, setCreateSaving] = useState(false);
  const [editContent, setEditContent] = useState<string | null>(null);
  const [editSaving, setEditSaving]   = useState(false);
  const [agentToast, setAgentToast]   = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  // Run agent state (A3)
  const [runPanel, setRunPanel]           = useState(false);
  const [missionInput, setMissionInput]   = useState('');
  const [missionOutput, setMissionOutput] = useState('');
  const [missionBusy, setMissionBusy]     = useState(false);

  function toast(msg: string) { setAgentToast(msg); setTimeout(() => setAgentToast(''), 3000); }

  async function createAgent() {
    if (!createForm.name.trim()) { toast('⚠ Name required'); return; }
    setCreateSaving(true);
    const slug = slugify(createForm.name);
    const fp = `${BOOST_AGENTS_PATH}\\${slug}.agent.md`;
    const body = `---\nname: ${createForm.name}\ndescription: ${createForm.desc}\ncategory: ${createForm.cat}\nmodel: ${createForm.model}\ntype: agent\n---\n\n${createForm.content || `# ${createForm.name}\n\n${createForm.desc || 'Agent instructions here.'}\n`}`;
    try {
      const r = await window.jarvisBridge.writeFile({ filePath: fp, content: body });
      if (r.ok) { toast(`◉ Created: ${slug}.agent.md`); setCreating(false); setCreateForm({ name: '', cat: 'SPECIALIST', model: 'Claude Sonnet 4.5', desc: '', content: '' }); }
      else toast(`⚠ ${r.err}`);
    } catch (e: any) { toast(`IPC: ${String(e?.message || e)}`); }
    setCreateSaving(false);
  }

  async function loadEdit(a: AgentEntry) {
    const fp = `${BOOST_AGENTS_PATH}\\${slugify(a.name)}.agent.md`;
    try {
      const r = await window.jarvisBridge.readFileContent(fp);
      if (r.ok) setEditContent(r.content);
      else toast(`⚠ Read error: ${r.err}`);
    } catch (e: any) { toast(`IPC: ${String(e?.message || e)}`); }
  }

  async function saveEdit(a: AgentEntry) {
    if (editContent === null) return;
    setEditSaving(true);
    const fp = `${BOOST_AGENTS_PATH}\\${slugify(a.name)}.agent.md`;
    try {
      const r = await window.jarvisBridge.writeFile({ filePath: fp, content: editContent });
      if (r.ok) { toast(`◉ Saved: ${a.name}`); setEditContent(null); }
      else toast(`⚠ ${r.err}`);
    } catch (e: any) { toast(`IPC: ${String(e?.message || e)}`); }
    setEditSaving(false);
  }

  function exportAgent(a: AgentEntry) {
    if (editContent !== null) {
      const blob = new Blob([editContent], { type: 'text/markdown' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${slugify(a.name)}.agent.md`; link.click(); URL.revokeObjectURL(url);
    } else {
      const md = `---\nname: ${a.name}\ndescription: ${a.desc}\ncategory: ${a.cat}\nmodel: ${a.model}\n---\n\n# ${a.name}\n\n${a.desc}\n`;
      const blob = new Blob([md], { type: 'text/markdown' });
      const url  = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${slugify(a.name)}.agent.md`; link.click(); URL.revokeObjectURL(url);
    }
    toast(`↓ Exported ${a.name}`);
  }

  function exportAll() {
    const json = JSON.stringify(AGENTS, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'jarvis-agents.json'; link.click(); URL.revokeObjectURL(url);
    toast(`↓ Exported ${AGENTS.length} agents`);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const fp = `${BOOST_AGENTS_PATH}\\${file.name}`;
    try {
      const r = await window.jarvisBridge.writeFile({ filePath: fp, content: text });
      if (r.ok) toast(`◉ Imported: ${file.name}`);
      else toast(`⚠ Import error: ${r.err}`);
    } catch (ex: any) { toast(`IPC: ${String(ex?.message || ex)}`); }
    e.target.value = '';
  }

  async function runAgent(a: AgentEntry) {
    if (!missionInput.trim()) { toast('⚠ Enter a mission first'); return; }
    setMissionBusy(true); setMissionOutput('');
    try {
      let system = `You are ${a.name}. ${a.desc}\nCategory: ${a.cat} | Model: ${a.model}`;
      const fp = `${BOOST_AGENTS_PATH}\\${slugify(a.name)}.agent.md`;
      try {
        const r = await window.jarvisBridge.readFileContent(fp);
        if (r.ok && r.content) system = r.content;
      } catch {}
      markAgentUsed(a.id);
      const result = await window.jarvisBridge.complete({
        messages: [{ role: 'user', content: missionInput }],
        system, maxTokens: 2000,
      });
      setMissionOutput(typeof result === 'string' ? result : String(result));
      toast(`◉ ${a.name} mission complete`);
    } catch (e: any) { setMissionOutput(`ERROR: ${String(e?.message || e)}`); }
    setMissionBusy(false);
  }

  const filtered = AGENTS.filter(a => {
    const matchCat = cat === 'ALL' || a.cat === cat;
    const q = search.toLowerCase();
    const matchQ = !q || a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q) || a.cat.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  const onlineCount = AGENTS.filter(a => a.status === 'online').length;
  const busyCount   = AGENTS.filter(a => a.status === 'busy').length;
  const inputStyle  = { background:'oklch(0.06 0.014 240 / 0.7)', border:'1px solid var(--line)', color:'var(--fg)', padding:'6px 10px', fontSize:10, outline:'none', width:'100%', letterSpacing:'0.04em', fontFamily:'var(--font-mono)' } as const;

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', gap:8 }}>
      {/* hidden import input */}
      <input ref={importRef} type="file" accept=".md,.agent.md" style={{ display:'none' }} onChange={handleImport} />

      {/* header + search + action buttons */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, flexWrap:'wrap' }}>
        <div className="font-mono" style={{ fontSize:9.5, color:'var(--cyan-dim)', letterSpacing:'0.12em' }}>
          {AGENT_COUNT} AGENTS · <span style={{ color: JADE }}>{onlineCount} ONLINE</span> · <span style={{ color: AMBER }}>{busyCount} BUSY</span>
          {source === 'live' && <span style={{ color: JADE, marginLeft:8 }}>◆ LIVE FILESYSTEM</span>}
          {source === 'fallback' && <span style={{ color: AMBER, marginLeft:8 }}>◇ CATALOG FALLBACK</span>}
          {source === 'loading' && <span style={{ color:'var(--cyan-dim)', marginLeft:8 }}>⟳ SCANNING…</span>}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {agentToast && <span className="font-mono" style={{ fontSize:8.5, color: JADE }}>{agentToast}</span>}
          <button onClick={() => setCreating(true)} className="hud-label" style={{ padding:'5px 12px', fontSize:8.5, letterSpacing:'0.18em', cursor:'pointer', color: JADE, border:`1px solid ${JADE}55`, background:`${JADE}10` }}>+ CREATE</button>
          <button onClick={() => importRef.current?.click()} className="hud-label" style={{ padding:'5px 12px', fontSize:8.5, letterSpacing:'0.18em', cursor:'pointer', color: CYAN, border:`1px solid ${CYAN}55`, background:`${CYAN}10` }}>↑ IMPORT</button>
          <button onClick={exportAll} className="hud-label" style={{ padding:'5px 12px', fontSize:8.5, letterSpacing:'0.18em', cursor:'pointer', color: AMBER, border:`1px solid ${AMBER}55`, background:`${AMBER}10` }}>↓ EXPORT ALL</button>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH AGENTS…"
            className="font-mono" style={{ background:'oklch(0.06 0.014 240 / 0.7)', border:'1px solid var(--line)', color:'var(--fg)', padding:'5px 10px', fontSize:10, outline:'none', minWidth:180, letterSpacing:'0.06em' }} />
        </div>
      </div>

      {/* CREATE modal */}
      {creating && (
        <div style={{ position:'fixed', inset:0, background:'oklch(0.04 0.012 240 / 0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
          onClick={() => setCreating(false)}>
          <div style={{ width:520, background:'oklch(0.07 0.014 240)', border:`1px solid ${JADE}`, padding:22, display:'flex', flexDirection:'column', gap:12 }}
            onClick={e2 => e2.stopPropagation()}>
            <div className="hud-label" style={{ fontSize:12, color: JADE, letterSpacing:'0.22em' }}>◉ CREATE NEW AGENT</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', marginBottom:4 }}>NAME</div>
                <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Agent Name" style={inputStyle} />
              </div>
              <div>
                <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', marginBottom:4 }}>CATEGORY</div>
                <select value={createForm.cat} onChange={e => setCreateForm(f => ({ ...f, cat: e.target.value as AgentCategory }))} style={{ ...inputStyle, cursor:'pointer' }}>
                  {Object.keys(AGENT_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', marginBottom:4 }}>MODEL</div>
                <input value={createForm.model} onChange={e => setCreateForm(f => ({ ...f, model: e.target.value }))} placeholder="Claude Sonnet 4.5" style={inputStyle} />
              </div>
              <div>
                <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', marginBottom:4 }}>DESCRIPTION</div>
                <input value={createForm.desc} onChange={e => setCreateForm(f => ({ ...f, desc: e.target.value }))} placeholder="Short description" style={inputStyle} />
              </div>
            </div>
            <div>
              <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', marginBottom:4 }}>CONTENT (MARKDOWN)</div>
              <textarea value={createForm.content} onChange={e => setCreateForm(f => ({ ...f, content: e.target.value }))} placeholder="# Agent instructions&#10;&#10;Write your agent's system prompt here..."
                style={{ ...inputStyle, height:180, resize:'vertical', lineHeight:1.5 }} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setCreating(false)} className="hud-label" style={{ padding:'7px 20px', fontSize:8.5, cursor:'pointer', color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', background:'transparent', letterSpacing:'0.14em' }}>CANCEL</button>
              <button onClick={createAgent} disabled={createSaving} className="hud-label" style={{ padding:'7px 20px', fontSize:8.5, cursor:'pointer', color: JADE, border:`1px solid ${JADE}`, background:`${JADE}18`, letterSpacing:'0.14em', opacity: createSaving ? 0.5 : 1 }}>
                {createSaving ? '◌ SAVING…' : '◉ CREATE AGENT'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* category chips */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        <Chip active={cat === 'ALL'} onClick={() => setCat('ALL')}>ALL · {AGENT_COUNT}</Chip>
        {CAT_ORDER.map(c => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)} color={catColor(c)}>
            {AGENT_CATEGORIES[c].icon} {c} · {(AGENTS_BY_CAT[c] || []).length}
          </Chip>
        ))}
      </div>
      {/* main grid + sidebar */}
      <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'1fr 260px', gap:10 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(230px, 1fr))', gap:8, overflow:'auto', alignContent:'start' }} className="nx-scroll">
          {filtered.map((a, i) => {
            const cc = catColor(a.cat);
            const isSel = selected?.id === a.id;
            return (
              <div key={a.id} className="holo holo-brackets anim-fade-up" onClick={() => setSelected(isSel ? null : a)}
                style={{ padding:12, cursor:'pointer', animationDelay:`${i*15}ms`, border: isSel ? `1px solid ${cc}` : undefined, background: isSel ? `oklch(0.08 0.015 240 / 0.9)` : undefined }}>
                <span className="br-bl" /><span className="br-br" />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                  <span className="font-mono" style={{ fontSize:8.5, color: cc, letterSpacing:'0.18em' }}>{a.id}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    {statusDot(a.status)}
                    <span className="font-mono" style={{ fontSize:8, color: statusColor(a.status), letterSpacing:'0.12em', textTransform:'uppercase' }}>{a.status}</span>
                  </div>
                </div>
                <div className="hud-label" style={{ fontSize:10.5, color: CYAN_BRIGHT, lineHeight:1.25, marginBottom:5 }}>{a.name}</div>
                <div className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{a.desc}</div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, alignItems:'center' }}>
                  <span className="hud-label" style={{ fontSize:7.5, color: cc, border:`1px solid ${cc}55`, padding:'1px 5px', letterSpacing:'0.18em' }}>
                    {AGENT_CATEGORIES[a.cat].icon} {a.cat}
                  </span>
                  <span className="font-mono" style={{ fontSize:8, color:'var(--cyan-dim)' }}>{a.model.replace('GPT-','').replace('Claude ','Cl.')}</span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="font-mono" style={{ color:'var(--cyan-dim)', fontSize:10.5, padding:24, gridColumn:'1/-1' }}>
              NO AGENTS MATCH "{search.toUpperCase()}"
            </div>
          )}
        </div>
        {/* sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
          <div className="holo" style={{ padding:14, flexShrink:0 }}>
            {selected ? (
              <>
                <div className="hud-label" style={{ fontSize:8.5, color: catColor(selected.cat), letterSpacing:'0.32em', marginBottom:6 }}>
                  {AGENT_CATEGORIES[selected.cat].icon} {selected.id} · {selected.cat}
                </div>
                <div className="font-display" style={{ fontSize:13, color: CYAN_BRIGHT, lineHeight:1.2, marginBottom:8 }}>{selected.name}</div>
                <div className="font-mono" style={{ fontSize:9.5, color:'var(--fg)', lineHeight:1.5, marginBottom:10 }}>{selected.desc}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div><div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)' }}>MODEL</div>
                    <div className="font-mono" style={{ fontSize:9.5, color: CYAN_BRIGHT, marginTop:2 }}>{selected.model}</div></div>
                  <div><div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)' }}>STATUS</div>
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
                      {statusDot(selected.status)}
                      <span className="font-mono" style={{ fontSize:9.5, color: statusColor(selected.status), textTransform:'uppercase' }}>{selected.status}</span>
                    </div></div>
                </div>
                <button onClick={() => setSelected(null)} className="hud-label" style={{ marginTop:10, width:'100%', padding:'5px', fontSize:8, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', letterSpacing:'0.22em', background:'transparent', cursor:'pointer' }}>CLOSE</button>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginTop:6 }}>
                  <button onClick={() => { setRunPanel(r => !r); setMissionOutput(''); }} className="hud-label"
                    style={{ padding:'5px', fontSize:8, cursor:'pointer', color: JADE, border:`1px solid ${JADE}55`, background: runPanel ? `${JADE}20` : `${JADE}10`, letterSpacing:'0.18em' }}>
                    ► RUN
                  </button>
                  <button onClick={() => editContent === null ? loadEdit(selected) : setEditContent(null)} className="hud-label"
                    style={{ padding:'5px', fontSize:8, cursor:'pointer', color: AMBER, border:`1px solid ${AMBER}55`, background:`${AMBER}10`, letterSpacing:'0.18em' }}>
                    {editContent !== null ? '✕ CANCEL' : '✎ EDIT'}
                  </button>
                  <button onClick={() => exportAgent(selected)} className="hud-label"
                    style={{ padding:'5px', fontSize:8, cursor:'pointer', color: VIOLET, border:`1px solid ${VIOLET}55`, background:`${VIOLET}10`, letterSpacing:'0.18em' }}>
                    ↓ EXPORT
                  </button>
                </div>
                {runPanel && editContent === null && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                    <div className="hud-label" style={{ fontSize:7.5, color: JADE, letterSpacing:'0.28em' }}>► MISSION INPUT</div>
                    <textarea value={missionInput} onChange={e => setMissionInput(e.target.value)}
                      placeholder="Describe the mission for this agent..."
                      style={{ width:'100%', height:80, padding:'7px 8px', fontSize:8.5, lineHeight:1.5, color:'var(--fg)', background:'oklch(0.05 0.012 240)', border:`1px solid ${JADE}55`, outline:'none', resize:'vertical', fontFamily:'var(--font-mono)', boxSizing:'border-box' }} />
                    <button onClick={() => runAgent(selected)} disabled={missionBusy} className="hud-label"
                      style={{ padding:'6px', fontSize:8, cursor:'pointer', color: JADE, border:`1px solid ${JADE}`, background:`${JADE}18`, letterSpacing:'0.18em', opacity: missionBusy ? 0.5 : 1 }}>
                      {missionBusy ? '◌ RUNNING…' : '► EXECUTE MISSION'}
                    </button>
                    {missionOutput && (
                      <div style={{ marginTop:4, padding:'8px', background:'oklch(0.04 0.01 240)', border:`1px solid ${JADE}33`, maxHeight:180, overflowY:'auto' }}>
                        <div className="font-mono" style={{ fontSize:8.5, color:'var(--fg)', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{missionOutput}</div>
                      </div>
                    )}
                  </div>
                )}
                {editContent !== null && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      style={{ width:'100%', height:200, padding:'7px 8px', fontSize:8.5, lineHeight:1.5, color:'var(--fg)', background:'oklch(0.05 0.012 240)', border:`1px solid ${AMBER}55`, outline:'none', resize:'vertical', fontFamily:'var(--font-mono)', boxSizing:'border-box' }} />
                    <button onClick={() => saveEdit(selected)} disabled={editSaving} className="hud-label"
                      style={{ padding:'6px', fontSize:8, cursor:'pointer', color: JADE, border:`1px solid ${JADE}`, background:`${JADE}18`, letterSpacing:'0.18em', opacity: editSaving ? 0.5 : 1 }}>
                      {editSaving ? '◌ SAVING…' : '◉ SAVE'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="hud-label" style={{ fontSize:8.5, color: AMBER, letterSpacing:'0.32em', marginBottom:8 }}>◆ CATALOG STATS</div>
                {CAT_ORDER.map(c => {
                  const count = (AGENTS_BY_CAT[c] || []).length;
                  const pct = count / AGENT_COUNT;
                  return (
                    <div key={c} style={{ marginBottom:5 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span className="font-mono" style={{ fontSize:8.5, color: catColor(c) }}>{AGENT_CATEGORIES[c].icon} {c}</span>
                        <span className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)' }}>{count}</span>
                      </div>
                      <div style={{ height:3, background:'oklch(0.78 0.13 215 / 0.08)' }}>
                        <div style={{ height:'100%', width:`${pct*100}%`, background: catColor(c), opacity:0.7 }} />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <div className="holo" style={{ flex:1, minHeight:0, padding:10, display:'flex', flexDirection:'column' }}>
            <div className="hud-label" style={{ fontSize:8.5, color: VIOLET, letterSpacing:'0.32em', marginBottom:6, flexShrink:0 }}>◈ LIVE DISPATCH</div>
            <ActivityFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Resources (Skills / Prompts / Instructions) ──────────────────────────
const RES_CAT_COLORS: Record<string, string> = {
  'Testing':  '#00e5ff', 'Monitoring': '#c8fb4e', 'Cloud': '#818cf8', 'DevOps': '#fb923c',
  'Security': '#f87171', 'Frontend': '#34d399',  'Backend': '#a78bfa', 'Data': '#fbbf24',
  'Content':  '#38bdf8', 'Tools': '#e879f9',      'AI': '#00e5ff',     'Media': '#f472b6',
  'Hardware': '#94a3b8', 'Planning': '#c8fb4e',   'META': '#00e5ff',
};
function resColor(cat: string) { return RES_CAT_COLORS[cat] ?? CYAN; }

function ResourcesTab({ type }: { type: 'SKILL' | 'PROMPT' | 'INSTRUCTION' }) {
  const source = type === 'SKILL' ? SKILLS : type === 'PROMPT' ? PROMPTS : INSTRUCTIONS;
  const totalCount = type === 'SKILL' ? RESOURCE_TOTAL.skills : type === 'PROMPT' ? RESOURCE_TOTAL.prompts : RESOURCE_TOTAL.instructions;
  const [catFilter, setCatFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Resource | null>(null);

  const cats = Array.from(new Set(source.map(r => r.cat))).sort();
  const catCounts: Record<string, number> = {};
  source.forEach(r => { catCounts[r.cat] = (catCounts[r.cat] || 0) + 1; });

  const filtered = source.filter(r => {
    const mc = catFilter === 'ALL' || r.cat === catFilter;
    const q = search.toLowerCase();
    const mq = !q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q);
    return mc && mq;
  });

  const typeColor = type === 'SKILL' ? JADE : type === 'PROMPT' ? AMBER : VIOLET;
  const inCatalog = source.length;

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', gap:8 }}>
      {/* info bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
        <div className="font-mono" style={{ fontSize:9.5, color:'var(--cyan-dim)', letterSpacing:'0.1em' }}>
          <span style={{ color: typeColor }}>{inCatalog} IN CATALOG</span>
          <span style={{ opacity:0.5 }}> / {totalCount} IN FOLDER · {type}</span>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`SEARCH ${type}S…`}
          className="font-mono" style={{ background:'oklch(0.06 0.014 240 / 0.7)', border:'1px solid var(--line)', color:'var(--fg)', padding:'5px 10px', fontSize:10, outline:'none', minWidth:180, letterSpacing:'0.06em' }} />
      </div>
      {/* category chips */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        <Chip active={catFilter === 'ALL'} onClick={() => setCatFilter('ALL')}>ALL · {inCatalog}</Chip>
        {cats.map(c => (
          <Chip key={c} active={catFilter === c} onClick={() => setCatFilter(c)} color={resColor(c)}>
            {c} · {catCounts[c]}
          </Chip>
        ))}
      </div>
      {/* grid + sidebar */}
      <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'1fr 260px', gap:10 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:8, overflow:'auto', alignContent:'start' }} className="nx-scroll">
          {filtered.map((r, i) => {
            const cc = resColor(r.cat);
            const isSel = selected?.id === r.id;
            return (
              <div key={r.id} className="holo holo-brackets anim-fade-up" onClick={() => setSelected(isSel ? null : r)}
                style={{ padding:11, cursor:'pointer', animationDelay:`${i*12}ms`, border: isSel ? `1px solid ${cc}` : undefined, background: isSel ? `oklch(0.08 0.015 240 / 0.9)` : undefined }}>
                <span className="br-bl" /><span className="br-br" />
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span className="font-mono" style={{ fontSize:8, color: typeColor, letterSpacing:'0.16em' }}>{r.id}</span>
                  <span className="hud-label" style={{ fontSize:7, color: typeColor, border:`1px solid ${typeColor}44`, padding:'1px 4px', letterSpacing:'0.16em' }}>{type}</span>
                </div>
                <div className="hud-label" style={{ fontSize:10.5, color: CYAN_BRIGHT, lineHeight:1.2, marginBottom:5 }}>{r.name}</div>
                <div className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{r.desc}</div>
                <div style={{ marginTop:7 }}>
                  <span className="hud-label" style={{ fontSize:7.5, color: cc, border:`1px solid ${cc}55`, padding:'1px 5px', letterSpacing:'0.15em' }}>{r.cat}</span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="font-mono" style={{ color:'var(--cyan-dim)', fontSize:10.5, padding:24, gridColumn:'1/-1' }}>
              NO {type}S MATCH "{search.toUpperCase()}"
            </div>
          )}
        </div>
        {/* sidebar */}
        <div className="holo" style={{ padding:14, height:'fit-content' }}>
          {selected ? (
            <>
              <div className="hud-label" style={{ fontSize:8.5, color: typeColor, letterSpacing:'0.28em', marginBottom:6 }}>{selected.id} · {selected.cat}</div>
              <div className="font-display" style={{ fontSize:13, color: CYAN_BRIGHT, lineHeight:1.2, marginBottom:8 }}>{selected.name}</div>
              <div className="font-mono" style={{ fontSize:9.5, color:'var(--fg)', lineHeight:1.5, marginBottom:10 }}>{selected.desc}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                <div><div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)' }}>TYPE</div>
                  <div className="font-mono" style={{ fontSize:9.5, color: typeColor, marginTop:2 }}>{selected.type}</div></div>
                <div><div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)' }}>CATEGORY</div>
                  <div className="font-mono" style={{ fontSize:9.5, color: resColor(selected.cat), marginTop:2 }}>{selected.cat}</div></div>
              </div>
              <button onClick={() => setSelected(null)} className="hud-label" style={{ width:'100%', padding:'5px', fontSize:8, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', letterSpacing:'0.22em', background:'transparent', cursor:'pointer' }}>CLOSE</button>
            </>
          ) : (
            <>
              <div className="hud-label" style={{ fontSize:8.5, color: typeColor, letterSpacing:'0.28em', marginBottom:8 }}>◆ {type} CATEGORIES</div>
              {cats.map(c => {
                const count = catCounts[c] ?? 0;
                const pct = count / inCatalog;
                return (
                  <div key={c} style={{ marginBottom:5 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span className="font-mono" style={{ fontSize:8.5, color: resColor(c) }}>{c}</span>
                      <span className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)' }}>{count}</span>
                    </div>
                    <div style={{ height:3, background:'oklch(0.78 0.13 215 / 0.08)' }}>
                      <div style={{ height:'100%', width:`${pct*100}%`, background: resColor(c), opacity:0.7 }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid var(--line-soft)' }}>
                <div className="font-mono" style={{ fontSize:8, color:'var(--cyan-dim)', lineHeight:1.5 }}>
                  <span style={{ color:'var(--fg)' }}>FOLDER TOTAL</span><br />
                  {totalCount} FILES · {inCatalog} CATALOGED
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Universe ─────────────────────────────────────────────────────────────
const GRAND_TOTAL = RESOURCE_TOTAL.total + ANTIGRAVITY_TOTAL_SKILLS + GAMECHANGERS_TOTAL + AWESOME_AI_APPS_TOTAL + PLUGINS_COUNT;

type UniverseView = 'COLLECTIONS' | 'ANTIGRAVITY' | 'AI-APPS' | 'PLUGINS';

function UniverseTab() {
  const [selected, setSelected] = useState<typeof GAMECHANGERS[number] | null>(null);
  const [catView, setCatView] = useState<UniverseView>('COLLECTIONS');

  const totalFiles = GAMECHANGERS.reduce((s, c) => s + c.fileCount, 0);

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', gap:8 }}>
      {/* stats bar */}
      <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
        <div className="font-mono" style={{ fontSize:9.5, color:'var(--cyan-dim)' }}>
          <span style={{ color:'#c8fb4e', fontSize:12 }}>{GRAND_TOTAL.toLocaleString()}</span> TOTAL ASSETS IN VAULT
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <span className="font-mono" style={{ fontSize:9, color: '#c8fb4e' }}>{ANTIGRAVITY_TOTAL_SKILLS.toLocaleString()} ANTIGRAVITY SKILLS</span>
          <span className="font-mono" style={{ fontSize:9, color: '#818cf8' }}>{GAMECHANGERS_COUNT} GC COLLECTIONS</span>
          <span className="font-mono" style={{ fontSize:9, color: '#34d399' }}>{AWESOME_AI_APPS_TOTAL} AI APP PROJECTS</span>
          <span className="font-mono" style={{ fontSize:9, color: '#fb923c' }}>{PLUGINS_COUNT} PLUGINS</span>
        </div>
        <div style={{ flex:1 }} />
        {/* view toggle */}
        <div style={{ display:'flex', gap:2 }}>
          {(['COLLECTIONS','ANTIGRAVITY','AI-APPS','PLUGINS'] as const).map(v => (
            <button key={v} onClick={() => setCatView(v)} className="hud-label"
              style={{ padding:'4px 10px', fontSize:8.5, letterSpacing:'0.2em', cursor:'pointer', background:'transparent', border:'1px solid var(--line-soft)',
                color: catView === v ? '#c8fb4e' : 'var(--cyan-dim)', borderColor: catView === v ? '#c8fb4e' : 'var(--line-soft)' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {catView === 'COLLECTIONS' && (
        <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'1fr 280px', gap:10 }}>
          {/* collection cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:8, overflow:'auto', alignContent:'start' }} className="nx-scroll">
            {GAMECHANGERS.map((c, i) => {
              const isSel = selected?.id === c.id;
              return (
                <div key={c.id} className="holo holo-brackets anim-fade-up" onClick={() => setSelected(isSel ? null : c)}
                  style={{ padding:12, cursor:'pointer', animationDelay:`${i*20}ms`, border: isSel ? `1px solid ${c.color}` : undefined, background: isSel ? `oklch(0.08 0.015 240 / 0.9)` : undefined }}>
                  <span className="br-bl" /><span className="br-br" />
                  {/* top row */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                    <span className="font-mono" style={{ fontSize:8, color: c.color, letterSpacing:'0.18em' }}>{c.id}</span>
                    <span className="hud-label" style={{ fontSize:7, color: c.color, border:`1px solid ${c.color}44`, padding:'1px 5px', letterSpacing:'0.16em' }}>{c.tag}</span>
                  </div>
                  {/* name */}
                  <div className="hud-label" style={{ fontSize:11, color: CYAN_BRIGHT, lineHeight:1.2, marginBottom:5 }}>{c.name}</div>
                  {/* desc */}
                  <div className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{c.desc}</div>
                  {/* file count bar */}
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                      <span className="font-mono" style={{ fontSize:7.5, color:'var(--cyan-dim)' }}>FILES</span>
                      <span className="font-mono" style={{ fontSize:8, color: c.color }}>{c.fileCount.toLocaleString()}</span>
                    </div>
                    <div style={{ height:2, background:'oklch(0.78 0.13 215 / 0.08)' }}>
                      <div style={{ height:'100%', width:`${Math.min((c.fileCount / 8000) * 100, 100)}%`, background: c.color, opacity:0.75 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* sidebar */}
          <div className="holo" style={{ padding:14, height:'fit-content', maxHeight:'100%', overflowY:'auto' }}>
            {selected ? (
              <>
                <div className="hud-label" style={{ fontSize:8.5, color: selected.color, letterSpacing:'0.28em', marginBottom:6 }}>{selected.id} · {selected.tag}</div>
                <div className="font-display" style={{ fontSize:13, color: CYAN_BRIGHT, lineHeight:1.2, marginBottom:8 }}>{selected.name}</div>
                <div className="font-mono" style={{ fontSize:9.5, color:'var(--fg)', lineHeight:1.5, marginBottom:10 }}>{selected.desc}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                  <div><div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)' }}>FILES</div>
                    <div className="font-mono" style={{ fontSize:12, color: selected.color, marginTop:2 }}>{selected.fileCount.toLocaleString()}</div></div>
                  <div><div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)' }}>TAG</div>
                    <div className="font-mono" style={{ fontSize:9.5, color: selected.color, marginTop:2 }}>{selected.tag}</div></div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', marginBottom:4 }}>SLUG</div>
                  <div className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', wordBreak:'break-all' }}>{selected.slug}</div>
                </div>
                <button onClick={() => setSelected(null)} className="hud-label" style={{ width:'100%', padding:'5px', fontSize:8, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', letterSpacing:'0.22em', background:'transparent', cursor:'pointer' }}>CLOSE</button>
              </>
            ) : (
              <>
                <div className="hud-label" style={{ fontSize:8.5, color:'#c8fb4e', letterSpacing:'0.28em', marginBottom:8 }}>◆ GAMECHANGER VAULT</div>
                <div className="font-mono" style={{ fontSize:9, color:'var(--fg)', lineHeight:1.6, marginBottom:10 }}>
                  {GAMECHANGERS_COUNT} sub-collections from the community, organized by type: Claude skills, Copilot agents, prompts, configs, and system frameworks.
                </div>
                {/* mini bar chart */}
                {GAMECHANGERS.slice().sort((a,b) => b.fileCount - a.fileCount).map(c => (
                  <div key={c.id} style={{ marginBottom:4 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:1.5 }}>
                      <span className="font-mono" style={{ fontSize:8, color: c.color, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                      <span className="font-mono" style={{ fontSize:8, color:'var(--cyan-dim)' }}>{c.fileCount.toLocaleString()}</span>
                    </div>
                    <div style={{ height:2, background:'oklch(0.78 0.13 215 / 0.08)' }}>
                      <div style={{ height:'100%', width:`${Math.min((c.fileCount / 8000) * 100, 100)}%`, background: c.color, opacity:0.6 }} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {catView === 'ANTIGRAVITY' && (
        <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'1fr 280px', gap:10 }}>
          {/* category grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:8, overflow:'auto', alignContent:'start' }} className="nx-scroll">
            {ANTIGRAVITY_CATEGORIES.map((cat, i) => (
              <div key={cat.label} className="holo holo-brackets anim-fade-up" style={{ padding:14, animationDelay:`${i*25}ms` }}>
                <span className="br-bl" /><span className="br-br" />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                  <span className="hud-label" style={{ fontSize:10.5, color: cat.color }}>{cat.label}</span>
                  <span className="font-mono" style={{ fontSize:11, color: cat.color }}>{cat.count}</span>
                </div>
                <div style={{ height:3, background:'oklch(0.78 0.13 215 / 0.08)', marginBottom:10 }}>
                  <div style={{ height:'100%', width:`${(cat.count / 225) * 100}%`, background: cat.color, opacity:0.75 }} />
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {cat.examples.map(ex => (
                    <span key={ex} className="font-mono" style={{ fontSize:7.5, color:'var(--cyan-dim)', background:'oklch(0.78 0.13 215 / 0.06)', padding:'1px 5px', borderRadius:2 }}>{ex}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* sidebar: totals */}
          <div className="holo" style={{ padding:14, height:'fit-content' }}>
            <div className="hud-label" style={{ fontSize:8.5, color:'#c8fb4e', letterSpacing:'0.28em', marginBottom:8 }}>⊕ ANTIGRAVITY SKILLS</div>
            <div style={{ marginBottom:10 }}>
              <div className="font-mono" style={{ fontSize:28, color:'#c8fb4e', lineHeight:1 }}>{ANTIGRAVITY_TOTAL_SKILLS.toLocaleString()}</div>
              <div className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)', marginTop:2 }}>SKILL FOLDERS ON DISK</div>
            </div>
            <div className="font-mono" style={{ fontSize:9, color:'var(--fg)', lineHeight:1.6, marginBottom:12 }}>
              The Antigravity Skills collection spans every development domain — from Azure SDK integrations to red-team security, UI/UX, SEO, data engineering, and autonomous agent design.
            </div>
            <div style={{ borderTop:'1px solid var(--line-soft)', paddingTop:10 }}>
              <div className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)', marginBottom:6 }}>DOMAIN BREAKDOWN</div>
              {ANTIGRAVITY_CATEGORIES.map(cat => (
                <div key={cat.label} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span className="font-mono" style={{ fontSize:8.5, color: cat.color }}>{cat.label}</span>
                  <span className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)' }}>{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {catView === 'AI-APPS' && (
        <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'1fr 260px', gap:10 }}>
          {/* app category cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:8, overflow:'auto', alignContent:'start' }} className="nx-scroll">
            {AWESOME_AI_APP_CATEGORIES.map((cat, i) => (
              <div key={cat.id} className="holo holo-brackets anim-fade-up" style={{ padding:14, animationDelay:`${i*30}ms` }}>
                <span className="br-bl" /><span className="br-br" />
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:18 }}>{cat.emoji}</span>
                  <span className="font-mono" style={{ fontSize:20, color: cat.color, fontWeight:700, lineHeight:1 }}>{cat.count}</span>
                </div>
                <div className="hud-label" style={{ fontSize:11, color: cat.color, marginBottom:5 }}>{cat.label}</div>
                <div className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', lineHeight:1.45, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{cat.desc}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {cat.examples.slice(0,4).map(ex => (
                    <span key={ex} className="font-mono" style={{ fontSize:7.5, color: cat.color, background:`${cat.color}18`, padding:'1px 5px', borderRadius:2 }}>{ex}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* sidebar */}
          <div className="holo" style={{ padding:14, height:'fit-content' }}>
            <div className="hud-label" style={{ fontSize:8.5, color:'#34d399', letterSpacing:'0.28em', marginBottom:8 }}>⚡ AWESOME AI APPS</div>
            <div style={{ marginBottom:10 }}>
              <div className="font-mono" style={{ fontSize:28, color:'#34d399', lineHeight:1 }}>{AWESOME_AI_APPS_TOTAL}</div>
              <div className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)', marginTop:2 }}>RUNNABLE AI PROJECTS</div>
            </div>
            <div className="font-mono" style={{ fontSize:9, color:'var(--fg)', lineHeight:1.6, marginBottom:12 }}>
              Real, runnable AI agent implementations covering every major framework — CrewAI, LangGraph, AutoGen, LlamaIndex, Mastra, Pydantic AI, OpenAI SDK, and more.
            </div>
            <div style={{ borderTop:'1px solid var(--line-soft)', paddingTop:10 }}>
              <div className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)', marginBottom:6 }}>BY CATEGORY</div>
              {AWESOME_AI_APP_CATEGORIES.map(cat => (
                <div key={cat.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                  <span className="font-mono" style={{ fontSize:8.5, color: cat.color }}>{cat.emoji} {cat.label}</span>
                  <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {catView === 'PLUGINS' && (
        <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'1fr 260px', gap:10 }}>
          {/* plugin list */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:6, overflow:'auto', alignContent:'start' }} className="nx-scroll">
            {PLUGINS.map((p, i) => (
              <div key={p.slug} className="holo anim-fade-up" style={{ padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', animationDelay:`${i*15}ms` }}>
                <div>
                  <div className="hud-label" style={{ fontSize:9.5, color: p.color, letterSpacing:'0.14em' }}>{p.name}</div>
                  <div className="font-mono" style={{ fontSize:7.5, color:'var(--cyan-dim)', marginTop:2 }}>{p.slug}</div>
                </div>
                <span className="hud-label" style={{ fontSize:7, color: p.color, border:`1px solid ${p.color}44`, padding:'1px 6px', letterSpacing:'0.14em', flexShrink:0, marginLeft:8 }}>{p.tag}</span>
              </div>
            ))}
          </div>

          {/* sidebar */}
          <div className="holo" style={{ padding:14, height:'fit-content' }}>
            <div className="hud-label" style={{ fontSize:8.5, color:'#fb923c', letterSpacing:'0.28em', marginBottom:8 }}>◈ COPILOT PLUGINS</div>
            <div style={{ marginBottom:10 }}>
              <div className="font-mono" style={{ fontSize:28, color:'#fb923c', lineHeight:1 }}>{PLUGINS_COUNT}</div>
              <div className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)', marginTop:2 }}>PLUGIN PACKAGES</div>
            </div>
            <div className="font-mono" style={{ fontSize:9, color:'var(--fg)', lineHeight:1.6, marginBottom:12 }}>
              Official GitHub Copilot plugin packages covering every language, cloud, MCP server, test framework, and specialty workflow. Ready-to-use in VS Code.
            </div>
            {/* tag breakdown */}
            <div style={{ borderTop:'1px solid var(--line-soft)', paddingTop:10 }}>
              <div className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)', marginBottom:6 }}>TAGS</div>
              {Array.from(new Set(PLUGINS.map(p => p.tag))).sort().map(tag => {
                const count = PLUGINS.filter(p => p.tag === tag).length;
                const color = PLUGINS.find(p => p.tag === tag)!.color;
                return (
                  <div key={tag} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span className="font-mono" style={{ fontSize:8.5, color }}>{tag}</span>
                    <span className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mission Creator ───────────────────────────────────────────────────────────
const LS_MISSIONS = 'jarvis.agent.missions';
const MISSION_TYPES = ['RESEARCH', 'BUILD', 'CONTENT', 'ANALYSIS', 'AUTOMATION', 'TRADING'] as const;
type MissionType = typeof MISSION_TYPES[number];
const MISSION_COLS = ['backlog', 'active', 'review', 'done'] as const;
type MissionStatus = typeof MISSION_COLS[number];

const MTYPE_COLOR: Record<MissionType, string> = {
  RESEARCH: CYAN, BUILD: JADE, CONTENT: AMBER, ANALYSIS: '#818cf8', AUTOMATION: '#e879f9', TRADING: '#4ade80',
};
const MTYPE_ICON: Record<MissionType, string> = {
  RESEARCH: '◎', BUILD: '◈', CONTENT: '◇', ANALYSIS: '◉', AUTOMATION: '⬡', TRADING: '◆',
};
const MCOL_COLOR: Record<MissionStatus, string> = {
  backlog: 'var(--cyan-dim)', active: JADE, review: AMBER, done: CYAN,
};
const MCOL_LABEL: Record<MissionStatus, string> = {
  backlog: 'BACKLOG', active: 'ACTIVE', review: 'REVIEW', done: 'DONE',
};

interface MissionStep {
  id: string; label: string; agentName: string; status: 'pending' | 'running' | 'done' | 'error';
}
interface Mission {
  id: string; name: string; objective: string; type: MissionType; priority: 'P0' | 'P1' | 'P2';
  status: MissionStatus; steps: MissionStep[]; agents: string[];
  created: string; updated: string; notes: string;
}
function loadMissions(): Mission[] { try { return JSON.parse(localStorage.getItem(LS_MISSIONS) || '[]'); } catch { return []; } }
function saveMissions(m: Mission[]) { localStorage.setItem(LS_MISSIONS, JSON.stringify(m)); }

function MiniDAG({ steps }: { steps: MissionStep[] }) {
  if (!steps.length) return null;
  const W = 320, H = 38, nodeW = Math.min(80, (W - (steps.length - 1) * 14) / Math.min(steps.length, 4));
  const spacing = steps.length > 1 ? (W - nodeW) / (Math.min(steps.length, 4) - 1) : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {steps.slice(0, 4).map((s, i) => {
        const x = i * spacing;
        const sc = s.status === 'done' ? JADE : s.status === 'running' ? AMBER : s.status === 'error' ? ROSE : 'oklch(0.45 0.05 215)';
        const nx = i < Math.min(steps.length, 4) - 1 ? (i + 1) * spacing : null;
        return (
          <g key={s.id}>
            {nx !== null && <line x1={x + nodeW} y1={H / 2} x2={nx} y2={H / 2} stroke={CYAN} strokeOpacity="0.25" strokeWidth="1.2" strokeDasharray="3,2" />}
            <rect x={x} y={4} width={nodeW} height={H - 8} rx="1" stroke={sc} strokeOpacity="0.7" fill="oklch(0.08 0.012 240 / 0.85)" />
            <text x={x + nodeW / 2} y={H / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={sc} fontSize="7.5" fontFamily="var(--font-mono)">{s.label.slice(0, 10)}</text>
          </g>
        );
      })}
      {steps.length > 4 && <text x={W} y={H / 2 + 1} textAnchor="end" dominantBaseline="middle" fill="var(--cyan-dim)" fontSize="8" fontFamily="var(--font-mono)">+{steps.length - 4}</text>}
    </svg>
  );
}

function MissionCard({ m, selected, onClick }: { m: Mission; selected: boolean; onClick: () => void }) {
  const tc = MTYPE_COLOR[m.type];
  const pc = m.priority === 'P0' ? ROSE : m.priority === 'P1' ? AMBER : JADE;
  return (
    <div onClick={onClick} style={{
      padding: '10px 12px', cursor: 'pointer',
      border: selected ? `1px solid ${tc}` : '1px solid var(--line-soft)',
      background: selected ? `${tc}08` : 'oklch(0.08 0.012 240 / 0.5)',
      display: 'flex', flexDirection: 'column', gap: 6,
      borderLeft: `3px solid ${tc}`, transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="hud-label" style={{ fontSize: 7.5, color: tc, letterSpacing: '0.18em' }}>{MTYPE_ICON[m.type]} {m.type}</span>
        <span className="hud-label" style={{ fontSize: 7.5, color: pc, border: `1px solid ${pc}40`, padding: '1px 5px' }}>{m.priority}</span>
      </div>
      <div className="hud-label" style={{ fontSize: 11, color: selected ? tc : CYAN_BRIGHT, lineHeight: 1.2, letterSpacing: '0.06em' }}>{m.name}</div>
      <div className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.objective || '—'}</div>
      {m.steps.length > 0 && <MiniDAG steps={m.steps} />}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>{m.steps.length} STEPS</span>
        <span className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>·</span>
        <span className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>{m.agents.length} AGENTS</span>
        <div style={{ flex: 1 }} />
        <span className="font-mono" style={{ fontSize: 7.5, color: 'oklch(0.45 0.04 215)' }}>{new Date(m.created).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function MissionsTab() {
  const [missions, setMissions] = useState<Mission[]>(loadMissions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [cForm, setCForm] = useState({
    name: '', type: 'BUILD' as MissionType, priority: 'P1' as 'P0' | 'P1' | 'P2',
    objective: '', notes: '',
    steps: [] as { id: string; label: string; agentName: string }[],
    newStep: '', newAgent: '',
  });

  function createMission() {
    if (!cForm.name.trim()) return;
    const m: Mission = {
      id: `M-${Date.now()}`, name: cForm.name, type: cForm.type, priority: cForm.priority,
      objective: cForm.objective, status: 'backlog',
      steps: cForm.steps.map(s => ({ ...s, status: 'pending' as const })),
      agents: [...new Set(cForm.steps.map(s => s.agentName).filter(Boolean))],
      notes: cForm.notes, created: new Date().toISOString(), updated: new Date().toISOString(),
    };
    const next = [...missions, m];
    setMissions(next); saveMissions(next);
    setCreating(false); setSelectedId(m.id);
    setCForm({ name: '', type: 'BUILD', priority: 'P1', objective: '', notes: '', steps: [], newStep: '', newAgent: '' });
  }

  function moveStatus(id: string, status: MissionStatus) {
    const next = missions.map(m => m.id === id ? { ...m, status, updated: new Date().toISOString() } : m);
    setMissions(next); saveMissions(next);
  }

  function deleteMission(id: string) {
    const next = missions.filter(m => m.id !== id);
    setMissions(next); saveMissions(next); setSelectedId(null);
  }

  function addStep() {
    if (!cForm.newStep.trim()) return;
    setCForm(f => ({ ...f, steps: [...f.steps, { id: `S-${Date.now()}`, label: f.newStep, agentName: f.newAgent }], newStep: '', newAgent: '' }));
  }

  const selected = missions.find(m => m.id === selectedId);
  const inputCss = {
    width: '100%', padding: '7px 10px', fontSize: 10,
    background: 'oklch(0.05 0.01 240 / 0.8)', border: `1px solid ${CYAN}44`,
    color: 'var(--fg)', outline: 'none', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' as const,
  };
  const lbl = { fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4, display: 'block' as const };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 390px', gap: 12 }}>
      {/* ── Board ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {/* stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, flexShrink: 0 }}>
          {MISSION_COLS.map(col => {
            const count = missions.filter(m => m.status === col).length;
            const cc = MCOL_COLOR[col];
            return (
              <div key={col} style={{ padding: '8px 12px', border: `1px solid ${cc}30`, background: `${cc}06` }}>
                <div className="hud-label" style={{ fontSize: 7.5, color: cc, letterSpacing: '0.28em', marginBottom: 3 }}>{MCOL_LABEL[col]}</div>
                <div className="font-mono" style={{ fontSize: 20, color: cc, lineHeight: 1 }}>{count}</div>
              </div>
            );
          })}
        </div>
        {/* kanban */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, overflow: 'auto' }} className="nx-scroll">
          {MISSION_COLS.map(col => {
            const cc = MCOL_COLOR[col];
            const colMissions = missions.filter(m => m.status === col);
            return (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 6px', borderBottom: `1px solid ${cc}40`, flexShrink: 0 }}>
                  <span className="hud-label" style={{ fontSize: 8.5, color: cc, letterSpacing: '0.22em' }}>{MCOL_LABEL[col]}</span>
                  <span className="font-mono" style={{ fontSize: 10, color: cc }}>{colMissions.length}</span>
                </div>
                {colMissions.length === 0 && (
                  <div className="font-mono" style={{ fontSize: 8.5, color: 'oklch(0.4 0.04 215)', padding: '12px 6px', textAlign: 'center' }}>EMPTY</div>
                )}
                {colMissions.map(m => (
                  <MissionCard key={m.id} m={m} selected={selectedId === m.id} onClick={() => { setSelectedId(m.id); setCreating(false); }} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="holo nx-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16, overflow: 'auto', minHeight: 0 }}>
        {creating ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="hud-label" style={{ fontSize: 11, color: JADE, letterSpacing: '0.24em' }}>◈ NEW MISSION</div>
              <button onClick={() => setCreating(false)} className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', padding: '4px 8px', cursor: 'pointer', background: 'transparent' }}>✕</button>
            </div>
            <div>
              <span style={lbl}>MISSION TYPE</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {MISSION_TYPES.map(t => {
                  const tc = MTYPE_COLOR[t];
                  return (
                    <button key={t} onClick={() => setCForm(f => ({ ...f, type: t }))} className="hud-label"
                      style={{ padding: '4px 10px', fontSize: 8, letterSpacing: '0.14em', cursor: 'pointer', color: cForm.type === t ? '#0d1117' : tc, background: cForm.type === t ? tc : 'transparent', border: `1px solid ${tc}60` }}>
                      {MTYPE_ICON[t]} {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span style={lbl}>PRIORITY</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['P0', 'P1', 'P2'] as const).map(p => {
                  const pc = p === 'P0' ? ROSE : p === 'P1' ? AMBER : JADE;
                  return (
                    <button key={p} onClick={() => setCForm(f => ({ ...f, priority: p }))} className="hud-label"
                      style={{ padding: '5px 18px', fontSize: 9, letterSpacing: '0.2em', cursor: 'pointer', color: cForm.priority === p ? '#0d1117' : pc, background: cForm.priority === p ? pc : 'transparent', border: `1px solid ${pc}60` }}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span style={lbl}>MISSION NAME *</span>
              <input value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Build JARVIS Trading Module v3" style={inputCss} />
            </div>
            <div>
              <span style={lbl}>OBJECTIVE / BRIEF</span>
              <textarea value={cForm.objective} onChange={e => setCForm(f => ({ ...f, objective: e.target.value }))} placeholder="What does this mission accomplish? Define success criteria…" rows={3} style={{ ...inputCss, resize: 'vertical' as const, lineHeight: 1.5 }} />
            </div>
            <div>
              <span style={lbl}>PIPELINE STEPS · {cForm.steps.length} ADDED</span>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                <input value={cForm.newStep} onChange={e => setCForm(f => ({ ...f, newStep: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addStep()} placeholder="Step label…" style={{ ...inputCss, flex: 2 }} />
                <input value={cForm.newAgent} onChange={e => setCForm(f => ({ ...f, newAgent: e.target.value }))} placeholder="Agent…" style={{ ...inputCss, flex: 1 }} />
                <button onClick={addStep} className="hud-label" style={{ padding: '4px 10px', fontSize: 9, color: JADE, border: `1px solid ${JADE}60`, cursor: 'pointer', background: 'transparent', flexShrink: 0 }}>+</button>
              </div>
              {cForm.steps.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', marginBottom: 3, background: 'oklch(0.06 0.01 240 / 0.5)', border: '1px solid var(--line-soft)' }}>
                  <span className="font-mono" style={{ fontSize: 8.5, color: VIOLET, width: 18, textAlign: 'center' }}>{i + 1}</span>
                  <span className="font-mono" style={{ fontSize: 9.5, color: 'var(--fg)', flex: 1 }}>{s.label}</span>
                  {s.agentName && <span className="hud-label" style={{ fontSize: 7.5, color: CYAN_BRIGHT, border: `1px solid ${CYAN}30`, padding: '1px 4px' }}>{s.agentName}</span>}
                  <button onClick={() => setCForm(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', color: ROSE, cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
              ))}
              {cForm.steps.length > 0 && <div style={{ marginTop: 8 }}><MiniDAG steps={cForm.steps.map(s => ({ ...s, status: 'pending' as const }))} /></div>}
            </div>
            <div>
              <span style={lbl}>NOTES / CONTEXT</span>
              <textarea value={cForm.notes} onChange={e => setCForm(f => ({ ...f, notes: e.target.value }))} placeholder="Constraints, dependencies, resources, linked missions…" rows={2} style={{ ...inputCss, resize: 'vertical' as const, lineHeight: 1.5 }} />
            </div>
            <button onClick={createMission} disabled={!cForm.name.trim()} className="hud-label"
              style={{ padding: '10px', fontSize: 10, letterSpacing: '0.28em', cursor: !cForm.name.trim() ? 'not-allowed' : 'pointer', color: !cForm.name.trim() ? 'var(--cyan-dim)' : JADE, border: `1px solid ${!cForm.name.trim() ? 'var(--line-soft)' : JADE}`, background: !cForm.name.trim() ? 'transparent' : `${JADE}10` }}>
              ◈ CREATE MISSION
            </button>
          </>
        ) : selected ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="hud-label" style={{ fontSize: 7.5, color: MTYPE_COLOR[selected.type], letterSpacing: '0.26em', marginBottom: 4 }}>{MTYPE_ICON[selected.type]} {selected.type} · {selected.priority}</div>
                <div className="font-display" style={{ fontSize: 15, color: MTYPE_COLOR[selected.type], lineHeight: 1.2 }}>{selected.name}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', padding: '4px 8px', cursor: 'pointer', background: 'transparent' }}>✕</button>
            </div>
            <div>
              <div className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.22em', marginBottom: 6 }}>STATUS PIPELINE</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {MISSION_COLS.map(col => {
                  const cc = MCOL_COLOR[col];
                  const active = selected.status === col;
                  return (
                    <button key={col} onClick={() => moveStatus(selected.id, col)} className="hud-label"
                      style={{ flex: 1, padding: '6px 4px', fontSize: 8, letterSpacing: '0.12em', cursor: 'pointer', color: active ? '#0d1117' : cc, background: active ? cc : 'transparent', border: `1px solid ${cc}60` }}>
                      {active ? '▶ ' : ''}{MCOL_LABEL[col]}
                    </button>
                  );
                })}
              </div>
            </div>
            {selected.objective && (
              <div style={{ padding: '10px 12px', background: `${MTYPE_COLOR[selected.type]}06`, border: `1px solid ${MTYPE_COLOR[selected.type]}20` }}>
                <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', marginBottom: 4 }}>OBJECTIVE</div>
                <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg)', lineHeight: 1.55 }}>{selected.objective}</div>
              </div>
            )}
            {selected.steps.length > 0 && (
              <div>
                <div className="hud-label" style={{ fontSize: 8, color: VIOLET, letterSpacing: '0.22em', marginBottom: 8 }}>◆ PIPELINE · {selected.steps.length} STEPS</div>
                <MiniDAG steps={selected.steps} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
                  {selected.steps.map((s, i) => {
                    const sc = s.status === 'done' ? JADE : s.status === 'running' ? AMBER : s.status === 'error' ? ROSE : 'var(--cyan-dim)';
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'oklch(0.06 0.01 240 / 0.5)', border: `1px solid ${sc}30` }}>
                        <span className="font-mono" style={{ fontSize: 8.5, color: VIOLET, width: 18, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: sc, flexShrink: 0 }} />
                        <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg)', flex: 1 }}>{s.label}</span>
                        {s.agentName && <span className="hud-label" style={{ fontSize: 7.5, color: CYAN_BRIGHT, border: `1px solid ${CYAN}30`, padding: '1px 4px', flexShrink: 0 }}>{s.agentName}</span>}
                        <span className="hud-label" style={{ fontSize: 7, color: sc, flexShrink: 0 }}>{s.status.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {selected.agents.length > 0 && (
              <div>
                <div className="hud-label" style={{ fontSize: 8, color: CYAN_BRIGHT, letterSpacing: '0.22em', marginBottom: 6 }}>ASSIGNED AGENTS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Array.from(new Set(selected.agents)).map(a => (
                    <span key={a} className="hud-label" style={{ fontSize: 8.5, color: VIOLET, border: `1px solid ${VIOLET}40`, padding: '3px 8px', background: `${VIOLET}08` }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
            {selected.notes && (
              <div>
                <div className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)', marginBottom: 4 }}>NOTES</div>
                <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--fg)', lineHeight: 1.55, padding: '8px 10px', background: 'oklch(0.06 0.01 240 / 0.4)', border: '1px dashed var(--line-soft)' }}>{selected.notes}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button onClick={() => { setCreating(true); setSelectedId(null); }} className="hud-label" style={{ flex: 1, padding: '7px', fontSize: 8.5, color: JADE, border: `1px solid ${JADE}50`, cursor: 'pointer', letterSpacing: '0.18em', background: 'transparent' }}>+ NEW</button>
              <button onClick={() => deleteMission(selected.id)} className="hud-label" style={{ flex: 1, padding: '7px', fontSize: 8.5, color: ROSE, border: `1px solid ${ROSE}50`, cursor: 'pointer', letterSpacing: '0.18em', background: 'transparent' }}>✕ DELETE</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20 }}>
            <div style={{ fontSize: 48, color: VIOLET, lineHeight: 1, opacity: 0.6 }}>◈</div>
            <div className="hud-label" style={{ fontSize: 10, color: 'var(--cyan-dim)', letterSpacing: '0.2em', textAlign: 'center', lineHeight: 1.7 }}>
              SELECT A MISSION<br />OR LAUNCH A NEW ONE
            </div>
            <button onClick={() => setCreating(true)} className="hud-label"
              style={{ padding: '10px 32px', fontSize: 10, color: JADE, border: `2px solid ${JADE}`, cursor: 'pointer', letterSpacing: '0.26em', background: `${JADE}10` }}>
              ◈ CREATE MISSION
            </button>
            {missions.length > 0 && (
              <div className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', textAlign: 'center' }}>
                {missions.length} MISSION{missions.length !== 1 ? 'S' : ''} IN BOARD
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
type TabId = 'MISSIONS' | 'AGENTS' | 'SKILLS' | 'PROMPTS' | 'INSTRUCTIONS' | 'UNIVERSE';

export default function AgentsScreen() {
  const [tab, setTab] = useState<TabId>('MISSIONS');
  const missionCount = (() => { try { return (JSON.parse(localStorage.getItem('jarvis.agent.missions') || '[]') as unknown[]).length; } catch { return 0; } })();

  const TABS: { id: TabId; label: string; count: number; color: string }[] = [
    { id:'MISSIONS',     label:'MISSIONS',     count: missionCount,              color: VIOLET },
    { id:'AGENTS',       label:'AGENTS',       count: AGENT_COUNT,               color: CYAN },
    { id:'SKILLS',       label:'SKILLS',       count: RESOURCE_TOTAL.skills,     color: JADE },
    { id:'PROMPTS',      label:'PROMPTS',      count: RESOURCE_TOTAL.prompts,    color: AMBER },
    { id:'INSTRUCTIONS', label:'INSTRUCTIONS', count: RESOURCE_TOTAL.instructions, color: '#818cf8' },
    { id:'UNIVERSE',     label:'UNIVERSE',     count: GAMECHANGERS_TOTAL + ANTIGRAVITY_TOTAL_SKILLS + AWESOME_AI_APPS_TOTAL + PLUGINS_COUNT, color: '#c8fb4e' },
  ];

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', gap:10 }}>
      {/* header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:8 }}>
        <ScreenHeader
          tag="JARVIS AGENT OPS"
          title="MISSION CONTROL"
          subtitle={`Visual mission creator · Agent pipeline builder · ${AGENT_COUNT} agents · ${RESOURCE_TOTAL.skills} skills · ${RESOURCE_TOTAL.prompts} prompts · ${GRAND_TOTAL.toLocaleString()} total assets`}
        />
      </div>

      {/* tab bar */}
      <div style={{ display:'flex', gap:2, borderBottom:'1px solid var(--line-soft)', paddingBottom:0, flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="hud-label"
            style={{
              background: tab === t.id ? `oklch(0.08 0.015 240 / 0.9)` : 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
              color: tab === t.id ? t.color : 'var(--cyan-dim)',
              padding:'7px 16px', fontSize:9.5, letterSpacing:'0.24em', cursor:'pointer',
              transition:'all 0.18s ease',
            }}>
            {t.label} <span style={{ opacity:0.6 }}>·{t.count.toLocaleString()}</span>
          </button>
        ))}
        <div style={{ flex:1 }} />
        <div className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', alignSelf:'center', paddingRight:4, letterSpacing:'0.08em' }}>
          AGENT OPS SYSTEM
        </div>
      </div>

      {/* tab content */}
      {tab === 'MISSIONS'     && <MissionsTab />}
      {tab === 'AGENTS'       && <AgentsTab />}
      {tab === 'SKILLS'       && <ResourcesTab type="SKILL" />}
      {tab === 'PROMPTS'      && <ResourcesTab type="PROMPT" />}
      {tab === 'INSTRUCTIONS' && <ResourcesTab type="INSTRUCTION" />}
      {tab === 'UNIVERSE'     && <UniverseTab />}
    </div>
  );
}

