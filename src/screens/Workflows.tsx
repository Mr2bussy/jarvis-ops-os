import { useState, useCallback, useEffect } from 'react';
import { HoloPanel, VoiceOrb, Stat, Pip } from '../components/primitives';
import { ScreenHeader, Chip } from '../components/shell';
import { DraggableTabs, type DragTab } from '../components/draggable';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, VIOLET, ROSE, colorFor } from '../theme';
import { WORKFLOWS } from '../data/os-data';
import type { Workflow, WorkflowNode } from '../data/os-data';
import { TEAMS, DIVISIONS } from '../data/jarvis-data';
import { LS, lsGet, lsSet, runResearch, runContent, runPlanDay } from '../lib/claude';

const LS_WF_KEY = 'jarvis.workflows.edits';
function loadEdits(): Record<string, Partial<Workflow>> {
  try { return JSON.parse(localStorage.getItem(LS_WF_KEY) || '{}'); } catch { return {}; }
}
function saveEdits(edits: Record<string, Partial<Workflow>>) {
  localStorage.setItem(LS_WF_KEY, JSON.stringify(edits));
}
function mergeWorkflows(base: Workflow[]): Workflow[] {
  const edits = loadEdits();
  return base.map(w => edits[w.id] ? { ...w, ...edits[w.id] } : w);
}

interface LiveWF { id: string; name: string; trigger: string; owner: string; desc: string; kind: 'research' | 'content' | 'planday'; }

const LIVE_WORKFLOWS: LiveWF[] = [
  { id: 'LIVE-RES',  name: 'Research Brief',     trigger: 'On-demand · LIVE', owner: 'ARC-OPT',
    desc: 'Multi-step research — TL;DR, key facts, counterpoints, next actions. Runs Claude live.', kind: 'research' },
  { id: 'LIVE-CON',  name: 'Content · 3 Drafts', trigger: 'On-demand · LIVE', owner: 'CNT-HUB',
    desc: 'Pick channel + brief. Generates 3 distinct drafts, channel-shaped. Runs Claude live.',    kind: 'content'  },
  { id: 'LIVE-DAY',  name: 'Plan My Day',        trigger: 'On-demand · LIVE', owner: 'ARC-OPT',
    desc: "Paste tasks + today's context. Returns reading, schedule, drop list, end-of-day check.", kind: 'planday' },
  // ── Content Creation ──────────────────────────────────────────────────
  { id: 'LIVE-VID',  name: 'Video Script AI',      trigger: 'On-demand · LIVE', owner: 'CNT-YT',
    desc: 'Full YouTube script: hook, 5-act structure, B-roll cues, CTAs, 3 title variants. Paste topic.', kind: 'content' },
  { id: 'LIVE-THR',  name: 'Thread Writer · X',    trigger: 'On-demand · LIVE', owner: 'CNT-X',
    desc: 'Viral X/Twitter thread: grabber hook + 8 punchy tweets + power CTA. Engineered for retweets.', kind: 'content' },
  { id: 'LIVE-NWS',  name: 'Newsletter Issue',     trigger: 'On-demand · LIVE', owner: 'CNT-NWS',
    desc: 'Subject line + intro + 3 insight sections + trade idea + insight quote + outro. ~500 words.', kind: 'content' },
  { id: 'LIVE-CAP',  name: 'Caption + Hooks · IG', trigger: 'On-demand · LIVE', owner: 'CNT-IG',
    desc: '5 hook variants + IG caption + hashtag stack. Paste reel concept or visual description.', kind: 'content' },
  { id: 'LIVE-RPU',  name: 'Repurpose 1 → 5',      trigger: 'On-demand · LIVE', owner: 'CNT-HUB',
    desc: 'Paste any content piece — get 5 platform-adapted versions: YT · X · IG · TW · NWS in one run.', kind: 'content' },
  { id: 'LIVE-CAL',  name: 'Content Calendar',     trigger: 'On-demand · LIVE', owner: 'CNT-HUB',
    desc: '30-day cross-platform calendar: themes, hooks, formats, optimal publish windows.', kind: 'content' },
];

function WorkflowDAG({ workflow, highlightTeam }: { workflow: Workflow; highlightTeam?: string | null }) {
  const W = 900, H = 280;
  const { nodes, edges } = workflow;
  const byId: Record<string, typeof nodes[number]> = Object.fromEntries(nodes.map(n => [n.id, n]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {edges.map(([a, b], i) => {
        const A = byId[a], B = byId[b];
        if (!A || !B) return null;
        const mx = (A.x + B.x) / 2;
        const lit = highlightTeam && (A.team === highlightTeam || B.team === highlightTeam);
        return <path key={i} d={`M ${A.x+60} ${A.y+18} C ${mx} ${A.y+18}, ${mx} ${B.y+18}, ${B.x} ${B.y+18}`}
          stroke={lit ? AMBER : CYAN} strokeOpacity={lit ? 0.85 : 0.4} strokeWidth={lit ? 2 : 1.2}
          fill="none" className={lit ? undefined : 'anim-dash'} />;
      })}
      {nodes.map(n => {
        const active = highlightTeam && n.team === highlightTeam;
        return (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            {active && <rect x="-3" y="-3" width="166" height="42" stroke={AMBER} strokeOpacity="0.7" fill={`${AMBER}12`} strokeWidth="1.5" rx="1" />}
            <rect x="0" y="0" width="160" height="36" stroke={active ? AMBER : CYAN} strokeOpacity={active ? 1 : 0.6}
              fill={active ? 'oklch(0.13 0.022 75 / 0.85)' : 'oklch(0.10 0.018 240 / 0.7)'} strokeWidth={active ? 1.5 : 1} />
            <text x="8" y="14" fontSize="9" fontFamily="Orbitron" fill={active ? AMBER : CYAN_BRIGHT} letterSpacing="2">{n.label}</text>
            <text x="8" y="28" fontSize="8.5" fontFamily="JetBrains Mono" fill={active ? AMBER : 'oklch(0.58 0.10 215)'}>{n.team}</text>
            {active && <text x="152" y="14" fontSize="10" textAnchor="end" fill={AMBER} fontFamily="Orbitron">◆</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* Compact DAG card for list view — renders the full pipeline inline */
function WorkflowCardDAG({ workflow, active }: { workflow: Workflow; active: boolean }) {
  const { nodes, edges } = workflow;
  if (!nodes.length) return null;
  // normalize positions to fit in 340x90 box
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 340, H = 90, NW = 120, NH = 26, PAD = 8;
  const sx = maxX === minX ? 1 : (W - NW - PAD * 2) / (maxX - minX);
  const sy = maxY === minY ? 1 : (H - NH - PAD * 2) / (maxY - minY);
  const scale = Math.min(sx, sy, 1);
  const px = (x: number) => PAD + (x - minX) * scale;
  const py = (y: number) => PAD + (y - minY) * scale;
  const byId: Record<string, typeof nodes[number]> = Object.fromEntries(nodes.map(n => [n.id, n]));
  const accentC = active ? CYAN_BRIGHT : CYAN;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }}>
      {edges.map(([a, b], i) => {
        const A = byId[a], B = byId[b];
        if (!A || !B) return null;
        const ax = px(A.x) + NW, ay = py(A.y) + NH / 2;
        const bx = px(B.x),      by = py(B.y) + NH / 2;
        const mx = (ax + bx) / 2;
        return <path key={i} d={`M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`}
          stroke={accentC} strokeOpacity={active ? 0.55 : 0.28} strokeWidth="1" fill="none" strokeDasharray="4,3" />;
      })}
      {nodes.map(n => {
        const x = px(n.x), y = py(n.y);
        return (
          <g key={n.id} transform={`translate(${x},${y})`}>
            <rect x="0" y="0" width={NW} height={NH} rx="1"
              stroke={accentC} strokeOpacity={active ? 0.7 : 0.4}
              fill={active ? `oklch(0.78 0.13 215 / 0.12)` : `oklch(0.08 0.012 240 / 0.7)`} />
            <text x="5" y="11" fontSize="6.5" fontFamily="Orbitron,sans-serif" fill={accentC} letterSpacing="1">{n.label.slice(0, 16)}</text>
            <text x="5" y="21" fontSize="6"   fontFamily="JetBrains Mono,monospace" fill="oklch(0.58 0.10 215)">{n.team}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LiveWorkflowRunner({ wf, onClose }: { wf: LiveWF; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [channel, setChannel] = useState('X / Twitter');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true); setError(''); setOutput('');
    try {
      let res = '';
      if (wf.kind === 'research') {
        const topic = input || 'Generative AI tooling for prosumer content creators, 2026 outlook';
        const step1 = await runResearch(topic);
        const step2 = await runResearch(`Given this research:\n\n${step1}\n\nNow provide: 1) 3 counterpoints, 2) 5 concrete action items, 3) a one-paragraph executive summary.`);
        res = `## RESEARCH BRIEF\n\n${step1}\n\n---\n\n## ANALYSIS & ACTIONS\n\n${step2}`;
      } else if (wf.kind === 'content') {
        const brief = input || 'JARVIS-style AI assistants for power users';
        const draft1 = await runContent(`Draft 1 (Informative angle): ${brief}`, channel);
        const draft2 = await runContent(`Draft 2 (Contrarian/provocative angle): ${brief}`, channel);
        const draft3 = await runContent(`Draft 3 (Story-driven angle with hook): ${brief}`, channel);
        res = `## DRAFT 1 — INFORMATIVE\n\n${draft1}\n\n---\n\n## DRAFT 2 — CONTRARIAN\n\n${draft2}\n\n---\n\n## DRAFT 3 — STORY-DRIVEN\n\n${draft3}`;
      } else if (wf.kind === 'planday') {
        const tasks = input || "1. Trader bot review\n2. Edit Q3 video\n3. Counsel call 14:00\n4. Workout\n5. Prep tomorrow's stream";
        const plan = await runPlanDay(tasks);
        const optimized = await runResearch(`Given this day plan:\n\n${plan}\n\nProvide: 1) energy/focus optimization suggestions, 2) which tasks to delegate or drop, 3) a 3-item end-of-day success checklist.`);
        res = `## DAY PLAN\n\n${plan}\n\n---\n\n## OPTIMIZATION\n\n${optimized}`;
      }
      setOutput(res);
      // Persist run
      const runs = lsGet<any[]>(LS.runs, []);
      runs.unshift({ id: `RUN-${Date.now()}`, wf: wf.name, kind: wf.kind, input, channel, output: res, at: new Date().toISOString(), steps: wf.kind === 'content' ? 3 : 2 });
      lsSet(LS.runs, runs.slice(0, 30));
    } catch (e: any) { setError(String(e?.message || e)); }
    setBusy(false);
  }

  const channels = ['X / Twitter', 'YouTube', 'Instagram', 'Newsletter', 'Twitch'];

  return (
    <div className="anim-fade-in" style={{ position: 'absolute', inset: 0, background: 'oklch(0.04 0.012 245 / 0.92)', zIndex: 50, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.4em' }}>◆ LIVE WORKFLOW · {wf.id}</div>
          <div className="font-display glow-cyan" style={{ fontSize: 20, color: CYAN_BRIGHT, marginTop: 4 }}>{wf.name}</div>
          <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--cyan-dim)', marginTop: 4 }}>{wf.desc}</div>
        </div>
        <button onClick={onClose} className="hud-label" style={{ padding: '6px 12px', fontSize: 9, color: CYAN_BRIGHT, border: `1px solid ${CYAN}80`, letterSpacing: '0.28em' }}>✕ CLOSE</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, flex: 1, minHeight: 0 }}>
        <HoloPanel label="INPUT" code="IN-Δ" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {wf.kind === 'content' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {channels.map(c => <Chip key={c} active={channel === c} onClick={() => setChannel(c)}>{c}</Chip>)}
            </div>
          )}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={
              wf.kind === 'research' ? 'Topic — e.g. "AI hardware shortages H2 2026"' :
              wf.kind === 'content'  ? 'Brief — e.g. "5 ways JARVIS-style AI outperforms ChatGPT for power users"' :
              "Today's tasks — one per line. Add deadlines if any."
            }
            style={{
              flex: 1, minHeight: 200, background: 'oklch(0.06 0.014 240 / 0.6)',
              border: '1px solid var(--line)', color: 'var(--fg)', padding: 12,
              fontFamily: 'JetBrains Mono', fontSize: 12, lineHeight: 1.5,
              resize: 'none', outline: 'none',
            }}
          />
          <button onClick={run} disabled={busy} className="hud-label anim-pulse-soft"
            style={{
              marginTop: 10, padding: '12px', fontSize: 11, letterSpacing: '0.32em',
              color: busy ? 'var(--cyan-dim)' : CYAN_BRIGHT,
              background: 'oklch(0.78 0.13 215 / 0.14)',
              border: `1px solid ${CYAN}`,
              cursor: busy ? 'wait' : 'pointer',
              boxShadow: `0 0 12px ${CYAN}55`,
              textShadow: `0 0 6px ${CYAN}`,
            }}>
            {busy ? '◌ RUNNING…' : '▶ RUN WORKFLOW'}
          </button>
          {error && <div className="font-mono" style={{ fontSize: 10, color: AMBER, marginTop: 8 }}>⚠ {error}</div>}
        </HoloPanel>

        <HoloPanel label="OUTPUT" code="OUT-Δ" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }} bodyClassName="nx-scroll">
          {!output && !busy && <div className="font-mono" style={{ fontSize: 11, color: 'var(--cyan-dim)', lineHeight: 1.5 }}>Output will stream here. Press RUN.</div>}
          {busy && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}>
              <VoiceOrb state="processing" size={160} />
              <div className="hud-label glow-violet" style={{ fontSize: 10, color: VIOLET, letterSpacing: '0.4em' }}>// PROCESSING</div>
            </div>
          )}
          {output && <pre className="font-mono anim-fade-up" style={{ fontSize: 11, color: 'var(--fg)', lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: 0 }}>{output}</pre>}
        </HoloPanel>
      </div>
    </div>
  );
}

// ── Cell Edit Data ─────────────────────────────────────────────────────────────
interface CellEditData {
  name: string;
  status: 'live' | 'warn' | 'idle';
  lead: string;
  trigger: string;
  notes: string;
}
const LS_CELL_EDITS = 'jarvis.wf.cell_edits';
function loadCellEdits(): Record<string, CellEditData> {
  try { return JSON.parse(localStorage.getItem(LS_CELL_EDITS) || '{}'); } catch { return {}; }
}

// ── Cell Editor Panel ──────────────────────────────────────────────────────────
function CellEditorPanel({ team, edits, draft, onDraftChange, onSave, onReset, onClose }: {
  team: typeof TEAMS[0];
  edits: Partial<CellEditData>;
  draft: Partial<CellEditData>;
  onDraftChange: (d: Partial<CellEditData>) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const merged = { ...team, trigger: '', notes: '', ...edits };
  const c = colorFor(DIVISIONS[team.div].color);
  const hasEdits = Object.keys(edits).length > 0;
  const fieldCss = {
    width: '100%', padding: '7px 10px', fontSize: 11,
    background: 'oklch(0.05 0.01 240 / 0.8)',
    border: `1px solid ${c}44`, color: 'var(--fg)' as const, outline: 'none',
    fontFamily: 'var(--font-mono)', boxSizing: 'border-box' as const,
  };
  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="hud-label" style={{ fontSize: 7.5, color: c, letterSpacing: '0.3em', marginBottom: 4 }}>
            CELL WORKFLOW EDITOR · {team.id} · {team.div}
          </div>
          <div className="font-display" style={{ fontSize: 15, color: c, letterSpacing: '0.12em' }}>
            {(draft.name ?? edits.name) || team.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {hasEdits && (
            <button onClick={onReset} className="hud-label"
              style={{ padding: '5px 10px', fontSize: 8.5, color: AMBER, border: `1px solid ${AMBER}60`, cursor: 'pointer', letterSpacing: '0.2em', background: 'transparent' }}>
              ↺ RESET
            </button>
          )}
          <button onClick={onSave} className="hud-label"
            style={{ padding: '5px 10px', fontSize: 8.5, color: JADE, border: `1px solid ${JADE}60`, cursor: 'pointer', letterSpacing: '0.2em', background: `${JADE}10` }}>
            ◆ SAVE
          </button>
          <button onClick={onClose} className="hud-label"
            style={{ padding: '5px 10px', fontSize: 8.5, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', cursor: 'pointer', letterSpacing: '0.2em', background: 'transparent' }}>
            ✕
          </button>
        </div>
      </div>
      <div>
        <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 6 }}>OPERATIONAL STATUS</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['live', 'warn', 'idle'] as const).map(s => {
            const sc = s === 'live' ? JADE : s === 'warn' ? AMBER : 'oklch(0.5 0.04 215)';
            const active = (draft.status ?? merged.status) === s;
            return (
              <button key={s} onClick={() => onDraftChange({ ...draft, status: s })} className="hud-label"
                style={{
                  padding: '6px 20px', fontSize: 9, cursor: 'pointer', letterSpacing: '0.22em',
                  color: active ? '#0d1117' : sc,
                  background: active ? sc : 'transparent',
                  border: `1px solid ${sc}60`,
                }}>
                {s.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
      {([
        { label: 'CELL / WORKFLOW NAME', key: 'name'    as const, placeholder: team.name },
        { label: 'LEAD AGENT / OWNER',   key: 'lead'    as const, placeholder: team.lead },
        { label: 'TRIGGER / SCHEDULE',   key: 'trigger' as const, placeholder: 'e.g. daily 08:00 · on push · manual · cron' },
      ]).map(({ label, key, placeholder }) => (
        <div key={key}>
          <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4 }}>{label}</div>
          <input
            value={((draft[key] ?? edits[key]) || '') as string}
            onChange={e => onDraftChange({ ...draft, [key]: e.target.value })}
            placeholder={placeholder}
            style={fieldCss}
          />
        </div>
      ))}
      <div>
        <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4 }}>SCOPE · OPERATIONS · NOTES</div>
        <textarea
          value={((draft.notes ?? edits.notes) || '') as string}
          onChange={e => onDraftChange({ ...draft, notes: e.target.value })}
          placeholder="Describe this workflow cell's operational scope, agent assignments, connected systems, escalation paths…"
          rows={5}
          style={{ ...fieldCss, resize: 'vertical' as const, lineHeight: 1.5 }}
        />
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
        padding: '10px 12px', background: 'oklch(0.06 0.012 240 / 0.5)', border: '1px solid var(--line-soft)',
      }}>
        <Stat label="DIVISION" value={team.div} />
        <Stat label="AGENTS"   value={`${team.agents}`} />
        <Stat label="TEAM ID"  value={team.id} />
      </div>
      <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', lineHeight: 1.5, padding: '8px 10px', border: '1px dashed var(--line-soft)' }}>
        ⓘ Edits saved to localStorage · Name, status, trigger and notes persist across restarts.
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────
// WORKFLOW BUILDER — types, templates, component
// ─────────────────────────────────────────────────────────────────────────

interface BuilderWF {
  id: string; name: string; desc: string; category: string;
  source: 'n8n' | 'github' | 'jarvis' | 'custom';
  trigger: string; tags: string[]; owner: string;
  nodes: WorkflowNode[]; edges: [string, string][];
  savedAt: string; fromTemplate?: string;
}

const LS_BUILDER = 'jarvis.builder.wfs';
function loadBuilderWFs(): BuilderWF[] {
  try { return JSON.parse(localStorage.getItem(LS_BUILDER) || '[]'); } catch { return []; }
}
function saveBuilderWFs(wfs: BuilderWF[]) {
  localStorage.setItem(LS_BUILDER, JSON.stringify(wfs));
}

// Shorthand helpers for template definitions
const _n = (id: string, x: number, y: number, label: string, team: string): WorkflowNode => ({ id, x, y, label, team });
const _e = (...pairs: [string, string][]): [string, string][] => pairs;

type TplDef = Omit<BuilderWF, 'savedAt'>;

const WF_TEMPLATES: TplDef[] = [

  // ── CI/CD & DevOps (8) ──────────────────────────────────────────────────
  {
    id: 'TPL-001', category: 'CI/CD', source: 'github', owner: 'INF-FS',
    name: 'Full-Stack CI/CD Pipeline', trigger: 'Push · main / PR',
    tags: ['github-actions', 'docker', 'deploy', 'testing'],
    desc: 'Unit test + lint in parallel → Docker build → Stage deploy → Smoke test → Prod deploy → Slack notify.',
    nodes: [
      _n('n1',  60, 100, 'Push · Trigger',      'INF-FS'),
      _n('n2', 260,  40, 'Test · Unit + Int',   'INF-FS'),
      _n('n3', 260, 150, 'Lint · Type Check',   'INF-FS'),
      _n('n4', 460, 100, 'Build · Docker',      'INF-FS'),
      _n('n5', 640, 100, 'Deploy · Staging',    'INF-WEB'),
      _n('n6', 820,  50, 'Smoke Test',          'INF-FS'),
      _n('n7', 820, 150, 'Deploy · Prod',       'INF-WEB'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'],['n6','n7']),
  },
  {
    id: 'TPL-002', category: 'CI/CD', source: 'github', owner: 'INF-FS',
    name: 'PR Auto-Review Bot', trigger: 'PR Opened',
    tags: ['github-actions', 'AI-review', 'code-quality'],
    desc: 'Static analysis + AI code review in parallel → post review comment → set merge status check.',
    nodes: [
      _n('n1',  60, 100, 'PR Opened',           'INF-FS'),
      _n('n2', 260,  50, 'Static Analysis',     'INF-FS'),
      _n('n3', 260, 150, 'AI Code Review',      'ARC-OPT'),
      _n('n4', 480, 100, 'Merge Comment',       'INF-FS'),
      _n('n5', 680, 100, 'Status Check Gate',   'INF-FS'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5']),
  },
  {
    id: 'TPL-003', category: 'CI/CD', source: 'github', owner: 'INF-HCK',
    name: 'Security Scan Gate', trigger: 'Push · any branch',
    tags: ['SAST', 'DAST', 'SCA', 'security'],
    desc: 'SAST + DAST + SCA dependency scan in parallel → aggregate findings → fail gate if critical → JIRA ticket.',
    nodes: [
      _n('n1',  60, 100, 'Push Trigger',        'INF-HCK'),
      _n('n2', 260,  30, 'SAST · CodeQL',       'INF-HCK'),
      _n('n3', 260, 100, 'DAST · ZAP Scan',     'INF-HCK'),
      _n('n4', 260, 170, 'SCA · Dependency',    'INF-HCK'),
      _n('n5', 500, 100, 'Aggregate Findings',  'INF-HCK'),
      _n('n6', 700, 100, 'Severity Gate',       'INF-HCK'),
      _n('n7', 860, 100, 'JIRA · Auto Ticket',  'INF-FS'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n1','n4'],['n2','n5'],['n3','n5'],['n4','n5'],['n5','n6'],['n6','n7']),
  },
  {
    id: 'TPL-004', category: 'CI/CD', source: 'github', owner: 'INF-FS',
    name: 'Semantic Release Pipeline', trigger: 'Merge to main',
    tags: ['semver', 'changelog', 'npm', 'release'],
    desc: 'Analyze commits (Conventional Commits) → bump version → generate CHANGELOG → publish → tag → notify.',
    nodes: [
      _n('n1',  60, 100, 'Merge · main',        'INF-FS'),
      _n('n2', 240, 100, 'Analyze Commits',     'INF-FS'),
      _n('n3', 420, 100, 'Bump Version · SemVer','INF-FS'),
      _n('n4', 600,  50, 'Generate CHANGELOG',  'INF-FS'),
      _n('n5', 600, 150, 'Publish · npm/PyPI',  'INF-FS'),
      _n('n6', 800, 100, 'Git Tag + Notify',    'INF-FS'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6']),
  },
  {
    id: 'TPL-005', category: 'CI/CD', source: 'n8n', owner: 'INF-FS',
    name: 'Infra Drift Detection', trigger: 'Schedule · 1h',
    tags: ['terraform', 'IaC', 'drift', 'ops'],
    desc: 'Run terraform plan → compare with last known state → detect drift → auto-open ticket → trigger remediation.',
    nodes: [
      _n('n1',  60, 100, 'Schedule · 1h',       'INF-FS'),
      _n('n2', 240, 100, 'Terraform Plan',      'INF-FS'),
      _n('n3', 440, 100, 'Drift Compare',       'INF-FS'),
      _n('n4', 640,  50, 'Alert · Slack',       'ARC-OPT'),
      _n('n5', 640, 150, 'JIRA Ticket',         'INF-FS'),
      _n('n6', 820, 100, 'Auto Remediate',      'INF-FS'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6']),
  },
  {
    id: 'TPL-006', category: 'CI/CD', source: 'github', owner: 'INF-WEB',
    name: 'Blue/Green Deployment', trigger: 'Tag · v*.*.*',
    tags: ['zero-downtime', 'kubernetes', 'blue-green'],
    desc: 'Build image → deploy to Green slot → run smoke tests → health checks → swap DNS → warm Green → retire Blue.',
    nodes: [
      _n('n1',  60, 100, 'Tag · Release',       'INF-WEB'),
      _n('n2', 240, 100, 'Build Image',         'INF-FS'),
      _n('n3', 420, 100, 'Deploy · Green',      'INF-WEB'),
      _n('n4', 600,  50, 'Smoke Tests',         'INF-FS'),
      _n('n5', 600, 150, 'Health Checks',       'INF-WEB'),
      _n('n6', 780, 100, 'Swap DNS · Route',    'INF-WEB'),
      _n('n7', 860, 100, 'Retire Blue',         'INF-WEB'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'],['n6','n7']),
  },
  {
    id: 'TPL-007', category: 'CI/CD', source: 'n8n', owner: 'INF-FS',
    name: 'Auto Rollback Trigger', trigger: 'Error Rate > 1%',
    tags: ['monitoring', 'rollback', 'SRE', 'ops'],
    desc: 'Monitor error spike → fetch canary metrics → compare baseline → decide rollback → execute → page on-call.',
    nodes: [
      _n('n1',  60, 100, 'Monitor · Error %',   'INF-FS'),
      _n('n2', 260, 100, 'Fetch Canary Metrics','INF-FS'),
      _n('n3', 460, 100, 'Compare Baseline',    'ARC-OPT'),
      _n('n4', 640, 100, 'Decide: Rollback?',   'ARC-OPT'),
      _n('n5', 820,  50, 'Execute Rollback',    'INF-WEB'),
      _n('n6', 820, 150, 'Page On-Call',        'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6']),
  },
  {
    id: 'TPL-008', category: 'CI/CD', source: 'github', owner: 'INF-SC',
    name: 'Multi-Cloud Sync Pipeline', trigger: 'File change · S3',
    tags: ['aws', 'gcp', 'azure', 'multi-cloud'],
    desc: 'Detect change in S3 → validate → replicate to GCS + Azure Blob in parallel → checksum verify → log.',
    nodes: [
      _n('n1',  60, 100, 'S3 Event · Change',   'INF-SC'),
      _n('n2', 240, 100, 'Validate Payload',    'INF-SC'),
      _n('n3', 420,  50, 'Replicate · GCS',     'INF-SC'),
      _n('n4', 420, 150, 'Replicate · Azure',   'INF-SC'),
      _n('n5', 640, 100, 'Checksum Verify',     'INF-SC'),
      _n('n6', 820, 100, 'Log · Audit Trail',   'INF-SC'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6']),
  },

  // ── Content & Social (8) ────────────────────────────────────────────────
  {
    id: 'TPL-009', category: 'CONTENT', source: 'n8n', owner: 'CNT-HUB',
    name: 'Content Repurpose Engine', trigger: 'YouTube Publish Event',
    tags: ['repurpose', 'AI', 'multi-platform', 'content'],
    desc: 'One video publish triggers 4 parallel rewrite agents: X thread, IG caption, newsletter snippet, LinkedIn post → schedule all.',
    nodes: [
      _n('n1',  60, 110, 'YT Publish Event',    'CNT-YT'),
      _n('n2', 260,  30, 'X Thread · AI',       'CNT-X'),
      _n('n3', 260,  90, 'IG Caption · AI',     'CNT-IG'),
      _n('n4', 260, 150, 'Newsletter · AI',     'CNT-NWS'),
      _n('n5', 260, 210, 'Twitch Highlight',    'CNT-TW'),
      _n('n6', 520, 120, 'Schedule · All',      'CNT-HUB'),
      _n('n7', 720, 120, 'Publish Queue',       'CNT-HUB'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n1','n4'],['n1','n5'],['n2','n6'],['n3','n6'],['n4','n6'],['n5','n6'],['n6','n7']),
  },
  {
    id: 'TPL-010', category: 'CONTENT', source: 'n8n', owner: 'CNT-HUB',
    name: 'SEO Content Pipeline', trigger: 'Keyword Brief Input',
    tags: ['SEO', 'content-writing', 'AI', 'publish'],
    desc: 'Keyword → SERP research → AI brief → AI draft → SEO optimize → human review gate → publish → rank track.',
    nodes: [
      _n('n1',  60, 100, 'Keyword Input',       'CNT-HUB'),
      _n('n2', 230, 100, 'SERP Research',       'ARC-SCT'),
      _n('n3', 400, 100, 'AI · Brief Gen',      'ARC-OPT'),
      _n('n4', 570, 100, 'AI · Draft',          'ARC-FRG'),
      _n('n5', 720,  50, 'SEO Optimize',        'CNT-HUB'),
      _n('n6', 720, 150, 'Human Review',        'CNT-HUB'),
      _n('n7', 880, 100, 'Publish + Track',     'CNT-HUB'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']),
  },
  {
    id: 'TPL-011', category: 'CONTENT', source: 'n8n', owner: 'CNT-HUB',
    name: 'Social Media Scheduler', trigger: 'Content Calendar · Daily',
    tags: ['scheduling', 'social', 'automation', 'buffer'],
    desc: 'Pull content calendar → classify platform → approval gate → enqueue → multi-platform publish → analytics collect.',
    nodes: [
      _n('n1',  60, 100, 'Calendar Pull',       'CNT-HUB'),
      _n('n2', 240, 100, 'Classify Platform',   'CNT-HUB'),
      _n('n3', 420, 100, 'Approval Gate',       'CNT-HUB'),
      _n('n4', 600, 100, 'Enqueue Posts',       'CNT-HUB'),
      _n('n5', 780, 100, 'Publish · All',       'CNT-HUB'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5']),
  },
  {
    id: 'TPL-012', category: 'CONTENT', source: 'n8n', owner: 'CNT-NWS',
    name: 'Newsletter Automation', trigger: 'Weekly · Monday 08:00',
    tags: ['newsletter', 'email', 'beehiiv', 'AI'],
    desc: 'Collect top stories → AI summarize → generate issue → add trade idea section → design → send → analytics.',
    nodes: [
      _n('n1',  60, 100, 'Trigger · Mon 08:00', 'CNT-NWS'),
      _n('n2', 240,  50, 'Fetch Top Stories',   'ARC-SCT'),
      _n('n3', 240, 150, 'Pull Trade Idea',     'FIN-TRD'),
      _n('n4', 460, 100, 'AI · Compose Issue',  'ARC-FRG'),
      _n('n5', 640, 100, 'Design · HTML',       'CNT-NWS'),
      _n('n6', 820, 100, 'Send + Analytics',    'CNT-NWS'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6']),
  },
  {
    id: 'TPL-013', category: 'CONTENT', source: 'n8n', owner: 'CNT-YT',
    name: 'YouTube Upload Flow', trigger: 'Render Complete Event',
    tags: ['youtube', 'thumbnail', 'SEO', 'metadata'],
    desc: 'Video render done → AI generate thumbnail variants → SEO metadata → upload → cards + endscreens → notify.',
    nodes: [
      _n('n1',  60, 100, 'Render Complete',     'CNT-YT'),
      _n('n2', 240,  50, 'AI · Thumbnail × 3', 'ARC-FRG'),
      _n('n3', 240, 150, 'SEO Metadata · AI',  'CNT-YT'),
      _n('n4', 460, 100, 'Upload · YouTube',    'CNT-YT'),
      _n('n5', 640, 100, 'Cards + End Screen',  'CNT-YT'),
      _n('n6', 820, 100, 'Notify · Telegram',   'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6']),
  },
  {
    id: 'TPL-014', category: 'CONTENT', source: 'jarvis', owner: 'CNT-X',
    name: 'Viral Thread Machine', trigger: 'Trend Detected',
    tags: ['X', 'thread', 'viral', 'AI-writing'],
    desc: 'Detect trending topic → score relevance → AI generate hook + 8 tweets + CTA → schedule → post → monitor engagement.',
    nodes: [
      _n('n1',  60, 100, 'Trend Detect · API', 'ARC-SCT'),
      _n('n2', 260, 100, 'Score Relevance',    'ARC-OPT'),
      _n('n3', 460, 100, 'AI · Thread Write',  'ARC-FRG'),
      _n('n4', 640,  50, 'Schedule Optimal',   'CNT-X'),
      _n('n5', 640, 150, 'Post · X API',       'CNT-X'),
      _n('n6', 820, 100, 'Monitor Engagement', 'CNT-X'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6']),
  },
  {
    id: 'TPL-015', category: 'CONTENT', source: 'n8n', owner: 'CNT-HUB',
    name: 'Podcast → Multi-Platform', trigger: 'Episode Upload',
    tags: ['podcast', 'transcription', 'repurpose', 'clips'],
    desc: 'Upload audio → transcribe (Whisper) → extract clips → blog post → show notes → social snippets → publish all.',
    nodes: [
      _n('n1',  60, 100, 'Episode Upload',     'CNT-HUB'),
      _n('n2', 240, 100, 'Transcribe · Whisper','ARC-OPT'),
      _n('n3', 440,  30, 'Extract Clips · AI', 'ARC-FRG'),
      _n('n4', 440, 100, 'Blog Post · AI',     'CNT-NWS'),
      _n('n5', 440, 170, 'Show Notes · AI',    'CNT-HUB'),
      _n('n6', 680, 100, 'Publish All',        'CNT-HUB'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n2','n4'],['n2','n5'],['n3','n6'],['n4','n6'],['n5','n6']),
  },
  {
    id: 'TPL-016', category: 'CONTENT', source: 'n8n', owner: 'CNT-HUB',
    name: 'Brand Monitor + Response', trigger: 'Continuous · 5min',
    tags: ['brand', 'monitoring', 'sentiment', 'social-listening'],
    desc: 'Listen mentions → classify intent → sentiment score → AI draft response → human approval gate → post reply.',
    nodes: [
      _n('n1',  60, 100, 'Listen · Mentions',  'CNT-HUB'),
      _n('n2', 240, 100, 'Classify Intent',    'ARC-OPT'),
      _n('n3', 420, 100, 'Sentiment Score',    'ARC-OPT'),
      _n('n4', 600, 100, 'AI Draft Response',  'ARC-FRG'),
      _n('n5', 780, 100, 'Human Approval',     'CNT-HUB'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5']),
  },

  // ── Trading & Finance (6) ────────────────────────────────────────────────
  {
    id: 'TPL-017', category: 'TRADING', source: 'jarvis', owner: 'FIN-TRD',
    name: 'Market Scanner · Signals', trigger: 'Tick · Real-time',
    tags: ['screener', 'signals', 'alerts', 'trading'],
    desc: 'Screener → signal detection (momentum + mean-rev) → filter noise → score → alert Telegram → log to DB.',
    nodes: [
      _n('n1',  60, 100, 'Tick · Screener',    'FIN-BOT'),
      _n('n2', 260,  50, 'Signal · Momentum',  'FIN-TRD'),
      _n('n3', 260, 150, 'Signal · Mean-Rev',  'FIN-TRD'),
      _n('n4', 480, 100, 'Filter + Score',     'ARC-OPT'),
      _n('n5', 660,  50, 'Alert · Telegram',   'ARC-OPT'),
      _n('n6', 660, 150, 'Log · Database',     'INF-FS'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6']),
  },
  {
    id: 'TPL-018', category: 'TRADING', source: 'jarvis', owner: 'FIN-TRD',
    name: 'Risk Report Automation', trigger: 'Daily 17:00 Close',
    tags: ['risk', 'VaR', 'reporting', 'pdf'],
    desc: 'Pull positions at close → calculate VaR + drawdown + exposure → AI risk narrative → PDF generate → email CFO.',
    nodes: [
      _n('n1',  60, 100, 'Market Close',       'FIN-BOT'),
      _n('n2', 240, 100, 'Pull Positions',     'FIN-TRD'),
      _n('n3', 440, 100, 'Calculate VaR + DD', 'FIN-TRD'),
      _n('n4', 640, 100, 'AI Risk Narrative',  'ARC-OPT'),
      _n('n5', 820, 100, 'PDF + Email CFO',    'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5']),
  },
  {
    id: 'TPL-019', category: 'TRADING', source: 'jarvis', owner: 'FIN-TRD',
    name: 'Portfolio Rebalancer', trigger: 'Drift Threshold > 5%',
    tags: ['rebalancing', 'portfolio', 'execution'],
    desc: 'Detect drift → compute target weights → calculate trades → risk check → execute orders → confirm + notify.',
    nodes: [
      _n('n1',  60, 100, 'Drift Detect > 5%',  'FIN-TRD'),
      _n('n2', 240, 100, 'Compute Weights',    'FIN-TRD'),
      _n('n3', 420, 100, 'Calc Trade List',    'FIN-TRD'),
      _n('n4', 600, 100, 'Risk Gate · VaR',    'ARC-OPT'),
      _n('n5', 780,  50, 'Execute Orders',     'FIN-BOT'),
      _n('n6', 780, 150, 'Confirm + Notify',   'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6']),
  },
  {
    id: 'TPL-020', category: 'TRADING', source: 'jarvis', owner: 'FIN-BOT',
    name: 'DCA Bot Pipeline', trigger: 'Schedule · Weekly',
    tags: ['DCA', 'BTC', 'automation', 'crypto'],
    desc: 'Weekly trigger → check current price vs 20w MA → calculate DCA size → execute buy → log → update dashboard.',
    nodes: [
      _n('n1',  60, 100, 'Weekly Trigger',     'FIN-BOT'),
      _n('n2', 240, 100, 'Price vs 20W MA',    'FIN-TRD'),
      _n('n3', 420, 100, 'Calc DCA Size',      'FIN-TRD'),
      _n('n4', 600, 100, 'Execute Buy',        'FIN-BOT'),
      _n('n5', 780, 100, 'Log + Dashboard',    'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5']),
  },
  {
    id: 'TPL-021', category: 'TRADING', source: 'n8n', owner: 'FIN-TRD',
    name: 'Earnings Alert System', trigger: 'Pre-market · Earnings Watch',
    tags: ['earnings', 'research', 'alerts', 'fundamental'],
    desc: 'Detect earnings event → scrape filing + analyst estimates → AI research brief → format → Telegram alert → archive.',
    nodes: [
      _n('n1',  60, 100, 'Earnings Watch',     'FIN-TRD'),
      _n('n2', 240,  50, 'Scrape 8-K Filing',  'INF-WS'),
      _n('n3', 240, 150, 'Analyst Estimates',  'INF-WS'),
      _n('n4', 460, 100, 'AI Research Brief',  'ARC-OPT'),
      _n('n5', 660, 100, 'Alert + Archive',    'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5']),
  },
  {
    id: 'TPL-022', category: 'TRADING', source: 'jarvis', owner: 'FIN-TRD',
    name: 'Options Flow Monitor', trigger: 'Stream · Unusual Whales',
    tags: ['options', 'dark-pool', 'flow', 'alert'],
    desc: 'Stream unusual options flow → filter by size > $1M + DTE < 21 → score sentiment → alert with context.',
    nodes: [
      _n('n1',  60, 100, 'Flow Stream',        'FIN-TRD'),
      _n('n2', 260, 100, 'Filter · Size+DTE',  'FIN-TRD'),
      _n('n3', 460, 100, 'Sentiment Score',    'ARC-OPT'),
      _n('n4', 660,  50, 'Alert · Telegram',   'ARC-OPT'),
      _n('n5', 660, 150, 'Log + Backfill',     'FIN-BOT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5']),
  },

  // ── AI & ML (6) ─────────────────────────────────────────────────────────
  {
    id: 'TPL-023', category: 'AI/ML', source: 'github', owner: 'ARC-FRG',
    name: 'RAG Pipeline Builder', trigger: 'Document Ingest',
    tags: ['RAG', 'embeddings', 'vector-db', 'langchain'],
    desc: 'Ingest docs → chunk + clean → embed (OpenAI/Cohere) → upsert Pinecone/Qdrant → query → rerank → respond.',
    nodes: [
      _n('n1',  60, 100, 'Doc Ingest',         'INF-WS'),
      _n('n2', 240, 100, 'Chunk + Clean',      'ARC-FRG'),
      _n('n3', 420, 100, 'Embed · OpenAI',     'ARC-FRG'),
      _n('n4', 600, 100, 'Upsert · Pinecone',  'INF-SC'),
      _n('n5', 780,  50, 'Query + Rerank',     'ARC-OPT'),
      _n('n6', 780, 150, 'Generate Response',  'ARC-FRG'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n6']),
  },
  {
    id: 'TPL-024', category: 'AI/ML', source: 'github', owner: 'ARC-FRG',
    name: 'Model Fine-Tune Pipeline', trigger: 'Dataset Ready Event',
    tags: ['fine-tuning', 'LoRA', 'eval', 'MLflow'],
    desc: 'Dataset → validate + dedupe → train (LoRA/QLoRA) → evaluate vs baseline → compare evals → promote if better.',
    nodes: [
      _n('n1',  60, 100, 'Dataset Ready',      'INF-SC'),
      _n('n2', 240, 100, 'Validate + Dedupe',  'ARC-FRG'),
      _n('n3', 440, 100, 'Train · LoRA',       'INF-SC'),
      _n('n4', 640,  50, 'Eval · Benchmarks',  'ARC-FRG'),
      _n('n5', 640, 150, 'Eval · Baseline',    'ARC-FRG'),
      _n('n6', 820, 100, 'Promote if Better',  'ARC-FRG'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6']),
  },
  {
    id: 'TPL-025', category: 'AI/ML', source: 'github', owner: 'ARC-OPT',
    name: 'LLM Eval Harness', trigger: 'Model Version Change',
    tags: ['evals', 'LLM', 'benchmarks', 'CI'],
    desc: 'Run test prompts through new + old model → score with judge LLM → aggregate → generate report → fail if regressed.',
    nodes: [
      _n('n1',  60, 100, 'Model Version Bump', 'ARC-FRG'),
      _n('n2', 240,  50, 'Run New Model',      'INF-SC'),
      _n('n3', 240, 150, 'Run Old Model',      'INF-SC'),
      _n('n4', 460, 100, 'Judge · LLM Score',  'ARC-OPT'),
      _n('n5', 640, 100, 'Aggregate + Report', 'ARC-OPT'),
      _n('n6', 820, 100, 'Gate: Pass/Fail',    'ARC-FRG'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6']),
  },
  {
    id: 'TPL-026', category: 'AI/ML', source: 'n8n', owner: 'ARC-FRG',
    name: 'AI Agent Spawner', trigger: 'Task Input',
    tags: ['agent', 'multi-agent', 'decompose', 'crewai'],
    desc: 'Receive complex task → decompose into sub-tasks → spawn specialized agents in parallel → aggregate outputs → deliver.',
    nodes: [
      _n('n1',  60, 100, 'Task Input',         'ARC-OPT'),
      _n('n2', 240, 100, 'Decompose · Planner','ARC-OPT'),
      _n('n3', 440,  30, 'Agent · Research',   'ARC-SCT'),
      _n('n4', 440, 100, 'Agent · Code',       'ARC-FRG'),
      _n('n5', 440, 170, 'Agent · Write',      'CNT-HUB'),
      _n('n6', 660, 100, 'Aggregate Output',   'ARC-OPT'),
      _n('n7', 820, 100, 'Deliver Result',     'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n2','n4'],['n2','n5'],['n3','n6'],['n4','n6'],['n5','n6'],['n6','n7']),
  },
  {
    id: 'TPL-027', category: 'AI/ML', source: 'n8n', owner: 'ARC-FRG',
    name: 'Prompt A/B Tester', trigger: 'New Prompt Version',
    tags: ['prompting', 'A/B', 'optimization', 'evals'],
    desc: 'New prompt variant → run both A and B on test set → score with rubric → statistical significance test → promote winner.',
    nodes: [
      _n('n1',  60, 100, 'New Prompt v2',      'ARC-FRG'),
      _n('n2', 240,  50, 'Run Variant A',      'INF-SC'),
      _n('n3', 240, 150, 'Run Variant B',      'INF-SC'),
      _n('n4', 460, 100, 'Score + Stats Test', 'ARC-OPT'),
      _n('n5', 640, 100, 'Select Winner',      'ARC-FRG'),
      _n('n6', 820, 100, 'Promote + Monitor',  'ARC-FRG'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6']),
  },
  {
    id: 'TPL-028', category: 'AI/ML', source: 'github', owner: 'INF-WS',
    name: 'Data Labeling Pipeline', trigger: 'Raw Dataset Upload',
    tags: ['labeling', 'annotation', 'active-learning', 'data'],
    desc: 'Raw data → auto-label easy cases → route hard cases to human → review → export → active learning feedback loop.',
    nodes: [
      _n('n1',  60, 100, 'Raw Dataset',        'INF-WS'),
      _n('n2', 240, 100, 'Auto-Label · Model', 'ARC-FRG'),
      _n('n3', 440,  50, 'High Confidence',    'INF-WS'),
      _n('n4', 440, 150, 'Human Review Queue', 'INF-WS'),
      _n('n5', 660, 100, 'Merge + Export',     'INF-WS'),
      _n('n6', 820, 100, 'Active Learning FB', 'ARC-FRG'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6']),
  },

  // ── Data & Analytics (6) ────────────────────────────────────────────────
  {
    id: 'TPL-029', category: 'DATA', source: 'n8n', owner: 'INF-WS',
    name: 'ETL Pipeline · Full Stack', trigger: 'Schedule · 03:00',
    tags: ['ETL', 'dbt', 'Snowflake', 'data-warehouse'],
    desc: 'Extract from 5 sources → validate schema → transform (dbt) → load to Snowflake → verify row counts → alert on error.',
    nodes: [
      _n('n1',  60, 100, 'Extract · 5 Sources','INF-WS'),
      _n('n2', 240, 100, 'Validate Schema',    'INF-FS'),
      _n('n3', 420, 100, 'Transform · dbt',    'INF-FS'),
      _n('n4', 600, 100, 'Load · Snowflake',   'INF-SC'),
      _n('n5', 780,  50, 'Verify Row Counts',  'INF-FS'),
      _n('n6', 780, 150, 'Alert on Error',     'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6']),
  },
  {
    id: 'TPL-030', category: 'DATA', source: 'n8n', owner: 'INF-SC',
    name: 'Real-time Dashboard Updater', trigger: 'Stream · 1s interval',
    tags: ['streaming', 'Kafka', 'dashboard', 'real-time'],
    desc: 'Kafka stream → aggregate 1m window → enrich with meta → push to Grafana/Retool → alert on anomaly.',
    nodes: [
      _n('n1',  60, 100, 'Kafka Stream',       'INF-SC'),
      _n('n2', 240, 100, 'Aggregate · 1m',     'INF-SC'),
      _n('n3', 440, 100, 'Enrich Meta',        'INF-WS'),
      _n('n4', 620,  50, 'Push · Dashboard',   'INF-SC'),
      _n('n5', 620, 150, 'Alert · Anomaly',    'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5']),
  },
  {
    id: 'TPL-031', category: 'DATA', source: 'n8n', owner: 'ARC-OPT',
    name: 'Anomaly Detection Flow', trigger: 'Continuous Stream',
    tags: ['anomaly', 'ML', 'alerting', 'monitoring'],
    desc: 'Time-series stream → statistical window → isolation forest detect → severity score → alert → auto-investigate → ticket.',
    nodes: [
      _n('n1',  60, 100, 'TS Stream',          'INF-SC'),
      _n('n2', 220, 100, 'Stat Window',        'ARC-OPT'),
      _n('n3', 380, 100, 'Isolation Forest',   'ARC-OPT'),
      _n('n4', 540, 100, 'Severity Score',     'ARC-OPT'),
      _n('n5', 700,  50, 'Alert · PagerDuty',  'ARC-OPT'),
      _n('n6', 700, 150, 'Auto Investigate',   'ARC-FRG'),
      _n('n7', 860, 100, 'JIRA Ticket',        'INF-FS'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']),
  },
  {
    id: 'TPL-032', category: 'DATA', source: 'github', owner: 'ARC-OPT',
    name: 'A/B Test Lifecycle', trigger: 'Feature Flag Toggle',
    tags: ['A/B', 'experimentation', 'statsig', 'product'],
    desc: 'Design experiment → deploy flag → monitor traffic split → collect metrics → power + significance test → decide → ship.',
    nodes: [
      _n('n1',  60, 100, 'Design Experiment',  'ARC-OPT'),
      _n('n2', 240, 100, 'Deploy Feature Flag','INF-FS'),
      _n('n3', 440, 100, 'Monitor Traffic',    'INF-SC'),
      _n('n4', 620, 100, 'Significance Test',  'ARC-OPT'),
      _n('n5', 800,  50, 'Ship Winner',        'INF-FS'),
      _n('n6', 800, 150, 'Document + Learn',   'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6']),
  },
  {
    id: 'TPL-033', category: 'DATA', source: 'n8n', owner: 'ARC-SCT',
    name: 'Competitor Monitor', trigger: 'Schedule · Daily 06:00',
    tags: ['competitive-intel', 'scraping', 'AI', 'alerts'],
    desc: 'Scrape competitor sites + Crunchbase + LinkedIn → diff vs yesterday → AI summary of changes → alert if significant.',
    nodes: [
      _n('n1',  60, 100, 'Schedule · 06:00',   'ARC-SCT'),
      _n('n2', 240,  50, 'Scrape Sites',       'INF-WS'),
      _n('n3', 240, 150, 'Pull Crunchbase',    'INF-WS'),
      _n('n4', 460, 100, 'Diff vs Yesterday',  'ARC-SCT'),
      _n('n5', 640, 100, 'AI Summary',         'ARC-OPT'),
      _n('n6', 820, 100, 'Alert + Archive',    'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6']),
  },
  {
    id: 'TPL-034', category: 'DATA', source: 'n8n', owner: 'INF-FS',
    name: 'Data Quality Checker', trigger: 'Post-Load Event',
    tags: ['data-quality', 'great-expectations', 'dbt', 'alerts'],
    desc: 'Run Great Expectations suite → flag failed checks → AI explain root cause → route to owner → auto-heal if possible.',
    nodes: [
      _n('n1',  60, 100, 'Post-Load Event',    'INF-FS'),
      _n('n2', 240, 100, 'GE Suite · Run',     'INF-FS'),
      _n('n3', 440,  50, 'All Pass',           'INF-FS'),
      _n('n4', 440, 150, 'Failures Detected',  'INF-FS'),
      _n('n5', 640, 150, 'AI Root Cause',      'ARC-OPT'),
      _n('n6', 800, 150, 'Route + Auto-Heal',  'INF-FS'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n2','n4'],['n4','n5'],['n5','n6']),
  },

  // ── Business Ops (6) ────────────────────────────────────────────────────
  {
    id: 'TPL-035', category: 'OPS', source: 'n8n', owner: 'ARC-OPT',
    name: 'Lead Qualification Pipeline', trigger: 'Form Submit / Inbound',
    tags: ['CRM', 'lead-scoring', 'sales', 'automation'],
    desc: 'Inbound lead → enrich (Clearbit + LinkedIn) → score (ICP fit + intent) → route to right rep → CRM update → notify.',
    nodes: [
      _n('n1',  60, 100, 'Lead Inbound',       'ARC-OPT'),
      _n('n2', 240,  50, 'Enrich · Clearbit',  'INF-WS'),
      _n('n3', 240, 150, 'Enrich · LinkedIn',  'INF-WS'),
      _n('n4', 460, 100, 'Score · ICP Fit',    'ARC-OPT'),
      _n('n5', 640, 100, 'Route to Rep',       'ARC-OPT'),
      _n('n6', 820, 100, 'CRM + Notify',       'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6']),
  },
  {
    id: 'TPL-036', category: 'OPS', source: 'n8n', owner: 'LGL-TAX',
    name: 'Invoice Processing Automation', trigger: 'Email Attachment',
    tags: ['invoice', 'OCR', 'AP', 'approval'],
    desc: 'Receive invoice email → OCR extract fields → match to PO → route for approval (>$10k = CFO) → trigger payment → archive.',
    nodes: [
      _n('n1',  60, 100, 'Invoice Email',      'LGL-TAX'),
      _n('n2', 240, 100, 'OCR · Extract',      'ARC-FRG'),
      _n('n3', 420, 100, 'Match · PO Number',  'LGL-TAX'),
      _n('n4', 600, 100, 'Approval Route',     'LGL-TAX'),
      _n('n5', 780,  50, 'Trigger Payment',    'LGL-TAX'),
      _n('n6', 780, 150, 'Archive + Audit',    'LGL-TAX'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6']),
  },
  {
    id: 'TPL-037', category: 'OPS', source: 'n8n', owner: 'ARC-OPT',
    name: 'Customer Onboarding Flow', trigger: 'Payment Confirmed',
    tags: ['onboarding', 'SaaS', 'email', 'automation'],
    desc: 'Payment confirmed → provision account → welcome sequence (D0/D3/D7) → assign CSM → activate features → NPS at D30.',
    nodes: [
      _n('n1',  60, 100, 'Payment Confirmed',  'ARC-OPT'),
      _n('n2', 240, 100, 'Provision Account',  'INF-FS'),
      _n('n3', 420,  50, 'Welcome D0 Email',   'CNT-NWS'),
      _n('n4', 420, 150, 'Assign CSM',         'ARC-OPT'),
      _n('n5', 640, 100, 'Activate Features',  'INF-FS'),
      _n('n6', 820, 100, 'NPS Survey · D30',   'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6']),
  },
  {
    id: 'TPL-038', category: 'OPS', source: 'n8n', owner: 'LGL-LAW',
    name: 'Contract Review Pipeline', trigger: 'Contract Upload',
    tags: ['contracts', 'legal', 'AI-review', 'e-sign'],
    desc: 'Upload contract → AI extract clauses → flag risky terms → route to counsel → human review → e-sign → archive.',
    nodes: [
      _n('n1',  60, 100, 'Contract Upload',    'LGL-LAW'),
      _n('n2', 240, 100, 'AI · Extract',       'ARC-FRG'),
      _n('n3', 440,  50, 'Flag Risky Terms',   'LGL-LAW'),
      _n('n4', 440, 150, 'Standard Clauses',   'LGL-LAW'),
      _n('n5', 660, 100, 'Counsel Review',     'LGL-LAW'),
      _n('n6', 820, 100, 'E-Sign + Archive',   'LGL-LAW'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6']),
  },
  {
    id: 'TPL-039', category: 'OPS', source: 'n8n', owner: 'ARC-OPT',
    name: 'Support Ticket Triage', trigger: 'New Ticket Created',
    tags: ['support', 'triage', 'AI', 'zendesk'],
    desc: 'Ticket in → AI classify (bug/feature/billing/general) → severity score → auto-reply standard cases → assign + SLA track.',
    nodes: [
      _n('n1',  60, 100, 'Ticket Created',     'ARC-OPT'),
      _n('n2', 240, 100, 'AI Classify',        'ARC-FRG'),
      _n('n3', 440,  50, 'Auto-Reply · Low',   'ARC-OPT'),
      _n('n4', 440, 150, 'Assign · High',      'ARC-OPT'),
      _n('n5', 640, 100, 'SLA Timer Start',    'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5']),
  },
  {
    id: 'TPL-040', category: 'OPS', source: 'jarvis', owner: 'ARC-OPT',
    name: 'Morning Intelligence Brief', trigger: 'Daily 05:45',
    tags: ['morning-brief', 'AI', 'digest', 'automation'],
    desc: 'At 05:45: fetch news + market scan + calendar + tasks in parallel → AI compose brief → deliver to Bridge + voice.',
    nodes: [
      _n('n1',  60, 120, 'Trigger · 05:45',    'ARC-OPT'),
      _n('n2', 240,  30, 'News · Top Stories', 'ARC-SCT'),
      _n('n3', 240,  90, 'Market Pre-Open',    'FIN-TRD'),
      _n('n4', 240, 150, 'Calendar · Today',   'ARC-OPT'),
      _n('n5', 240, 210, 'Tasks · Priority',   'ARC-OPT'),
      _n('n6', 500, 120, 'AI · Compose Brief', 'ARC-FRG'),
      _n('n7', 720,  70, 'Deliver · Bridge',   'ARC-OPT'),
      _n('n8', 720, 170, 'Deliver · Voice',    'ARC-OPT'),
    ],
    edges: _e(['n1','n2'],['n1','n3'],['n1','n4'],['n1','n5'],['n2','n6'],['n3','n6'],['n4','n6'],['n5','n6'],['n6','n7'],['n6','n8']),
  },

  // ── GROWTH (8) ──────────────────────────────────────────────────────────────
  { id:'TPL-041',category:'GROWTH',source:'jarvis',owner:'ARC-OPT',
    name:'Viral Loop Engine',trigger:'User Share Event',tags:['viral','loop','referral','k-factor'],
    desc:'User shares → track referral source → reward gate → notify invitees → convert → reward sender → calc k-factor.',
    nodes:[_n('n1',60,100,'Share Event','ARC-OPT'),_n('n2',240,100,'Track Referral','ARC-OPT'),_n('n3',420,50,'Reward Gate','ARC-OPT'),_n('n4',420,150,'Notify Invitees','CNT-HUB'),_n('n5',620,100,'Convert + Reward','ARC-OPT'),_n('n6',800,100,'K-Factor Calc','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6'])},
  { id:'TPL-042',category:'GROWTH',source:'n8n',owner:'ARC-OPT',
    name:'Product-Led Growth Pipeline',trigger:'Trial Signup',tags:['PLG','activation','aha-moment','onboarding'],
    desc:'Trial signup → track activation milestones → detect aha-moment → trigger upgrade nudge → A/B convert offer → celebrate + retain.',
    nodes:[_n('n1',60,100,'Trial Signup','ARC-OPT'),_n('n2',240,100,'Track Milestones','ARC-OPT'),_n('n3',420,100,'Aha-Moment Detect','ARC-OPT'),_n('n4',600,50,'Upgrade Nudge','CNT-NWS'),_n('n5',600,150,'A/B Offer','ARC-OPT'),_n('n6',800,100,'Celebrate + Retain','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-043',category:'GROWTH',source:'n8n',owner:'CNT-HUB',
    name:'Referral Program Automation',trigger:'Referral Link Click',tags:['referral','affiliate','reward','double-sided'],
    desc:'Referral click → attribute source → sign-up gate → dual reward calc (sender+receiver) → email rewards → track attribution → report.',
    nodes:[_n('n1',60,100,'Referral Click','CNT-HUB'),_n('n2',240,100,'Attribute Source','ARC-OPT'),_n('n3',420,100,'Sign-Up Gate','ARC-OPT'),_n('n4',600,50,'Dual Reward Calc','ARC-OPT'),_n('n5',600,150,'Email Rewards','CNT-NWS'),_n('n6',800,100,'Attribution Log','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-044',category:'GROWTH',source:'n8n',owner:'ARC-OPT',
    name:'User Activation Sprint',trigger:'Day 1 Post-Signup',tags:['activation','onboarding','D1','D3','D7'],
    desc:'D1 → guide to first value event → D3 follow-up if not activated → D7 human touch → inactivate path to cancel save.',
    nodes:[_n('n1',60,100,'D1 Trigger','ARC-OPT'),_n('n2',240,100,'First Value Event?','ARC-OPT'),_n('n3',420,50,'Activated Path','ARC-OPT'),_n('n4',420,150,'D3 Nudge Email','CNT-NWS'),_n('n5',620,150,'D7 Human Touch','ARC-OPT'),_n('n6',800,100,'Deepen + Expand','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n6'],['n4','n5'],['n5','n6'])},
  { id:'TPL-045',category:'GROWTH',source:'n8n',owner:'CNT-HUB',
    name:'Influencer Outreach Pipeline',trigger:'Target List Import',tags:['influencer','outreach','UGC','collaboration'],
    desc:'Import targets → enrich profile + engagement stats → score fit → personalized outreach → track responses → negotiate → contract → brief.',
    nodes:[_n('n1',60,100,'Import Targets','CNT-HUB'),_n('n2',240,100,'Enrich + Score','ARC-SCT'),_n('n3',420,100,'Filter High-Fit','ARC-OPT'),_n('n4',600,100,'Personalized DM','CNT-HUB'),_n('n5',780,50,'Contract + Brief','LGL-LAW'),_n('n6',780,150,'Track Response','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-046',category:'GROWTH',source:'jarvis',owner:'ARC-OPT',
    name:'Churn Prevention Engine',trigger:'Health Score Drop < 60',tags:['churn','retention','health-score','CSM'],
    desc:'Health score drop → classify risk tier → trigger playbook (email/CSM/incentive) → measure engagement lift → escalate if declining.',
    nodes:[_n('n1',60,100,'Health Score Drop','ARC-OPT'),_n('n2',240,100,'Risk Classification','ARC-OPT'),_n('n3',420,50,'Email Playbook','CNT-NWS'),_n('n4',420,150,'CSM Task','ARC-OPT'),_n('n5',620,100,'Measure Lift','ARC-OPT'),_n('n6',800,100,'Escalate / Close','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6'])},
  { id:'TPL-047',category:'GROWTH',source:'n8n',owner:'ARC-OPT',
    name:'Growth Experiment Tracker',trigger:'New Experiment Launch',tags:['experimentation','ICE','growth','hypothesis'],
    desc:'New hypothesis → ICE score → approve gate → run experiment → collect results → stat significance → ship or kill → document.',
    nodes:[_n('n1',60,100,'Hypothesis','ARC-OPT'),_n('n2',240,100,'ICE Score','ARC-OPT'),_n('n3',420,100,'Approve Gate','ARC-OPT'),_n('n4',600,100,'Run Experiment','INF-FS'),_n('n5',780,50,'Stat Test','ARC-OPT'),_n('n6',780,150,'Ship / Kill','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-048',category:'GROWTH',source:'n8n',owner:'ARC-OPT',
    name:'Revenue Expansion Automation',trigger:'Usage Threshold Hit',tags:['upsell','expansion','MRR','PQL'],
    desc:'Usage spike → qualify PQL → run expansion playbook → CSM trigger → upsell offer → contract amendment → log MRR expansion.',
    nodes:[_n('n1',60,100,'Usage Spike','ARC-OPT'),_n('n2',240,100,'PQL Qualify','ARC-OPT'),_n('n3',420,100,'Expansion Playbook','ARC-OPT'),_n('n4',600,50,'CSM + Offer','ARC-OPT'),_n('n5',600,150,'Contract Amend','LGL-LAW'),_n('n6',800,100,'Log MRR Delta','FIN-TRD')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},

  // ── SALES (8) ──────────────────────────────────────────────────────────────
  { id:'TPL-049',category:'SALES',source:'n8n',owner:'ARC-OPT',
    name:'Cold Outreach Sequencer',trigger:'Prospect List Upload',tags:['cold-email','sequences','reply','personalization'],
    desc:'Upload prospects → enrich (LinkedIn + Clearbit) → AI personalize → D1 email → D3 follow-up → D7 breakup → reply auto-detect → book.',
    nodes:[_n('n1',60,100,'Prospect Upload','ARC-OPT'),_n('n2',240,100,'Enrich + Personalize','INF-WS'),_n('n3',420,100,'D1 Email · AI','CNT-NWS'),_n('n4',600,50,'D3 Follow-Up','CNT-NWS'),_n('n5',600,150,'Reply Detected?','ARC-OPT'),_n('n6',800,100,'Book · Calendly','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-050',category:'SALES',source:'n8n',owner:'ARC-OPT',
    name:'Deal Stage Automation',trigger:'CRM Stage Change',tags:['CRM','deal-flow','Salesforce','automation'],
    desc:'Stage change → update CRM → trigger stage-specific tasks → notify stakeholders → update forecast → set next follow-up.',
    nodes:[_n('n1',60,100,'Stage Change','ARC-OPT'),_n('n2',240,100,'Update CRM','ARC-OPT'),_n('n3',420,50,'Stage Tasks','ARC-OPT'),_n('n4',420,150,'Notify Team','ARC-OPT'),_n('n5',620,100,'Update Forecast','FIN-TRD'),_n('n6',800,100,'Set Follow-Up','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6'])},
  { id:'TPL-051',category:'SALES',source:'n8n',owner:'ARC-OPT',
    name:'AI Proposal Generator',trigger:'Deal Qualified Stage',tags:['proposal','AI-writing','personalization','pitch'],
    desc:'Deal qualifies → pull CRM context + discovery notes → AI draft proposal → pricing calc → design PDF → approval gate → send + track.',
    nodes:[_n('n1',60,100,'Deal Qualified','ARC-OPT'),_n('n2',240,100,'Pull CRM Context','ARC-OPT'),_n('n3',420,100,'AI Draft Proposal','ARC-FRG'),_n('n4',600,50,'Pricing Calc','FIN-TRD'),_n('n5',600,150,'Design + PDF','CNT-HUB'),_n('n6',800,100,'Send + Track','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-052',category:'SALES',source:'jarvis',owner:'ARC-OPT',
    name:'Pipeline Health Monitor',trigger:'Daily 07:00',tags:['pipeline','health','forecast','coaching'],
    desc:'Daily scan → calc pipeline coverage + velocity + age by stage → flag stale deals → coach suggestions → alert rep + manager.',
    nodes:[_n('n1',60,100,'Daily 07:00','ARC-OPT'),_n('n2',240,100,'Pipeline Scan','ARC-OPT'),_n('n3',420,100,'Coverage + Velocity','ARC-OPT'),_n('n4',600,50,'Flag Stale Deals','ARC-OPT'),_n('n5',600,150,'AI Coach Tips','ARC-FRG'),_n('n6',800,100,'Alert + Report','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-053',category:'SALES',source:'jarvis',owner:'FIN-TRD',
    name:'Sales Forecasting Engine',trigger:'Weekly · Monday',tags:['forecasting','AI','ML','accuracy'],
    desc:'Pull pipeline snapshot → apply ML win probability → scenario model (base/best/worst) → compare vs quota → AI narrative → board report.',
    nodes:[_n('n1',60,100,'Pipeline Snap','ARC-OPT'),_n('n2',240,100,'ML Win Prob','ARC-FRG'),_n('n3',420,100,'Scenario Model','FIN-TRD'),_n('n4',620,50,'vs Quota Delta','FIN-TRD'),_n('n5',620,150,'AI Narrative','ARC-OPT'),_n('n6',800,100,'Board Report','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-054',category:'SALES',source:'n8n',owner:'ARC-OPT',
    name:'Win/Loss Analysis Pipeline',trigger:'Deal Closed (Won/Lost)',tags:['win-loss','insights','competitive','coaching'],
    desc:'Deal closes → auto-send exit survey → scrape battlecard signals → AI analyze patterns → update competitive intel → coaching report.',
    nodes:[_n('n1',60,100,'Deal Closed','ARC-OPT'),_n('n2',240,50,'Exit Survey','ARC-OPT'),_n('n3',240,150,'Battlecard Signal','ARC-SCT'),_n('n4',450,100,'Pattern Analysis','ARC-FRG'),_n('n5',650,100,'Competitive Intel','ARC-SCT'),_n('n6',820,100,'Coaching Report','ARC-OPT')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-055',category:'SALES',source:'n8n',owner:'LGL-LAW',
    name:'Contract-to-Close Automation',trigger:'Verbal Agreement',tags:['contract','e-sign','redlines','legal'],
    desc:'Verbal yes → generate MSA from template → legal review gate → redline AI check → e-sign → CRM close → invoice trigger → kickoff.',
    nodes:[_n('n1',60,100,'Verbal Yes','ARC-OPT'),_n('n2',240,100,'Generate MSA','LGL-LAW'),_n('n3',420,100,'AI Redline Check','ARC-FRG'),_n('n4',600,100,'E-Sign · Docusign','LGL-LAW'),_n('n5',780,50,'CRM Close + Invoice','FIN-TRD'),_n('n6',780,150,'Kickoff Trigger','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-056',category:'SALES',source:'n8n',owner:'ARC-SCT',
    name:'Account-Based Marketing Stack',trigger:'Target Account Added',tags:['ABM','intent-data','personalization','B2B'],
    desc:'Account added → intent data pull → buying committee map → personalized content per persona → multi-channel sequence → engagement score → alert SDR.',
    nodes:[_n('n1',60,100,'Account Added','ARC-SCT'),_n('n2',240,100,'Intent Data Pull','INF-WS'),_n('n3',420,100,'Committee Map','ARC-SCT'),_n('n4',600,50,'Personalize Content','ARC-FRG'),_n('n5',600,150,'Multi-Channel Seq','CNT-HUB'),_n('n6',800,100,'Alert SDR','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},

  // ── RESEARCH (6) ──────────────────────────────────────────────────────────
  { id:'TPL-057',category:'RESEARCH',source:'jarvis',owner:'ARC-SCT',
    name:'Deep Research Orchestrator',trigger:'Research Query Input',tags:['deep-research','multi-source','synthesis','report'],
    desc:'Query → decompose into sub-questions → parallel: web scrape + academic + news + X → aggregate → dedup → AI synthesize → structured report.',
    nodes:[_n('n1',60,100,'Query Input','ARC-SCT'),_n('n2',240,100,'Decompose Qs','ARC-OPT'),_n('n3',420,30,'Web Scrape','INF-WS'),_n('n4',420,90,'Academic DB','INF-WS'),_n('n5',420,150,'News + X Feed','ARC-SCT'),_n('n6',620,100,'Aggregate + Dedup','ARC-FRG'),_n('n7',800,100,'Structured Report','ARC-FRG')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n2','n5'],['n3','n6'],['n4','n6'],['n5','n6'],['n6','n7'])},
  { id:'TPL-058',category:'RESEARCH',source:'n8n',owner:'ARC-SCT',
    name:'Market Sizing Pipeline',trigger:'New Market Definition',tags:['TAM','SAM','SOM','market-research'],
    desc:'Define market → pull industry reports + census data + competitor revenue → AI bottom-up calc → TAM/SAM/SOM model → confidence score → slide deck.',
    nodes:[_n('n1',60,100,'Market Defined','ARC-SCT'),_n('n2',240,50,'Industry Reports','INF-WS'),_n('n3',240,150,'Competitor Revenue','ARC-SCT'),_n('n4',440,100,'Bottom-Up Calc','ARC-FRG'),_n('n5',640,100,'TAM/SAM/SOM','FIN-TRD'),_n('n6',820,100,'Slide Deck Output','CNT-HUB')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-059',category:'RESEARCH',source:'jarvis',owner:'ARC-SCT',
    name:'Trend Prediction Engine',trigger:'Weekly Data Refresh',tags:['trends','prediction','early-signal','AI'],
    desc:'Refresh data → scan social signals + patent filings + job postings + funding rounds → ML trend scoring → early signal detection → brief + alert.',
    nodes:[_n('n1',60,100,'Data Refresh','ARC-SCT'),_n('n2',240,30,'Social Signals','CNT-X'),_n('n3',240,90,'Patent Filings','INF-WS'),_n('n4',240,150,'Job Postings','INF-WS'),_n('n5',240,210,'Funding Rounds','FIN-TRD'),_n('n6',480,120,'ML Score + Rank','ARC-FRG'),_n('n7',680,120,'Early Signal Brief','ARC-SCT')],
    edges:_e(['n1','n2'],['n1','n3'],['n1','n4'],['n1','n5'],['n2','n6'],['n3','n6'],['n4','n6'],['n5','n6'],['n6','n7'])},
  { id:'TPL-060',category:'RESEARCH',source:'n8n',owner:'ARC-SCT',
    name:'Academic Research Synthesizer',trigger:'New Paper Batch',tags:['arxiv','papers','literature','synthesis'],
    desc:'New papers → parse abstracts → relevance filter → full-text extract key findings → cluster by theme → AI meta-analysis → weekly digest.',
    nodes:[_n('n1',60,100,'Paper Batch','INF-WS'),_n('n2',240,100,'Relevance Filter','ARC-FRG'),_n('n3',420,100,'Extract Findings','ARC-FRG'),_n('n4',600,100,'Theme Cluster','ARC-FRG'),_n('n5',780,100,'Meta-Analysis + Digest','ARC-SCT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'])},
  { id:'TPL-061',category:'RESEARCH',source:'github',owner:'ARC-SCT',
    name:'Patent Landscape Analyzer',trigger:'Technology Keyword Set',tags:['patents','IP','freedom-to-operate','landscape'],
    desc:'Keywords → USPTO + EPO + Google Patents API → parse claims → cluster by IPC class → whitespace map → AI FTO summary → legal report.',
    nodes:[_n('n1',60,100,'Keywords Input','ARC-SCT'),_n('n2',240,50,'USPTO + EPO Pull','INF-WS'),_n('n3',240,150,'Google Patents','INF-WS'),_n('n4',460,100,'Parse + Cluster','ARC-FRG'),_n('n5',660,100,'Whitespace Map','ARC-SCT'),_n('n6',820,100,'FTO Report','LGL-LAW')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-062',category:'RESEARCH',source:'jarvis',owner:'ARC-SCT',
    name:'Competitive Intelligence Hub',trigger:'Continuous · 4h cycle',tags:['competitive','CI','positioning','SWOT'],
    desc:'Every 4h: scrape 10 competitor sites + G2 + Crunchbase + job boards → detect pricing/product/hiring changes → SWOT delta → alert if significant.',
    nodes:[_n('n1',60,100,'4h Trigger','ARC-SCT'),_n('n2',240,50,'Scrape Sites + G2','INF-WS'),_n('n3',240,150,'Crunchbase + Jobs','INF-WS'),_n('n4',460,100,'Change Detection','ARC-SCT'),_n('n5',660,100,'SWOT Delta','ARC-FRG'),_n('n6',820,100,'Alert If Material','ARC-OPT')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},

  // ── WEB3 (6) ──────────────────────────────────────────────────────────────
  { id:'TPL-063',category:'WEB3',source:'jarvis',owner:'FIN-BOT',
    name:'On-Chain Event Monitor',trigger:'Webhook · Smart Contract Event',tags:['on-chain','events','DeFi','alerts'],
    desc:'Contract event fires → decode calldata → classify event type → enrich with price/gas data → alert if whale (>$1M) → log + dashboard.',
    nodes:[_n('n1',60,100,'Contract Event','FIN-BOT'),_n('n2',240,100,'Decode Calldata','FIN-BOT'),_n('n3',420,100,'Classify Type','ARC-OPT'),_n('n4',600,50,'Enrich Price+Gas','FIN-TRD'),_n('n5',600,150,'Whale Gate >$1M','FIN-TRD'),_n('n6',800,100,'Alert + Log','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-064',category:'WEB3',source:'jarvis',owner:'FIN-BOT',
    name:'DeFi Yield Optimizer',trigger:'Hourly Rate Scan',tags:['DeFi','yield','APY','rebalance','Aave','Compound'],
    desc:'Hourly scan Aave + Compound + Curve + Pendle → rank by risk-adjusted yield → gas cost calc → execute rebalance if delta > 0.5% → notify.',
    nodes:[_n('n1',60,100,'Hourly Scan','FIN-BOT'),_n('n2',240,50,'Aave + Compound','FIN-BOT'),_n('n3',240,150,'Curve + Pendle','FIN-BOT'),_n('n4',460,100,'Rank Risk-Adj','FIN-TRD'),_n('n5',640,100,'Gas + Delta Check','FIN-BOT'),_n('n6',820,100,'Execute Rebalance','FIN-BOT')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-065',category:'WEB3',source:'n8n',owner:'CNT-HUB',
    name:'NFT Collection Launch',trigger:'Launch Date T-7',tags:['NFT','launch','mint','community','allowlist'],
    desc:'T-7: build allowlist → T-3: teaser content burst → T-1: final hype → Mint Day: monitor + alert → post-mint analytics → holder rewards.',
    nodes:[_n('n1',60,100,'T-7 Launch Prep','CNT-HUB'),_n('n2',240,50,'Allowlist Build','FIN-BOT'),_n('n3',240,150,'Content Teaser Burst','CNT-HUB'),_n('n4',460,100,'T-1 Final Hype','CNT-HUB'),_n('n5',640,100,'Mint Day Monitor','FIN-BOT'),_n('n6',820,100,'Analytics + Rewards','ARC-OPT')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-066',category:'WEB3',source:'github',owner:'FIN-BOT',
    name:'Token Distribution Pipeline',trigger:'Distribution Event',tags:['airdrop','vesting','token','smart-contract'],
    desc:'Snapshot wallets → eligibility filter → merkle tree construct → deploy distributor contract → claim portal → vesting schedule → monitor claims.',
    nodes:[_n('n1',60,100,'Wallet Snapshot','FIN-BOT'),_n('n2',240,100,'Eligibility Filter','FIN-BOT'),_n('n3',420,100,'Merkle Tree Build','INF-FS'),_n('n4',600,100,'Deploy Contract','INF-FS'),_n('n5',780,50,'Claim Portal Live','INF-WEB'),_n('n6',780,150,'Monitor Claims','FIN-BOT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-067',category:'WEB3',source:'github',owner:'FIN-BOT',
    name:'DAO Governance Processor',trigger:'Proposal Created',tags:['DAO','governance','voting','quorum'],
    desc:'Proposal created → AI summarize → notify holders → voting period open → tally votes → quorum check → execute if passed → on-chain log.',
    nodes:[_n('n1',60,100,'Proposal Created','FIN-BOT'),_n('n2',240,100,'AI Summarize','ARC-FRG'),_n('n3',420,100,'Notify Holders','CNT-HUB'),_n('n4',600,100,'Tally + Quorum','FIN-BOT'),_n('n5',780,50,'Execute If Passed','FIN-BOT'),_n('n6',780,150,'On-Chain Log','FIN-BOT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-068',category:'WEB3',source:'jarvis',owner:'FIN-TRD',
    name:'Wallet Risk Analyzer',trigger:'Large Transaction Alert',tags:['wallet','risk','AML','on-chain-analytics'],
    desc:'Large tx detected → trace wallet history → check sanctions lists → calc risk score → graph known bad actors → alert compliance → file SAR if needed.',
    nodes:[_n('n1',60,100,'Large Tx Alert','FIN-TRD'),_n('n2',240,100,'Trace History','FIN-BOT'),_n('n3',420,50,'Sanctions Check','LGL-TAX'),_n('n4',420,150,'Bad Actor Graph','FIN-TRD'),_n('n5',640,100,'Risk Score','FIN-TRD'),_n('n6',820,100,'Alert + SAR Gate','LGL-LAW')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6'])},

  // ── SECURITY (6) ──────────────────────────────────────────────────────────
  { id:'TPL-069',category:'SECURITY',source:'n8n',owner:'INF-HCK',
    name:'Threat Hunt Pipeline',trigger:'IOC Feed Update',tags:['threat-hunting','IOC','MITRE','ATT&CK'],
    desc:'New IOC feed → normalize indicators → correlate with SIEM logs → ATT&CK TTP mapping → hunt query gen → analyst queue → containment.',
    nodes:[_n('n1',60,100,'IOC Feed','INF-HCK'),_n('n2',240,100,'Normalize IOCs','INF-HCK'),_n('n3',420,50,'SIEM Correlate','INF-HCK'),_n('n4',420,150,'ATT&CK Map','INF-HCK'),_n('n5',640,100,'Hunt Query Gen','ARC-FRG'),_n('n6',820,100,'Analyst Queue','INF-HCK')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6'])},
  { id:'TPL-070',category:'SECURITY',source:'github',owner:'INF-HCK',
    name:'Incident Response Orchestrator',trigger:'Severity 1 Alert',tags:['IR','SOAR','containment','forensics'],
    desc:'Sev-1 alert → assemble IR team → isolate host → collect forensics → parallel threat intel + timeline build → eradicate → recover → post-mortem.',
    nodes:[_n('n1',60,100,'Sev-1 Alert','INF-HCK'),_n('n2',240,50,'Assemble IR Team','INF-HCK'),_n('n3',240,150,'Isolate Host','INF-HCK'),_n('n4',460,100,'Collect Forensics','INF-HCK'),_n('n5',640,50,'Threat Intel','ARC-SCT'),_n('n6',640,150,'Timeline Build','INF-HCK'),_n('n7',820,100,'Eradicate + Recover','INF-HCK')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7'])},
  { id:'TPL-071',category:'SECURITY',source:'n8n',owner:'INF-HCK',
    name:'Compliance Audit Automation',trigger:'Quarterly Audit Trigger',tags:['compliance','SOC2','ISO27001','evidence'],
    desc:'Audit trigger → collect evidence from 12 control families → auto-map to framework → gap analysis → AI remediation plan → auditor package.',
    nodes:[_n('n1',60,100,'Audit Trigger','INF-HCK'),_n('n2',240,100,'Collect Evidence','INF-HCK'),_n('n3',420,100,'Framework Map','INF-HCK'),_n('n4',600,100,'Gap Analysis','ARC-FRG'),_n('n5',780,50,'Remediation Plan','INF-HCK'),_n('n6',780,150,'Auditor Package','LGL-LAW')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-072',category:'SECURITY',source:'jarvis',owner:'INF-HCK',
    name:'SIEM Alert Correlator',trigger:'Continuous Alert Stream',tags:['SIEM','correlation','noise-reduction','triage'],
    desc:'Raw alerts stream → dedup + normalize → ML noise filter → correlate into incidents → priority score → route to analyst or auto-close.',
    nodes:[_n('n1',60,100,'Alert Stream','INF-HCK'),_n('n2',240,100,'Dedup + Normalize','INF-HCK'),_n('n3',420,100,'ML Noise Filter','ARC-FRG'),_n('n4',600,100,'Correlate Incidents','INF-HCK'),_n('n5',780,50,'Route Analyst','INF-HCK'),_n('n6',780,150,'Auto-Close Low','INF-HCK')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-073',category:'SECURITY',source:'github',owner:'INF-HCK',
    name:'Pen Test Report Generator',trigger:'Engagement Complete',tags:['pentest','report','CVSS','remediation'],
    desc:'Engagement done → parse tool outputs (Burp+Nessus+Metasploit) → CVSS score → prioritize findings → AI narrative → exec summary → PDF.',
    nodes:[_n('n1',60,100,'Engagement Done','INF-HCK'),_n('n2',240,50,'Parse Burp+Nessus','INF-HCK'),_n('n3',240,150,'Parse Metasploit','INF-HCK'),_n('n4',460,100,'CVSS Score + Priority','INF-HCK'),_n('n5',660,100,'AI Narrative','ARC-FRG'),_n('n6',820,100,'PDF Report','CNT-HUB')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-074',category:'SECURITY',source:'jarvis',owner:'INF-HCK',
    name:'Zero-Day Response Protocol',trigger:'CVE Published · CVSS ≥ 9',tags:['zero-day','CVE','patch','emergency'],
    desc:'CVE ≥ 9 published → asset inventory scan → blast radius calc → emergency war room → patch pipeline → verification scan → close.',
    nodes:[_n('n1',60,100,'CVE Alert ≥9','INF-HCK'),_n('n2',240,100,'Asset Inventory Scan','INF-SC'),_n('n3',420,100,'Blast Radius Calc','INF-HCK'),_n('n4',600,50,'Emergency War Room','INF-HCK'),_n('n5',600,150,'Patch Pipeline','INF-FS'),_n('n6',800,100,'Verify + Close','INF-HCK')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},

  // ── INFRA (6) ──────────────────────────────────────────────────────────────
  { id:'TPL-075',category:'INFRA',source:'github',owner:'INF-FS',
    name:'Chaos Engineering Pipeline',trigger:'Weekly Chaos Day',tags:['chaos','resilience','fault-injection','SRE'],
    desc:'Schedule chaos day → select blast radius (low) → inject fault scenarios → monitor steady-state → auto-rollback if SLO breached → report.',
    nodes:[_n('n1',60,100,'Chaos Day Trigger','INF-FS'),_n('n2',240,100,'Select Blast Radius','INF-FS'),_n('n3',420,100,'Inject Fault','INF-FS'),_n('n4',600,50,'Monitor SLOs','INF-SC'),_n('n5',600,150,'Rollback If Breach','INF-WEB'),_n('n6',800,100,'Resilience Report','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-076',category:'INFRA',source:'n8n',owner:'INF-SC',
    name:'Capacity Planning Automation',trigger:'Monthly Forecast Run',tags:['capacity','scaling','cost','forecast'],
    desc:'Monthly run → pull 90d usage trends → ML growth model → scenario planning (p50/p90/p99) → cost projection → provisioning plan → approval.',
    nodes:[_n('n1',60,100,'Monthly Forecast','INF-SC'),_n('n2',240,100,'90d Usage Trends','INF-SC'),_n('n3',420,100,'ML Growth Model','ARC-FRG'),_n('n4',600,100,'Scenario Planning','INF-SC'),_n('n5',780,50,'Cost Projection','FIN-TRD'),_n('n6',780,150,'Provision Plan','INF-SC')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-077',category:'INFRA',source:'n8n',owner:'INF-FS',
    name:'Runbook Automation Engine',trigger:'Alert Fires',tags:['runbook','SRE','auto-remediation','ops'],
    desc:'Alert fires → look up runbook → classify issue type → execute automated steps → check resolution → escalate if unresolved → document actions.',
    nodes:[_n('n1',60,100,'Alert Fires','INF-FS'),_n('n2',240,100,'Lookup Runbook','INF-FS'),_n('n3',420,100,'Classify Issue','ARC-FRG'),_n('n4',600,100,'Execute Steps','INF-FS'),_n('n5',780,50,'Resolved?','INF-FS'),_n('n6',780,150,'Escalate + Doc','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-078',category:'INFRA',source:'jarvis',owner:'INF-SC',
    name:'Observability Pipeline',trigger:'Continuous Telemetry',tags:['observability','OTEL','traces','metrics','logs'],
    desc:'Telemetry stream → OTel collect → enrich with service context → ML anomaly baseline → alert on deviation → auto-trace sampling boost.',
    nodes:[_n('n1',60,100,'OTel Stream','INF-SC'),_n('n2',240,100,'Collect + Enrich','INF-SC'),_n('n3',420,100,'ML Baseline','ARC-FRG'),_n('n4',600,50,'Anomaly Alert','ARC-OPT'),_n('n5',600,150,'Trace Sample Boost','INF-SC'),_n('n6',800,100,'Dashboard Update','INF-SC')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-079',category:'INFRA',source:'n8n',owner:'INF-SC',
    name:'Cloud Cost Optimizer',trigger:'Daily Cost Report',tags:['FinOps','cloud-cost','rightsizing','waste'],
    desc:'Daily cost pull → identify waste (idle resources, oversized) → rightsizing recommendations → auto-apply approved rules → track savings → report.',
    nodes:[_n('n1',60,100,'Daily Cost Pull','INF-SC'),_n('n2',240,100,'Identify Waste','ARC-FRG'),_n('n3',420,100,'Rightsize Recs','INF-SC'),_n('n4',600,50,'Auto-Apply Rules','INF-SC'),_n('n5',600,150,'Track Savings','FIN-TRD'),_n('n6',800,100,'FinOps Report','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-080',category:'INFRA',source:'github',owner:'INF-FS',
    name:'Disaster Recovery Drill',trigger:'Quarterly DR Test',tags:['DR','RTO','RPO','failover','backup'],
    desc:'Trigger DR drill → snapshot all critical systems → simulate failure → initiate failover → validate RTO/RPO → measure gaps → update runbooks.',
    nodes:[_n('n1',60,100,'DR Drill Trigger','INF-FS'),_n('n2',240,100,'Snapshot Critical','INF-SC'),_n('n3',420,100,'Simulate Failure','INF-FS'),_n('n4',600,100,'Initiate Failover','INF-WEB'),_n('n5',780,50,'Validate RTO/RPO','INF-FS'),_n('n6',780,150,'Update Runbooks','INF-FS')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},

  // ── PRODUCT (6) ──────────────────────────────────────────────────────────
  { id:'TPL-081',category:'PRODUCT',source:'n8n',owner:'ARC-OPT',
    name:'Feature Launch Checklist',trigger:'Feature Flag: Launch Date',tags:['launch','checklist','GTM','coordination'],
    desc:'Launch date set → trigger eng + design + marketing + legal checklists in parallel → gate on all green → staged rollout → monitor → celebrate.',
    nodes:[_n('n1',60,100,'Launch Date Set','ARC-OPT'),_n('n2',240,30,'Eng Checklist','INF-FS'),_n('n3',240,90,'Design QA','INF-WEB'),_n('n4',240,150,'Marketing Brief','CNT-HUB'),_n('n5',240,210,'Legal Clear','LGL-LAW'),_n('n6',500,120,'All Green Gate','ARC-OPT'),_n('n7',700,120,'Staged Rollout','INF-FS')],
    edges:_e(['n1','n2'],['n1','n3'],['n1','n4'],['n1','n5'],['n2','n6'],['n3','n6'],['n4','n6'],['n5','n6'],['n6','n7'])},
  { id:'TPL-082',category:'PRODUCT',source:'jarvis',owner:'ARC-OPT',
    name:'User Journey Intelligence',trigger:'Segment Event Stream',tags:['user-journey','analytics','drop-off','funnel'],
    desc:'Event stream → reconstruct user sessions → funnel visualization → identify drop-off points → AI hypothesis gen → prioritize fixes → A/B test.',
    nodes:[_n('n1',60,100,'Event Stream','ARC-OPT'),_n('n2',240,100,'Session Reconstruct','ARC-FRG'),_n('n3',420,100,'Funnel Analysis','ARC-OPT'),_n('n4',600,100,'Drop-Off Identify','ARC-OPT'),_n('n5',780,50,'AI Hypotheses','ARC-FRG'),_n('n6',780,150,'A/B Test Queue','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-083',category:'PRODUCT',source:'n8n',owner:'ARC-OPT',
    name:'Roadmap Sync Automation',trigger:'Quarterly Planning',tags:['roadmap','JIRA','OKR','alignment','product'],
    desc:'Planning kick → pull OKRs + customer requests + tech debt → AI prioritization matrix → roadmap draft → stakeholder review → JIRA sync.',
    nodes:[_n('n1',60,100,'Planning Kick','ARC-OPT'),_n('n2',240,50,'Pull OKRs + CRs','ARC-OPT'),_n('n3',240,150,'Tech Debt Assess','INF-FS'),_n('n4',460,100,'AI Priority Matrix','ARC-FRG'),_n('n5',660,100,'Roadmap Draft','ARC-OPT'),_n('n6',820,100,'Stakeholder → JIRA','INF-FS')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-084',category:'PRODUCT',source:'n8n',owner:'ARC-OPT',
    name:'NPS Action Pipeline',trigger:'NPS Survey Response',tags:['NPS','CSAT','action','close-loop'],
    desc:'NPS response → segment (Promoter/Passive/Detractor) → Promoter: case study ask + referral → Detractor: CSM + root cause → close loop email.',
    nodes:[_n('n1',60,100,'NPS Response','ARC-OPT'),_n('n2',240,100,'Score Segment','ARC-OPT'),_n('n3',420,50,'Promoter Path','ARC-OPT'),_n('n4',420,150,'Detractor Path','ARC-OPT'),_n('n5',640,50,'Case Study + Ref','CNT-HUB'),_n('n6',640,150,'CSM + Root Cause','ARC-OPT'),_n('n7',820,100,'Close Loop Email','CNT-NWS')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n6'],['n5','n7'],['n6','n7'])},
  { id:'TPL-085',category:'PRODUCT',source:'n8n',owner:'ARC-OPT',
    name:'Beta Feedback Loop',trigger:'Beta User Event',tags:['beta','feedback','iteration','product-discovery'],
    desc:'Beta activity → in-app survey trigger → collect feedback → cluster themes with AI → update backlog → notify beta users of fixes → re-survey.',
    nodes:[_n('n1',60,100,'Beta Activity','ARC-OPT'),_n('n2',240,100,'In-App Survey','ARC-OPT'),_n('n3',420,100,'AI Cluster Themes','ARC-FRG'),_n('n4',600,100,'Update Backlog','INF-FS'),_n('n5',780,50,'Notify Beta Users','CNT-NWS'),_n('n6',780,150,'Re-Survey D30','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-086',category:'PRODUCT',source:'github',owner:'INF-FS',
    name:'Deprecation Manager',trigger:'Feature Sunset Schedule',tags:['deprecation','migration','sunset','communication'],
    desc:'Sunset date set → identify active users → migration path gen → T-90 email → T-30 in-app warning → T-7 final alert → kill switch → verify.',
    nodes:[_n('n1',60,100,'Sunset Schedule','INF-FS'),_n('n2',240,100,'Identify Active Users','ARC-OPT'),_n('n3',420,100,'Migration Path','ARC-FRG'),_n('n4',600,50,'T-90 + T-30 Emails','CNT-NWS'),_n('n5',600,150,'T-7 In-App Warn','INF-WEB'),_n('n6',800,100,'Kill Switch + Verify','INF-FS')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},

  // ── PERSONAL (8) ──────────────────────────────────────────────────────────
  { id:'TPL-087',category:'PERSONAL',source:'jarvis',owner:'ARC-OPT',
    name:'Morning Productivity Stack',trigger:'Daily 05:30',tags:['morning','routine','focus','productivity'],
    desc:'05:30: pull weather + news + markets + tasks → AI priority stack for day → block deep work windows → set focus mode → brief notification.',
    nodes:[_n('n1',60,100,'05:30 Trigger','ARC-OPT'),_n('n2',240,30,'News + Markets','ARC-SCT'),_n('n3',240,100,'Tasks + Calendar','ARC-OPT'),_n('n4',240,170,'Weather + Health','ARC-OPT'),_n('n5',480,100,'AI Priority Stack','ARC-FRG'),_n('n6',680,100,'Focus Mode Brief','ARC-OPT')],
    edges:_e(['n1','n2'],['n1','n3'],['n1','n4'],['n2','n5'],['n3','n5'],['n4','n5'],['n5','n6'])},
  { id:'TPL-088',category:'PERSONAL',source:'n8n',owner:'ARC-OPT',
    name:'Health & Performance Tracker',trigger:'Daily Wearable Sync',tags:['health','HRV','sleep','performance','biometrics'],
    desc:'Wearable sync → pull HRV + sleep + activity → performance score calc → trend analysis → AI readiness brief → adjust training load → log.',
    nodes:[_n('n1',60,100,'Wearable Sync','ARC-OPT'),_n('n2',240,50,'HRV + Sleep','ARC-OPT'),_n('n3',240,150,'Activity + Nutrition','ARC-OPT'),_n('n4',460,100,'Perf Score Calc','ARC-FRG'),_n('n5',660,100,'Readiness Brief','ARC-OPT'),_n('n6',820,100,'Adjust Load + Log','ARC-OPT')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-089',category:'PERSONAL',source:'jarvis',owner:'ARC-OPT',
    name:'Deep Work Scheduler',trigger:'Daily Calendar Analysis',tags:['deep-work','focus','calendar','time-blocking'],
    desc:'Analyze calendar → identify 90-min deep work windows → protect from meetings → set Do Not Disturb → prepare context doc → end-session log.',
    nodes:[_n('n1',60,100,'Calendar Analysis','ARC-OPT'),_n('n2',240,100,'Find DW Windows','ARC-FRG'),_n('n3',420,100,'Block + Protect','ARC-OPT'),_n('n4',600,50,'Set DND Mode','ARC-OPT'),_n('n5',600,150,'Prepare Context','ARC-FRG'),_n('n6',800,100,'End Session Log','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-090',category:'PERSONAL',source:'n8n',owner:'ARC-OPT',
    name:'Continuous Learning Pipeline',trigger:'Daily 21:00',tags:['learning','Anki','spaced-repetition','books','courses'],
    desc:'21:00: pull reading queue + courses + papers → AI extract key concepts → generate Anki cards → schedule review → track knowledge graph → weekly report.',
    nodes:[_n('n1',60,100,'21:00 Trigger','ARC-OPT'),_n('n2',240,50,'Reading Queue','ARC-SCT'),_n('n3',240,150,'Courses + Papers','INF-WS'),_n('n4',460,100,'Extract Concepts','ARC-FRG'),_n('n5',660,100,'Anki Cards + Schedule','ARC-OPT'),_n('n6',820,100,'Knowledge Graph','ARC-OPT')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-091',category:'PERSONAL',source:'jarvis',owner:'ARC-OPT',
    name:'Weekly Goal Review Engine',trigger:'Sunday 19:00',tags:['goals','OKR','review','planning','accountability'],
    desc:'Sunday review: pull weekly goals + completed tasks → score progress → identify blockers → AI next-week plan → recalibrate priorities → journal.',
    nodes:[_n('n1',60,100,'Sunday 19:00','ARC-OPT'),_n('n2',240,50,'Pull Goals + Tasks','ARC-OPT'),_n('n3',240,150,'Score Progress','ARC-OPT'),_n('n4',460,100,'Identify Blockers','ARC-FRG'),_n('n5',660,100,'Next Week Plan','ARC-FRG'),_n('n6',820,100,'Recalibrate + Journal','ARC-OPT')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-092',category:'PERSONAL',source:'n8n',owner:'FIN-TRD',
    name:'Personal Finance Dashboard',trigger:'Daily Bank Sync',tags:['personal-finance','budget','net-worth','tracking'],
    desc:'Daily sync → categorize transactions → vs budget delta → net worth calc → investment performance → tax estimate → alert on anomalies.',
    nodes:[_n('n1',60,100,'Bank Sync','FIN-TRD'),_n('n2',240,100,'Categorize Txns','ARC-FRG'),_n('n3',420,50,'vs Budget Delta','FIN-TRD'),_n('n4',420,150,'Net Worth Calc','FIN-TRD'),_n('n5',640,100,'Tax Estimate','LGL-TAX'),_n('n6',820,100,'Anomaly Alert','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6'])},
  { id:'TPL-093',category:'PERSONAL',source:'n8n',owner:'ARC-OPT',
    name:'Network Intelligence Manager',trigger:'Weekly Relationship Review',tags:['networking','CRM','follow-up','relationships'],
    desc:'Weekly review of relationship strength scores → identify who needs contact → AI personalized message draft → send reminder → log interaction.',
    nodes:[_n('n1',60,100,'Weekly Review','ARC-OPT'),_n('n2',240,100,'Relationship Scores','ARC-OPT'),_n('n3',420,100,'Flag Needs Contact','ARC-SCT'),_n('n4',600,100,'AI Draft Message','ARC-FRG'),_n('n5',780,100,'Send Reminder + Log','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'])},
  { id:'TPL-094',category:'PERSONAL',source:'jarvis',owner:'ARC-OPT',
    name:'High-Stakes Decision Framework',trigger:'Decision Input',tags:['decision','second-order','pre-mortem','clarity'],
    desc:'Input decision → AI map options + tradeoffs → second-order consequences → pre-mortem analysis → confidence score → pros/cons matrix → recommendation.',
    nodes:[_n('n1',60,100,'Decision Input','ARC-OPT'),_n('n2',240,100,'Map Options','ARC-FRG'),_n('n3',420,50,'2nd Order Effects','ARC-FRG'),_n('n4',420,150,'Pre-Mortem','ARC-FRG'),_n('n5',640,100,'Confidence Score','ARC-OPT'),_n('n6',820,100,'Final Recommendation','ARC-FRG')],
    edges:_e(['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6'])},

  // ── COMMUNITY (6) ─────────────────────────────────────────────────────────
  { id:'TPL-095',category:'COMMUNITY',source:'n8n',owner:'CNT-HUB',
    name:'Discord Community Bot',trigger:'Server Events · Continuous',tags:['Discord','community','bot','moderation'],
    desc:'Monitor server events → welcome new members → auto-role assign → detect spam/toxicity → escalate to mod → weekly server health report.',
    nodes:[_n('n1',60,100,'Server Events','CNT-HUB'),_n('n2',240,50,'Welcome + Role','CNT-HUB'),_n('n3',240,150,'Spam/Toxicity Check','INF-HCK'),_n('n4',460,100,'Escalate to Mod','CNT-HUB'),_n('n5',660,100,'Mod Action','CNT-HUB'),_n('n6',820,100,'Health Report','ARC-OPT')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-096',category:'COMMUNITY',source:'n8n',owner:'CNT-HUB',
    name:'Member Onboarding Flow',trigger:'New Member Joins',tags:['onboarding','community','engagement','activation'],
    desc:'Join event → welcome DM + intro video → community tour thread → assign buddy → 48h check-in → first contribution nudge → track activation.',
    nodes:[_n('n1',60,100,'Member Joins','CNT-HUB'),_n('n2',240,100,'Welcome DM + Tour','CNT-HUB'),_n('n3',420,100,'Assign Buddy','CNT-HUB'),_n('n4',600,100,'48h Check-In','CNT-HUB'),_n('n5',780,100,'First Contribution','CNT-HUB')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'])},
  { id:'TPL-097',category:'COMMUNITY',source:'jarvis',owner:'CNT-HUB',
    name:'Community Event Automation',trigger:'Event Creation',tags:['events','community','live','registration'],
    desc:'Event created → announcement sequence (T-7/T-3/T-1/day-of) → registration tracking → reminder DMs → live support bot → recording + recap post.',
    nodes:[_n('n1',60,100,'Event Created','CNT-HUB'),_n('n2',240,100,'Announcement Seq','CNT-HUB'),_n('n3',420,100,'Registration Track','ARC-OPT'),_n('n4',600,50,'Reminder DMs','CNT-HUB'),_n('n5',600,150,'Live Support Bot','CNT-HUB'),_n('n6',800,100,'Recording + Recap','CNT-HUB')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n4','n6'],['n5','n6'])},
  { id:'TPL-098',category:'COMMUNITY',source:'n8n',owner:'CNT-HUB',
    name:'Ambassador Program Manager',trigger:'Ambassador Application',tags:['ambassador','advocacy','rewards','program'],
    desc:'Application → score candidate → tier assignment → welcome kit → monthly missions assign → track completions → reward distribution → leaderboard.',
    nodes:[_n('n1',60,100,'Application','CNT-HUB'),_n('n2',240,100,'Score + Tier','ARC-OPT'),_n('n3',420,100,'Welcome Kit','CNT-HUB'),_n('n4',600,50,'Monthly Missions','CNT-HUB'),_n('n5',600,150,'Track + Reward','ARC-OPT'),_n('n6',800,100,'Leaderboard Update','CNT-HUB')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n5','n6'])},
  { id:'TPL-099',category:'COMMUNITY',source:'jarvis',owner:'CNT-HUB',
    name:'Viral Challenge Engine',trigger:'Challenge Launch',tags:['challenge','UGC','viral','engagement'],
    desc:'Launch challenge → announce across platforms → track submissions with hashtag → AI judge + score → daily leaderboard → winner announce → prize flow.',
    nodes:[_n('n1',60,100,'Challenge Launch','CNT-HUB'),_n('n2',240,100,'Cross-Platform Blast','CNT-HUB'),_n('n3',420,100,'Track Submissions','ARC-SCT'),_n('n4',600,100,'AI Judge + Score','ARC-FRG'),_n('n5',780,50,'Leaderboard Update','CNT-HUB'),_n('n6',780,150,'Winner + Prize','ARC-OPT')],
    edges:_e(['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'])},
  { id:'TPL-100',category:'COMMUNITY',source:'n8n',owner:'CNT-HUB',
    name:'Community Health Pulse',trigger:'Weekly Metrics Pull',tags:['community','health','churn','DAU','sentiment'],
    desc:'Weekly: pull DAU/MAU + message volume + sentiment + churn rate → health score calc → identify at-risk cohorts → engagement campaigns → exec brief.',
    nodes:[_n('n1',60,100,'Weekly Pull','CNT-HUB'),_n('n2',240,50,'DAU/MAU + Volume','ARC-OPT'),_n('n3',240,150,'Sentiment Analysis','ARC-FRG'),_n('n4',460,100,'Health Score Calc','ARC-OPT'),_n('n5',660,50,'At-Risk Cohorts','ARC-OPT'),_n('n6',660,150,'Engagement Campaigns','CNT-HUB'),_n('n7',840,100,'Exec Brief','ARC-OPT')],
    edges:_e(['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7'])},
];;


// ── WorkflowBuilderTab ────────────────────────────────────────────────────
const WB_CATS = ['ALL', 'CI/CD', 'CONTENT', 'TRADING', 'AI/ML', 'DATA', 'OPS', 'GROWTH', 'SALES', 'RESEARCH', 'WEB3', 'SECURITY', 'INFRA', 'PRODUCT', 'PERSONAL', 'COMMUNITY'];
const SRC_COLOR = (s: string) => s === 'n8n' ? JADE : s === 'github' ? VIOLET : s === 'jarvis' ? CYAN_BRIGHT : ROSE;

interface WBChat { role: 'user' | 'jarvis'; text: string; }

function WorkflowBuilderTab({ myWorkflows }: { myWorkflows: Workflow[] }) {
  void myWorkflows;
  const [cat, setCat] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selTpl, setSelTpl] = useState<string | null>(null);
  const [library, setLibrary] = useState<BuilderWF[]>(loadBuilderWFs);
  const [selLib, setSelLib] = useState<string | null>(null);
  const [panel, setPanel] = useState<'templates' | 'library'>('templates');
  const [showJson, setShowJson] = useState(false);

  // Editor state
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<BuilderWF>>({});
  const [selNode, setSelNode] = useState<string | null>(null);
  const [nodeDraft, setNodeDraft] = useState<{ label: string; team: string }>({ label: '', team: 'ARC-OPT' });
  const [addEdgeFrom, setAddEdgeFrom] = useState('');
  const [addEdgeTo, setAddEdgeTo] = useState('');
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeTeam, setNewNodeTeam] = useState('ARC-OPT');

  // Jarvis chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<WBChat[]>([
    { role: 'jarvis', text: 'JARVIS WORKFLOW ARCHITECT online. Describe any automation and I\'ll help design the optimal node structure, trigger logic, and edge connections.' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const allCats = ['ALL', ...Array.from(new Set(WF_TEMPLATES.map(t => t.category)))];
  const filtered = WF_TEMPLATES.filter(t =>
    (cat === 'ALL' || t.category === cat) &&
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) ||
     t.desc.toLowerCase().includes(search.toLowerCase()) ||
     t.tags.some(tg => tg.toLowerCase().includes(search.toLowerCase())))
  );

  const selTplObj = WF_TEMPLATES.find(t => t.id === selTpl);
  const selLibObj = library.find(w => w.id === selLib);
  const previewWF: (TplDef & { savedAt?: string }) | null = selLibObj ?? selTplObj ?? null;

  function startEdit() {
    if (!selLibObj) return;
    setEditDraft({ name: selLibObj.name, desc: selLibObj.desc, trigger: selLibObj.trigger, category: selLibObj.category, owner: selLibObj.owner, tags: [...selLibObj.tags] });
    setSelNode(null); setEditMode(true);
  }
  function saveLibEdit() {
    if (!selLibObj) return;
    const updated = library.map(w => w.id === selLibObj.id ? { ...w, ...editDraft } as BuilderWF : w);
    setLibrary(updated); saveBuilderWFs(updated); setEditMode(false); setEditDraft({});
  }
  function updateNode(id: string, changes: Partial<WorkflowNode>) {
    if (!selLibObj) return;
    const nodes = selLibObj.nodes.map(n => n.id === id ? { ...n, ...changes } : n);
    const updated = library.map(w => w.id === selLibObj.id ? { ...w, nodes } : w);
    setLibrary(updated); saveBuilderWFs(updated);
  }
  function addNode() {
    if (!selLibObj || !newNodeLabel.trim()) return;
    const maxX = Math.max(...selLibObj.nodes.map(n => n.x), 0);
    const newN: WorkflowNode = { id: `n${selLibObj.nodes.length + 1}`, x: maxX + 200, y: 100, label: newNodeLabel.trim(), team: newNodeTeam };
    const updated = library.map(w => w.id === selLibObj.id ? { ...w, nodes: [...w.nodes, newN] } : w);
    setLibrary(updated); saveBuilderWFs(updated); setNewNodeLabel('');
  }
  function deleteNode(id: string) {
    if (!selLibObj) return;
    const nodes = selLibObj.nodes.filter(n => n.id !== id);
    const edges = selLibObj.edges.filter(([a, b]) => a !== id && b !== id);
    const updated = library.map(w => w.id === selLibObj.id ? { ...w, nodes, edges } : w);
    setLibrary(updated); saveBuilderWFs(updated); if (selNode === id) setSelNode(null);
  }
  function addEdge() {
    if (!selLibObj || !addEdgeFrom.trim() || !addEdgeTo.trim() || addEdgeFrom === addEdgeTo) return;
    const exists = selLibObj.edges.some(([a, b]) => a === addEdgeFrom && b === addEdgeTo);
    if (exists) return;
    const edges: [string, string][] = [...selLibObj.edges, [addEdgeFrom.trim(), addEdgeTo.trim()]];
    const updated = library.map(w => w.id === selLibObj.id ? { ...w, edges } : w);
    setLibrary(updated); saveBuilderWFs(updated); setAddEdgeFrom(''); setAddEdgeTo('');
  }
  function deleteEdge(a: string, b: string) {
    if (!selLibObj) return;
    const edges = selLibObj.edges.filter(([ea, eb]) => !(ea === a && eb === b));
    const updated = library.map(w => w.id === selLibObj.id ? { ...w, edges } : w);
    setLibrary(updated); saveBuilderWFs(updated);
  }
  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMsgs(m => [...m, { role: 'user', text: userMsg }]);
    setChatInput(''); setChatLoading(true);
    try {
      const ctx = previewWF ? `Active workflow context: "${previewWF.name}" (${previewWF.nodes.length} nodes, category: ${previewWF.category}). ` : '';
      const reply = await runContent(`${ctx}User asks: ${userMsg}\n\nYou are JARVIS Workflow Architect — an expert in automation design. Reply concisely with actionable workflow design advice: node suggestions, trigger patterns, edge logic, or best practices. Plain text only, no markdown.`, 'workflow');
      setChatMsgs(m => [...m, { role: 'jarvis', text: reply }]);
    } catch {
      setChatMsgs(m => [...m, { role: 'jarvis', text: 'Connection error. Check Claude integration.' }]);
    } finally { setChatLoading(false); }
  }
  function useTemplate(tpl: TplDef) {
    const wf: BuilderWF = { ...tpl, id: 'BLD-' + Date.now(), savedAt: new Date().toISOString(), fromTemplate: tpl.id };
    const updated = [...library, wf];
    setLibrary(updated); saveBuilderWFs(updated); setSelLib(wf.id); setPanel('library');
  }
  function createCustom() {
    const wf: BuilderWF = {
      id: 'BLD-' + Date.now(), name: 'New Workflow', desc: 'Custom workflow — edit to define.', category: 'CUSTOM',
      source: 'custom', trigger: 'On-demand', tags: [], owner: 'ARC-OPT',
      nodes: [
        { id: 'n1', x: 60, y: 100, label: 'Trigger', team: 'ARC-OPT' },
        { id: 'n2', x: 280, y: 100, label: 'Process', team: 'ARC-OPT' },
        { id: 'n3', x: 500, y: 100, label: 'Deliver', team: 'ARC-OPT' },
      ],
      edges: [['n1', 'n2'], ['n2', 'n3']],
      savedAt: new Date().toISOString(),
    };
    const updated = [...library, wf];
    setLibrary(updated); saveBuilderWFs(updated); setSelLib(wf.id); setPanel('library');
    setEditDraft({ name: wf.name, desc: wf.desc, trigger: wf.trigger, category: wf.category, owner: wf.owner, tags: [] });
    setEditMode(true);
  }
  function deleteLib(id: string) {
    const updated = library.filter(w => w.id !== id);
    setLibrary(updated); saveBuilderWFs(updated);
    if (selLib === id) { setSelLib(null); setEditMode(false); }
  }
  function exportJson(wf: BuilderWF | TplDef) {
    const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${wf.name.replace(/\s+/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const inCss: React.CSSProperties = { padding: '4px 8px', fontSize: 10, background: 'oklch(0.05 0.01 240/0.9)', border: '1px solid var(--line)', color: 'var(--fg)', outline: 'none', fontFamily: 'var(--font-mono)', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 8 }}>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`SEARCH ${WF_TEMPLATES.length} TEMPLATES…`}
          style={{ padding: '5px 10px', fontSize: 10, background: 'oklch(0.05 0.01 240/0.9)', border: '1px solid var(--line)', color: 'var(--fg)', outline: 'none', fontFamily: 'var(--font-mono)', width: 210 }} />
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', flex: 1 }}>
          {allCats.map(c => (
            <button key={c} onClick={() => setCat(c)} className="hud-label"
              style={{ padding: '3px 7px', fontSize: 7.5, cursor: 'pointer', letterSpacing: '0.1em',
                color: cat === c ? '#0d1117' : CYAN_BRIGHT, background: cat === c ? CYAN_BRIGHT : 'transparent',
                border: `1px solid ${CYAN}45` }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button onClick={() => setChatOpen(v => !v)} className="hud-label"
            style={{ padding: '5px 12px', fontSize: 8.5, cursor: 'pointer', letterSpacing: '0.16em',
              color: chatOpen ? '#0d1117' : VIOLET, background: chatOpen ? VIOLET : 'transparent',
              border: `1px solid ${VIOLET}60` }}>
            ⬡ JARVIS {chatOpen ? '◂' : '▸'}
          </button>
          <button onClick={() => setPanel(panel === 'library' ? 'templates' : 'library')} className="hud-label"
            style={{ padding: '5px 12px', fontSize: 8.5, cursor: 'pointer', letterSpacing: '0.16em',
              color: panel === 'library' ? '#0d1117' : AMBER, background: panel === 'library' ? AMBER : 'transparent',
              border: `1px solid ${AMBER}60` }}>
            ◆ LIBRARY ({library.length})
          </button>
          <button onClick={createCustom} className="hud-label"
            style={{ padding: '5px 12px', fontSize: 8.5, cursor: 'pointer', color: JADE, border: `1px solid ${JADE}60`, background: 'transparent', letterSpacing: '0.16em' }}>
            + NEW
          </button>
        </div>
      </div>

      {/* ── 3-panel grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: chatOpen ? '260px 1fr 300px' : '260px 1fr', gap: 10, flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Left: list ── */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, paddingRight: 3 }}>
          <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', flexShrink: 0, marginBottom: 2 }}>
            {panel === 'templates' ? `${filtered.length} / ${WF_TEMPLATES.length} TEMPLATES` : `${library.length} SAVED WORKFLOWS`}
          </div>

          {panel === 'templates' ? filtered.map(tpl => {
            const sc = SRC_COLOR(tpl.source);
            const active = selTpl === tpl.id && !selLib;
            return (
              <div key={tpl.id} onClick={() => { setSelTpl(tpl.id); setSelLib(null); setEditMode(false); }}
                style={{ padding: '7px 9px', cursor: 'pointer', flexShrink: 0,
                  borderLeft: `3px solid ${active ? CYAN_BRIGHT : sc}`,
                  border: `1px solid ${active ? CYAN : 'var(--line-soft)'}`,
                  background: active ? 'oklch(0.78 0.13 215/0.09)' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span className="hud-label" style={{ fontSize: 8.5, color: active ? CYAN_BRIGHT : 'var(--fg)', letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{tpl.name}</span>
                  <span style={{ fontSize: 6.5, color: sc, fontFamily: 'Orbitron', border: `1px solid ${sc}50`, padding: '0 3px', flexShrink: 0, marginLeft: 4, letterSpacing: '0.12em' }}>{tpl.source.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className="font-mono" style={{ fontSize: 7.5, color: AMBER }}>◆ {tpl.category}</span>
                  <span className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>{tpl.nodes.length}n · {tpl.edges.length}e</span>
                </div>
              </div>
            );
          }) : (
            <>
              {library.length === 0 && (
                <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', padding: 16, textAlign: 'center', lineHeight: 1.6 }}>
                  Library empty.<br />Browse templates → USE.
                </div>
              )}
              {library.map(wf => {
                const sc = SRC_COLOR(wf.source);
                const active = selLib === wf.id;
                return (
                  <div key={wf.id} onClick={() => { setSelLib(wf.id); setSelTpl(null); setEditMode(false); }}
                    style={{ padding: '7px 9px', cursor: 'pointer', flexShrink: 0,
                      borderLeft: `3px solid ${active ? AMBER : sc}`,
                      border: `1px solid ${active ? AMBER : 'var(--line-soft)'}`,
                      background: active ? `${AMBER}09` : 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="hud-label" style={{ fontSize: 8.5, color: active ? AMBER : 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, letterSpacing: '0.1em' }}>{wf.name}</span>
                      <button onClick={e => { e.stopPropagation(); deleteLib(wf.id); }}
                        style={{ fontSize: 9, color: 'var(--cyan-dim)', border: 'none', cursor: 'pointer', background: 'transparent', padding: '0 3px', flexShrink: 0 }}>✕</button>
                    </div>
                    <div className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)' }}>
                      {wf.nodes.length}n · {wf.category} · {new Date(wf.savedAt).toLocaleDateString()}
                    </div>
                    {wf.fromTemplate && (
                      <div className="font-mono" style={{ fontSize: 7.5, color: sc }}>↳ tpl: {wf.fromTemplate}</div>
                    )}
                  </div>
                );
              })}
              <button onClick={createCustom} className="hud-label"
                style={{ marginTop: 6, padding: '8px', fontSize: 8.5, color: JADE, border: `1px solid ${JADE}60`, cursor: 'pointer', letterSpacing: '0.2em', background: 'transparent', flexShrink: 0 }}>
                + CREATE NEW WORKFLOW
              </button>
            </>
          )}
        </div>

        {/* ── Center: detail / editor ── */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          {!previewWF ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, opacity: 0.5 }}>
              <div className="font-display" style={{ fontSize: 14, color: CYAN_BRIGHT, letterSpacing: '0.24em' }}>SELECT A TEMPLATE</div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)' }}>
                {WF_TEMPLATES.length} curated workflows · {allCats.length - 1} categories
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 400 }}>
                {(['n8n', 'github', 'jarvis', 'custom'] as const).map(s => (
                  <span key={s} className="hud-label" style={{ fontSize: 8, color: SRC_COLOR(s), border: `1px solid ${SRC_COLOR(s)}45`, padding: '3px 8px', letterSpacing: '0.16em' }}>{s.toUpperCase()}</span>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 7.5, color: SRC_COLOR(previewWF.source), fontFamily: 'Orbitron', letterSpacing: '0.18em', border: `1px solid ${SRC_COLOR(previewWF.source)}50`, padding: '1px 5px' }}>
                      {previewWF.source.toUpperCase()}
                    </span>
                    <span className="hud-label" style={{ fontSize: 7.5, color: AMBER, letterSpacing: '0.16em' }}>◆ {previewWF.category}</span>
                    <span className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.12em' }}>{previewWF.nodes.length}N · {previewWF.edges.length}E</span>
                  </div>
                  {editMode && selLibObj ? (
                    <input value={editDraft.name ?? ''} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                      style={{ ...inCss, fontSize: 14, fontFamily: 'var(--font-display)', marginBottom: 0 }} />
                  ) : (
                    <div className="font-display glow-cyan" style={{ fontSize: 14, color: CYAN_BRIGHT, lineHeight: 1.2 }}>{previewWF.name}</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  {!selLib && selTplObj && (
                    <button onClick={() => useTemplate(selTplObj)} className="hud-label"
                      style={{ padding: '7px 14px', fontSize: 8.5, color: JADE, border: `1px solid ${JADE}60`, cursor: 'pointer', letterSpacing: '0.2em', background: `${JADE}10` }}>
                      ◆ USE TEMPLATE
                    </button>
                  )}
                  {selLib && !editMode && (
                    <button onClick={startEdit} className="hud-label"
                      style={{ padding: '7px 14px', fontSize: 8.5, color: AMBER, border: `1px solid ${AMBER}60`, cursor: 'pointer', letterSpacing: '0.2em', background: 'transparent' }}>
                      ✎ EDIT
                    </button>
                  )}
                  {selLib && editMode && (
                    <>
                      <button onClick={saveLibEdit} className="hud-label"
                        style={{ padding: '7px 14px', fontSize: 8.5, color: JADE, border: `1px solid ${JADE}60`, cursor: 'pointer', letterSpacing: '0.2em', background: `${JADE}12` }}>
                        ✓ SAVE
                      </button>
                      <button onClick={() => setEditMode(false)} className="hud-label"
                        style={{ padding: '5px 10px', fontSize: 8, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', cursor: 'pointer', background: 'transparent' }}>
                        CANCEL
                      </button>
                    </>
                  )}
                  <button onClick={() => exportJson(previewWF)} className="hud-label"
                    style={{ padding: '5px 10px', fontSize: 8, color: CYAN_BRIGHT, border: `1px solid ${CYAN}50`, cursor: 'pointer', letterSpacing: '0.14em', background: 'transparent' }}>
                    ↓ JSON
                  </button>
                </div>
              </div>

              {/* Metadata editor / display */}
              {editMode && selLibObj ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.2em', marginBottom: 3 }}>DESCRIPTION</div>
                    <textarea value={editDraft.desc ?? ''} onChange={e => setEditDraft(d => ({ ...d, desc: e.target.value }))}
                      rows={3} style={{ ...inCss, resize: 'vertical', lineHeight: 1.45 }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.2em', marginBottom: 3 }}>TRIGGER</div>
                      <input value={editDraft.trigger ?? ''} onChange={e => setEditDraft(d => ({ ...d, trigger: e.target.value }))} style={inCss} />
                    </div>
                    <div>
                      <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.2em', marginBottom: 3 }}>OWNER TEAM</div>
                      <input value={editDraft.owner ?? ''} onChange={e => setEditDraft(d => ({ ...d, owner: e.target.value }))} style={inCss} />
                    </div>
                    <div>
                      <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.2em', marginBottom: 3 }}>TAGS (comma-separated)</div>
                      <input value={(editDraft.tags ?? []).join(', ')} onChange={e => setEditDraft(d => ({ ...d, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} style={inCss} />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)', lineHeight: 1.55 }}>{previewWF.desc}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                    {previewWF.tags.map(tag => (
                      <span key={tag} className="font-mono" style={{ fontSize: 7.5, color: 'oklch(0.55 0.08 215)', border: '1px solid var(--line-soft)', padding: '0 4px' }}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 14 }}>
                <Stat label="TRIGGER" value={editMode && editDraft.trigger ? editDraft.trigger : previewWF.trigger} />
                <Stat label="OWNER" value={editMode && editDraft.owner ? editDraft.owner : previewWF.owner} />
                <Stat label="NODES" value={`${previewWF.nodes.length}`} />
                <Stat label="EDGES" value={`${previewWF.edges.length}`} />
              </div>

              {/* DAG Preview */}
              <div>
                <div className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.3em', marginBottom: 5 }}>◆ DAG PREVIEW</div>
                <div style={{ padding: 8, border: '1px solid var(--line-soft)', background: 'oklch(0.05 0.012 240/0.6)' }}>
                  <WorkflowDAG workflow={{ ...previewWF, status: 'active', runs: 0 }} />
                </div>
              </div>

              {/* Nodes */}
              <div>
                <div className="hud-label" style={{ fontSize: 9, color: CYAN_BRIGHT, letterSpacing: '0.28em', marginBottom: 5 }}>
                  ◆ NODES {selLib && editMode ? <span style={{ color: 'var(--cyan-dim)', fontWeight: 400 }}>· CLICK NODE TO EDIT</span> : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {previewWF.nodes.map(n => {
                    const t = TEAMS.find(x => x.id === n.team);
                    const c = t ? colorFor(DIVISIONS[t.div]?.color ?? 'cyan') : 'oklch(0.65 0.08 215)';
                    const isSelNode = selNode === n.id;
                    return (
                      <div key={n.id}>
                        <div onClick={() => { if (selLib && editMode) { if (isSelNode) { setSelNode(null); } else { setSelNode(n.id); setNodeDraft({ label: n.label, team: n.team }); } } }}
                          style={{ display: 'grid', gridTemplateColumns: '28px 90px 1fr 52px auto', gap: 6, alignItems: 'center', padding: '4px 8px',
                            background: isSelNode ? 'oklch(0.10 0.018 240/0.85)' : 'oklch(0.07 0.012 240/0.5)',
                            border: `1px solid ${isSelNode ? CYAN : 'var(--line-soft)'}`,
                            cursor: selLib && editMode ? 'pointer' : 'default' }}>
                          <span className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)' }}>{n.id}</span>
                          <span style={{ fontSize: 7.5, color: c, fontFamily: 'Orbitron', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.team}</span>
                          <span className="font-mono" style={{ fontSize: 9.5, color: 'var(--fg)' }}>{n.label}</span>
                          <span className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', textAlign: 'right' }}>({n.x},{n.y})</span>
                          {selLib && editMode && (
                            <button onClick={e => { e.stopPropagation(); deleteNode(n.id); }}
                              style={{ fontSize: 9, color: 'var(--cyan-dim)', border: 'none', cursor: 'pointer', background: 'transparent', padding: '0 2px' }}>✕</button>
                          )}
                        </div>
                        {isSelNode && selLib && editMode && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '7px 10px', background: 'oklch(0.09 0.016 240/0.9)', border: '1px solid var(--line)', borderTop: 'none' }}>
                            <div>
                              <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.18em', marginBottom: 3 }}>LABEL</div>
                              <input value={nodeDraft.label} onChange={e => setNodeDraft(d => ({ ...d, label: e.target.value }))} style={inCss} />
                            </div>
                            <div>
                              <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.18em', marginBottom: 3 }}>TEAM ID</div>
                              <input value={nodeDraft.team} onChange={e => setNodeDraft(d => ({ ...d, team: e.target.value }))} style={inCss} />
                            </div>
                            <button onClick={() => { updateNode(n.id, nodeDraft); setSelNode(null); }} className="hud-label"
                              style={{ gridColumn: '1/-1', padding: '5px', fontSize: 8.5, color: JADE, border: `1px solid ${JADE}60`, cursor: 'pointer', letterSpacing: '0.18em', background: `${JADE}10` }}>
                              ✓ UPDATE NODE
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selLib && editMode && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px', gap: 6, marginTop: 6 }}>
                    <input value={newNodeLabel} onChange={e => setNewNodeLabel(e.target.value)} placeholder="Node label…" style={inCss}
                      onKeyDown={e => e.key === 'Enter' && addNode()} />
                    <input value={newNodeTeam} onChange={e => setNewNodeTeam(e.target.value)} placeholder="Team ID" style={inCss} />
                    <button onClick={addNode} className="hud-label"
                      style={{ padding: '4px 8px', fontSize: 8.5, color: JADE, border: `1px solid ${JADE}60`, cursor: 'pointer', letterSpacing: '0.14em', background: 'transparent' }}>
                      + NODE
                    </button>
                  </div>
                )}
              </div>

              {/* Edges */}
              <div>
                <div className="hud-label" style={{ fontSize: 9, color: CYAN_BRIGHT, letterSpacing: '0.28em', marginBottom: 5 }}>◆ EDGES</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {previewWF.edges.map(([a, b], i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <span className="font-mono" style={{ fontSize: 9, color: CYAN_BRIGHT, padding: '2px 6px', border: `1px solid ${CYAN}40`, background: 'oklch(0.07 0.012 240/0.5)' }}>{a}→{b}</span>
                      {selLib && editMode && (
                        <button onClick={() => deleteEdge(a, b)} style={{ fontSize: 8, color: 'var(--cyan-dim)', border: 'none', cursor: 'pointer', background: 'transparent', padding: 0 }}>✕</button>
                      )}
                    </span>
                  ))}
                </div>
                {selLib && editMode && (
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 90px 80px', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <input value={addEdgeFrom} onChange={e => setAddEdgeFrom(e.target.value)} placeholder="From (n1)" style={inCss} />
                    <input value={addEdgeTo} onChange={e => setAddEdgeTo(e.target.value)} placeholder="To (n2)" style={inCss}
                      onKeyDown={e => e.key === 'Enter' && addEdge()} />
                    <button onClick={addEdge} className="hud-label"
                      style={{ padding: '4px 8px', fontSize: 8.5, color: CYAN_BRIGHT, border: `1px solid ${CYAN}60`, cursor: 'pointer', letterSpacing: '0.12em', background: 'transparent' }}>
                      + EDGE
                    </button>
                  </div>
                )}
              </div>

              {selLib && showJson && (
                <div>
                  <div className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.28em', marginBottom: 4 }}>◆ RAW JSON</div>
                  <pre className="font-mono" style={{ fontSize: 8.5, color: 'var(--fg)', background: 'oklch(0.04 0.01 240/0.95)', border: '1px solid var(--line-soft)', padding: 10, overflow: 'auto', maxHeight: 280, lineHeight: 1.4, margin: 0 }}>
                    {JSON.stringify(previewWF, null, 2)}
                  </pre>
                </div>
              )}
              {selLib && (
                <button onClick={() => setShowJson(v => !v)} className="hud-label"
                  style={{ alignSelf: 'flex-start', padding: '4px 10px', fontSize: 8, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', cursor: 'pointer', letterSpacing: '0.12em', background: 'transparent' }}>
                  {showJson ? 'HIDE JSON' : 'VIEW JSON'}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Right: Jarvis chat ── */}
        {chatOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: `1px solid ${VIOLET}50`, background: 'oklch(0.04 0.014 285/0.95)' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${VIOLET}35`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div className="font-display" style={{ fontSize: 9.5, color: VIOLET, letterSpacing: '0.24em' }}>⬡ JARVIS ARCHITECT</div>
                <div className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>Workflow design AI assistant</div>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ fontSize: 11, color: 'var(--cyan-dim)', border: 'none', cursor: 'pointer', background: 'transparent' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              {chatMsgs.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div className="hud-label" style={{ fontSize: 7, color: m.role === 'user' ? CYAN_BRIGHT : VIOLET, letterSpacing: '0.2em' }}>
                    {m.role === 'user' ? 'YOU' : '⬡ JARVIS'}
                  </div>
                  <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--fg)', lineHeight: 1.55, padding: '7px 10px', maxWidth: '92%',
                    background: m.role === 'user' ? 'oklch(0.78 0.13 215/0.12)' : `${VIOLET}0f`,
                    border: `1px solid ${m.role === 'user' ? CYAN + '25' : VIOLET + '28'}` }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="font-mono" style={{ fontSize: 9, color: VIOLET }}>⬡ JARVIS thinking…</div>
              )}
            </div>
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${VIOLET}28`, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Describe a workflow or ask…"
                  style={{ flex: 1, padding: '6px 8px', fontSize: 9.5, background: `${VIOLET}0a`, border: `1px solid ${VIOLET}35`, color: 'var(--fg)', outline: 'none', fontFamily: 'var(--font-mono)' }} />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="hud-label"
                  style={{ padding: '6px 12px', fontSize: 8.5, color: chatLoading ? 'var(--cyan-dim)' : VIOLET, border: `1px solid ${VIOLET}55`, cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed', letterSpacing: '0.18em', background: 'transparent' }}>
                  SEND
                </button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {['Design a CI/CD pipeline', 'Add parallel error handling', 'Suggest webhook triggers', 'Optimize for speed'].map(q => (
                  <button key={q} onClick={() => setChatInput(q)} className="font-mono"
                    style={{ fontSize: 7.5, color: VIOLET, border: `1px solid ${VIOLET}30`, cursor: 'pointer', padding: '2px 6px', background: 'transparent' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkflowsScreen() {
  const [workflows, setWorkflows] = useState(() => mergeWorkflows(WORKFLOWS));
  const [selected, setSelected] = useState(workflows[0].id);
  const [running, setRunning] = useState<LiveWF | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Workflow>>({});
  const [selectedCell, setSelectedCell] = useState<string|null>(null);
  const [cellEdits, setCellEditsState]  = useState<Record<string, CellEditData>>(loadCellEdits);
  const [cellDraft, setCellDraft]       = useState<Partial<CellEditData>>({});
  const [mainTab, setMainTab]           = useState<'PIPELINE' | 'BUILDER'>('PIPELINE');

  // Scheduler state (A2)
  const [schedModal, setSchedModal] = useState<{ id: string; name: string } | null>(null);
  const [cronInput, setCronInput]   = useState('0 9 * * 1-5');
  const [schedJobs, setSchedJobs]   = useState<{ id: string; workflowId: string; workflowName: string; expression: string; runCount: number; lastRun?: number }[]>([]);
  const [schedToast, setSchedToast] = useState('');

  const WF_MAIN_TABS: DragTab[] = [
    { id: 'PIPELINE', label: 'PIPELINE · ORCHESTRATION', color: CYAN, pinned: true },
    { id: 'BUILDER',  label: 'WORKFLOW BUILDER · DEV',    color: AMBER },
  ];

  function saveCellEdit(id: string) {
    const t = TEAMS.find(tm => tm.id === id)!;
    const defaults: CellEditData = { name: t.name, status: t.status as CellEditData['status'], lead: t.lead, trigger: '', notes: '' };
    const base = cellEdits[id] || {};
    const next = { ...cellEdits, [id]: { ...defaults, ...base, ...cellDraft } as CellEditData };
    setCellEditsState(next);
    localStorage.setItem(LS_CELL_EDITS, JSON.stringify(next));
    setCellDraft({});
  }
  function resetCellEdit(id: string) {
    const { [id]: _, ...rest } = cellEdits;
    setCellEditsState(rest);
    localStorage.setItem(LS_CELL_EDITS, JSON.stringify(rest));
    setCellDraft({});
  }

  const wf = workflows.find(w => w.id === selected)!;

  function selectWf(id: string) {
    setSelected(id);
    setEditing(false);
    setDraft({});
    setSelectedCell(null);
  }

  function startEdit() {
    setDraft({ name: wf.name, desc: wf.desc, trigger: wf.trigger, owner: wf.owner, status: wf.status });
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); setDraft({}); }

  function saveEdit() {
    const edits = loadEdits();
    edits[wf.id] = { ...(edits[wf.id] || {}), ...draft };
    saveEdits(edits);
    setWorkflows(mergeWorkflows(WORKFLOWS));
    setEditing(false);
    setDraft({});
  }

  function resetEdit() {
    const edits = loadEdits();
    delete edits[wf.id];
    saveEdits(edits);
    setWorkflows(mergeWorkflows(WORKFLOWS));
    setEditing(false);
    setDraft({});
  }

  const hasCustom = !!loadEdits()[wf.id];

  // Load scheduled jobs on mount (A2)
  useEffect(() => {
    (async () => {
      try {
        const jobs = await (window.jarvisBridge as any).workflowListScheduled?.();
        if (jobs) setSchedJobs(jobs);
      } catch {}
    })();
  }, []);

  async function scheduleWorkflow(wfId: string, wfName: string, expression: string) {
    try {
      const id = `sched_${wfId}_${Date.now()}`;
      const r = await (window.jarvisBridge as any).workflowSchedule?.({
        id, expression, workflowId: wfId, workflowName: wfName,
        prompt: `Run workflow "${wfName}" — automated scheduled execution.`,
        channel: 'schedule',
      });
      if (r?.ok) {
        const updated = await (window.jarvisBridge as any).workflowListScheduled?.();
        if (updated) setSchedJobs(updated);
        setSchedToast(`⏰ Scheduled: ${wfName}`);
        setTimeout(() => setSchedToast(''), 3000);
      }
    } catch (e: any) {
      setSchedToast(`⚠ Schedule error: ${String(e?.message || e).slice(0, 50)}`);
      setTimeout(() => setSchedToast(''), 4000);
    }
    setSchedModal(null);
  }

  async function cancelSchedule(id: string) {
    try {
      await (window.jarvisBridge as any).workflowCancel?.(id);
      setSchedJobs(j => j.filter(x => x.id !== id));
      setSchedToast('✕ Schedule cancelled');
      setTimeout(() => setSchedToast(''), 3000);
    } catch {}
  }

  // Real run data from localStorage
  const allRuns = lsGet<{id:string; wf:string; kind:string; input:string; channel:string; output:string; at:string}[]>(LS.runs, []);
  const runCounts  = allRuns.reduce((acc, r) => { acc[r.wf] = (acc[r.wf] || 0) + 1; return acc; }, {} as Record<string, number>);
  const lastRunAt  = allRuns.reduce((acc, r) => { if (!acc[r.wf] || r.at > acc[r.wf]) acc[r.wf] = r.at; return acc; }, {} as Record<string, string>);
  const recentRuns = allRuns.slice(0, 6);

  const inputCss: React.CSSProperties = {
    width: '100%', padding: '7px 10px', fontSize: 11, background: 'oklch(0.05 0.01 240 / 0.8)',
    border: '1px solid var(--line)', color: 'var(--fg)', outline: 'none',
    fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
      <ScreenHeader
        tag="WORKFLOWS"
        title={`${workflows.length + LIVE_WORKFLOWS.length} AUTOMATIONS · ${LIVE_WORKFLOWS.length} LIVE`}
        subtitle="Workflow cells (META + INFRA) plus automations they orchestrate. ▶ LIVE workflows actually run via Claude."
      />
      <DraggableTabs storageKey="jarvis.tabs.workflows.main" defaultTabs={WF_MAIN_TABS} active={mainTab} onActivate={id => setMainTab(id as 'PIPELINE' | 'BUILDER')} />

      {mainTab === 'PIPELINE' && (<>
      {/* Workflow cell roster */}
      <HoloPanel label="WORKFLOW CELLS · ORCHESTRATION ROSTER" code="ROST-W" status="live">
        {/* META + INFRA cells */}
        {(['META','INFRA','CONTENT'] as const).map(div => {
          const filteredTeams = TEAMS.filter(t => t.div === div);
          if (!filteredTeams.length) return null;
          const divColor = colorFor(DIVISIONS[div].color);
          return (
            <div key={div} style={{ marginBottom: div !== 'CONTENT' ? 10 : 0 }}>
              <div className="hud-label" style={{ fontSize: 8, color: divColor, letterSpacing: '0.3em', marginBottom: 5, opacity: 0.7 }}>{DIVISIONS[div].label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
                {filteredTeams.map(t => {
                  const c = colorFor(DIVISIONS[t.div].color);
                  const cellEdit = cellEdits[t.id];
                  const displayName = cellEdit?.name || t.name;
                  const isSelected = selectedCell === t.id;
                  return (
                    <div key={t.id}
                      onClick={() => { setSelectedCell(t.id); setCellDraft({}); }}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 2,
                        padding: '7px 9px', border: `1px solid ${isSelected ? c : 'var(--line-soft)'}`,
                        background: isSelected ? `${c}10` : 'oklch(0.10 0.018 240 / 0.40)',
                        borderLeft: `2px solid ${c}`, position: 'relative',
                        transition: 'border-color 0.15s', cursor: 'pointer',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="hud-label" style={{ fontSize: 8.5, color: c, letterSpacing: '0.15em' }}>{t.id}</span>
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                          {cellEdit && <span style={{ fontSize: 7, color: AMBER, fontFamily: 'var(--font-mono)' }}>✎</span>}
                          <span style={{ width: 5, height: 5, borderRadius: 99, background: (cellEdit?.status ?? t.status) === 'live' ? c : (cellEdit?.status ?? t.status) === 'warn' ? AMBER : 'oklch(0.5 0.04 215)' }} />
                        </div>
                      </div>
                      <div
                        className="font-mono"
                        style={{ fontSize: 9.5, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '1px 0' }}
                        title="Click to edit workflow"
                      >{displayName}</div>
                      <div className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)' }}>{t.lead} · {t.agents}a</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </HoloPanel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.7fr', gap: 12, flex: 1, minHeight: 0 }}>
        <div className="nx-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', paddingRight: 4 }}>
          <div className="hud-label" style={{ fontSize: 8.5, color: AMBER, padding: '4px 6px', letterSpacing: '0.32em' }}>◆ LIVE · CLAUDE</div>
          {LIVE_WORKFLOWS.map(w => (
            <button key={w.id} onClick={() => setRunning(w)}
              style={{
                textAlign: 'left', padding: '10px 12px',
                border: `1px solid ${AMBER}55`,
                background: 'oklch(0.78 0.15 75 / 0.05)',
                display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="hud-label glow-amber" style={{ fontSize: 10, color: AMBER }}>{w.name}</div>
                <div className="font-mono" style={{ fontSize: 9, color: AMBER }}>▶ RUN</div>
              </div>
              <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)' }}>
                {w.trigger}
                {runCounts[w.name] ? <span style={{ color: JADE }}> · {runCounts[w.name]} runs</span> : null}
                {lastRunAt[w.name] ? <span> · last {new Date(lastRunAt[w.name]).toLocaleTimeString()}</span> : null}
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-dim)', lineHeight: 1.4 }}>{w.desc}</div>
            </button>
          ))}

          <div style={{ padding: '12px 6px 4px', display:'flex', alignItems:'center', gap:6 }}>
            <span className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.32em' }}>◆ SCHEDULED · PIPELINE</span>
            <span style={{ fontSize:7.5, fontFamily:'var(--font-mono)', letterSpacing:'0.16em', color: AMBER, background:`${AMBER}18`, border:`1px solid ${AMBER}44`, padding:'1px 6px' }}>CATALOG</span>
          </div>
          {workflows.map(w => {
            const a = w.id === selected;
            const edited = !!loadEdits()[w.id];
            return (
              <div key={w.id} role="button"
                onClick={() => selectWf(w.id)}
                style={{
                  padding: '10px 12px',
                  border: a ? `1px solid ${CYAN}` : '1px solid var(--line-soft)',
                  background: a ? 'oklch(0.78 0.13 215 / 0.08)' : 'transparent',
                  display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="hud-label" style={{ fontSize: 10, color: a ? CYAN_BRIGHT : 'var(--fg)' }}>{w.name}</div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {edited && <span style={{ fontSize: 7.5, color: AMBER, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>EDITED</span>}
                    <Pip status={w.status === 'active' ? 'live' : w.status === 'warn' ? 'warn' : 'idle'} />
                  </div>
                </div>
                <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>{w.trigger} · {w.runs.toLocaleString()} runs</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={e => { e.stopPropagation(); setRunning({ id: w.id, name: w.name, trigger: w.trigger, owner: w.owner, desc: w.desc, kind: 'research' }); }} className="hud-label"
                    style={{ flex: 1, padding: '4px 6px', fontSize: 8, color: JADE, border: `1px solid ${JADE}40`, cursor: 'pointer', letterSpacing: '0.16em', background: 'transparent' }}>
                    ► RUN
                  </button>
                  <button onClick={e => { e.stopPropagation(); setSchedModal({ id: w.id, name: w.name }); setCronInput('0 9 * * 1-5'); }} className="hud-label"
                    style={{ flex: 1, padding: '4px 6px', fontSize: 8, color: AMBER, border: `1px solid ${AMBER}40`, cursor: 'pointer', letterSpacing: '0.16em', background: 'transparent' }}>
                    ⏰ SCHED
                  </button>
                  <button onClick={e => { e.stopPropagation(); selectWf(w.id); setDraft({ name: w.name, desc: w.desc, trigger: w.trigger, owner: w.owner, status: w.status }); setEditing(true); }} className="hud-label"
                    style={{ flex: 1, padding: '4px 6px', fontSize: 8, color: CYAN_BRIGHT, border: `1px solid ${CYAN}40`, cursor: 'pointer', letterSpacing: '0.16em', background: 'transparent' }}>
                    ✏ EDIT
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel — always shows workflow detail + DAG + inline cells roster */}
        <HoloPanel
          label={`DETAIL · ${wf.id}`}
          code={wf.owner}
          status={wf.status === 'active' ? 'live' : wf.status === 'warn' ? 'warn' : 'idle'}
          style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
          bodyClassName="nx-scroll"
        >
          {false ? null : (
            <>
              {/* \u2500\u2500 Header (always visible) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="font-display glow-cyan" style={{ fontSize: 16, color: editing ? AMBER : CYAN_BRIGHT }}>
                    {editing ? `\u270f ${wf.name}` : wf.name}
                  </div>
                  {hasCustom && !editing && <span className="font-mono" style={{ fontSize: 8.5, color: AMBER }}>\u25c6 CUSTOM EDIT ACTIVE</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {hasCustom && !editing && (
                    <button onClick={resetEdit} className="hud-label"
                      style={{ padding: '5px 10px', fontSize: 8.5, color: AMBER, border: `1px solid ${AMBER}60`, cursor: 'pointer', letterSpacing: '0.2em' }}>
                      \u21ba RESET
                    </button>
                  )}
                  {!editing ? (
                    <button onClick={startEdit} className="hud-label"
                      style={{ padding: '5px 10px', fontSize: 8.5, color: CYAN_BRIGHT, border: `1px solid ${CYAN}60`, cursor: 'pointer', letterSpacing: '0.2em' }}>
                      \u270f EDIT
                    </button>
                  ) : (
                    <>
                      <button onClick={cancelEdit} className="hud-label"
                        style={{ padding: '5px 10px', fontSize: 8.5, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', cursor: 'pointer', letterSpacing: '0.2em' }}>
                        \u2715 CANCEL
                      </button>
                      <button onClick={saveEdit} className="hud-label"
                        style={{ padding: '5px 10px', fontSize: 8.5, color: JADE, border: `1px solid ${JADE}60`, cursor: 'pointer', letterSpacing: '0.2em', background: `${JADE}10` }}>
                        \u25c6 SAVE
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--cyan-dim)', marginTop: 6, lineHeight: 1.5 }}>{wf.desc}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <Stat label="TRIGGER" value={wf.trigger} />
                <Stat label="OWNER" value={wf.owner} />
                <Stat label="RUNS" value={wf.runs.toLocaleString()} />
                <Stat label="STATUS" value={wf.status.toUpperCase()} />
              </div>

              {/* \u2500\u2500 DAG (always visible) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
              <div className="hud-label" style={{ marginTop: 16, fontSize: 9, color: AMBER, letterSpacing: '0.32em' }}>\u25c6 DAG{selectedCell ? ` · ${selectedCell} ACTIVE` : ''}</div>
              <div style={{ marginTop: 8, padding: 12, border: `1px solid ${editing ? AMBER + '44' : selectedCell ? AMBER + '33' : 'var(--line-soft)'}`, background: 'oklch(0.06 0.014 240 / 0.5)' }}>
                <WorkflowDAG workflow={wf} highlightTeam={selectedCell} />
              </div>

              {/* ── Orchestration Cells Roster (ALL nodes in this workflow) ── */}
              {(() => {
                // All unique team IDs from DAG nodes — including unregistered ones like 'OPERATOR'
                const wfTeamIds = [...new Set(wf.nodes.map(n => n.team))];
                if (!wfTeamIds.length) return null;
                return (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div className="hud-label" style={{ fontSize: 9, color: CYAN_BRIGHT, letterSpacing: '0.28em' }}>\u25c6 ORCHESTRATION CELLS · {wfTeamIds.length} TEAMS</div>
                      {selectedCell && wfTeamIds.includes(selectedCell) && (
                        <button onClick={() => { setSelectedCell(null); setCellDraft({}); }} className="hud-label"
                          style={{ fontSize: 8.5, padding: '3px 8px', color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', cursor: 'pointer', letterSpacing: '0.18em' }}>
                          \u2715 DESELECT
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                      {wfTeamIds.map(teamId => {
                        const t = TEAMS.find(x => x.id === teamId);
                        const c = t ? colorFor(DIVISIONS[t.div]?.color ?? 'cyan') : 'oklch(0.65 0.08 215)';
                        const cellEdit = t ? cellEdits[t.id] : undefined;
                        const isActive = selectedCell === teamId;
                        const nodeLabel = wf.nodes.find(n => n.team === teamId)?.label ?? teamId;
                        return (
                          <div key={teamId}
                            onClick={() => { setSelectedCell(isActive ? null : teamId); setCellDraft({}); }}
                            style={{
                              display: 'flex', flexDirection: 'column', gap: 2,
                              padding: '7px 9px', cursor: 'pointer',
                              border: `1px solid ${isActive ? c : 'var(--line-soft)'}`,
                              background: isActive ? `${c}15` : 'oklch(0.09 0.016 240 / 0.50)',
                              borderLeft: `3px solid ${isActive ? c : c + '60'}`,
                              transition: 'border-color 0.15s, background 0.15s',
                            }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="hud-label" style={{ fontSize: 8, color: c, letterSpacing: '0.14em' }}>{teamId}</span>
                              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                {cellEdit && <span style={{ fontSize: 7, color: AMBER, fontFamily: 'var(--font-mono)' }}>\u270e</span>}
                                <span style={{ width: 5, height: 5, borderRadius: 99,
                                  background: (cellEdit?.status ?? t?.status) === 'live' ? c
                                    : (cellEdit?.status ?? t?.status) === 'warn' ? AMBER
                                    : 'oklch(0.5 0.04 215)'
                                }} />
                              </div>
                            </div>
                            <div className="font-mono" style={{ fontSize: 9, color: isActive ? 'var(--fg)' : 'var(--cyan-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodeLabel}</div>
                            <div className="font-mono" style={{ fontSize: 7.5, color: 'oklch(0.50 0.08 215)' }}>
                              {t ? `${t.div} · ${t.agents}a` : 'EXTERNAL NODE'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── Cell Editor (inline, below roster) ─────────────── */}
              {selectedCell && (() => {
                const ct = TEAMS.find(t => t.id === selectedCell);
                if (!ct) {
                  // External / unregistered node (e.g. OPERATOR) — show info only
                  const nodeLabel = wf.nodes.find(n => n.team === selectedCell)?.label ?? selectedCell;
                  return (
                    <div className="anim-fade-in" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
                      <div className="hud-label" style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.28em', marginBottom: 8 }}>EXTERNAL NODE · {selectedCell}</div>
                      <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--fg)' }}>{nodeLabel}</div>
                      <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', marginTop: 6, lineHeight: 1.5, padding: '8px 10px', border: '1px dashed var(--line-soft)' }}>
                        ⓘ This node is an external actor — not managed by the orchestration roster. No cell editor available.
                      </div>
                    </div>
                  );
                }
                const c = colorFor(DIVISIONS[ct.div]?.color ?? 'cyan');
                return (
                  <div className="anim-fade-in" style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${c}44` }}>
                    <CellEditorPanel
                      team={ct}
                      edits={cellEdits[selectedCell] || {}}
                      draft={cellDraft}
                      onDraftChange={setCellDraft}
                      onSave={() => saveCellEdit(selectedCell)}
                      onReset={() => resetCellEdit(selectedCell)}
                      onClose={() => { setSelectedCell(null); setCellDraft({}); }}
                    />
                  </div>
                );
              })()}

              {/* \u2500\u2500 Edit form (below DAG, only when editing) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
              {editing && (
                <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${AMBER}44` }}>
                  <div className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.32em' }}>\u270f EDIT METADATA</div>
                  {([
                    { label: 'WORKFLOW NAME', key: 'name', type: 'text' },
                    { label: 'TRIGGER (e.g. 06:00 daily)', key: 'trigger', type: 'text' },
                    { label: 'OWNER TEAM', key: 'owner', type: 'text' },
                  ] as { label: string; key: keyof Workflow; type: string }[]).map(({ label, key, type }) => (
                    <div key={String(key)}>
                      <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4 }}>{label}</div>
                      <input type={type} value={(draft[key] as string) ?? (wf[key] as string)} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} style={inputCss} />
                    </div>
                  ))}
                  <div>
                    <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4 }}>DESCRIPTION</div>
                    <textarea value={(draft.desc as string) ?? wf.desc} onChange={e => setDraft(d => ({ ...d, desc: e.target.value }))} rows={4} style={{ ...inputCss, resize: 'vertical', lineHeight: 1.5 }} />
                  </div>
                  <div>
                    <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4 }}>STATUS</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['active', 'warn', 'queue'] as const).map(s => (
                        <button key={s} onClick={() => setDraft(d => ({ ...d, status: s }))} className="hud-label"
                          style={{
                            padding: '5px 12px', fontSize: 8.5, cursor: 'pointer', letterSpacing: '0.2em',
                            color: (draft.status ?? wf.status) === s ? '#0d1117' : (s === 'active' ? JADE : s === 'warn' ? AMBER : 'var(--cyan-dim)'),
                            background: (draft.status ?? wf.status) === s ? (s === 'active' ? JADE : s === 'warn' ? AMBER : 'var(--cyan-dim)') : 'transparent',
                            border: `1px solid ${s === 'active' ? JADE : s === 'warn' ? AMBER : 'var(--line)'}60`,
                          }}>
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', lineHeight: 1.5, padding: '10px 12px', border: '1px dashed var(--line-soft)' }}>
                    \u24d8 Changes are saved to localStorage and persist across restarts.<br />
                    DAG node layout is not editable here \u2014 export to JSON for advanced edits.
                  </div>
                </div>
              )}

              {!editing && (
                <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginTop: 10, fontStyle: 'italic' }}>
                  \u24d8 Changes saved to local storage. To run live with Claude, pick a workflow from the \u25ba LIVE section.
                </div>
              )}
            </>
          )}
        </HoloPanel>
      </div>

      {recentRuns.length > 0 && (
        <HoloPanel label="RECENT LIVE RUNS · FROM CLAUDE" code="RUNS-Δ" status="live" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentRuns.map(r => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '130px 90px 1fr 150px', gap: 8, alignItems: 'baseline', padding: '5px 0', borderBottom: '1px dashed var(--line-soft)' }}>
                <span className="font-mono" style={{ fontSize: 9, color: AMBER, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.wf}</span>
                <span className="hud-label" style={{ fontSize: 8, color: CYAN_BRIGHT, letterSpacing: '0.12em' }}>{r.kind.toUpperCase()}</span>
                <span className="font-mono" style={{ fontSize: 9.5, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.input?.slice(0, 70) || '—'}</span>
                <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', textAlign: 'right' }}>{new Date(r.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </HoloPanel>
      )}

      </>)}

      {mainTab === 'BUILDER' && (
        <HoloPanel label={`WORKFLOW BUILDER · ${WF_TEMPLATES.length} TEMPLATES`} code="BLD-Δ" status="live" style={{ flex: 1, minHeight: 0 }} bodyClassName="nx-scroll">
          <WorkflowBuilderTab myWorkflows={workflows} />
        </HoloPanel>
      )}

      {running && <LiveWorkflowRunner wf={running} onClose={() => setRunning(null)} />}

      {/* Schedule Toast */}
      {schedToast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, padding: '8px 16px', background: 'oklch(0.08 0.02 240)', border: `1px solid ${AMBER}`, color: AMBER, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
          {schedToast}
        </div>
      )}

      {/* Schedule Modal */}
      {schedModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}
          onClick={() => setSchedModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 360, background: 'oklch(0.07 0.018 240)', border: `1px solid ${AMBER}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.32em' }}>⏰ SCHEDULE WORKFLOW</div>
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg)' }}>{schedModal.name}</div>
            <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', marginTop: -4 }}>Cron expression (UTC)</div>
            <input value={cronInput} onChange={e => setCronInput(e.target.value)}
              style={{ padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'oklch(0.04 0.01 240)', border: `1px solid ${AMBER}55`, color: 'var(--fg)', outline: 'none' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[['Daily 09:00', '0 9 * * *'], ['Weekdays 09:00', '0 9 * * 1-5'], ['Mon 07:00', '0 7 * * 1'], ['Hourly', '0 * * * *'], ['Every 6h', '0 */6 * * *']].map(([label, expr]) => (
                <button key={label} onClick={() => setCronInput(expr)} className="hud-label"
                  style={{ padding: '3px 8px', fontSize: 8, color: cronInput === expr ? AMBER : 'var(--cyan-dim)', border: `1px solid ${cronInput === expr ? AMBER : 'var(--line-soft)'}`, background: cronInput === expr ? `${AMBER}15` : 'transparent', cursor: 'pointer', letterSpacing: '0.12em' }}>
                  {label}
                </button>
              ))}
            </div>
            {schedJobs.filter(j => j.workflowId === schedModal.id).length > 0 && (
              <div style={{ padding: '8px', background: 'oklch(0.04 0.01 240)', border: '1px solid var(--line-soft)' }}>
                <div className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 6 }}>ACTIVE SCHEDULES</div>
                {schedJobs.filter(j => j.workflowId === schedModal.id).map(j => (
                  <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="font-mono" style={{ fontSize: 9, color: JADE }}>{j.expression}</span>
                    <button onClick={() => cancelSchedule(j.id)} className="hud-label"
                      style={{ padding: '2px 6px', fontSize: 7.5, color: ROSE, border: `1px solid ${ROSE}55`, background: 'transparent', cursor: 'pointer', letterSpacing: '0.12em' }}>
                      ✕ CANCEL
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => scheduleWorkflow(schedModal.id, schedModal.name, cronInput)} className="hud-label"
                style={{ flex: 1, padding: '8px', fontSize: 9, color: JADE, border: `1px solid ${JADE}`, background: `${JADE}18`, cursor: 'pointer', letterSpacing: '0.2em' }}>
                ► ACTIVATE
              </button>
              <button onClick={() => setSchedModal(null)} className="hud-label"
                style={{ flex: 1, padding: '8px', fontSize: 9, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', background: 'transparent', cursor: 'pointer', letterSpacing: '0.2em' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
