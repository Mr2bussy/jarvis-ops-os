import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { CYAN, CYAN_BRIGHT, VIOLET, AMBER, ROSE, JADE } from '../theme';
import type { CellStatus } from '../data/jarvis-data';

/* ── HoloPanel ──────────────────────────────────────────────── */
export function HoloPanel({
  label, code, status = 'live', accent = 'cyan', className = '', bodyClassName = '', style, bodyStyle, children,
}: {
  label: string; code?: string; status?: CellStatus; accent?: 'cyan' | 'amber' | 'violet';
  className?: string; bodyClassName?: string; style?: CSSProperties; bodyStyle?: CSSProperties; children?: ReactNode;
}) {
  const dot = status === 'warn' ? AMBER : status === 'queue' ? 'oklch(0.5 0.04 215)' : status === 'live' ? CYAN : JADE;
  void accent;
  return (
    <div className={`holo holo-brackets relative anim-fade-up ${className}`} style={style}>
      <span className="br-bl" /><span className="br-br" />
      <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', background: 'oklch(0.10 0.018 240 / 0.45)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="anim-pulse-soft" style={{ width: 6, height: 6, borderRadius: 99, background: dot, boxShadow: `0 0 8px ${dot}`, flexShrink: 0 }} />
          <span className="hud-label glow-cyan-sm" style={{ fontSize: 9.5, color: CYAN_BRIGHT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </div>
        {code && <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.2em', flexShrink: 0 }}>{code}</span>}
      </div>
      <div className={bodyClassName} style={{ padding: 12, ...bodyStyle }}>{children}</div>
    </div>
  );
}

/* ── Sparkline ──────────────────────────────────────────────── */
export function Sparkline({ data, height = 28, color = CYAN, fill = true }:
  { data: number[]; height?: number; color?: string; fill?: boolean }) {
  // filter NaN/null, need at least 1 point
  const clean = (data ?? []).map(v => (typeof v === 'number' && isFinite(v) ? v : null)).filter(v => v !== null) as number[];
  if (clean.length === 0) return null;
  // duplicate single point so pts_data.length-1 is never 0 (avoids NaN x coords)
  const pts_data = clean.length === 1 ? [clean[0], clean[0]] : clean;
  const w = 100, h = height;
  const max = Math.max(...pts_data, 1), min = Math.min(...pts_data, 0);
  const range = (max - min) || 1;
  const pts = pts_data.map((d, i) => {
    const x = (i / (pts_data.length - 1)) * w;
    const y = h - ((d - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const gid = 'sg-' + Math.random().toString(36).slice(2, 8);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }}>
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.30" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`} />
        </>
      )}
      <polyline fill="none" stroke={color} strokeWidth="1.2" points={pts} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
    </svg>
  );
}

/* ── ProgressArc ────────────────────────────────────────────── */
export function ProgressArc({ value = 0, size = 72, label, sub, color = CYAN, thickness = 2 }:
  { value?: number; size?: number; label?: string; sub?: string; color?: string; thickness?: number }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const dash = c * value;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity="0.12" strokeWidth={thickness} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={thickness} fill="none" strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="font-display glow-cyan-sm" style={{ fontSize: size > 80 ? 14 : 11, color: CYAN_BRIGHT, lineHeight: 1 }}>{label ?? `${Math.round(value * 100)}%`}</div>
        {sub && <div className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.18em', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Waveform ───────────────────────────────────────────────── */
export function Waveform({ active = true, bars = 48, color = CYAN, height = 36 }:
  { active?: boolean; bars?: number; color?: string; height?: number }) {
  const [hs, setHs] = useState<number[]>(() => Array.from({ length: bars }, () => 0.2));
  useEffect(() => {
    if (!active) { setHs(h => h.map(() => 0.10)); return; }
    const id = setInterval(() => {
      setHs(prev => prev.map((_, i) => {
        const w = Math.sin(Date.now() / 140 + i * 0.4) * 0.4;
        return Math.max(0.10, Math.min(1, 0.5 + w + Math.random() * 0.30));
      }));
    }, 75);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      {hs.map((h, i) => (
        <div key={i} style={{
          flex: 1, height: `${h * 100}%`, background: color,
          opacity: active ? 0.85 : 0.25, borderRadius: 1,
          boxShadow: active ? `0 0 4px ${color}` : 'none',
          transition: 'height 90ms linear',
        }} />
      ))}
    </div>
  );
}

/* ── VoiceOrb ───────────────────────────────────────────────── */
export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking';

function buildHexRing(cx: number, cy: number, r: number, segs: number, gap = 4) {
  const arcs: string[] = []; const segDeg = 360 / segs - gap;
  for (let i = 0; i < segs; i++) {
    const s = i * (360 / segs) + gap / 2, e = s + segDeg;
    const sx = cx + r * Math.cos(s * Math.PI / 180), sy = cy + r * Math.sin(s * Math.PI / 180);
    const ex = cx + r * Math.cos(e * Math.PI / 180), ey = cy + r * Math.sin(e * Math.PI / 180);
    arcs.push(`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`);
  }
  return arcs.join(' ');
}
function buildTicks(cx: number, cy: number, ri: number, ro: number, count: number) {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    lines.push(`M ${cx + ri * Math.cos(a)} ${cy + ri * Math.sin(a)} L ${cx + ro * Math.cos(a)} ${cy + ro * Math.sin(a)}`);
  }
  return lines.join(' ');
}

export function VoiceOrb({ state = 'processing', size = 520, intensity = 1 }:
  { state?: OrbState; size?: number; intensity?: number }) {
  const accent = state === 'processing' ? VIOLET : state === 'speaking' ? CYAN_BRIGHT : CYAN;
  const dim = state === 'idle' ? 0.55 : state === 'processing' ? 0.95 : 1;
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 48 }, () => 0.3));
  useEffect(() => {
    const active = state !== 'idle';
    if (!active) { setBars(b => b.map(() => 0.18)); return; }
    const id = setInterval(() => {
      setBars(prev => prev.map((_, i) => {
        const base = state === 'speaking' ? 0.55 : state === 'processing' ? 0.40 : 0.45;
        const w = Math.sin(Date.now() / 180 + i * 0.6) * 0.25;
        return Math.max(0.12, Math.min(1, base + w + Math.random() * 0.30));
      }));
    }, 70);
    return () => clearInterval(id);
  }, [state]);

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <div className="anim-pulse-scale" style={{
        position: 'absolute', inset: -size * 0.05, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}55 0%, ${accent}15 30%, transparent 65%)`,
        filter: 'blur(14px)', opacity: dim * intensity,
      }} />
      <svg viewBox="0 0 600 600" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: `drop-shadow(0 0 12px ${accent}88)` }} fill="none" stroke={accent} strokeWidth={1}>
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E0FBFF" stopOpacity="0.95" />
            <stop offset="35%" stopColor={accent} stopOpacity="0.85" />
            <stop offset="70%" stopColor={accent} stopOpacity="0.20" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0FBFF" stopOpacity="1" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <g className="anim-spin-slow" style={{ transformOrigin: '300px 300px' }}>
          <path d={buildHexRing(300, 300, 285, 24)} stroke={accent} strokeOpacity="0.45" />
          <circle cx="300" cy="300" r="285" stroke={accent} strokeOpacity="0.06" />
        </g>
        <g className="anim-spin-rev" style={{ transformOrigin: '300px 300px' }}>
          <path d={buildTicks(300, 300, 250, 266, 72)} stroke={accent} strokeOpacity="0.45" />
          <path d={buildTicks(300, 300, 248, 272, 12)} stroke={accent} strokeOpacity="0.85" strokeWidth="1.5" />
        </g>
        <g className="anim-spin-medium" style={{ transformOrigin: '300px 300px' }}>
          <path d={buildHexRing(300, 300, 220, 6)} stroke={accent} strokeOpacity="0.85" strokeWidth="1.4" />
        </g>
        <g className="anim-spin-fast" style={{ transformOrigin: '300px 300px' }}>
          <path d={buildTicks(300, 300, 196, 206, 90)} stroke={accent} strokeOpacity="0.30" />
        </g>
        {[0, 90, 180, 270].map(a => {
          const rad = a * Math.PI / 180;
          const cx = 300 + 300 * Math.cos(rad), cy = 300 + 300 * Math.sin(rad);
          return (<g key={a} transform={`translate(${cx} ${cy}) rotate(${a + 90})`}>
            <path d="M -10 -8 L -10 0 L 10 0 L 10 -8" stroke={accent} strokeWidth="1.5" />
          </g>);
        })}
        <g style={{ transformOrigin: '300px 300px' }}>
          {bars.map((h, i) => {
            const a = (i / bars.length) * Math.PI * 2;
            const ri = 130, len = 38 * h;
            const x1 = 300 + ri * Math.cos(a), y1 = 300 + ri * Math.sin(a);
            const x2 = 300 + (ri + len) * Math.cos(a), y2 = 300 + (ri + len) * Math.sin(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#barG)" strokeWidth="2.4" strokeLinecap="round" opacity={dim} />;
          })}
        </g>
        <circle cx="300" cy="300" r="118" stroke={accent} strokeOpacity="0.55" />
        <circle cx="300" cy="300" r="100" stroke={accent} strokeOpacity="0.20" />
        <circle cx="300" cy="300" r="86" fill="url(#coreGlow)" stroke="none" opacity={dim} />
        <circle cx="300" cy="300" r="86" stroke="#E0FBFF" strokeOpacity="0.85" strokeWidth="1" className="anim-pulse-soft" />
        <polygon points="300,232 358,266 358,334 300,368 242,334 242,266" stroke={accent} strokeWidth="1.2" strokeOpacity="0.85" />
        <line x1="300" y1="208" x2="300" y2="232" stroke={accent} strokeOpacity="0.6" />
        <line x1="300" y1="368" x2="300" y2="392" stroke={accent} strokeOpacity="0.6" />
        <line x1="208" y1="300" x2="232" y2="300" stroke={accent} strokeOpacity="0.6" />
        <line x1="368" y1="300" x2="392" y2="300" stroke={accent} strokeOpacity="0.6" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="hud-label glow-cyan-sm anim-flicker" style={{ fontSize: 11, color: CYAN_BRIGHT }}>
            {state === 'idle' && 'STANDBY'}
            {state === 'listening' && '// LISTENING'}
            {state === 'speaking' && '// TRANSMITTING'}
            {state === 'processing' && '// PROCESSING'}
          </div>
          <div className="font-display" style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.4em', marginTop: 4 }}>J·A·R·V·I·S</div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat / Pip / StepRow ───────────────────────────────────── */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span className="glow-cyan-sm" style={{ color: CYAN_BRIGHT }}>{value}</span>
      {sub && <span style={{ opacity: 0.55 }}>{sub}</span>}
    </div>
  );
}

export function Pip({ status }: { status: CellStatus }) {
  const c = status === 'warn' ? AMBER : status === 'queue' ? 'oklch(0.5 0.04 215)' : status === 'idle' ? 'oklch(0.5 0.04 215 / 0.5)' : CYAN;
  return <span className="anim-pulse-soft" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 99, background: c, boxShadow: `0 0 6px ${c}`, flexShrink: 0 }} />;
}

export function StepRow({ step, dense = false }:
  { step: { i: number; label: string; pct: number; dur: string; status: 'done' | 'active' | 'queue' }; dense?: boolean }) {
  const isActive = step.status === 'active';
  const isDone = step.status === 'done';
  const color = isDone ? JADE : isActive ? CYAN : 'oklch(0.5 0.04 215)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '20px 80px 1fr 70px 60px', alignItems: 'center', gap: 8, padding: dense ? '4px 0' : '6px 0', borderBottom: '1px dashed var(--line-soft)' }}>
      <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)' }}>{String(step.i).padStart(2, '0')}</div>
      <div className="hud-label" style={{ fontSize: 9.5, color: isActive ? CYAN_BRIGHT : 'var(--fg-dim)' }}>{step.label}</div>
      <div style={{ position: 'relative', height: 4, background: 'oklch(0.78 0.13 215 / 0.10)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${step.pct * 100}%`, background: color, boxShadow: isActive ? `0 0 8px ${color}` : 'none' }} />
      </div>
      <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)', textAlign: 'right' }}>{step.dur}</div>
      <div className="font-mono" style={{ fontSize: 9.5, color, textAlign: 'right' }}>
        {isDone ? '✔ DONE' : isActive ? '● LIVE' : '○ QUEUE'}
      </div>
    </div>
  );
}

export { CYAN, CYAN_BRIGHT, VIOLET, AMBER, ROSE, JADE };
