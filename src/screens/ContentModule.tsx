import { useState, useEffect } from 'react';
import { HoloPanel, Sparkline } from '../components/primitives';
import { ScreenHeader, Chip } from '../components/shell';
import { DraggableTabs, type DragTab } from '../components/draggable';
import { CYAN, CYAN_BRIGHT, AMBER, ROSE, JADE, VIOLET, colorFor } from '../theme';
import { CHANNELS } from '../data/os-data';
import { runResearch, runContent } from '../lib/claude';
import type { ScreenProps } from './Bridge';

/* ── Content pipeline + hooks data ──────────────────────────────────────── */
const DEFAULT_PIPELINE = [
  { id:'CNT-Q01', title:'Q3 Capital Envelope — Deep Dive', platform:'YT',  status:'RENDERING', eta:'14:30', lead:'ORION'    },
  { id:'CNT-Q02', title:'17 AI Cells Explained in 4 Min',  platform:'YT',  status:'SCRIPTING',  eta:'16:00', lead:'ORION'    },
  { id:'CNT-Q03', title:'ZeusBot v0.41 — Live P&L Thread', platform:'X',   status:'QUEUED',     eta:'15:00', lead:'HERMES'   },
  { id:'CNT-Q04', title:'Morning Reel · Markets Open',      platform:'IG',  status:'EDITING',    eta:'12:45', lead:'SELENE'   },
  { id:'CNT-Q05', title:'Stream Highlight · 3h Clip',       platform:'TW',  status:'QUEUED',     eta:'18:00', lead:'VOLT'     },
  { id:'CNT-Q06', title:'Weekly Feature · AI Agents Rise',  platform:'NWS', status:'DRAFTING',   eta:'20:00', lead:'GUTNBRG'  },
  { id:'CNT-Q07', title:'Bot vs Human: 30-Day Comparison',  platform:'YT',  status:'QUEUED',     eta:'TOM',   lead:'ORION'    },
  { id:'CNT-Q08', title:'Portfolio Rebalance — Reel',       platform:'IG',  status:'QUEUED',     eta:'TOM',   lead:'SELENE'   },
];

const VIRAL_HOOKS = [
  { platform:'YT', tag:'HOOK-YT', hook:'I gave an AI $100k and let it trade for 30 days. The results will surprise you.' },
  { platform:'YT', tag:'HOOK-YT', hook:'The 17-cell AI system that runs my entire business while I sleep.' },
  { platform:'X',  tag:'HOOK-X',  hook:'Most traders lose because they fight emotions. I removed emotions entirely. Here\'s how 🧵' },
  { platform:'X',  tag:'HOOK-X',  hook:'My bot just printed +2.4% in 6 hours. Here\'s the exact strategy breakdown.' },
  { platform:'IG', tag:'HOOK-IG', hook:'POV: your AI just handled 428 social posts while you were at dinner.' },
  { platform:'IG', tag:'HOOK-IG', hook:'Day 47 of letting JARVIS run my content. The results? Insane.' },
  { platform:'TW', tag:'HOOK-TW', hook:'We\'re going live right now — ZeusBot is ARMED and trading in real-time.' },
  { platform:'NWS', tag:'HOOK-NWS', hook:'How one developer built a sovereign AI operating system in 72 hours.' },
];

const DEFAULT_SCHEDULE = [
  { day:'MON', platform:'YT', time:'10:00', title:'Weekly Markets Brief', status:'scheduled' },
  { day:'MON', platform:'X',  time:'12:00', title:'Market Open Thread',   status:'queued' },
  { day:'TUE', platform:'IG', time:'08:30', title:'Morning Reel',         status:'scheduled' },
  { day:'TUE', platform:'TW', time:'14:00', title:'Strategy Breakdown',   status:'live' },
  { day:'WED', platform:'YT', time:'16:00', title:'Deep Dive Upload',     status:'scheduled' },
  { day:'WED', platform:'NWS',time:'09:00', title:'Newsletter',           status:'scheduled' },
  { day:'THU', platform:'X',  time:'11:00', title:'Thread · Bot P&L',    status:'queued' },
  { day:'THU', platform:'IG', time:'17:00', title:'Portfolio Update Reel',status:'queued' },
  { day:'FRI', platform:'YT', time:'18:00', title:'Strategy Explainer',   status:'queued' },
  { day:'FRI', platform:'TW', time:'20:00', title:'Friday Live Session',  status:'queued' },
  { day:'SAT', platform:'NWS',time:'10:00', title:'Weekend Analysis',     status:'queued' },
  { day:'SUN', platform:'X',  time:'20:00', title:'Week-Ahead Thread',    status:'scheduled' },
];

function platformColor(p: string) {
  return p === 'YT' ? ROSE : p === 'X' ? 'var(--fg)' : p === 'IG' ? '#e879f9' : p === 'TW' ? VIOLET : AMBER;
}
function pipelineStatusColor(s: string) {
  return s === 'RENDERING' ? CYAN_BRIGHT : s === 'EDITING' ? VIOLET : s === 'SCRIPTING' ? AMBER : s === 'DRAFTING' ? '#e879f9' : 'var(--cyan-dim)';
}

/* ── Content Creation Workflow Builder ───────────────────────────────────────────── */
type WFBStageId = 'IDEA' | 'RESEARCH' | 'BRIEF' | 'DRAFT' | 'REVIEW' | 'SCHEDULE';
type WFBStatus  = 'idle' | 'running' | 'done' | 'error';
interface WFBStage { input: string; output: string; status: WFBStatus; }
const STAGE_META: { id: WFBStageId; label: string; desc: string; color: string }[] = [
  { id: 'IDEA',     label: '01 · IDEA',     desc: 'Topic · angle · core message',           color: AMBER  },
  { id: 'RESEARCH', label: '02 · RESEARCH', desc: 'Deep research + key facts + context',     color: CYAN   },
  { id: 'BRIEF',    label: '03 · BRIEF',    desc: 'Creative brief for chosen channel',       color: VIOLET },
  { id: 'DRAFT',    label: '04 · DRAFT',    desc: 'Full first draft ready to edit',          color: JADE   },
  { id: 'REVIEW',   label: '05 · REVIEW',   desc: 'AI critique + improvement actions',       color: ROSE   },
  { id: 'SCHEDULE', label: '06 · SCHEDULE', desc: 'Publish plan + cross-platform dates',     color: AMBER  },
];
function mkStages(): Record<WFBStageId, WFBStage> {
  return { IDEA:{input:'',output:'',status:'idle'}, RESEARCH:{input:'',output:'',status:'idle'}, BRIEF:{input:'',output:'',status:'idle'}, DRAFT:{input:'',output:'',status:'idle'}, REVIEW:{input:'',output:'',status:'idle'}, SCHEDULE:{input:'',output:'',status:'idle'} };
}
const WFB_CHANNELS = ['YouTube','X / Twitter','Instagram','Newsletter','Twitch'];

function ContentWorkflowBuilder() {
  const [stages,    setStages]    = useState<Record<WFBStageId, WFBStage>>(mkStages);
  const [channel,   setChannel]   = useState('YouTube');
  const [automating,setAutomating]= useState(false);
  const [expanded,  setExpanded]  = useState<WFBStageId|''>('IDEA');
  const [error,     setError]     = useState('');

  function patch(id: WFBStageId, upd: Partial<WFBStage>) {
    setStages(s => ({...s, [id]: {...s[id], ...upd}}));
  }

  async function runStage(id: WFBStageId, inputOverride?: string): Promise<string> {
    const s = stages;
    const idea     = s.IDEA.output     || s.IDEA.input;
    const research = s.RESEARCH.output || s.RESEARCH.input;
    const brief    = s.BRIEF.output    || s.BRIEF.input;
    const draft    = s.DRAFT.output    || s.DRAFT.input;
    const inp = inputOverride ?? (stages[id].input || '');
    patch(id, { status: 'running' });
    try {
      let out = '';
      if (id === 'IDEA') {
        out = inp || idea || 'No idea entered.';
      } else if (id === 'RESEARCH') {
        const q = inp || idea || 'AI trading + content automation 2026';
        let searchCtx = '';
        try {
          const hits = await window.jarvisBridge.searchWeb(q);
          if (hits.length) {
            searchCtx = '\n\nLIVE SEARCH RESULTS:\n' + hits.map((r, i) =>
              `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`
            ).join('\n\n');
          }
        } catch { /* no search key - skip */ }
        out = await runResearch(q + searchCtx);
      } else if (id === 'BRIEF') {
        out = await runContent(`Write a detailed content brief for this topic: ${inp || research || idea}. Include: target audience, key messages, tone, structure, hooks, and CTA.`, channel);
      } else if (id === 'DRAFT') {
        out = await runContent(inp || brief || research || idea, channel);
      } else if (id === 'REVIEW') {
        out = await runResearch(`Review and critique this content piece. Be specific. Identify what works well, what to cut, what to strengthen, and give exactly 3 concrete improvement actions:\n\n${inp || draft}`);
      } else if (id === 'SCHEDULE') {
        out = await runContent(`Create a detailed cross-platform publishing schedule and distribution plan for this ${channel} content. Include best times, hashtags, repurposing steps, and 7-day promotion sequence.\n\nContent:\n${inp || draft}`, 'Newsletter');
      }
      patch(id, { output: out, status: 'done' });
      return out;
    } catch(e: any) {
      const msg = String(e?.message || e);
      patch(id, { status: 'error', output: msg });
      return '';
    }
  }

  async function automateAll() {
    setAutomating(true); setError('');
    const idea = stages.IDEA.output || stages.IDEA.input;
    if (!idea) { setError('Enter an idea in Stage 01 first.'); setAutomating(false); return; }
    try {
      const research = await runStage('RESEARCH', idea);
      setExpanded('RESEARCH');
      const brief = await runStage('BRIEF', research);
      setExpanded('BRIEF');
      const draft = await runStage('DRAFT', brief);
      setExpanded('DRAFT');
      const review = await runStage('REVIEW', draft);
      setExpanded('REVIEW');
      const schedule = await runStage('SCHEDULE', draft);
      setExpanded('SCHEDULE');
      // Persist completed workflow run
      const runRecord = {
        id: `wf-${Date.now()}`,
        idea, channel,
        completedAt: new Date().toISOString(),
        stages: { research, brief, draft, review, schedule },
      };
      try {
        const existing = JSON.parse(localStorage.getItem('jarvis.workflow-runs') || '[]');
        existing.unshift(runRecord);
        localStorage.setItem('jarvis.workflow-runs', JSON.stringify(existing.slice(0, 20)));
      } catch { /* localStorage full */ }
    } catch(e: any) { setError(String(e?.message || e)); }
    setAutomating(false);
  }

  function resetAll() { setStages(mkStages()); setExpanded('IDEA'); setError(''); }

  const totalDone = STAGE_META.filter(s => stages[s.id].status === 'done').length;

  return (
    <HoloPanel label="CONTENT CREATION WORKFLOW · AI AUTOMATABLE" code="WF-Σ" status="live" style={{ flexShrink: 0 }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <span className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)', letterSpacing:'0.28em' }}>CHANNEL:</span>
        {WFB_CHANNELS.map(ch => (
          <button key={ch} onClick={() => setChannel(ch)} className="hud-label"
            style={{ padding:'3px 9px', fontSize:8, cursor:'pointer', letterSpacing:'0.1em',
              color: channel===ch ? '#0d1117' : 'var(--cyan-dim)',
              background: channel===ch ? CYAN : 'transparent',
              border:`1px solid ${CYAN}50` }}>
            {ch==='X / Twitter'?'X':ch==='YouTube'?'YT':ch==='Instagram'?'IG':ch==='Twitch'?'TW':'NWS'}
          </button>
        ))}
        <div style={{ display:'flex', gap:6, marginLeft:'auto', alignItems:'center' }}>
          {totalDone > 0 && (
            <span className="font-mono" style={{ fontSize:9, color:JADE }}>{totalDone}/6 stages done</span>
          )}
          <button onClick={resetAll} className="hud-label"
            style={{ padding:'5px 12px', fontSize:8, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', cursor:'pointer', letterSpacing:'0.16em', background:'transparent' }}>
            ↺ RESET
          </button>
          <button onClick={automateAll} disabled={automating} className="hud-label anim-pulse-soft"
            style={{ padding:'7px 18px', fontSize:9, letterSpacing:'0.26em',
              color: automating ? 'var(--cyan-dim)' : AMBER,
              border:`1px solid ${AMBER}${automating?'30':'90'}`,
              background:`${AMBER}10`, cursor: automating?'wait':'pointer',
              boxShadow: automating ? 'none' : `0 0 10px ${AMBER}30`,
              textShadow: automating ? 'none' : `0 0 6px ${AMBER}` }}>
            {automating ? '◌ AUTOMATING…' : '►► AUTOMATE ALL 6 STAGES'}
          </button>
        </div>
      </div>
      {error && <div className="font-mono" style={{ fontSize:10, color:AMBER, marginBottom:8, padding:'6px 10px', border:`1px solid ${AMBER}40`, background:`${AMBER}08` }}>⚠ {error}</div>}

      {/* Stage pipeline */}
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        {STAGE_META.map((sm, i) => {
          const st = stages[sm.id];
          const isExp = expanded === sm.id;
          const dotColor = st.status==='done' ? JADE : st.status==='running' ? sm.color : st.status==='error' ? ROSE : 'var(--line)';
          return (
            <div key={sm.id} style={{ border:`1px solid ${isExp ? sm.color+'55' : 'var(--line-soft)'}`, background: isExp ? `${sm.color}06` : 'transparent', transition:'all 0.15s' }}>
              {/* Header row */}
              <div
                onClick={() => setExpanded(isExp ? '' : sm.id)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', cursor:'pointer', userSelect:'none' }}>
                <div style={{ width:7, height:7, borderRadius:99, flexShrink:0, background:dotColor, boxShadow: st.status==='done' ? `0 0 7px ${JADE}` : st.status==='running' ? `0 0 7px ${sm.color}` : 'none', transition:'all 0.2s' }} />
                <span className="hud-label" style={{ fontSize:9.5, color:sm.color, letterSpacing:'0.22em', minWidth:130 }}>{sm.label}</span>
                <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>{sm.desc}</span>
                <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
                  {st.status==='done'   && <span className="hud-label" style={{ fontSize:8, color:JADE, letterSpacing:'0.18em' }}>DONE ✓</span>}
                  {st.status==='running'&& <span className="hud-label anim-pulse-soft" style={{ fontSize:8, color:sm.color }}>RUNNING…</span>}
                  {st.status==='error'  && <span className="hud-label" style={{ fontSize:8, color:ROSE }}>ERROR</span>}
                  <span style={{ fontSize:11, color:'var(--cyan-dim)', transform:isExp?'rotate(180deg)':'none', transition:'transform 0.15s', lineHeight:1 }}>▾</span>
                </div>
              </div>
              {/* Expanded body */}
              {isExp && (
                <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column', gap:8 }} className="anim-fade-in">
                  <div style={{ display:'grid', gridTemplateColumns: st.output ? '1fr 1fr' : '1fr', gap:8 }}>
                    <div>
                      <div className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)', letterSpacing:'0.24em', marginBottom:4 }}>
                        {i===0 ? 'YOUR IDEA / TOPIC' : `INPUT ${i>0 ? '(auto-filled from prev. stage)' : ''}`}
                      </div>
                      <textarea
                        value={st.input}
                        onChange={e => patch(sm.id, {input:e.target.value})}
                        placeholder={i===0
                          ? 'Enter topic, angle, core message — e.g. "5 reasons AI trading beats emotions"'
                          : 'Leave empty to auto-use previous stage output, or type an override'
                        }
                        style={{ width:'100%', height:88, background:'oklch(0.05 0.01 240/0.8)', border:'1px solid var(--line)', color:'var(--fg)', padding:9, fontFamily:'var(--font-mono)', fontSize:10.5, lineHeight:1.5, resize:'vertical', outline:'none', boxSizing:'border-box' }}
                      />
                    </div>
                    {st.output && (
                      <div>
                        <div className="hud-label" style={{ fontSize:8, color:JADE, letterSpacing:'0.24em', marginBottom:4 }}>OUTPUT · EDITABLE</div>
                        <textarea
                          value={st.output}
                          onChange={e => patch(sm.id, {output:e.target.value})}
                          style={{ width:'100%', height:88, background:`${JADE}08`, border:`1px solid ${JADE}40`, color:'var(--fg)', padding:9, fontFamily:'var(--font-mono)', fontSize:10.5, lineHeight:1.5, resize:'vertical', outline:'none', boxSizing:'border-box' }}
                        />
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    {sm.id !== 'IDEA' && (
                      <button onClick={() => runStage(sm.id)} disabled={st.status==='running'} className="hud-label"
                        style={{ padding:'6px 16px', fontSize:9, letterSpacing:'0.2em',
                          color: st.status==='running' ? 'var(--cyan-dim)' : sm.color,
                          border:`1px solid ${sm.color}60`, background:`${sm.color}08`,
                          cursor: st.status==='running' ? 'wait' : 'pointer' }}>
                        {st.status==='running' ? '◌ RUNNING…' : `► RUN ${sm.id}`}
                      </button>
                    )}
                    {sm.id === 'IDEA' && (
                      <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>Type your idea above, then click ►► AUTOMATE ALL or run each stage manually below.</span>
                    )}
                    {st.output && (
                      <button onClick={() => navigator.clipboard?.writeText(st.output)} className="hud-label"
                        style={{ padding:'6px 12px', fontSize:8.5, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', cursor:'pointer', letterSpacing:'0.16em', background:'transparent' }}>
                        COPY OUTPUT
                      </button>
                    )}
                    {st.status==='error' && <span className="font-mono" style={{ fontSize:9.5, color:ROSE }}>{st.output.slice(0,120)}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </HoloPanel>
  );
}

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
      {id:'n1',x:60, y:90, label:'Hook Concept',       team:'CNT-X'},
      {id:'n2',x:270,y:90, label:'Thread Draft (8)',    team:'CNT-X'},
      {id:'n3',x:490,y:35, label:'AI Review',           team:'ARC-OPT'},
      {id:'n4',x:490,y:145,label:'Visual Assets',       team:'CNT-IG'},
      {id:'n5',x:700,y:90, label:'Schedule · Peak Time',team:'CNT-HUB'},
      {id:'n6',x:910,y:90, label:'Monitor + Reply',     team:'CNT-X'},
    ],
    edges:[['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6']],
  },
  {
    id:'CWF-IG', name:'Instagram Reel', platform:'IG',
    trigger:'Reel concept approved',
    desc:'IG reel: concept → 5 hook variants → caption → record → edit → post → stories CTA.',
    nodes:[
      {id:'n1',x:60, y:90, label:'Reel Concept',       team:'CNT-IG'},
      {id:'n2',x:260,y:35, label:'Hook Variants (5)',   team:'CNT-IG'},
      {id:'n3',x:260,y:145,label:'Caption + Hashtags',  team:'CNT-HUB'},
      {id:'n4',x:480,y:90, label:'Record + Edit',       team:'CNT-IG'},
      {id:'n5',x:690,y:35, label:'Post + Alt Text',     team:'CNT-IG'},
      {id:'n6',x:690,y:145,label:'Stories CTA',         team:'CNT-IG'},
      {id:'n7',x:900,y:90, label:'Track Engagement',    team:'CNT-HUB'},
    ],
    edges:[['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']],
  },
  {
    id:'CWF-NWS', name:'Newsletter Issue', platform:'NWS',
    trigger:'Weekly · Monday 07:00',
    desc:'Full newsletter: topic curation → research → outline → draft → design → compliance → send → analytics.',
    nodes:[
      {id:'n1',x:55, y:90, label:'Topic Curation',     team:'CNT-NWS'},
      {id:'n2',x:255,y:35, label:'Research Pull',      team:'ARC-SCT'},
      {id:'n3',x:255,y:145,label:'Outline + Structure', team:'CNT-NWS'},
      {id:'n4',x:475,y:90, label:'Draft + Edit',        team:'CNT-NWS'},
      {id:'n5',x:685,y:35, label:'Design + Visuals',    team:'CNT-HUB'},
      {id:'n6',x:685,y:145,label:'Compliance Check',    team:'LGL-LAW'},
      {id:'n7',x:895,y:90, label:'Send + Track Opens',  team:'CNT-NWS'},
    ],
    edges:[['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']],
  },
  {
    id:'CWF-TW', name:'Twitch Stream', platform:'TW',
    trigger:'Stream day',
    desc:'Twitch stream: plan → announce → go live → clip highlights → VOD edit → cross-post.',
    nodes:[
      {id:'n1',x:60, y:90, label:'Stream Plan',         team:'CNT-TW'},
      {id:'n2',x:260,y:35, label:'Announce · X + IG',   team:'CNT-HUB'},
      {id:'n3',x:260,y:145,label:'Tech + OBS Prep',     team:'INF-FS'},
      {id:'n4',x:480,y:90, label:'Go Live',              team:'CNT-TW'},
      {id:'n5',x:690,y:35, label:'Clip Highlights',      team:'CNT-TW'},
      {id:'n6',x:690,y:145,label:'VOD Edit',             team:'CNT-TW'},
      {id:'n7',x:900,y:90, label:'Cross-Post + Recap',   team:'CNT-HUB'},
    ],
    edges:[['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']],
  },
  {
    id:'CWF-XPL', name:'Cross-Platform Saturation', platform:'ALL',
    trigger:'Event · YT publish',
    desc:'After each YouTube publish: X thread, IG reel, TW clip, newsletter snippet. Full 24h cross-platform cycle.',
    nodes:[
      {id:'n1',x:60, y:110,label:'Event · YT Publish',  team:'CNT-YT'},
      {id:'n2',x:280,y:30, label:'X · Thread Compose',  team:'CNT-X'},
      {id:'n3',x:280,y:90, label:'IG · Reel Cut',        team:'CNT-IG'},
      {id:'n4',x:280,y:150,label:'TW · Clip Spotlight',  team:'CNT-TW'},
      {id:'n5',x:280,y:210,label:'NWS · Snippet',        team:'CNT-NWS'},
      {id:'n6',x:550,y:120,label:'Schedule Cross-Post',  team:'CNT-HUB'},
      {id:'n7',x:780,y:120,label:'Monitor · 24h Window', team:'ARC-OPT'},
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
  wf: CWorkflow; selectedNode: string | null; addingEdge: string | null;
  onNodeClick: (id: string) => void;
}) {
  const NW = 160, NH = 36;
  const xs = wf.nodes.map(n => n.x);
  const ys = wf.nodes.map(n => n.y);
  const maxX = xs.length ? Math.max(...xs) + NW + 20 : 300;
  const maxY = ys.length ? Math.max(...ys) + NH + 20 : 200;
  const byId: Record<string, CNode> = Object.fromEntries(wf.nodes.map(n => [n.id, n]));
  const accent = pltColor(wf.platform);
  return (
    <svg viewBox={`0 0 ${maxX} ${maxY}`}
      style={{ width:'100%', height: Math.max(200, maxY), display:'block', background:'oklch(0.04 0.01 240 / 0.6)' }}>
      {wf.edges.map(([a,b],i) => {
        const A = byId[a], B = byId[b];
        if (!A || !B) return null;
        const ax = A.x + NW, ay = A.y + NH/2, bx = B.x, by = B.y + NH/2, mx = (ax+bx)/2;
        return <path key={i} d={`M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`}
          stroke={accent} strokeOpacity="0.45" strokeWidth="1.2" fill="none" strokeDasharray="5 4" />;
      })}
      {wf.nodes.map(n => {
        const isSel = selectedNode === n.id;
        const isEdge = addingEdge === n.id;
        const bc = isSel ? accent : isEdge ? '#ffb300' : accent;
        const bg = isSel ? `${accent}28` : isEdge ? 'rgba(255,179,0,0.12)' : 'oklch(0.10 0.018 240/0.8)';
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor:'pointer' }}
            onClick={() => onNodeClick(n.id)}>
            <rect x="0" y="0" width={NW} height={NH} stroke={bc} strokeWidth={isSel?1.5:1}
              strokeOpacity={isSel?1:0.6} fill={bg} rx="0" />
            {isSel && <rect x="-1" y="-1" width={NW+2} height={NH+2} stroke={accent}
              strokeWidth="0.5" fill="none" strokeOpacity="0.4" />}
            <text x="8" y="14" fontSize="8.5" fontFamily="Orbitron,monospace"
              fill={isSel?'#fff':accent} letterSpacing="1.5" opacity={isSel?1:0.9}>{n.label}</text>
            <text x="8" y="28" fontSize="8" fontFamily="JetBrains Mono,monospace"
              fill="oklch(0.58 0.10 215)">{n.team}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Content Workflows Tab ─────────────────────────────────────────── */
function ContentWorkflowsTab() {
  const [wfs,         setWfs]         = useState<CWorkflow[]>(() => { const s = loadCWFs(); return s.length ? s : SEED_CWFS; });
  const [selId,       setSelId]       = useState<string>(SEED_CWFS[0].id);
  const [platFilter,  setPlatFilter]  = useState<string>('ALL');
  const [selNode,     setSelNode]     = useState<string|null>(null);
  const [editingWF,   setEditingWF]   = useState(false);
  const [wfDraft,     setWfDraft]     = useState<Partial<CWorkflow>>({});
  const [nodeDraft,   setNodeDraft]   = useState<Partial<CNode>>({});
  const [addEdgeA,    setAddEdgeA]    = useState<string|null>(null);
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [newNodeDraft,setNewNodeDraft]= useState({label:'',team:'CNT-HUB'});
  const [addWFOpen,   setAddWFOpen]   = useState(false);
  const [newWFDraft,  setNewWFDraft]  = useState({name:'',platform:'YT',trigger:'',desc:''});

  const wf = wfs.find(w => w.id === selId) ?? wfs[0];
  const filteredWFs = platFilter === 'ALL' ? wfs : wfs.filter(w => w.platform === platFilter);

  function persist(updated: CWorkflow[]) { setWfs(updated); saveCWFs(updated); }
  function patchWF(id: string, patch: Partial<CWorkflow>) {
    persist(wfs.map(w => w.id === id ? {...w,...patch} : w));
  }

  function handleNodeClick(nid: string) {
    if (addEdgeA !== null && addEdgeA !== '__waiting__') {
      if (addEdgeA !== nid) {
        const edge: CEdge = [addEdgeA, nid];
        const exists = wf.edges.some(([a,b]) => a===edge[0] && b===edge[1]);
        if (!exists) patchWF(wf.id, { edges:[...wf.edges, edge] });
      }
      setAddEdgeA(null);
    } else if (addEdgeA === '__waiting__') {
      setAddEdgeA(nid);
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
      nodes: wf.nodes.filter(n => n.id!==selNode),
      edges: wf.edges.filter(([a,b]) => a!==selNode && b!==selNode),
    });
    setSelNode(null); setNodeDraft({});
  }
  function deleteEdge(a: string, b: string) {
    patchWF(wf.id, { edges: wf.edges.filter(([ea,eb]) => !(ea===a && eb===b)) });
  }
  function addNode() {
    const id = 'n' + Date.now();
    const maxY = wf.nodes.length ? Math.max(...wf.nodes.map(n=>n.y)) : 0;
    const newNode: CNode = { id, x:60, y:maxY+60, label:newNodeDraft.label||'New Step', team:newNodeDraft.team||'CNT-HUB' };
    patchWF(wf.id, { nodes:[...wf.nodes, newNode] });
    setAddNodeOpen(false); setNewNodeDraft({label:'',team:'CNT-HUB'});
  }
  function saveWFMeta() { patchWF(wf.id, wfDraft); setEditingWF(false); setWfDraft({}); }
  function addWorkflow() {
    const id = 'CWF-' + Date.now();
    const nw: CWorkflow = {
      id, name:newWFDraft.name||'New Workflow',
      platform:newWFDraft.platform, trigger:newWFDraft.trigger||'On-demand',
      desc:newWFDraft.desc||'',
      nodes:[{id:'n1',x:60,y:90,label:'Start',team:'CNT-HUB'},{id:'n2',x:280,y:90,label:'Step 2',team:'CNT-HUB'},{id:'n3',x:500,y:90,label:'Publish',team:'CNT-HUB'}],
      edges:[['n1','n2'],['n2','n3']],
    };
    const updated = [...wfs, nw];
    persist(updated); setSelId(id);
    setAddWFOpen(false); setNewWFDraft({name:'',platform:'YT',trigger:'',desc:''});
  }
  function deleteWorkflow(id: string) {
    const updated = wfs.filter(w => w.id!==id);
    persist(updated.length ? updated : SEED_CWFS);
    setSelId((updated[0]??SEED_CWFS[0]).id);
  }
  function resetToSeed() { persist(SEED_CWFS); setSelId(SEED_CWFS[0].id); }

  const inputCss: React.CSSProperties = {
    width:'100%', padding:'5px 8px', fontSize:10.5,
    background:'oklch(0.05 0.01 240/0.9)', border:'1px solid var(--line)',
    color:'var(--fg)', outline:'none', fontFamily:'var(--font-mono)', boxSizing:'border-box',
  };
  const PLATFORMS = ['ALL','YT','X','IG','NWS','TW'];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0, gap:0 }}>
      {/* platform filter bar */}
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 0 8px', flexShrink:0, flexWrap:'wrap' }}>
        {PLATFORMS.map(p => (
          <button key={p} onClick={() => setPlatFilter(p)} className="hud-label"
            style={{ padding:'4px 12px', fontSize:8.5, cursor:'pointer', letterSpacing:'0.18em',
              color: platFilter===p ? '#0d1117' : pltColor(p),
              background: platFilter===p ? pltColor(p) : 'transparent',
              border:`1px solid ${pltColor(p)}60` }}>
            {p}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={() => setAddWFOpen(v=>!v)} className="hud-label"
            style={{ padding:'4px 12px', fontSize:8.5, cursor:'pointer', letterSpacing:'0.18em',
              color:addWFOpen?'#0d1117':AMBER, background:addWFOpen?AMBER:'transparent',
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

      {/* add workflow form */}
      {addWFOpen && (
        <div className="anim-fade-in" style={{ padding:'10px 14px', marginBottom:8, border:`1px solid ${AMBER}50`, background:`${AMBER}07`, flexShrink:0 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 1fr 1fr', gap:8, alignItems:'end' }}>
            <div>
              <div className="hud-label" style={{ fontSize:7.5, color:AMBER, letterSpacing:'0.22em', marginBottom:3 }}>WORKFLOW NAME</div>
              <input value={newWFDraft.name} onChange={e=>setNewWFDraft(d=>({...d,name:e.target.value}))} placeholder="e.g. YouTube Shorts" style={inputCss} />
            </div>
            <div>
              <div className="hud-label" style={{ fontSize:7.5, color:AMBER, letterSpacing:'0.22em', marginBottom:3 }}>PLATFORM</div>
              <select value={newWFDraft.platform} onChange={e=>setNewWFDraft(d=>({...d,platform:e.target.value}))} style={{...inputCss,height:28}}>
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
              style={{ padding:'5px 16px', fontSize:9, color:JADE, border:`1px solid ${JADE}60`, cursor:'pointer', background:`${JADE}10`, letterSpacing:'0.18em' }}>◆ CREATE</button>
            <button onClick={() => setAddWFOpen(false)} className="hud-label"
              style={{ padding:'5px 12px', fontSize:9, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', cursor:'pointer', background:'transparent', letterSpacing:'0.14em' }}>CANCEL</button>
          </div>
        </div>
      )}

      {/* main layout: list + detail */}
      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:10, flex:1, minHeight:0, overflow:'hidden' }}>
        {/* workflow list */}
        <div style={{ display:'flex', flexDirection:'column', gap:4, overflowY:'auto', paddingRight:4 }} className="nx-scroll">
          {filteredWFs.length === 0 && (
            <div className="font-mono" style={{ fontSize:10, color:'var(--cyan-dim)', padding:10 }}>No workflows for this platform.</div>
          )}
          {filteredWFs.map(w => {
            const isSel = w.id === selId;
            const col = pltColor(w.platform);
            return (
              <div key={w.id}
                style={{ border:`1px solid ${isSel?col:'var(--line-soft)'}`, background:isSel?`${col}10`:'transparent', cursor:'pointer' }}
                onClick={() => { setSelId(w.id); setSelNode(null); setEditingWF(false); setWfDraft({}); }}>
                <div style={{ padding:'9px 10px 7px', borderLeft:`3px solid ${col}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:4 }}>
                    <span className="hud-label" style={{ fontSize:7.5, color:col, letterSpacing:'0.18em',
                      padding:'1px 5px', border:`1px solid ${col}40`, background:`${col}14`, flexShrink:0 }}>{w.platform}</span>
                    {wfs.length > 1 && (
                      <button onClick={e=>{e.stopPropagation();deleteWorkflow(w.id);}}
                        style={{ background:'transparent', border:'none', color:'rgba(255,100,100,0.4)', cursor:'pointer', fontSize:12, padding:0, lineHeight:1 }}>×</button>
                    )}
                  </div>
                  <div className="font-mono" style={{ fontSize:10.5, color:isSel?'#fff':'var(--fg)', marginTop:4, lineHeight:1.2 }}>{w.name}</div>
                  <div className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', marginTop:3 }}>{w.trigger}</div>
                  <div className="font-mono" style={{ fontSize:8, color:'var(--cyan-dim)', marginTop:2 }}>{w.nodes.length} nodes · {w.edges.length} edges</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* DAG + editor */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, overflowY:'auto', minHeight:0 }} className="nx-scroll">
          {wf && (<>
            {/* workflow header + toolbar */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:8, flexShrink:0, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ padding:'2px 8px', fontSize:8, fontFamily:'Orbitron,monospace', letterSpacing:'0.2em',
                    color:'#0d1117', background:pltColor(wf.platform), flexShrink:0 }}>{wf.platform}</span>
                  <span className="font-display" style={{ fontSize:15, color:CYAN_BRIGHT }}>{wf.name}</span>
                </div>
                <div className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)', marginTop:3 }}>{wf.trigger} · {wf.desc}</div>
              </div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center', flexShrink:0 }}>
                {addEdgeA && addEdgeA !== '__waiting__' && (
                  <span className="hud-label anim-pulse-soft" style={{ fontSize:8, color:AMBER, border:`1px solid ${AMBER}60`, padding:'3px 8px', letterSpacing:'0.14em' }}>
                    CLICK 2ND NODE →
                  </span>
                )}
                <button onClick={()=>{setAddEdgeA(null);setAddNodeOpen(v=>!v);setSelNode(null);}} className="hud-label"
                  style={{ padding:'4px 10px', fontSize:8, cursor:'pointer', letterSpacing:'0.14em',
                    color:addNodeOpen?'#0d1117':JADE, background:addNodeOpen?JADE:'transparent', border:`1px solid ${JADE}60` }}>
                  + NODE
                </button>
                <button onClick={()=>{setAddNodeOpen(false);setAddEdgeA(addEdgeA?null:'__waiting__');setSelNode(null);}} className="hud-label"
                  style={{ padding:'4px 10px', fontSize:8, cursor:'pointer', letterSpacing:'0.14em',
                    color:addEdgeA?'#0d1117':CYAN, background:addEdgeA?CYAN:'transparent', border:`1px solid ${CYAN}60` }}>
                  {addEdgeA ? '✕ CANCEL LINK' : '⟶ LINK NODES'}
                </button>
                <button onClick={()=>{setEditingWF(v=>!v);setSelNode(null);setNodeDraft({});setWfDraft({name:wf.name,trigger:wf.trigger,desc:wf.desc,platform:wf.platform});setAddEdgeA(null);setAddNodeOpen(false);}} className="hud-label"
                  style={{ padding:'4px 10px', fontSize:8, cursor:'pointer', letterSpacing:'0.14em',
                    color:editingWF?'#0d1117':VIOLET, background:editingWF?VIOLET:'transparent', border:`1px solid ${VIOLET}60` }}>
                  ✏ EDIT META
                </button>
              </div>
            </div>

            {/* add node form */}
            {addNodeOpen && (
              <div className="anim-fade-in" style={{ padding:'8px 12px', border:`1px solid ${JADE}40`, background:`${JADE}06`, flexShrink:0 }}>
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <div style={{ flex:2 }}>
                    <div className="hud-label" style={{ fontSize:7.5, color:JADE, letterSpacing:'0.2em', marginBottom:3 }}>NODE LABEL</div>
                    <input value={newNodeDraft.label} onChange={e=>setNewNodeDraft(d=>({...d,label:e.target.value}))}
                      placeholder="e.g. SEO Optimize" style={inputCss} onKeyDown={e=>e.key==='Enter'&&addNode()} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div className="hud-label" style={{ fontSize:7.5, color:JADE, letterSpacing:'0.2em', marginBottom:3 }}>TEAM ID</div>
                    <input value={newNodeDraft.team} onChange={e=>setNewNodeDraft(d=>({...d,team:e.target.value}))}
                      placeholder="CNT-HUB" style={inputCss} onKeyDown={e=>e.key==='Enter'&&addNode()} />
                  </div>
                  <button onClick={addNode} className="hud-label"
                    style={{ padding:'5px 14px', fontSize:9, color:JADE, border:`1px solid ${JADE}70`, cursor:'pointer', background:`${JADE}12`, letterSpacing:'0.18em', flexShrink:0 }}>ADD</button>
                  <button onClick={()=>setAddNodeOpen(false)} className="hud-label"
                    style={{ padding:'5px 9px', fontSize:9, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', cursor:'pointer', background:'transparent' }}>✕</button>
                </div>
              </div>
            )}

            {/* edit workflow metadata */}
            {editingWF && (
              <div className="anim-fade-in" style={{ padding:'10px 14px', border:`1px solid ${VIOLET}40`, background:`${VIOLET}07`, flexShrink:0 }}>
                <div className="hud-label" style={{ fontSize:8, color:VIOLET, letterSpacing:'0.28em', marginBottom:8 }}>◆ EDIT WORKFLOW METADATA</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 1fr', gap:8, marginBottom:8 }}>
                  <div>
                    <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>NAME</div>
                    <input value={wfDraft.name??wf.name} onChange={e=>setWfDraft(d=>({...d,name:e.target.value}))} style={inputCss} />
                  </div>
                  <div>
                    <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>PLATFORM</div>
                    <select value={wfDraft.platform??wf.platform} onChange={e=>setWfDraft(d=>({...d,platform:e.target.value}))} style={{...inputCss,height:28}}>
                      {['YT','X','IG','NWS','TW','ALL'].map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>TRIGGER</div>
                    <input value={wfDraft.trigger??wf.trigger} onChange={e=>setWfDraft(d=>({...d,trigger:e.target.value}))} style={inputCss} />
                  </div>
                </div>
                <div style={{ marginBottom:8 }}>
                  <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>DESCRIPTION</div>
                  <textarea value={wfDraft.desc??wf.desc} onChange={e=>setWfDraft(d=>({...d,desc:e.target.value}))}
                    rows={2} style={{...inputCss,resize:'vertical',lineHeight:1.5}} />
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
              <ContentDAG wf={wf} selectedNode={selNode}
                addingEdge={addEdgeA && addEdgeA !== '__waiting__' ? addEdgeA : null}
                onNodeClick={handleNodeClick} />
              {addEdgeA === '__waiting__' && (
                <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, cursor:'crosshair',
                  display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.05)' }}>
                  <span className="hud-label" style={{ fontSize:9, color:AMBER, letterSpacing:'0.2em',
                    background:'rgba(0,0,0,0.7)', padding:'6px 14px', border:`1px solid ${AMBER}60` }}>
                    CLICK SOURCE NODE
                  </span>
                </div>
              )}
            </div>

            {/* Node editor */}
            {selNode && (
              <div className="anim-fade-in" style={{ padding:'10px 14px', border:`1px solid ${CYAN}40`, background:`${CYAN}06`, flexShrink:0 }}>
                <div className="hud-label" style={{ fontSize:8, color:CYAN_BRIGHT, letterSpacing:'0.28em', marginBottom:8 }}>◆ EDIT NODE · {selNode}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  <div>
                    <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>NODE LABEL</div>
                    <input value={nodeDraft.label ?? wf.nodes.find(n=>n.id===selNode)?.label ?? ''}
                      onChange={e=>setNodeDraft(d=>({...d,label:e.target.value}))} style={inputCss} />
                  </div>
                  <div>
                    <div className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)', letterSpacing:'0.2em', marginBottom:3 }}>TEAM ID</div>
                    <input value={nodeDraft.team ?? wf.nodes.find(n=>n.id===selNode)?.team ?? ''}
                      onChange={e=>setNodeDraft(d=>({...d,team:e.target.value}))} style={inputCss} />
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
                  <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>No edges yet. Use ⟶ LINK NODES, then click two nodes.</span>
                )}
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}


/* ── AI CONTENT GEN — platform definitions ──────────────────────────────── */
/* ── AI Content Gen constants ──────────────────────────────────────────── */
const AI_PLATFORMS = [
  { id: 'X',   name: 'X / Twitter', color: '#e2e8f0', icon: '𝕏', type: 'Thread',           prompt: 'Write an X/Twitter thread: tweet 1 = disruptive hook (max 280 chars), tweets 2-7 = numbered insights with stats or examples, final tweet = strong CTA. Separate each tweet with ---.' },
  { id: 'IG',  name: 'Instagram',   color: '#e879f9', icon: '◈', type: 'Caption',           prompt: 'Write an Instagram caption: bold first line as hook, 4 engaging short paragraphs, clear CTA, line break, then 25 niche hashtags grouped by topic.' },
  { id: 'LI',  name: 'LinkedIn',    color: '#38bdf8', icon: 'in', type: 'Thought Leadership',prompt: 'Write a LinkedIn post: killer opening line (no "I am excited to..."), 3-4 paragraphs with data and insight, contrarian or unique angle, soft professional CTA. 200-280 words.' },
  { id: 'YT',  name: 'YouTube',     color: '#f87171', icon: '▶', type: 'Script + Title',    prompt: 'Write: 1) SEO title (clickworthy, keyword-rich, under 60 chars), 2) Hook script for first 30 seconds (pattern interrupt + promise), 3) Description (150 words, first 2 lines keyword-rich).' },
  { id: 'TT',  name: 'TikTok',      color: '#fb7185', icon: '♪', type: '60s Script',        prompt: 'Write a TikTok script in 3 labeled sections — HOOK [0-3s]: shocking or curious opener; BODY [3-55s]: fast story or tips with pattern interrupts every 10s; CTA [55-60s]: follow/share prompt.' },
  { id: 'FB',  name: 'Facebook',    color: '#60a5fa', icon: 'f', type: 'Community Post',    prompt: 'Write a Facebook post: conversational and relatable, poses a question or tells a short story, 120-160 words, ends with an open question that invites comments.' },
  { id: 'RD',  name: 'Reddit',      color: '#fb923c', icon: '◉', type: 'Post + Body',       prompt: 'Write a Reddit post: non-clickbait title, detailed body that leads with value (no self-promotion), structured with line breaks, ends with a genuine question to spark discussion.' },
  { id: 'DC',  name: 'Discord',     color: '#818cf8', icon: '⬡', type: 'Announcement',      prompt: 'Write a Discord announcement: starts with @here, uses **bold** for key info, 2-3 short punchy paragraphs, clear action item, relevant emoji used sparingly.' },
  { id: 'TG',  name: 'Telegram',    color: '#22d3ee', icon: '✈', type: 'Channel Post',      prompt: 'Write a Telegram channel post: **bold** headline, direct no-fluff paragraphs, bullet key points, link placeholder at end as [Read More →].' },
  { id: 'TH',  name: 'Threads',     color: '#f472b6', icon: '@', type: 'Thread Series',     prompt: 'Write 5 Threads posts (max 500 chars each): each is standalone but flows as a series, conversational tone, last one has the CTA. Separate with ---.' },
  { id: 'NWS', name: 'Newsletter',  color: '#fbbf24', icon: '✉', type: 'Full Section',      prompt: 'Write a newsletter section: sub-headline, 200-word analytical paragraph, 3 bold takeaway bullets, "What to do next" action CTA, and an optional PS line.' },
  { id: 'PC',  name: 'Podcast',     color: '#a78bfa', icon: '◎', type: 'Show Notes',        prompt: 'Write: 1) Episode title (catchy + SEO), 2) 100-word show notes summary, 3) 4-5 timestamp chapter topics, 4) 60-second intro script with hook.' },
];

const AI_TONES = [
  { id: 'VIRAL',        color: '#f43f5e', desc: 'Max engagement, bold claims'    },
  { id: 'PROFESSIONAL', color: '#38bdf8', desc: 'Data-driven, authoritative'     },
  { id: 'CASUAL',       color: '#34d399', desc: 'Friendly, relatable, human'     },
  { id: 'AUTHORITY',    color: '#fbbf24', desc: 'Expert voice, confident'        },
  { id: 'STORYTELLING', color: '#a78bfa', desc: 'Narrative arc, emotional pull'  },
  { id: 'EDGY',         color: '#fb7185', desc: 'Provocative, no filter'         },
  { id: 'MINIMAL',      color: '#94a3b8', desc: 'Concise, no fluff'              },
];

const AI_LENGTHS  = ['SHORT', 'MEDIUM', 'LONG'] as const;
const AI_HOOKS    = ['QUESTION', 'STAT / FACT', 'BOLD CLAIM', 'STORY', 'CONTROVERSY', 'LISTICLE'] as const;
const AI_LANGS    = ['English', 'German', 'Spanish', 'French', 'Portuguese', 'Italian', 'Dutch', 'Polish'] as const;

interface PlatformResult { content: string; status: 'idle' | 'loading' | 'done' | 'error'; }

function SettingLabel({ children }: { children: React.ReactNode }) {
  return <div className="hud-label" style={{ fontSize: 7, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 5, marginTop: 10 }}>{children}</div>;
}

function AIContentGenTab() {
  const [topic,      setTopic]      = useState('');
  const [context,    setContext]    = useState('');
  const [audience,   setAudience]   = useState('');
  const [brand,      setBrand]      = useState('');
  const [cta,        setCta]        = useState('');
  const [tone,       setTone]       = useState('VIRAL');
  const [length,     setLength]     = useState<typeof AI_LENGTHS[number]>('MEDIUM');
  const [hook,       setHook]       = useState<typeof AI_HOOKS[number]>('BOLD CLAIM');
  const [lang,       setLang]       = useState<typeof AI_LANGS[number]>('English');
  const [selPlats,   setSelPlats]   = useState<string[]>(['X', 'IG', 'LI', 'YT', 'TT', 'TG', 'NWS']);
  const [results,    setResults]    = useState<Record<string, PlatformResult>>({});
  const [generating, setGenerating] = useState(false);
  const [copied,     setCopied]     = useState<string | null>(null);

  const togglePlat = (id: string) => setSelPlats(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const copyContent = (id: string) => {
    const c = results[id]?.content;
    if (c) { navigator.clipboard?.writeText(c); setCopied(id); setTimeout(() => setCopied(null), 2200); }
  };

  function buildPrompt(plat: typeof AI_PLATFORMS[number]) {
    const toneDef = AI_TONES.find(t => t.id === tone)!;
    const lengthMap = { SHORT: 'Keep it concise and punchy.', MEDIUM: 'Standard length for the platform.', LONG: 'Go in-depth, detailed, comprehensive.' };
    const parts = [
      `You are an elite content strategist. Write ${lang} content with a ${toneDef.id.toLowerCase()} tone (${toneDef.desc}).`,
      `Hook style: ${hook}.`,
      lengthMap[length],
      `\nTOPIC: "${topic}"`,
      audience  ? `TARGET AUDIENCE: ${audience}` : '',
      cta       ? `CALL TO ACTION: ${cta}` : '',
      brand     ? `BRAND/HANDLE: ${brand}` : '',
      context   ? `EXTRA CONTEXT: ${context}` : '',
      `\nTASK: ${plat.prompt}`,
      `\nOutput ONLY the final content. No preamble, no "Here is...", no meta-commentary.`,
    ].filter(Boolean).join('\n');
    return parts;
  }

  async function generateAll() {
    if (!topic.trim() || generating || selPlats.length === 0) return;
    setGenerating(true);
    const platforms = AI_PLATFORMS.filter(p => selPlats.includes(p.id));
    const initial: Record<string, PlatformResult> = {};
    platforms.forEach(p => { initial[p.id] = { content: '', status: 'loading' }; });
    setResults(initial);
    for (const plat of platforms) {
      try {
        const content = await runContent(buildPrompt(plat), plat.id);
        setResults(r => ({ ...r, [plat.id]: { content, status: 'done' } }));
      } catch {
        setResults(r => ({ ...r, [plat.id]: { content: 'Generation failed — check Claude API connection.', status: 'error' } }));
      }
    }
    setGenerating(false);
  }

  async function regenerateOne(platId: string) {
    const plat = AI_PLATFORMS.find(p => p.id === platId);
    if (!plat || !topic.trim()) return;
    setResults(r => ({ ...r, [platId]: { content: '', status: 'loading' } }));
    try {
      const content = await runContent(buildPrompt(plat), platId);
      setResults(r => ({ ...r, [platId]: { content, status: 'done' } }));
    } catch {
      setResults(r => ({ ...r, [platId]: { content: 'Generation failed.', status: 'error' } }));
    }
  }

  const doneCount    = Object.values(results).filter(r => r.status === 'done').length;
  const hasResults   = Object.values(results).some(r => r.status !== 'idle');
  const canGenerate  = topic.trim().length > 0 && selPlats.length > 0 && !generating;

  // shared input style
  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 10,
    background: 'oklch(0.055 0.01 240/0.95)', border: '1px solid var(--line)',
    color: 'var(--fg)', outline: 'none', fontFamily: 'var(--font-mono)', lineHeight: 1.4,
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, gap: 0, overflow: 'hidden' }}>

      {/* ══ LEFT SIDEBAR — settings ══ */}
      <div className="nx-scroll" style={{
        width: 270, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--line-soft)',
        padding: '14px 14px 20px', display: 'flex', flexDirection: 'column', gap: 0,
        background: 'oklch(0.04 0.01 240/0.9)',
      }}>

        {/* Header */}
        <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--line-soft)' }}>
          <div className="font-display" style={{ fontSize: 11, color: CYAN_BRIGHT, letterSpacing: '0.28em', marginBottom: 3 }}>
            AI CONTENT GEN
          </div>
          <div className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)' }}>
            {AI_PLATFORMS.length} platforms · {AI_TONES.length} tones
          </div>
        </div>

        {/* Topic */}
        <SettingLabel>TOPIC / CORE MESSAGE *</SettingLabel>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3}
          placeholder="e.g. My AI trading system hit 18% returns in Q3. Here's exactly how."
          style={{ ...inp, resize: 'vertical', minHeight: 64, borderColor: topic ? CYAN_BRIGHT : 'var(--line)', transition: 'border-color 0.2s' }} />

        {/* Audience */}
        <SettingLabel>TARGET AUDIENCE</SettingLabel>
        <input value={audience} onChange={e => setAudience(e.target.value)}
          placeholder="e.g. SaaS founders, 28-40, B2B"
          style={inp} />

        {/* CTA */}
        <SettingLabel>CALL TO ACTION</SettingLabel>
        <input value={cta} onChange={e => setCta(e.target.value)}
          placeholder="e.g. Join waitlist at jarvis.ai"
          style={inp} />

        {/* Brand */}
        <SettingLabel>BRAND / HANDLE</SettingLabel>
        <input value={brand} onChange={e => setBrand(e.target.value)}
          placeholder="e.g. @jarvis_ai · JARVIS™"
          style={inp} />

        {/* Context */}
        <SettingLabel>EXTRA CONTEXT</SettingLabel>
        <input value={context} onChange={e => setContext(e.target.value)}
          placeholder="Stats, references, style notes…"
          style={inp} />

        <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: 14, marginBottom: 0 }} />

        {/* Tone */}
        <SettingLabel>TONE</SettingLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {AI_TONES.map(t => {
            const sel = tone === t.id;
            return (
              <button key={t.id} onClick={() => setTone(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  background: sel ? `${t.color}14` : 'transparent',
                  border: `1px solid ${sel ? t.color : 'var(--line-soft)'}`,
                  outline: 'none',
                }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: sel ? t.color : 'transparent', border: `2px solid ${t.color}`, transition: 'background 0.15s' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="hud-label" style={{ fontSize: 8.5, color: sel ? t.color : 'var(--fg)', letterSpacing: '0.18em' }}>{t.id}</div>
                  <div className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', marginTop: 1 }}>{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Hook style */}
        <SettingLabel>OPENING HOOK</SettingLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {AI_HOOKS.map(h => {
            const sel = hook === h;
            return (
              <button key={h} onClick={() => setHook(h)}
                style={{
                  padding: '6px 6px', cursor: 'pointer', transition: 'all 0.15s',
                  background: sel ? `${AMBER}15` : 'transparent',
                  border: `1px solid ${sel ? AMBER : 'var(--line-soft)'}`,
                  outline: 'none',
                }}>
                <div className="font-mono" style={{ fontSize: 8, color: sel ? AMBER : 'var(--fg)', textAlign: 'center', lineHeight: 1.3 }}>{h}</div>
              </button>
            );
          })}
        </div>

        {/* Length */}
        <SettingLabel>CONTENT LENGTH</SettingLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {AI_LENGTHS.map(l => {
            const sel = length === l;
            return (
              <button key={l} onClick={() => setLength(l)}
                style={{
                  padding: '7px 4px', cursor: 'pointer', transition: 'all 0.15s',
                  background: sel ? `${JADE}18` : 'transparent',
                  border: `1px solid ${sel ? JADE : 'var(--line-soft)'}`,
                  outline: 'none',
                }}>
                <div className="hud-label" style={{ fontSize: 8, color: sel ? JADE : 'var(--fg)', textAlign: 'center', letterSpacing: '0.14em' }}>{l}</div>
              </button>
            );
          })}
        </div>

        {/* Language */}
        <SettingLabel>LANGUAGE</SettingLabel>
        <select value={lang} onChange={e => setLang(e.target.value as typeof AI_LANGS[number])}
          style={{ ...inp, cursor: 'pointer', appearance: 'none', paddingRight: 28 }}>
          {AI_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: 14, marginBottom: 14 }} />

        {/* Generate button */}
        <button onClick={generateAll} disabled={!canGenerate}
          style={{
            padding: '12px 16px', cursor: canGenerate ? 'pointer' : 'not-allowed',
            background: canGenerate ? CYAN_BRIGHT : 'transparent',
            border: `2px solid ${canGenerate ? CYAN_BRIGHT : 'var(--line)'}`,
            color: canGenerate ? '#0d1117' : 'var(--cyan-dim)',
            transition: 'all 0.2s', outline: 'none',
          }}>
          <div className="hud-label" style={{ fontSize: 10, letterSpacing: '0.28em', textAlign: 'center' }}>
            {generating ? `GENERATING ${doneCount}/${selPlats.length}…` : `◆ GENERATE · ${selPlats.length}`}
          </div>
          {!generating && (
            <div className="font-mono" style={{ fontSize: 7.5, color: canGenerate ? '#0d1117cc' : 'var(--cyan-dim)', textAlign: 'center', marginTop: 3, letterSpacing: '0.1em' }}>
              {selPlats.length === 0 ? 'Select platforms first' : `${selPlats.length} platform${selPlats.length !== 1 ? 's' : ''} selected`}
            </div>
          )}
        </button>

        {hasResults && !generating && (
          <button onClick={() => setResults({})}
            style={{ marginTop: 6, padding: '7px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--line-soft)', outline: 'none' }}>
            <div className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)', textAlign: 'center', letterSpacing: '0.14em' }}>CLEAR RESULTS</div>
          </button>
        )}
        {hasResults && !generating && (
          <div className="font-mono" style={{ fontSize: 8, color: JADE, textAlign: 'center', marginTop: 8, letterSpacing: '0.12em' }}>
            ✓ {doneCount} of {selPlats.length} done
          </div>
        )}

      </div>

      {/* ══ RIGHT — platform grid + results ══ */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Platform picker strip */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-soft)', flexShrink: 0, background: 'oklch(0.045 0.01 240/0.8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="hud-label" style={{ fontSize: 7, color: 'var(--cyan-dim)', letterSpacing: '0.28em', flexShrink: 0 }}>PLATFORMS</div>
            {AI_PLATFORMS.map(p => {
              const sel = selPlats.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePlat(p.id)}
                  title={p.type}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px',
                    cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
                    background: sel ? `${p.color}16` : 'transparent',
                    border: `1px solid ${sel ? p.color : 'oklch(0.22 0.015 240)'}`,
                  }}>
                  <span style={{ fontSize: 9, color: p.color, fontWeight: 700, lineHeight: 1 }}>{p.icon}</span>
                  <span className="font-mono" style={{ fontSize: 8.5, color: sel ? p.color : 'oklch(0.55 0.04 215)', lineHeight: 1, letterSpacing: '0.04em' }}>{p.name}</span>
                </button>
              );
            })}
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <button onClick={() => setSelPlats(AI_PLATFORMS.map(p => p.id))}
                style={{ padding: '5px 12px', cursor: 'pointer', background: 'transparent', border: `1px solid ${JADE}55`, outline: 'none' }}>
                <span className="font-mono" style={{ fontSize: 8, color: JADE, letterSpacing: '0.14em' }}>ALL</span>
              </button>
              <button onClick={() => setSelPlats([])}
                style={{ padding: '5px 12px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--line-soft)', outline: 'none' }}>
                <span className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.14em' }}>NONE</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results or empty state */}
        {hasResults ? (
          <div className="nx-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
              {AI_PLATFORMS.filter(p => selPlats.includes(p.id)).map(plat => {
                const r = results[plat.id];
                if (!r) return null;
                const isCopied   = copied === plat.id;
                const isLoading  = r.status === 'loading';
                const isDone     = r.status === 'done';
                const isError    = r.status === 'error';
                return (
                  <div key={plat.id} style={{
                    display: 'flex', flexDirection: 'column',
                    border: `1px solid ${isDone ? `${plat.color}50` : isError ? '#f43f5e40' : 'var(--line-soft)'}`,
                    background: 'oklch(0.055 0.012 240/0.9)',
                  }}>
                    {/* card header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderBottom: `1px solid ${plat.color}20`,
                      background: `${plat.color}0a`, flexShrink: 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: plat.color, lineHeight: 1, fontWeight: 700 }}>{plat.icon}</span>
                        <div>
                          <div className="hud-label" style={{ fontSize: 9, color: plat.color, letterSpacing: '0.18em' }}>{plat.name}</div>
                          <div className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>{plat.type}</div>
                        </div>
                        {isLoading && (
                          <div className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)', marginLeft: 4 }}>generating…</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {isDone && (
                          <>
                            <button onClick={() => copyContent(plat.id)}
                              style={{
                                padding: '4px 12px', cursor: 'pointer', outline: 'none', transition: 'all 0.2s',
                                background: isCopied ? `${JADE}20` : 'transparent',
                                border: `1px solid ${isCopied ? JADE : plat.color + '70'}`,
                              }}>
                              <span className="hud-label" style={{ fontSize: 7.5, color: isCopied ? JADE : plat.color, letterSpacing: '0.18em' }}>
                                {isCopied ? '✓ COPIED' : 'COPY'}
                              </span>
                            </button>
                            <button onClick={() => regenerateOne(plat.id)}
                              style={{ padding: '4px 9px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--line-soft)', outline: 'none' }}
                              title="Regenerate">
                              <span className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)' }}>↺</span>
                            </button>
                          </>
                        )}
                        {isError && (
                          <button onClick={() => regenerateOne(plat.id)}
                            style={{ padding: '4px 12px', cursor: 'pointer', background: 'transparent', border: '1px solid #f43f5e50', outline: 'none' }}>
                            <span className="hud-label" style={{ fontSize: 7.5, color: '#f87171', letterSpacing: '0.16em' }}>RETRY</span>
                          </button>
                        )}
                      </div>
                    </div>
                    {/* card body */}
                    <div style={{ padding: '12px 14px', flex: 1 }}>
                      {isLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 72 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: plat.color, animation: 'pulse 1s ease-in-out infinite' }} />
                          <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>Writing {plat.name} content…</span>
                        </div>
                      )}
                      {(isDone || isError) && (
                        <div className="font-mono" style={{ fontSize: 9.5, color: isError ? '#f8717180' : 'var(--fg)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {r.content}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: 0, opacity: 0.55 }}>
            <div className="font-display" style={{ fontSize: 15, color: CYAN_BRIGHT, letterSpacing: '0.3em' }}>ZERO-EFFORT CONTENT ENGINE</div>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)', textAlign: 'center', lineHeight: 1.75, maxWidth: 400 }}>
              Fill in topic + settings on the left.<br />
              Select platforms above. Hit GENERATE.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 500 }}>
              {AI_PLATFORMS.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: `1px solid ${p.color}35` }}>
                  <span style={{ fontSize: 9, color: p.color }}>{p.icon}</span>
                  <span className="font-mono" style={{ fontSize: 8, color: `${p.color}99` }}>{p.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export function ContentScreen({ onNav }: ScreenProps) {
  // ── Persistent pipeline + schedule state ──────────────────────────────────
  const [pipeline, setPipeline] = useState<typeof DEFAULT_PIPELINE>(() => {
    try { const s = localStorage.getItem('jarvis.pipeline'); return s ? JSON.parse(s) : DEFAULT_PIPELINE; } catch { return DEFAULT_PIPELINE; }
  });
  const [schedSlots, setSchedSlots] = useState<typeof DEFAULT_SCHEDULE>(() => {
    try { const s = localStorage.getItem('jarvis.schedule'); return s ? JSON.parse(s) : DEFAULT_SCHEDULE; } catch { return DEFAULT_SCHEDULE; }
  });
  useEffect(() => { try { localStorage.setItem('jarvis.pipeline', JSON.stringify(pipeline)); } catch {} }, [pipeline]);
  useEffect(() => { try { localStorage.setItem('jarvis.schedule', JSON.stringify(schedSlots)); } catch {} }, [schedSlots]);
  const PIPELINE_STATUSES = ['QUEUED','DRAFTING','SCRIPTING','EDITING','RENDERING','DONE'] as const;
  function cyclePipelineStatus(id: string) {
    setPipeline(p => p.map(item => {
      if (item.id !== id) return item;
      const idx = PIPELINE_STATUSES.indexOf(item.status as any);
      return { ...item, status: PIPELINE_STATUSES[(idx + 1) % PIPELINE_STATUSES.length] };
    }));
  }
  const SCHED_STATUSES = ['queued','scheduled','live'] as const;
  function cycleSchedStatus(i: number) {
    setSchedSlots(s => s.map((sl, j) => {
      if (j !== i) return sl;
      const idx = SCHED_STATUSES.indexOf(sl.status as any);
      return { ...sl, status: SCHED_STATUSES[(idx + 1) % SCHED_STATUSES.length] };
    }));
  }
    const [tab, setTab] = useState<'HUB'|'WORKFLOWS'|'AI_GEN'>('HUB');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [activeHookPlatform, setActiveHookPlatform] = useState<string>('ALL');

  function copyHook(idx: number, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  }

  const filteredHooks = activeHookPlatform === 'ALL'
    ? VIRAL_HOOKS
    : VIRAL_HOOKS.filter(h => h.platform === activeHookPlatform);

  const CONTENT_DEFAULT_TABS: DragTab[] = [
    { id: 'HUB',       label: 'CONTENT HUB',    color: AMBER, pinned: true },
    { id: 'WORKFLOWS', label: 'WORKFLOWS · DAG', color: CYAN  },
    { id: 'AI_GEN',    label: 'AI CONTENT GEN', color: ROSE  },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0 }}>
      {/* ── Module header ── */}
      <ScreenHeader
        tag="CONTENT MODULE"
        title="CHANNELS · PIPELINE · WORKFLOWS"
        subtitle="All 5 channels · content pipeline · viral hooks · cross-platform workflow DAGs."
        right={
          <button onClick={() => onNav('workflows')} className="hud-label" style={{ padding: '8px 14px', fontSize: 10, color: AMBER, border: `1px solid ${AMBER}80`, letterSpacing: '0.32em', textShadow: `0 0 6px ${AMBER}`, cursor: 'pointer' }}>
            ▶ COMPOSE DRAFTS →
          </button>
        }
      />

      <DraggableTabs
        storageKey="jarvis.tabs.content"
        defaultTabs={CONTENT_DEFAULT_TABS}
        active={tab}
        onActivate={id => setTab(id as 'HUB' | 'WORKFLOWS' | 'AI_GEN')}
        style={{ marginBottom: 10 }}
      />

      {/* ── WORKFLOWS tab ── */}
      {tab === 'WORKFLOWS' && (
        <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
          <ContentWorkflowsTab />
        </div>
      )}

      {/* ── AI CONTENT GEN tab ── */}
      {tab === 'AI_GEN' && (
        <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
          <AIContentGenTab />
        </div>
      )}

      {/* ── HUB tab ── */}
      {tab === 'HUB' && (
      <div style={{ flex:1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto' }} className="nx-scroll">

      {/* channel cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, flexShrink: 0 }}>
        {CHANNELS.map((c, i) => {
          const col = colorFor(c.color);
          return (
            <div key={c.id} className="holo holo-brackets anim-fade-up" style={{ padding: 14, animationDelay: `${i*40}ms`, position: 'relative' }}>
              <span className="br-bl" /><span className="br-br" />
              {c.live && <span className="anim-pulse-soft" style={{ position: 'absolute', top: 12, right: 12, fontSize: 8.5, color: ROSE, letterSpacing: '0.22em', padding: '2px 6px', border: `1px solid ${ROSE}`, fontFamily: 'Orbitron' }}>● LIVE</span>}
              <div className="font-mono" style={{ fontSize: 9, color: col, letterSpacing: '0.22em' }}>{c.id.toUpperCase()}</div>
              <div className="hud-label glow-cyan-sm" style={{ fontSize: 14, color: CYAN_BRIGHT, marginTop: 4 }}>{c.name}</div>
              <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginTop: 4 }}>{c.accent}</div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[['LEAD', c.lead], ['AUDIENCE', c.subs], ['TODAY', c.today], ['TREND 24H', c.trend]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)' }}>{k}</span>
                    <span className="font-mono glow-cyan-sm" style={{ fontSize: 10.5, color: k === 'TREND 24H' ? (v.startsWith('+') ? JADE : ROSE) : CYAN_BRIGHT }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <Sparkline data={Array.from({length: 18},(_, j) => 40 + Math.sin(i + j/2) * 18 + j*1.4 + Math.random()*6)} height={40} color={col} />
              </div>
            </div>
          );
        })}
      </div>

      {/* pipeline + schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flexShrink: 0 }}>
        {/* content pipeline */}
        <HoloPanel label="CONTENT PIPELINE" code="CNT-Q" status="live">
          <div style={{ display: 'grid', gridTemplateColumns: '70px 38px 1fr 62px 60px', gap: 0, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--line)' }} className="hud-label">
            <span style={{ fontSize: 8 }}>ID</span><span style={{ fontSize: 8 }}>PLAT</span><span style={{ fontSize: 8 }}>TITLE</span><span style={{ fontSize: 8 }}>STATUS</span><span style={{ fontSize: 8, textAlign: 'right' }}>ETA</span>
          </div>
          {pipeline.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 38px 1fr 62px 60px', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed var(--line-soft)', gap: 0, cursor: 'pointer' }} onClick={() => cyclePipelineStatus(item.id)} title="Click to cycle status">
              <span className="font-mono" style={{ fontSize: 9, color: CYAN_BRIGHT }}>{item.id}</span>
              <span className="hud-label" style={{ fontSize: 8.5, color: platformColor(item.platform), letterSpacing: '0.1em' }}>{item.platform}</span>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>{item.title}</span>
              <span className="hud-label" style={{ fontSize: 8, color: pipelineStatusColor(item.status), letterSpacing: '0.08em' }}>{item.status}</span>
              <span className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', textAlign: 'right' }}>{item.eta}</span>
            </div>
          ))}
        </HoloPanel>

        {/* cross-platform schedule */}
        <HoloPanel label="WEEKLY SCHEDULE" code="SCH-Ω" status="live">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {['MON','TUE','WED','THU','FRI','SAT/SUN'].map(day => (
              <div key={day} className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.12em', textAlign: 'center', paddingBottom: 4, borderBottom: '1px solid var(--line)' }}>{day}</div>
            ))}
            {['MON','TUE','WED','THU','FRI','SAT'].map(day => {
              const slots = schedSlots.filter(s => s.day === day || (day === 'SAT' && (s.day === 'SAT' || s.day === 'SUN')));
              return (
                <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
                  {slots.map((sl, j) => (
                    <div key={j} onClick={() => cycleSchedStatus(schedSlots.indexOf(sl))} style={{ cursor: 'pointer',
                      padding: '4px 5px', background: sl.status === 'live' ? `${ROSE}18` : sl.status === 'scheduled' ? `${JADE}12` : 'oklch(0.08 0.012 240 / 0.5)',
                      border: `1px solid ${sl.status === 'live' ? ROSE : sl.status === 'scheduled' ? JADE : 'var(--line-soft)'}40`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span className="hud-label" style={{ fontSize: 7.5, color: platformColor(sl.platform) }}>{sl.platform}</span>
                        <span className="font-mono" style={{ fontSize: 7, color: 'var(--cyan-dim)' }}>{sl.time}</span>
                      </div>
                      <div className="font-mono" style={{ fontSize: 7.5, color: sl.status === 'live' ? ROSE : 'var(--fg)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sl.title}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </HoloPanel>
      </div>

      {/* viral hooks generator */}
      <HoloPanel label="VIRAL HOOKS GENERATOR" code="HKS-Σ" status="live" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {['ALL','YT','X','IG','TW','NWS'].map(p => (
            <button key={p} onClick={() => setActiveHookPlatform(p)} className="hud-label"
              style={{ padding: '4px 10px', fontSize: 8.5, cursor: 'pointer', letterSpacing: '0.2em',
                color: activeHookPlatform === p ? '#0d1117' : platformColor(p),
                background: activeHookPlatform === p ? platformColor(p) : 'transparent',
                border: `1px solid ${platformColor(p)}60`,
              }}>
              {p}
            </button>
          ))}
          <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', alignSelf: 'center', marginLeft: 'auto' }}>CLICK HOOK → COPY TO CLIPBOARD</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {filteredHooks.map((h, i) => (
            <div key={i} onClick={() => copyHook(i, h.hook)}
              style={{ padding: '10px 12px', cursor: 'pointer', border: `1px solid ${copiedIdx === i ? JADE : 'var(--line-soft)'}`, background: copiedIdx === i ? `${JADE}14` : 'oklch(0.07 0.012 240 / 0.5)', transition: 'all 0.2s', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span className="hud-label" style={{ fontSize: 8, color: platformColor(h.platform), letterSpacing: '0.16em', flexShrink: 0, paddingTop: 2 }}>{h.platform}</span>
              <span className="font-mono" style={{ fontSize: 10.5, color: copiedIdx === i ? JADE : 'var(--fg)', lineHeight: 1.5, flex: 1 }}>{h.hook}</span>
              <span className="hud-label" style={{ fontSize: 8, color: copiedIdx === i ? JADE : 'var(--cyan-dim)', flexShrink: 0, paddingTop: 2, letterSpacing: '0.1em' }}>{copiedIdx === i ? 'COPIED ✓' : 'COPY'}</span>
            </div>
          ))}
        </div>
      </HoloPanel>

      {/* ── Content Creation Workflow Builder ── */}
      <ContentWorkflowBuilder />

      </div>
      )}
    </div>
  );
}

