"""Generates ContentWorkflowsTab TSX content and writes to _cwt_content.txt"""

content = r'''
/* ══════════════════════════════════════════════════════════════════
   CONTENT WORKFLOW MANAGER — data + components
   ══════════════════════════════════════════════════════════════════ */
interface CNode { id: string; x: number; y: number; label: string; team: string; }
type CEdge = [string, string];
interface CWorkflow {
  id: string; name: string; platform: string; trigger: string;
  desc: string; nodes: CNode[]; edges: CEdge[];
}

const LS_CWF = 'jarvis.content.workflows';

function loadCWFs(): CWorkflow[] {
  try { const s = localStorage.getItem(LS_CWF); return s ? JSON.parse(s) : []; } catch { return []; }
}
function saveCWFs(wfs: CWorkflow[]) { localStorage.setItem(LS_CWF, JSON.stringify(wfs)); }

const SEED_CWFS: CWorkflow[] = [
  {
    id:'CWF-YT', name:'YouTube Full Pipeline', platform:'YT',
    trigger:'Video idea approved',
    desc:'End-to-end YouTube: research → script → record → edit → SEO → publish → cross-promote.',
    nodes:[
      {id:'n1',x:60, y:90, label:'Idea Approval',    team:'CNT-YT'},
      {id:'n2',x:270,y:35, label:'Research Brief',   team:'ARC-SCT'},
      {id:'n3',x:270,y:140,label:'Script + Hook',    team:'CNT-YT'},
      {id:'n4',x:490,y:35, label:'Thumbnail Concept',team:'CNT-YT'},
      {id:'n5',x:490,y:140,label:'Record + Edit',    team:'CNT-YT'},
      {id:'n6',x:710,y:90, label:'SEO Optimize',     team:'CNT-HUB'},
      {id:'n7',x:920,y:90, label:'Publish + Promote',team:'CNT-HUB'},
    ],
    edges:[['n1','n2'],['n1','n3'],['n2','n4'],['n3','n5'],['n4','n6'],['n5','n6'],['n6','n7']],
  },
  {
    id:'CWF-X', name:'X / Twitter Thread', platform:'X',
    trigger:'Hook idea locked',
    desc:'Viral X thread: hook → draft 8 tweets → AI review → schedule → monitor + reply loop.',
    nodes:[
      {id:'n1',x:60, y:90, label:'Hook Concept',      team:'CNT-X'},
      {id:'n2',x:270,y:90, label:'Thread Draft (8)',   team:'CNT-X'},
      {id:'n3',x:490,y:35, label:'AI Review',          team:'ARC-OPT'},
      {id:'n4',x:490,y:145,label:'Visual Assets',      team:'CNT-IG'},
      {id:'n5',x:700,y:90, label:'Schedule · Peak Time',team:'CNT-HUB'},
      {id:'n6',x:910,y:90, label:'Monitor + Reply',    team:'CNT-X'},
    ],
    edges:[['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6']],
  },
  {
    id:'CWF-IG', name:'Instagram Reel', platform:'IG',
    trigger:'Reel concept approved',
    desc:'IG reel: concept → 5 hook variants → caption → record → edit → post → stories CTA.',
    nodes:[
      {id:'n1',x:60, y:90, label:'Reel Concept',      team:'CNT-IG'},
      {id:'n2',x:260,y:35, label:'Hook Variants (5)',  team:'CNT-IG'},
      {id:'n3',x:260,y:145,label:'Caption + Hashtags', team:'CNT-HUB'},
      {id:'n4',x:480,y:90, label:'Record + Edit',      team:'CNT-IG'},
      {id:'n5',x:690,y:35, label:'Post + Alt Text',    team:'CNT-IG'},
      {id:'n6',x:690,y:145,label:'Stories CTA',        team:'CNT-IG'},
      {id:'n7',x:900,y:90, label:'Track Engagement',   team:'CNT-HUB'},
    ],
    edges:[['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']],
  },
  {
    id:'CWF-NWS', name:'Newsletter Issue', platform:'NWS',
    trigger:'Weekly · Monday 07:00',
    desc:'Full newsletter: topic curation → research → outline → draft → design → compliance → send → analytics.',
    nodes:[
      {id:'n1',x:55, y:90, label:'Topic Curation',    team:'CNT-NWS'},
      {id:'n2',x:255,y:35, label:'Research Pull',     team:'ARC-SCT'},
      {id:'n3',x:255,y:145,label:'Outline + Structure',team:'CNT-NWS'},
      {id:'n4',x:475,y:90, label:'Draft + Edit',       team:'CNT-NWS'},
      {id:'n5',x:685,y:35, label:'Design + Visuals',   team:'CNT-HUB'},
      {id:'n6',x:685,y:145,label:'Compliance Check',   team:'LGL-LAW'},
      {id:'n7',x:895,y:90, label:'Send + Track Opens', team:'CNT-NWS'},
    ],
    edges:[['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']],
  },
  {
    id:'CWF-TW', name:'Twitch Stream', platform:'TW',
    trigger:'Stream day',
    desc:'Twitch stream: plan → announce → go live → clip highlights → VOD edit → cross-post.',
    nodes:[
      {id:'n1',x:60, y:90, label:'Stream Plan',        team:'CNT-TW'},
      {id:'n2',x:260,y:35, label:'Announce · X + IG',  team:'CNT-HUB'},
      {id:'n3',x:260,y:145,label:'Tech + OBS Prep',    team:'INF-FS'},
      {id:'n4',x:480,y:90, label:'Go Live',             team:'CNT-TW'},
      {id:'n5',x:690,y:35, label:'Clip Highlights',     team:'CNT-TW'},
      {id:'n6',x:690,y:145,label:'VOD Edit',            team:'CNT-TW'},
      {id:'n7',x:900,y:90, label:'Cross-Post + Recap',  team:'CNT-HUB'},
    ],
    edges:[['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']],
  },
  {
    id:'CWF-XPL', name:'Cross-Platform Saturation', platform:'ALL',
    trigger:'Event · YT publish',
    desc:'After each YouTube publish: X thread, IG reel, TW clip, newsletter snippet. Full 24h cross-platform cycle.',
    nodes:[
      {id:'n1',x:60, y:110,label:'Event · YT Publish', team:'CNT-YT'},
      {id:'n2',x:280,y:30, label:'X · Thread Compose', team:'CNT-X'},
      {id:'n3',x:280,y:90, label:'IG · Reel Cut',       team:'CNT-IG'},
      {id:'n4',x:280,y:150,label:'TW · Clip Spotlight', team:'CNT-TW'},
      {id:'n5',x:280,y:210,label:'NWS · Snippet',       team:'CNT-NWS'},
      {id:'n6',x:550,y:120,label:'Schedule Cross-Post', team:'CNT-HUB'},
      {id:'n7',x:780,y:120,label:'Monitor · 24h Window',team:'ARC-OPT'},
    ],
    edges:[['n1','n2'],['n1','n3'],['n1','n4'],['n1','n5'],['n2','n6'],['n3','n6'],['n4','n6'],['n5','n6'],['n6','n7']],
  },
];

const PLT_COLORS: Record<string,string> = {
  YT:'#ff4444', X:'#e2e8f0', IG:'#e879f9', NWS:'oklch(0.78 0.15 75)',
  TW:'oklch(0.62 0.16 290)', ALL:'oklch(0.78 0.13 215)',
};

function pltColor(p: string) { return PLT_COLORS[p] ?? PLT_COLORS.ALL; }

/* ── DAG SVG renderer ─────────────────────────────────────────────── */
function ContentDAG({
  wf, selectedNode, addingEdge, onNodeClick,
}: {
  wf: CWorkflow;
  selectedNode: string | null;
  addingEdge: string | null;
  onNodeClick: (id: string) => void;
}) {
  const NW = 160, NH = 36;
  const xs = wf.nodes.map(n => n.x); const ys = wf.nodes.map(n => n.y);
  const maxX = Math.max(...xs) + NW + 20;
  const maxY = Math.max(...ys) + NH + 20;
  const byId: Record<string, CNode> = Object.fromEntries(wf.nodes.map(n => [n.id, n]));
  const accent = pltColor(wf.platform);

  return (
    <svg
      viewBox={`0 0 ${maxX} ${maxY}`}
      style={{ width:'100%', height: Math.max(200, maxY), display:'block', background:'oklch(0.04 0.01 240 / 0.6)' }}
    >
      {/* edges */}
      {wf.edges.map(([a,b],i) => {
        const A = byId[a], B = byId[b];
        if (!A || !B) return null;
        const ax = A.x + NW, ay = A.y + NH/2;
        const bx = B.x,      by = B.y + NH/2;
        const mx = (ax + bx) / 2;
        return (
          <path key={i}
            d={`M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`}
            stroke={accent} strokeOpacity="0.45" strokeWidth="1.2"
            fill="none" strokeDasharray="5 4"
          />
        );
      })}
      {/* nodes */}
      {wf.nodes.map(n => {
        const isSel  = selectedNode === n.id;
        const isEdge = addingEdge === n.id;
        const bc = isSel ? accent : isEdge ? '#ffb300' : accent;
        const bg = isSel ? `${accent}28` : isEdge ? 'rgba(255,179,0,0.12)' : 'oklch(0.10 0.018 240 / 0.8)';
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}
            style={{ cursor: 'pointer' }}
            onClick={() => onNodeClick(n.id)}
          >
            <rect x="0" y="0" width={NW} height={NH}
              stroke={bc} strokeWidth={isSel ? 1.5 : 1}
              strokeOpacity={isSel ? 1 : 0.6}
              fill={bg}
              rx="0"
            />
            {isSel && <rect x="-1" y="-1" width={NW+2} height={NH+2} stroke={accent} strokeWidth="0.5" fill="none" strokeOpacity="0.4" />}
            <text x="8" y="14" fontSize="8.5" fontFamily="Orbitron,monospace" fill={isSel ? '#fff' : accent} letterSpacing="1.5" opacity={isSel?1:0.9}>{n.label}</text>
            <text x="8" y="28" fontSize="8" fontFamily="JetBrains Mono,monospace" fill="oklch(0.58 0.10 215)">{n.team}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Main ContentWorkflowsTab ─────────────────────────────────────── */
function ContentWorkflowsTab() {
  const [wfs,        setWfs]        = useState<CWorkflow[]>(() => { const s = loadCWFs(); return s.length ? s : SEED_CWFS; });
  const [selId,      setSelId]      = useState<string>(SEED_CWFS[0].id);
  const [platFilter, setPlatFilter] = useState<string>('ALL');
  const [selNode,    setSelNode]    = useState<string|null>(null);
  const [editingWF,  setEditingWF]  = useState(false);
  const [wfDraft,    setWfDraft]    = useState<Partial<CWorkflow>>({});
  const [nodeDraft,  setNodeDraft]  = useState<Partial<CNode>>({});
  const [addEdgeA,   setAddEdgeA]   = useState<string|null>(null);
  const [addNodeOpen,setAddNodeOpen]= useState(false);
  const [newNodeDraft,setNewNodeDraft] = useState({label:'',team:'CNT-HUB'});
  const [addWFOpen,  setAddWFOpen]  = useState(false);
  const [newWFDraft, setNewWFDraft] = useState({name:'',platform:'YT',trigger:'',desc:''});

  const wf = wfs.find(w => w.id === selId) ?? wfs[0];
  const filteredWFs = platFilter === 'ALL' ? wfs : wfs.filter(w => w.platform === platFilter);

  function persist(updated: CWorkflow[]) { setWfs(updated); saveCWFs(updated); }

  function patchWF(id: string, patch: Partial<CWorkflow>) {
    persist(wfs.map(w => w.id === id ? {...w, ...patch} : w));
  }

  /* ── Node interaction ── */
  function handleNodeClick(nid: string) {
    if (addEdgeA !== null) {
      if (addEdgeA !== nid) {
        const edge: CEdge = [addEdgeA, nid];
        const exists = wf.edges.some(([a,b]) => a === edge[0] && b === edge[1]);
        if (!exists) patchWF(wf.id, { edges: [...wf.edges, edge] });
      }
      setAddEdgeA(null);
    } else {
      if (selNode === nid) { setSelNode(null); setNodeDraft({}); }
      else { setSelNode(nid); const n = wf.nodes.find(x=>x.id===nid)!; setNodeDraft({label:n.label,team:n.team}); setEditingWF(false); }
    }
  }

  function saveNode() {
    if (!selNode) return;
    patchWF(wf.id, { nodes: wf.nodes.map(n => n.id===selNode ? {...n,...nodeDraft} : n) });
    setSelNode(null); setNodeDraft({});
  }

  function deleteNode() {
    if (!selNode) return;
    patchWF(wf.id, {
      nodes: wf.nodes.filter(n => n.id !== selNode),
      edges: wf.edges.filter(([a,b]) => a !== selNode && b !== selNode),
    });
    setSelNode(null); setNodeDraft({});
  }

  function deleteEdge(a: string, b: string) {
    patchWF(wf.id, { edges: wf.edges.filter(([ea,eb]) => !(ea===a && eb===b)) });
  }

  function addNode() {
    const id = 'n' + Date.now();
    // place new node in a new row below existing
    const maxY = Math.max(...wf.nodes.map(n=>n.y), 0);
    const newNode: CNode = { id, x: 60, y: maxY + 60, label: newNodeDraft.label || 'New Step', team: newNodeDraft.team || 'CNT-HUB' };
    patchWF(wf.id, { nodes: [...wf.nodes, newNode] });
    setAddNodeOpen(false); setNewNodeDraft({label:'',team:'CNT-HUB'});
  }

  function saveWFMeta() {
    patchWF(wf.id, wfDraft);
    setEditingWF(false); setWfDraft({});
  }

  function addWorkflow() {
    const id = 'CWF-' + Date.now();
    const nw: CWorkflow = {
      id, name: newWFDraft.name || 'New Workflow',
      platform: newWFDraft.platform, trigger: newWFDraft.trigger || 'On-demand',
      desc: newWFDraft.desc || '',
      nodes: [
        {id:'n1', x:60,  y:90, label:'Start', team:'CNT-HUB'},
        {id:'n2', x:280, y:90, label:'Step 2', team:'CNT-HUB'},
        {id:'n3', x:500, y:90, label:'Publish', team:'CNT-HUB'},
      ],
      edges: [['n1','n2'],['n2','n3']],
    };
    const updated = [...wfs, nw];
    persist(updated); setSelId(id);
    setAddWFOpen(false); setNewWFDraft({name:'',platform:'YT',trigger:'',desc:''});
  }

  function deleteWorkflow(id: string) {
    const updated = wfs.filter(w => w.id !== id);
    persist(updated.length ? updated : SEED_CWFS);
    setSelId(updated[0]?.id ?? SEED_CWFS[0].id);
  }

  function resetToSeed() { persist(SEED_CWFS); setSelId(SEED_CWFS[0].id); }

  const inputCss: React.CSSProperties = {
    width:'100%', padding:'5px 8px', fontSize:10.5, background:'oklch(0.05 0.01 240/0.9)',
    border:'1px solid var(--line)', color:'var(--fg)', outline:'none',
    fontFamily:'var(--font-mono)', boxSizing:'border-box',
  };

  const PLATFORMS = ['ALL','YT','X','IG','NWS','TW'];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0, gap:0 }}>

      {/* ── Platform filter bar ──────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 0 8px', flexShrink:0, flexWrap:'wrap' }}>
        {PLATFORMS.map(p => (
          <button key={p} onClick={() => setPlatFilter(p)} className="hud-label"
            style={{ padding:'4px 12px', fontSize:8.5, cursor:'pointer', letterSpacing:'0.18em',
              color: platFilter===p ? '#0d1117' : pltColor(p==='ALL'?'ALL':p),
              background: platFilter===p ? pltColor(p==='ALL'?'ALL':p) : 'transparent',
              border:`1px solid ${pltColor(p==='ALL'?'ALL':p)}60`,
            }}>
            {p}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={() => setAddWFOpen(v=>!v)} className="hud-label"
            style={{ padding:'4px 12px', fontSize:8.5, cursor:'pointer', letterSpacing:'0.18em',
              color: addWFOpen ? '#0d1117' : AMBER, background: addWFOpen ? AMBER : 'transparent',
              border:`1px solid ${AMBER}60` }}>
            + NEW WORKFLOW
          </button>
          <button onClick={resetToSeed} className="hud-label"
            style={{ padding:'4px 10px', fontSize:8, cursor:'pointer', letterSpacing:'0.14em',
              color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', background:'transparent' }}>
            ↺ RESET
          </button>
        </div>
      </div>

      {/* ── Add workflow form ────────────────────────────────────── */}
      {addWFOpen && (
        <div className="anim-fade-in" style={{ padding:'10px 14px', marginBottom:8, border:`1px solid ${AMBER}50`, background:`${AMBER}07`, flexShrink:0 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 1fr 1fr', gap:8, alignItems:'end' }}>
            <div>
              <div className="hud-label" style={{ fontSize:7.5, color:AMBER, letterSpacing:'0.22em', marginBottom:3 }}>WORKFLOW NAME</div>
              <input value={newWFDraft.name} onChange={e=>setNewWFDraft(d=>({...d,name:e.target.value}))} placeholder="e.g. YouTube Shorts" style={inputCss} />
            </div>
            <div>
              <div className="hud-label" style={{ fontSize:7.5, color:AMBER, letterSpacing:'0.22em', marginBottom:3 }}>PLATFORM</div>
              <select value={newWFDraft.platform} onChange={e=>setNewWFDraft(d=>({...d,platform:e.target.value}))}
                style={{...inputCss, height:28}}>
                {['YT','X','IG','NWS','TW','ALL'].map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div className="hud-label" style={{ fontSize:7.5, color:AMBER, letterSpacing:'0.22em', marginBottom:3 }}>TRIGGER</div>
              <input value={newWFDraft.trigger} onChange={e=>setNewWFDraft(d=>({...d,trigger:e.target.value}))} placeholder="e.g. On-demand" style={inputCss} />
            </div>
            <div>
              <div className="hud-label" style={{ fontSize:7.5, color:AMBER, letterSpacing:'0.22em', marginBottom:3 }}>DESCRIPTION</div>
              <input value={newWFDraft.desc} onChange={e=>setNewWFDraft(d=>({...d,desc:e.target.value}))} placeholder="Brief description…" style={inputCss} />
            </div>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <button onClick={addWorkflow} className="hud-label"
              style={{ padding:'5px 16px', fontSize:9, color:JADE, border:`1px solid ${JADE}60`, cursor:'pointer', background:`${JADE}10`, letterSpacing:'0.18em' }}>
              ◆ CREATE
            </button>
            <button onClick={() => setAddWFOpen(false)} className="hud-label"
              style={{ padding:'5px 12px', fontSize:9, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', cursor:'pointer', background:'transparent', letterSpacing:'0.14em' }}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* ── Main layout: list + detail ──────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:10, flex:1, minHeight:0, overflow:'hidden' }}>

        {/* Left: workflow list */}
        <div style={{ display:'flex', flexDirection:'column', gap:4, overflow:'auto', paddingRight:4 }} className="nx-scroll">
          {filteredWFs.length === 0 && (
            <div className="font-mono" style={{ fontSize:10, color:'var(--cyan-dim)', padding:10 }}>No workflows for this platform. Click + NEW WORKFLOW.</div>
          )}
          {filteredWFs.map(w => {
            const isSel = w.id === selId;
            const col = pltColor(w.platform);
            return (
              <div key={w.id}
                style={{ border:`1px solid ${isSel ? col : 'var(--line-soft)'}`, background: isSel ? `${col}10` : 'transparent', cursor:'pointer', position:'relative' }}
                onClick={() => { setSelId(w.id); setSelNode(null); setEditingWF(false); setWfDraft({}); }}
              >
                <div style={{ padding:'9px 10px 7px', borderLeft:`3px solid ${col}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:4 }}>
                    <span className="hud-label" style={{ fontSize:7.5, color:col, letterSpacing:'0.18em',
                      padding:'1px 5px', border:`1px solid ${col}40`, background:`${col}14`, flexShrink:0 }}>
                      {w.platform}
                    </span>
                    {wfs.length > 1 && (
                      <button onClick={e=>{e.stopPropagation();deleteWorkflow(w.id);}}
                        style={{ background:'transparent', border:'none', color:'rgba(255,100,100,0.4)', cursor:'pointer', fontSize:12, padding:0, lineHeight:1 }}>×</button>
                    )}
                  </div>
                  <div className="font-mono" style={{ fontSize:10.5, color: isSel ? '#fff' : 'var(--fg)', marginTop:4, lineHeight:1.2 }}>{w.name}</div>
                  <div className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', marginTop:3 }}>{w.trigger}</div>
                  <div className="font-mono" style={{ fontSize:8, color:'var(--cyan-dim)', marginTop:2 }}>{w.nodes.length} nodes · {w.edges.length} edges</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: DAG + editor */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, overflow:'auto', minHeight:0 }} className="nx-scroll">
          {wf && (
            <>
              {/* DAG header */}
              <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ padding:'2px 8px', fontSize:8, fontFamily:'Orbitron,monospace', letterSpacing:'0.2em',
                      color:'#0d1117', background:pltColor(wf.platform), flexShrink:0 }}>{wf.platform}</span>
                    <span className="font-display" style={{ fontSize:15, color:CYAN_BRIGHT }}>{wf.name}</span>
                  </div>
                  <div className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)', marginTop:3 }}>{wf.trigger} · {wf.desc}</div>
                </div>
                <div style={{ display:'flex', gap:5, marginLeft:'auto', flexWrap:'wrap', alignItems:'center' }}>
                  {addEdgeA && (
                    <span className="hud-label anim-pulse-soft" style={{ fontSize:8, color:AMBER, border:`1px solid ${AMBER}60`, padding:'3px 8px', letterSpacing:'0.14em' }}>
                      CLICK 2ND NODE TO LINK →
                    </span>
                  )}
                  <button onClick={()=>{setAddEdgeA(null); setAddNodeOpen(v=>!v); setSelNode(null);}} className="hud-label"
                    style={{ padding:'4px 10px', fontSize:8, cursor:'pointer', letterSpacing:'0.14em',
                      color: addNodeOpen ? '#0d1117' : JADE, background: addNodeOpen ? JADE : 'transparent',
                      border:`1px solid ${JADE}60` }}>
                    + NODE
                  </button>
                  <button onClick={()=>{setAddNodeOpen(false); setAddEdgeA(addEdgeA ? null : '__waiting__'); setSelNode(null);}} className="hud-label"
                    style={{ padding:'4px 10px', fontSize:8, cursor:'pointer', letterSpacing:'0.14em',
                      color: addEdgeA ? '#0d1117' : CYAN, background: addEdgeA ? CYAN : 'transparent',
                      border:`1px solid ${CYAN}60` }}>
                    {addEdgeA ? '✕ CANCEL LINK' : '⟶ LINK NODES'}
                  </button>
                  <button onClick={()=>{setEditingWF(v=>!v); setSelNode(null); setNodeDraft({}); setWfDraft({name:wf.name,trigger:wf.trigger,desc:wf.desc}); setAddEdgeA(null); setAddNodeOpen(false);}} className="hud-label"
                    style={{ padding:'4px 10px', fontSize:8, cursor:'pointer', letterSpacing:'0.14em',
                      color: editingWF ? '#0d1117' : VIOLET, background: editingWF ? VIOLET : 'transparent',
                      border:`1px solid ${VIOLET}60` }}>
                    ✏ EDIT META
                  </button>
                </div>
              </div>

              {/* Add node form */}
              {addNodeOpen && (
                <div className="anim-fade-in" style={{ padding:'8px 12px', border:`1px solid ${JADE}40`, background:`${JADE}06`, flexShrink:0 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                    <div style={{ flex:2 }}>
                      <div className="hud-label" style={{ fontSize:7.5, color:JADE, letterSpacing:'0.2em', marginBottom:3 }}>NODE LABEL</div>
                      <input value={newNodeDraft.label} onChange={e=>setNewNodeDraft(d=>({...d,label:e.target.value}))}
                        placeholder="e.g. SEO Optimize" style={{...inputCss}} onKeyDown={e=>e.key==='Enter'&&addNode()} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div className="hud-label" style={{ fontSize:7.5, color:JADE, letterSpacing:'0.2em', marginBottom:3 }}>TEAM ID</div>
                      <input value={newNodeDraft.team} onChange={e=>setNewNodeDraft(d=>({...d,team:e.target.value}))}
                        placeholder="CNT-HUB" style={{...inputCss}} onKeyDown={e=>e.key==='Enter'&&addNode()} />
                    </div>
                    <button onClick={addNode} className="hud-label"
                      style={{ padding:'5px 14px', fontSize:9, color:JADE, border:`1px solid ${JADE}70`, cursor:'pointer', background:`${JADE}12`, letterSpacing:'0.18em', flexShrink:0 }}>
                      ADD
                    </button>
                    <button onClick={()=>setAddNodeOpen(false)} className="hud-label"
                      style={{ padding:'5px 9px', fontSize:9, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', cursor:'pointer', background:'transparent' }}>
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Edit workflow metadata */}
              {editingWF && (
                <div className="anim-fade-in" style={{ padding:'10px 14px', border:`1px solid ${VIOLET}40`, background:`${VIOLET}07`, flexShrink:0 }}>
                  <div className="hud-label" style={{ fontSize:8, color:VIOLET, letterSpacing:'0.28em', marginBottom:8 }}>◆ EDIT WORKFLOW METADATA</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 1fr', gap:8, marginBottom:8 }}>
                    <div>
                      <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>NAME</div>
                      <input value={wfDraft.name ?? wf.name} onChange={e=>setWfDraft(d=>({...d,name:e.target.value}))} style={inputCss} />
                    </div>
                    <div>
                      <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>PLATFORM</div>
                      <select value={wfDraft.platform ?? wf.platform} onChange={e=>setWfDraft(d=>({...d,platform:e.target.value}))}
                        style={{...inputCss, height:28}}>
                        {['YT','X','IG','NWS','TW','ALL'].map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>TRIGGER</div>
                      <input value={wfDraft.trigger ?? wf.trigger} onChange={e=>setWfDraft(d=>({...d,trigger:e.target.value}))} style={inputCss} />
                    </div>
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>DESCRIPTION</div>
                    <textarea value={wfDraft.desc ?? wf.desc} onChange={e=>setWfDraft(d=>({...d,desc:e.target.value}))}
                      rows={2} style={{...inputCss, resize:'vertical', lineHeight:1.5}} />
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={saveWFMeta} className="hud-label"
                      style={{ padding:'5px 16px', fontSize:9, color:JADE, border:`1px solid ${JADE}60`, cursor:'pointer', background:`${JADE}10`, letterSpacing:'0.18em' }}>◆ SAVE</button>
                    <button onClick={()=>setEditingWF(false)} className="hud-label"
                      style={{ padding:'5px 12px', fontSize:9, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', cursor:'pointer', background:'transparent' }}>CANCEL</button>
                  </div>
                </div>
              )}

              {/* DAG canvas */}
              <div style={{ border:'1px solid var(--line-soft)', flexShrink:0, position:'relative' }}>
                <ContentDAG
                  wf={wf}
                  selectedNode={selNode}
                  addingEdge={addEdgeA !== '__waiting__' ? addEdgeA : null}
                  onNodeClick={handleNodeClick}
                />
                {addEdgeA === '__waiting__' && (
                  <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, cursor:'crosshair', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.05)' }}>
                    <span className="hud-label" style={{ fontSize:9, color:AMBER, letterSpacing:'0.2em', background:'rgba(0,0,0,0.7)', padding:'6px 14px', border:`1px solid ${AMBER}60` }}>
                      CLICK SOURCE NODE
                    </span>
                  </div>
                )}
              </div>

              {/* Node editor (when node selected) */}
              {selNode && (
                <div className="anim-fade-in" style={{ padding:'10px 14px', border:`1px solid ${CYAN}40`, background:`${CYAN}06`, flexShrink:0 }}>
                  <div className="hud-label" style={{ fontSize:8, color:CYAN_BRIGHT, letterSpacing:'0.28em', marginBottom:8 }}>◆ EDIT NODE · {selNode}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                    <div>
                      <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>NODE LABEL</div>
                      <input
                        value={nodeDraft.label ?? wf.nodes.find(n=>n.id===selNode)?.label ?? ''}
                        onChange={e=>setNodeDraft(d=>({...d,label:e.target.value}))}
                        style={inputCss}
                      />
                    </div>
                    <div>
                      <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>TEAM ID</div>
                      <input
                        value={nodeDraft.team ?? wf.nodes.find(n=>n.id===selNode)?.team ?? ''}
                        onChange={e=>setNodeDraft(d=>({...d,team:e.target.value}))}
                        style={inputCss}
                      />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                    <button onClick={saveNode} className="hud-label"
                      style={{ padding:'5px 14px', fontSize:9, color:JADE, border:`1px solid ${JADE}60`, cursor:'pointer', background:`${JADE}10`, letterSpacing:'0.18em' }}>◆ SAVE NODE</button>
                    <button onClick={()=>setAddEdgeA(selNode)} className="hud-label"
                      style={{ padding:'5px 12px', fontSize:9, color:CYAN, border:`1px solid ${CYAN}50`, cursor:'pointer', background:`${CYAN}08`, letterSpacing:'0.16em' }}>⟶ LINK FROM HERE</button>
                    <button onClick={deleteNode} className="hud-label"
                      style={{ padding:'5px 12px', fontSize:9, color:ROSE, border:`1px solid ${ROSE}50`, cursor:'pointer', background:`${ROSE}08`, letterSpacing:'0.16em' }}>✕ DELETE NODE</button>
                    <button onClick={()=>{setSelNode(null);setNodeDraft({});}} className="hud-label"
                      style={{ padding:'5px 10px', fontSize:9, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', cursor:'pointer', background:'transparent' }}>CANCEL</button>
                  </div>
                </div>
              )}

              {/* Edge list */}
              <div style={{ flexShrink:0 }}>
                <div className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)', letterSpacing:'0.28em', marginBottom:6 }}>◆ EDGES · CLICK × TO REMOVE</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {wf.edges.map(([a,b],i) => {
                    const A = wf.nodes.find(n=>n.id===a)?.label ?? a;
                    const B = wf.nodes.find(n=>n.id===b)?.label ?? b;
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px',
                        border:'1px solid var(--line-soft)', background:'oklch(0.07 0.012 240/0.5)', flexShrink:0 }}>
                        <span className="font-mono" style={{ fontSize:9, color:CYAN_BRIGHT }}>{A}</span>
                        <span style={{ fontSize:9, color:pltColor(wf.platform), opacity:0.7 }}>→</span>
                        <span className="font-mono" style={{ fontSize:9, color:CYAN_BRIGHT }}>{B}</span>
                        <button onClick={()=>deleteEdge(a,b)}
                          style={{ background:'transparent', border:'none', color:'rgba(255,100,100,0.5)', cursor:'pointer', fontSize:11, padding:0, marginLeft:2, lineHeight:1 }}>×</button>
                      </div>
                    );
                  })}
                  {wf.edges.length === 0 && (
                    <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>No edges yet. Click ⟶ LINK NODES, then click two nodes to connect them.</span>
                  )}
                </div>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
'''

with open('_cwt_content.txt', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Written: {len(content.splitlines())} lines → _cwt_content.txt")
