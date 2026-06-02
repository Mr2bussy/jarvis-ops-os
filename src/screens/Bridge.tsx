import { useState, useRef, useEffect } from 'react';
import { HoloPanel, Sparkline, Stat } from '../components/primitives';
import { ScreenHeader, Chip } from '../components/shell';
import type { OSState, ScreenId } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET, colorFor } from '../theme';
import { TEAMS, DIVISIONS } from '../data/jarvis-data';
import type { Team, Division } from '../data/jarvis-data';
import { BRIEFINGS } from '../data/os-data';
import { AGENT_COUNT, AGENTS } from '../data/agents-catalog';
import { lsGet, lsSet, LS, DEFAULT_CONTEXT, JARVIS_PERSONA, type ChatMsg } from '../lib/claude';
import { useSystemMetrics, useRollingHistory } from '../lib/system';
import { useJarvisLive } from '../lib/live-data';
import { ZeusBotMiniPlayer } from './TradingContent';

/* Merge TEAMS with localStorage status overrides */
const LS_TEAM_STATUS = 'jarvis.team.status';
function getTeamsWithOverrides(): typeof TEAMS {
  try {
    const overrides: Record<string, Team['status']> = JSON.parse(localStorage.getItem(LS_TEAM_STATUS) || '{}');
    if (!Object.keys(overrides).length) return TEAMS;
    return TEAMS.map(t => overrides[t.id] ? { ...t, status: overrides[t.id] } : t);
  } catch { return TEAMS; }
}

/* Live dispatch ticker for Bridge sidebar — uses real activity ring buffer */
function LiveDispatchTicker() {
  const [lines, setLines] = useState<{ts: number; who:string; action:string; target:string}[]>([]);
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const data = await window.jarvisBridge.recentActivity();
        if (alive) setLines(data.slice(0, 7));
      } catch { /* bridge not ready yet */ }
    }
    poll();
    const iv = setInterval(poll, 2500);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [lines]);
  const { data: live } = useJarvisLive(10_000);
  const realCount   = (live?.agentCount  || 0) > 0 ? (live?.agentCount  || AGENT_COUNT) : AGENT_COUNT;
  const onlineCount = Math.round(realCount * 0.43);
  const busyCount   = Math.round(realCount * 0.14);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 2 }}>
        <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>TOTAL <span style={{ color: CYAN_BRIGHT }}>{realCount}</span></span>
        <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>ONLINE <span style={{ color: JADE }}>{onlineCount}</span></span>
        <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>BUSY <span style={{ color: AMBER }}>{busyCount}</span></span>
      </div>
      <div ref={feedRef} style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:120, overflow:'hidden' }}>
        {lines.length === 0 && (
          <span className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', opacity:0.5 }}>// waiting for activity…</span>
        )}
        {lines.map((l, i) => (
          <div key={i} className="anim-fade-in" style={{ display:'grid', gridTemplateColumns:'52px 1fr', gap:6, alignItems:'baseline' }}>
            <span className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)' }}>{new Date(l.ts).toTimeString().slice(0,8)}</span>
            <div style={{ overflow:'hidden' }}>
              <span className="font-mono" style={{ fontSize:8.5, color: CYAN_BRIGHT }}>{l.who} </span>
              <span className="hud-label" style={{ fontSize:7.5, color: AMBER, letterSpacing:'0.16em' }}>{l.action} </span>
              <span className="font-mono" style={{ fontSize:8.5, color:'var(--fg)', opacity:0.7 }}>{l.target}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ScreenProps {
  state: OSState;
  setState: (s: OSState) => void;
  onNav: (id: ScreenId) => void;
  onVoice: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────
 * ZEUS CORE MINI — compact MT5 widget for Bridge sidebar
 * ──────────────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────
 * AGENT RADAR — concentric rings with all TEAMS plotted around central core
 * ──────────────────────────────────────────────────────────────────────── */
const RING_BY_DIV: Record<Division, number> = {
  META: 0,
  INFRA: 1, LEGAL: 1, MIND: 1,
  CONTENT: 2, FINANCE: 2, HEALTH: 2,
  SOCIAL: 2, FITNESS: 2, LIFESTYLE: 2,
};

/* ─────────────────────────────────────────────────────────────────────────
 * TEAM DETAIL PANEL — flies in when a node is clicked
 * ──────────────────────────────────────────────────────────────────────── */
function TeamDetailPanel({ team, color, onClose, onDeploy }: {
  team: Team; color: string; onClose: () => void; onDeploy: (id: string) => void;
}) {
  const [deployed, setDeployed] = useState(false);
  const statusColor = team.status === 'live' ? JADE : team.status === 'warn' ? AMBER : team.status === 'queue' ? VIOLET : 'var(--cyan-dim)';

  return (
    <div className="anim-fade-up" style={{
      position:'absolute', top:8, right:8, width:210, zIndex:20,
      background:'oklch(0.07 0.016 240 / 0.97)',
      border:`1px solid ${color}55`, padding:14,
      boxShadow:`0 0 30px ${color}22`,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span className="hud-label" style={{ fontSize:9, color, letterSpacing:'0.3em' }}>{team.id}</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--cyan-dim)', fontSize:13, cursor:'pointer', lineHeight:1 }}>×</button>
      </div>
      <div className="hud-label" style={{ fontSize:11.5, color:'var(--fg)', lineHeight:1.25, marginBottom:4 }}>{team.name}</div>
      <div className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', marginBottom:10, lineHeight:1.4 }}>{team.role}</div>

      {[
        ['LEAD',    team.lead],
        ['AGENTS',  String(team.agents)],
        ['KPI',     team.kpi],
        ['STATUS',  team.status.toUpperCase()],
        ['DIVISION',team.div],
      ].map(([k, v]) => (
        <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span className="hud-label" style={{ fontSize:8, color:'var(--cyan-dim)' }}>{k}</span>
          <span className="font-mono" style={{ fontSize:9, color: k === 'STATUS' ? statusColor : color }}>{v}</span>
        </div>
      ))}

      {/* progress bar */}
      <div style={{ marginTop:8, marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
          <span className="hud-label" style={{ fontSize:7.5, color:'var(--cyan-dim)' }}>PROGRESS</span>
          <span className="font-mono" style={{ fontSize:8, color }}>{Math.round(team.pct * 100)}%</span>
        </div>
        <div style={{ height:3, background:'oklch(0.78 0.13 215 / 0.08)' }}>
          <div style={{ height:'100%', width:`${team.pct * 100}%`, background: color }} />
        </div>
      </div>

      <button
        onClick={() => { setDeployed(true); onDeploy(team.id); }}
        disabled={deployed || team.status === 'live'}
        className="hud-label"
        style={{
          width:'100%', padding:'7px', fontSize:9, letterSpacing:'0.28em',
          border:`1px solid ${deployed || team.status === 'live' ? JADE : color}`,
          color: deployed || team.status === 'live' ? JADE : color,
          background: deployed ? 'oklch(0.74 0.16 145 / 0.10)' : 'transparent',
          cursor: deployed || team.status === 'live' ? 'default' : 'pointer',
        }}>
        {team.status === 'live' ? '◉ ALREADY LIVE' : deployed ? '✓ CELL DEPLOYED' : '▶ DEPLOY CELL'}
      </button>
    </div>
  );
}

function AgentRadar({ size = 560, state, selected, onSelect }: {
  size?: number; state: OSState; selected: Team | null; onSelect: (t: Team | null) => void;
}) {
  const cx = size / 2, cy = size / 2;
  const ringR = [size * 0.22, size * 0.32, size * 0.42];
  const { data: liveIpc } = useJarvisLive(10_000);
  const liveTeams = getTeamsWithOverrides();
  const realAgentCount = (liveIpc?.agentCount || 0) > 0 ? liveIpc!.agentCount : liveTeams.reduce((s, t) => s + t.agents, 0);

  const grouped: Team[][] = [[], [], []];
  for (const t of liveTeams) grouped[RING_BY_DIV[t.div]].push(t);

  type Placed = { t: Team; x: number; y: number; color: string };
  const placed: Placed[] = [];
  grouped.forEach((teams, ringIdx) => {
    const baseR = ringR[ringIdx];
    const offset = ringIdx * 0.28;
    teams.forEach((t, i) => {
      const angle = (i / teams.length) * Math.PI * 2 + offset - Math.PI / 2;
      placed.push({
        t,
        x: cx + Math.cos(angle) * baseR,
        y: cy + Math.sin(angle) * baseR,
        color: colorFor(DIVISIONS[t.div].color),
      });
    });
  });

  const live = liveTeams.filter(t => t.status === 'live').length;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={CYAN_BRIGHT} stopOpacity="1" />
          <stop offset="35%" stopColor={CYAN}        stopOpacity="0.55" />
          <stop offset="100%" stopColor={CYAN}       stopOpacity="0" />
        </radialGradient>
        <radialGradient id="core-orb" cx="38%" cy="35%" r="70%">
          <stop offset="0%"  stopColor="oklch(0.99 0.04 215)" stopOpacity="1" />
          <stop offset="30%" stopColor={CYAN_BRIGHT}            stopOpacity="0.95" />
          <stop offset="65%" stopColor={CYAN}                   stopOpacity="0.55" />
          <stop offset="100%" stopColor="oklch(0.30 0.10 240)" stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id="core-inner" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="oklch(0.98 0.05 290)" stopOpacity="1" />
          <stop offset="55%" stopColor="oklch(0.70 0.18 290)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="oklch(0.62 0.16 290)" stopOpacity="0" />
        </radialGradient>
        <filter id="core-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={size * 0.012} />
        </filter>
      </defs>

      {/* concentric rings */}
      {[0.18, 0.26, 0.34, 0.42, 0.48].map((f, i) => (
        <circle key={i} cx={cx} cy={cy} r={size * f} fill="none"
          stroke="oklch(0.78 0.13 215 / 0.18)" strokeWidth={i === 4 ? 1 : 0.6}
          strokeDasharray={i % 2 ? '2 6' : '1 4'} />
      ))}
      <line x1={cx} y1={size * 0.04} x2={cx} y2={size * 0.96} stroke="oklch(0.78 0.13 215 / 0.14)" strokeWidth="0.5" />
      <line x1={size * 0.04} y1={cy} x2={size * 0.96} y2={cy} stroke="oklch(0.78 0.13 215 / 0.14)" strokeWidth="0.5" />

      {/* connector lines */}
      {placed.map(p => (
        <line key={`l-${p.t.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y}
          stroke={p.color} strokeOpacity={p.t.status === 'live' ? 0.30 : 0.12}
          strokeWidth="0.6" strokeDasharray="2 5" />
      ))}

      {/* core — minimal: dashed concentric rings + tick marks + small violet pulse + text */}
      <g>
        {/* central radial glow (very soft) */}
        <circle cx={cx} cy={cy} r={size * 0.18} fill="url(#core-glow)" opacity="0.18" />

        {/* concentric core rings — dashed cyan, no rotation */}
        <circle cx={cx} cy={cy} r={size * 0.165} fill="none" stroke={CYAN} strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 5" />
        <circle cx={cx} cy={cy} r={size * 0.130} fill="none" stroke={CYAN} strokeOpacity="0.50" strokeWidth="1" strokeDasharray="3 5" />
        <circle cx={cx} cy={cy} r={size * 0.095} fill="none" stroke={CYAN} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="3 5" />

        {/* fine tick ring (innermost) — many small ticks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const r1 = size * 0.072;
          const r2 = size * 0.082;
          return (
            <line key={i}
              x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
              stroke={CYAN} strokeOpacity={i % 5 === 0 ? 0.8 : 0.35} strokeWidth={i % 5 === 0 ? 1 : 0.6} />
          );
        })}

        {/* 4 cardinal bracket ticks just outside outer ring */}
        {[
          { x: cx, y: cy - size * 0.175, w: size * 0.012, h: size * 0.008 },
          { x: cx, y: cy + size * 0.175, w: size * 0.012, h: size * 0.008 },
          { x: cx - size * 0.175, y: cy, w: size * 0.008, h: size * 0.012 },
          { x: cx + size * 0.175, y: cy, w: size * 0.008, h: size * 0.012 },
        ].map((t, i) => (
          <rect key={i} x={t.x - t.w} y={t.y - t.h} width={t.w * 2} height={t.h * 2}
            fill="none" stroke={CYAN} strokeOpacity="0.7" strokeWidth="1" />
        ))}

        {/* PROCESSING text */}
        <text x={cx} y={cy - size * 0.005} textAnchor="middle" fill={CYAN_BRIGHT}
          fontFamily="Orbitron, monospace" fontSize={size * 0.026} letterSpacing={size * 0.005}
          style={{ filter: `drop-shadow(0 0 3px ${CYAN})` }}>
          // {state === 'listening' ? 'LISTENING' : state === 'speaking' ? 'SPEAKING' : 'PROCESSING'}
        </text>
        <text x={cx} y={cy + size * 0.028} textAnchor="middle" fill="oklch(0.55 0.14 290)"
          fontFamily="Orbitron, monospace" fontSize={size * 0.020} letterSpacing={size * 0.010} opacity="0.55">
          J A R V I S
        </text>

        {/* VOICE HALO — subtle expanding wave (only 1, soft) */}
        {(() => {
          const isVoice = state === 'listening' || state === 'speaking';
          const haloColor = state === 'listening' ? AMBER : state === 'speaking' ? CYAN_BRIGHT : CYAN;
          const dur = isVoice ? '1.6s' : '3.4s';
          const op0 = isVoice ? 0.7 : 0.30;
          const rStart = size * 0.05;
          const rEnd = size * 0.165;
          return (
            <g>
              {[0, 0.85].map((delay, i) => (
                <circle key={i} cx={cx} cy={cy} r={rStart} fill="none"
                  stroke={haloColor} strokeWidth="1" strokeOpacity={op0}>
                  <animate attributeName="r" values={`${rStart};${rEnd}`} dur={dur} begin={`${delay}s`} repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values={`${op0};0`} dur={dur} begin={`${delay}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
          );
        })()}

        {/* tiny central pulse — violet/white star point */}
        <circle cx={cx} cy={cy + size * 0.005} r={size * 0.018} fill="url(#core-inner)" opacity="0.85" className="anim-pulse-soft" />
        <circle cx={cx} cy={cy + size * 0.005} r={size * 0.006} fill="oklch(0.99 0.04 290)" />

        {/* live cells subtitle below rings */}
        <text x={cx} y={cy + size * 0.205} textAnchor="middle" fill="oklch(0.55 0.08 215)"
          fontFamily="JetBrains Mono, monospace" fontSize={size * 0.012} letterSpacing={size * 0.002}>
          {live}/{liveTeams.length} CELLS · {realAgentCount.toLocaleString()} AGENTS
        </text>
      </g>

      {/* nodes */}
      {placed.map(p => {
        const labelLeft = p.x < cx;
        const tx = p.x + (labelLeft ? -8 : 8);
        const isSel = selected?.id === p.t.id;
        return (
          <g key={p.t.id} onClick={() => onSelect(isSel ? null : p.t)} style={{ cursor: 'pointer' }}>
            {/* selection ring */}
            {isSel && (
              <circle cx={p.x} cy={p.y} r={size * 0.038}
                fill={p.color} fillOpacity="0.12"
                stroke={p.color} strokeOpacity="0.8" strokeWidth="1.5" />
            )}
            {/* hover hit-area */}
            <circle cx={p.x} cy={p.y} r={size * 0.028} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={p.t.status === 'live' ? 5 : 4}
              fill={p.color} opacity={p.t.status === 'idle' ? 0.4 : 1}
              className={p.t.status === 'live' ? 'anim-pulse-soft' : ''} />
            {p.t.status === 'live' && (
              <circle cx={p.x} cy={p.y} r="8" fill="none" stroke={p.color} strokeOpacity="0.35" />
            )}
            <text x={tx} y={p.y - 2} textAnchor={labelLeft ? 'end' : 'start'}
              fill={isSel ? p.color : p.color} fontFamily="Orbitron, monospace" fontSize="9" letterSpacing="1.2"
              style={{ textShadow: `0 0 ${isSel ? 8 : 4}px ${p.color}`, fontWeight: isSel ? 700 : 400 }}>
              {p.t.id}
            </text>
            <text x={tx} y={p.y + 9} textAnchor={labelLeft ? 'end' : 'start'}
              fill="oklch(0.72 0.03 215)" fontFamily="JetBrains Mono, monospace" fontSize="8">
              {p.t.name.length > 22 ? p.t.name.slice(0, 22) + '…' : p.t.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * CORE CHAT — compact chat strip embedded under the radar
 * ──────────────────────────────────────────────────────────────────────── */
function CoreChat({ onOpenConsole }: { onOpenConsole: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => lsGet<ChatMsg[]>(LS.console, []));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [streamText, setStreamText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }); }, [msgs, busy]);
  useEffect(() => { lsSet(LS.console, msgs); }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput(''); setErr(null);
    const next: ChatMsg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setBusy(true);
    const sid = 'bc-' + Date.now();
    let acc = '';
    setStreamText('');
    try {
      window.jarvisBridge.onStreamChunk((d) => {
        if (d.id !== sid) return;
        acc += d.text;
        setStreamText(acc);
      });
      const context = lsGet(LS.context, DEFAULT_CONTEXT);
      const sys = JARVIS_PERSONA + '\n\nOPERATOR CONTEXT\n' + context;
      const reply = await window.jarvisBridge.completeStream(
        { messages: next.map(m => ({ role: m.role, content: m.content })), system: sys, maxTokens: 600 },
        sid
      );
      window.jarvisBridge.offStreamChunk();
      setMsgs([...next, { role: 'assistant', content: reply || acc }]);
      setStreamText('');
    } catch (e: any) {
      window.jarvisBridge.offStreamChunk();
      setErr(e?.message || String(e));
      setStreamText('');
    } finally { setBusy(false); }
  }

  const recent = msgs.slice(-3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderTop: '1px solid var(--line)', background: 'oklch(0.07 0.014 240 / 0.55)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="hud-label glow-cyan-sm" style={{ fontSize: 9.5, color: CYAN_BRIGHT, letterSpacing: '0.32em' }}>
          ◆ CORE CHANNEL · DIRECT
        </div>
        <button onClick={onOpenConsole} className="hud-label"
          style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em' }}>
          full console →
        </button>
      </div>
      <div ref={scrollRef} className="nx-scroll" style={{ maxHeight: 92, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {recent.length === 0 && (
          <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)' }}>
            // direct line to JARVIS. ask anything — markets, agents, status, ideas.
          </div>
        )}
        {recent.map((m, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 6 }}>
            <span className="hud-label" style={{ fontSize: 8, color: m.role === 'user' ? AMBER : CYAN_BRIGHT, letterSpacing: '0.22em' }}>
              // {m.role === 'user' ? 'OP' : 'JARVIS'}
            </span>
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg)', lineHeight: 1.35 }}>
              {m.content.length > 220 ? m.content.slice(0, 220) + '…' : m.content}
            </span>
          </div>
        ))}
        {busy && (
          <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 6 }}>
            <span className="hud-label" style={{ fontSize: 8, color: CYAN_BRIGHT, letterSpacing: '0.22em' }}>
              // JARVIS
            </span>
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg)', lineHeight: 1.35 }}>
              {streamText ? streamText.slice(-200) : '…'}
              <span className="anim-pulse-soft" style={{ color: CYAN }}>▊</span>
            </span>
          </div>
        )}
      </div>
      {err && (
        <div className="font-mono" style={{ fontSize: 9.5, color: 'oklch(0.66 0.20 22)' }}>
          // {err}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="// directive…"
          className="font-mono"
          disabled={busy}
          style={{
            flex: 1, padding: '8px 10px', fontSize: 11, color: 'var(--fg)',
            background: 'oklch(0.07 0.014 240 / 0.7)',
            border: `1px solid ${CYAN}55`, outline: 'none',
          }}
        />
        <button onClick={send} disabled={busy || !input.trim()} className="hud-label"
          style={{
            padding: '0 14px', fontSize: 9.5, color: CYAN_BRIGHT,
            border: `1px solid ${CYAN}`, letterSpacing: '0.28em',
            background: 'oklch(0.78 0.13 215 / 0.10)',
            opacity: (busy || !input.trim()) ? 0.4 : 1,
          }}>
          ▶ SEND
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * ACTIVE DIRECTIVE — mission-critical current orders & status
 * ──────────────────────────────────────────────────────────────────────── */
const LS_DIRECTIVES = 'jarvis.directives';
interface Directive { id: string; text: string; priority: 'P0'|'P1'|'P2'; status: 'ACTIVE'|'DONE'|'HOLD'; ts: string; }
function loadDirectives(): Directive[] { try { return JSON.parse(localStorage.getItem(LS_DIRECTIVES)||'[]'); } catch { return []; } }
function saveDirectives(d: Directive[]) { localStorage.setItem(LS_DIRECTIVES, JSON.stringify(d)); }

function ActiveDirective() {
  const [directives, setDirectives] = useState<Directive[]>(loadDirectives);
  const [draft, setDraft] = useState('');
  const [prio, setPrio] = useState<'P0'|'P1'|'P2'>('P1');
  const [expanded, setExpanded] = useState<string|null>(null);

  function addDirective() {
    if (!draft.trim()) return;
    const next = [...directives, { id:`D-${Date.now()}`, text: draft.trim(), priority: prio, status: 'ACTIVE' as const, ts: new Date().toISOString() }];
    setDirectives(next); saveDirectives(next); setDraft('');
  }
  function cycleStatus(id: string) {
    const cycle: Directive['status'][] = ['ACTIVE','HOLD','DONE'];
    const next = directives.map(d => d.id === id ? { ...d, status: cycle[(cycle.indexOf(d.status)+1)%3] } : d);
    setDirectives(next); saveDirectives(next);
  }
  function remove(id: string) {
    const next = directives.filter(d => d.id !== id);
    setDirectives(next); saveDirectives(next);
  }

  const active = directives.filter(d => d.status === 'ACTIVE');
  const hold   = directives.filter(d => d.status === 'HOLD');
  const done   = directives.filter(d => d.status === 'DONE');

  const pcol = (p: Directive['priority']) => p==='P0' ? ROSE : p==='P1' ? AMBER : JADE;
  const scol = (s: Directive['status'])   => s==='ACTIVE' ? CYAN : s==='HOLD' ? AMBER : JADE;

  return (
    <HoloPanel label="◆ ACTIVE DIRECTIVE" code="DIR-Δ" status="live">
      {/* stats row */}
      <div style={{ display:'flex', gap:16, marginBottom:10 }}>
        <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>ACTIVE <span style={{ color:CYAN_BRIGHT, fontWeight:700 }}>{active.length}</span></span>
        <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>HOLD <span style={{ color:AMBER }}>{hold.length}</span></span>
        <span className="font-mono" style={{ fontSize:9, color:'var(--cyan-dim)' }}>DONE <span style={{ color:JADE }}>{done.length}</span></span>
      </div>

      {/* directive list */}
      <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:160, overflow:'auto' }} className="nx-scroll">
        {directives.length === 0 && (
          <div className="font-mono" style={{ fontSize:9.5, color:'var(--cyan-dim)', opacity:0.5, padding:'8px 0' }}>// no active directives · add one below</div>
        )}
        {directives.map(d => {
          const exp = expanded === d.id;
          return (
            <div key={d.id} style={{ border:`1px solid ${scol(d.status)}30`, background:`${scol(d.status)}06`, padding:'6px 9px', borderLeft:`2px solid ${pcol(d.priority)}` }}>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span className="hud-label" style={{ fontSize:7, color:pcol(d.priority), border:`1px solid ${pcol(d.priority)}50`, padding:'1px 4px', flexShrink:0 }}>{d.priority}</span>
                <span className="font-mono" style={{ fontSize:9.5, color: d.status==='DONE' ? 'var(--cyan-dim)' : 'var(--fg)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace: exp ? 'normal' : 'nowrap', textDecoration: d.status==='DONE' ? 'line-through' : 'none', cursor:'pointer' }}
                  onClick={() => setExpanded(exp ? null : d.id)}>{d.text}</span>
                <button onClick={() => cycleStatus(d.id)} className="hud-label" style={{ fontSize:7.5, color:scol(d.status), border:`1px solid ${scol(d.status)}40`, padding:'1px 5px', cursor:'pointer', background:'transparent', flexShrink:0 }}>{d.status}</button>
                <button onClick={() => remove(d.id)} style={{ background:'none', border:'none', color:ROSE, cursor:'pointer', fontSize:10, flexShrink:0, padding:0 }}>✕</button>
              </div>
              {exp && <div className="font-mono" style={{ fontSize:8.5, color:'var(--cyan-dim)', marginTop:4 }}>{new Date(d.ts).toLocaleString()}</div>}
            </div>
          );
        })}
      </div>

      {/* add form */}
      <div style={{ display:'flex', gap:6, marginTop:10, alignItems:'center' }}>
        <div style={{ display:'flex', gap:3 }}>
          {(['P0','P1','P2'] as const).map(p => (
            <button key={p} onClick={() => setPrio(p)} className="hud-label"
              style={{ padding:'3px 7px', fontSize:7.5, cursor:'pointer', color: prio===p ? '#0d1117' : pcol(p), background: prio===p ? pcol(p) : 'transparent', border:`1px solid ${pcol(p)}60` }}>
              {p}
            </button>
          ))}
        </div>
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key==='Enter' && addDirective()}
          placeholder="New directive…"
          style={{ flex:1, padding:'5px 8px', fontSize:9.5, background:'oklch(0.07 0.014 240 / 0.7)', border:`1px solid ${CYAN}40`, color:'var(--fg)', outline:'none', fontFamily:'var(--font-mono)' }} />
        <button onClick={addDirective} className="hud-label"
          style={{ padding:'5px 12px', fontSize:9, color:JADE, border:`1px solid ${JADE}60`, cursor:'pointer', background:'transparent', letterSpacing:'0.2em' }}>+ ADD</button>
      </div>
    </HoloPanel>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * LIVE PULSE — real CPU/RAM/uptime sparkline strip
 * ──────────────────────────────────────────────────────────────────────── */
function LivePulse() {
  const sys = useSystemMetrics(1500);
  const cpuHist = useRollingHistory(sys?.cpu_util ?? null, 60);
  const memHist = useRollingHistory(sys?.mem_pct ?? null, 60);

  if (!sys) return null;
  return (
    <HoloPanel label="LIVE PULSE · YOUR PC" code="PULSE-Δ" status="live">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="hud-label" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>CPU</span>
            <span className="font-mono glow-cyan-sm" style={{ fontSize: 11, color: CYAN_BRIGHT }}>{Math.round(sys.cpu_util * 100)}%</span>
          </div>
          <Sparkline data={cpuHist.length ? cpuHist : [0]} height={36} color={CYAN} />
          <div className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', marginTop: 2 }}>{sys.cpu_count} cores · {sys.cpu_speed_mhz} MHz</div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="hud-label" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>RAM</span>
            <span className="font-mono glow-cyan-sm" style={{ fontSize: 11, color: CYAN_BRIGHT }}>{sys.mem_used_gb.toFixed(1)} / {sys.mem_total_gb.toFixed(0)} GB</span>
          </div>
          <Sparkline data={memHist.length ? memHist : [0]} height={36} color={JADE} />
          <div className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', marginTop: 2 }}>{Math.round(sys.mem_pct * 100)}% in use</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--line-soft)' }}>
        <Stat label="HOST"   value={sys.host} />
        <Stat label="USER"   value={sys.user} />
        <Stat label="UPTIME" value={`${Math.floor(sys.uptime / 3600)}h`} />
        <Stat label="DISK"   value={`${Math.round(sys.disk_pct * 100)}%`} />
      </div>
    </HoloPanel>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * BRIDGE SCREEN
 * ──────────────────────────────────────────────────────────────────────── */
export default function BridgeScreen({ state, onNav, onVoice }: ScreenProps) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [deployedCells, setDeployedCells] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<typeof TEAMS>(getTeamsWithOverrides);
  const morningBrief = BRIEFINGS[0] ?? {
    id: 'STANDBY', tag: 'AWAITING', time: '--:--', title: 'No briefings yet',
    accent: 'cyan' as const, blurb: 'Ask JARVIS to generate a morning briefing.',
    items: [], summary: '',
  };
  const liveCells = teams.filter(t => t.status === 'live').length;

  function handleDeploy(id: string) {
    setDeployedCells(prev => new Set([...prev, id]));
    // Persist deployed status to localStorage
    try {
      const overrides: Record<string, Team['status']> = JSON.parse(localStorage.getItem(LS_TEAM_STATUS) || '{}');
      overrides[id] = 'live';
      localStorage.setItem(LS_TEAM_STATUS, JSON.stringify(overrides));
    } catch { /* non-fatal */ }
    setTeams(getTeamsWithOverrides);
    const team = teams.find(t => t.id === id);
    if (!team) return;
    const msg = `ACTIVATE CELL: ${team.name} (${id}) — Division: ${team.div} — Deploy all ${team.agents} agents in this cell. Confirm activation and report current operational status.`;
    window.jarvisBridge.complete({ messages: [{ role: 'user', content: msg }] })
      .then(() => window.jarvisBridge.recentActivity?.())
      .catch(() => { /* bridge not ready */ });
  }

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1.55fr 1fr', gap: 14, minHeight: 0 }}>
      {/* LEFT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <LivePulse />

        <HoloPanel label="DIVISION ROLLUP" code="DV-Σ" status="live" bodyClassName="nx-scroll">
          {Object.entries(DIVISIONS).map(([k, d]) => {
            const divTeams = teams.filter(t => t.div === k);
            const live = divTeams.filter(t => t.status === 'live').length;
            const c = colorFor(d.color);
            const agents = divTeams.reduce((s, t) => s + t.agents, 0);
            return (
              <div key={k} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: c, boxShadow: `0 0 8px ${c}` }} />
                    <div className="hud-label" style={{ fontSize: 10, color: 'var(--fg)' }}>{d.label}</div>
                  </div>
                  <div className="font-mono glow-cyan-sm" style={{ fontSize: 11, color: c }}>{live}/{divTeams.length}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)' }}>{agents} agents · {divTeams.length} cells</div>
                  <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)' }}>{divTeams.some(t => t.status === 'warn') ? '1 warn' : 'nominal'}</div>
                </div>
                <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                  {divTeams.map(t => (
                    <div key={t.id} style={{ flex: 1, height: 4, background: t.status === 'live' ? c : t.status === 'warn' ? AMBER : 'oklch(0.5 0.04 215)' }} />
                  ))}
                </div>
              </div>
            );
          })}
        </HoloPanel>

        <ZeusBotMiniPlayer />
      </div>

      {/* CENTER — JARVIS CORE (radar + chat) */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="holo holo-brackets relative" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
          <span className="br-bl" /><span className="br-br" />
          <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', background: 'oklch(0.10 0.018 240 / 0.45)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="anim-pulse-soft" style={{ width: 6, height: 6, borderRadius: 99, background: CYAN, boxShadow: `0 0 8px ${CYAN}` }} />
              <span className="hud-label glow-cyan-sm" style={{ fontSize: 9.5, color: CYAN_BRIGHT }}>JARVIS CORE · AGENT RADAR</span>
            </div>
            <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.2em' }}>V-CORE · 001</span>
          </div>

          {/* Radar fills available square; chat below */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="dot-grid" style={{ position: 'absolute', inset: 8, opacity: 0.30 }} />
            <div style={{ position: 'absolute', inset: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 'min(100%, 540px)', aspectRatio: '1 / 1', maxHeight: 'min(100%, 540px)' }}>
                <AgentRadar state={state} selected={selectedTeam} onSelect={setSelectedTeam} />
              </div>
            </div>
            <div style={{ position: 'absolute', top: 10, left: 14, fontSize: 10, zIndex: 2 }} className="font-mono">
              <div style={{ color: 'var(--cyan-dim)' }}>SIG <span className="glow-cyan-sm" style={{ color: CYAN_BRIGHT }}>98.7%</span></div>
              <div style={{ color: 'var(--cyan-dim)' }}>JIT <span style={{ color: CYAN_BRIGHT }}>02 ms</span></div>
            </div>
            <div style={{ position: 'absolute', top: 10, right: 14, fontSize: 10, textAlign: 'right', zIndex: 2 }} className="font-mono">
              <div style={{ color: 'var(--cyan-dim)' }}>CONF <span style={{ color: CYAN_BRIGHT }}>94.3%</span></div>
              <div style={{ color: 'var(--cyan-dim)' }}>STATE <span style={{ color: CYAN_BRIGHT, textTransform: 'uppercase' }}>{state}</span></div>
            </div>
            <button onClick={onVoice} className="hud-label anim-pulse-soft"
              style={{
                position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                padding: '7px 16px', fontSize: 10, color: CYAN_BRIGHT,
                background: 'oklch(0.78 0.13 215 / 0.14)',
                border: `1px solid ${CYAN}`, letterSpacing: '0.32em',
                boxShadow: `0 0 14px ${CYAN}66`, textShadow: `0 0 6px ${CYAN}`,
                zIndex: 2,
              }}>
              ◉ ENTER VOICE MODE
            </button>

            {/* Team detail floating panel */}
            {selectedTeam && (() => {
              const placedTeam = teams.find(t => t.id === selectedTeam.id);
              if (!placedTeam) return null;
              const c = colorFor(DIVISIONS[placedTeam.div].color);
              return (
                <TeamDetailPanel
                  team={placedTeam}
                  color={c}
                  onClose={() => setSelectedTeam(null)}
                  onDeploy={handleDeploy}
                />
              );
            })()}

            {/* hint text when nothing selected */}
            {!selectedTeam && (
              <div className="font-mono" style={{ position:'absolute', bottom:36, left:'50%', transform:'translateX(-50%)', fontSize:8.5, color:'var(--cyan-dim)', opacity:0.55, letterSpacing:'0.14em', whiteSpace:'nowrap', zIndex:2 }}>
                CLICK NODE TO INSPECT &amp; DEPLOY
              </div>
            )}
          </div>

          <CoreChat onOpenConsole={() => onNav('console')} />
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <ActiveDirective />

        <HoloPanel label={`◆ ${morningBrief.tag} · ${morningBrief.time}`} code={morningBrief.id} status="live" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} bodyClassName="nx-scroll">
          <div className="font-display glow-cyan" style={{ fontSize: 14, color: CYAN_BRIGHT, lineHeight: 1.2 }}>{morningBrief.title}</div>
          <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--cyan-dim)', marginTop: 8, lineHeight: 1.5 }}>{morningBrief.blurb}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {morningBrief.items.slice(0, 5).map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: 8, alignItems: 'start' }}>
                <span className="hud-label" style={{ fontSize: 8.5, color: CYAN_BRIGHT, letterSpacing: '0.22em', padding: '2px 4px', border: `1px solid ${CYAN}55`, textAlign: 'center' }}>{it.tag}</span>
                <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--fg)', lineHeight: 1.4 }}>{it.text}</span>
              </div>
            ))}
          </div>
          <button onClick={() => onNav('briefings')} className="hud-label"
            style={{ marginTop: 10, padding: '8px 12px', fontSize: 9, color: CYAN_BRIGHT, border: `1px solid ${CYAN}80`, letterSpacing: '0.28em' }}>
            ◆ ALL BRIEFINGS →
          </button>
        </HoloPanel>

        <HoloPanel label="◈ LIVE DISPATCH" code="DSP-Λ" status="live">
          <LiveDispatchTicker />
        </HoloPanel>
      </div>
    </div>
  );
}

// keep re-exports for any consumers
export { ScreenHeader, Chip, Sparkline };
// silence unused (kept for type re-export consumers)
void ROSE;
