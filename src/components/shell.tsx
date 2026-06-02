import { useEffect, useState } from 'react';
import { CYAN, CYAN_BRIGHT, AMBER } from '../theme';
import { Stat } from './primitives';
import VariantCinematic from './VariantCinematic';
import { useSystemMetrics } from '../lib/system';

export type OSState = 'idle' | 'listening' | 'processing' | 'speaking';
export type ScreenId =
  | 'bridge'
  | 'agents'
  | 'workflows'
  | 'briefings'
  | 'trading'
  | 'content'
  | 'apps'
  | 'system'
  | 'console'
  | 'arsenal'
  | 'admin'
  | 'integrations'
  | 'code';

export const NAV: { id: ScreenId; label: string; glyph: string; desc: string }[] = [
  { id: 'bridge', label: 'Bridge', glyph: '◇', desc: 'Operations overview' },
  { id: 'agents', label: 'Agents', glyph: '◈', desc: '22 cells · 5 divisions' },
  { id: 'workflows', label: 'Workflows', glyph: '⋈', desc: 'Roster · automations · live' },
  { id: 'briefings', label: 'Briefings', glyph: '▤', desc: 'Morning · Market · Content' },
  { id: 'trading', label: 'Trading', glyph: '$', desc: 'Floor · positions · ZeusBot' },
  { id: 'content', label: 'Content', glyph: '▶', desc: 'YT · X · IG · Twitch · News' },
  { id: 'apps', label: 'My Apps', glyph: '▣', desc: 'Connect & launch your apps' },
  { id: 'integrations', label: 'Integrations', glyph: '⌬', desc: 'Composio · 485 apps · 5 cats' },
  { id: 'system', label: 'System', glyph: '⊞', desc: 'Real CPU · RAM · Disk · Net' },
  { id: 'console', label: 'Console', glyph: '›_', desc: 'Chat with JARVIS' },
  { id: 'arsenal', label: 'Arsenal', glyph: '◆', desc: `${2145} skills · agents · prompts` },
  { id: 'admin', label: 'Admin', glyph: '⚙', desc: 'LLM library · connectors · paths' },
  { id: 'code', label: 'Code Anim', glyph: '⚡', desc: 'Code animations · AI art · renders' },
];

export function Sidebar({
  active,
  onNav,
  onVoice,
}: {
  active: ScreenId;
  onNav: (id: ScreenId) => void;
  onVoice: () => void;
}) {
  return (
    <aside
      style={{
        width: 240,
        height: '100%',
        borderRight: '1px solid var(--line)',
        background: 'linear-gradient(180deg, oklch(0.07 0.014 240 / 0.85), oklch(0.04 0.012 245 / 0.95))',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
        gap: 14,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg viewBox="0 0 32 32" width="36" height="36" style={{ filter: `drop-shadow(0 0 8px ${CYAN}88)` }}>
          <polygon points="16,3 28,10 28,22 16,29 4,22 4,10" stroke={CYAN} strokeWidth="1.4" fill="none" />
          <circle cx="16" cy="16" r="4" fill={CYAN_BRIGHT} />
          <circle
            cx="16"
            cy="16"
            r="7"
            stroke={CYAN_BRIGHT}
            fill="none"
            strokeOpacity="0.5"
            className="anim-pulse-soft"
          />
        </svg>
        <div>
          <div className="font-display glow-cyan" style={{ fontSize: 15, color: CYAN_BRIGHT }}>
            J·A·R·V·I·S
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.22em' }}
          >
            OPERATIONS · OS
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--line-soft)',
          paddingTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div className="hud-label" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', padding: '4px 6px' }}>
          ◆ MODULES
        </div>
        {NAV.map((n) => {
          const a = active === n.id;
          return (
            <button
              key={n.id}
              onClick={() => onNav(n.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '26px 1fr',
                alignItems: 'center',
                gap: 10,
                padding: '10px 8px',
                textAlign: 'left',
                background: a ? 'oklch(0.78 0.13 215 / 0.10)' : 'transparent',
                borderLeft: a ? `2px solid ${CYAN}` : '2px solid transparent',
                color: a ? CYAN_BRIGHT : 'var(--fg)',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => {
                if (!a)
                  (e.currentTarget as HTMLButtonElement).style.background = 'oklch(0.78 0.13 215 / 0.04)';
              }}
              onMouseLeave={(e) => {
                if (!a) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <div
                className="font-display"
                style={{
                  fontSize: 16,
                  color: a ? CYAN_BRIGHT : 'var(--cyan-dim)',
                  textShadow: a ? `0 0 8px ${CYAN}` : 'none',
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: a ? `1px solid ${CYAN}80` : '1px solid var(--line-soft)',
                }}
              >
                {n.glyph}
              </div>
              <div>
                <div className="hud-label" style={{ fontSize: 10, color: a ? CYAN_BRIGHT : 'var(--fg)' }}>
                  {n.label}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 8.5, color: 'var(--cyan-dim)', marginTop: 2, letterSpacing: '0.06em' }}
                >
                  {n.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={onVoice}
        className="hud-label anim-pulse-soft"
        style={{
          width: '100%',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: 'oklch(0.78 0.13 215 / 0.10)',
          border: `1px solid ${CYAN}`,
          color: CYAN_BRIGHT,
          fontSize: 11,
          letterSpacing: '0.32em',
          boxShadow: `0 0 16px ${CYAN}55, inset 0 0 12px ${CYAN}22`,
          textShadow: `0 0 6px ${CYAN}`,
        }}
      >
        <span style={{ fontSize: 16 }}>◉</span> VOICE MODE
      </button>

      <div
        className="font-mono"
        style={{
          fontSize: 8.5,
          color: 'var(--cyan-dim)',
          letterSpacing: '0.18em',
          textAlign: 'center',
          marginTop: 2,
        }}
      >
        BUILD 04.21.7 · ALPHA-9
      </div>
    </aside>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <div
        className="font-display glow-cyan"
        style={{ fontSize: 18, color: CYAN_BRIGHT, letterSpacing: '0.18em' }}
      >
        {hh}:{mm}
        <span className="anim-blink">:</span>
        {ss}
      </div>
      <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.18em' }}>
        UTC+02 · WED 13 MAY 2026
      </div>
    </div>
  );
}

export function TopBar({
  state,
  screen,
  setState,
}: {
  state: OSState;
  screen: ScreenId;
  setState: (s: OSState) => void;
}) {
  const screenLabel = (NAV.find((n) => n.id === screen) || { label: '' }).label;
  const states: OSState[] = ['idle', 'listening', 'processing', 'speaking'];
  const sys = useSystemMetrics(2000);
  const cpuTxt = sys ? `${Math.round(sys.cpu_util * 100)}%` : '—';
  const ramTxt = sys ? `${Math.round(sys.mem_pct * 100)}%` : '—';
  const upTxt = sys ? `${Math.floor(sys.uptime / 3600)}h` : '—';
  return (
    <header
      style={{
        height: 64,
        borderBottom: '1px solid var(--line)',
        background: 'oklch(0.07 0.014 240 / 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div>
          <div
            className="hud-label glow-cyan-sm"
            style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.32em' }}
          >
            ◤ MODULE
          </div>
          <div className="font-display glow-cyan" style={{ fontSize: 14, color: CYAN_BRIGHT, marginTop: 2 }}>
            {screenLabel.toUpperCase()}
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--line)' }} />
        <Stat label="OP" value={sys?.user?.toUpperCase() || 'OPERATOR'} />
        <Stat label="HOST" value={sys?.host?.toUpperCase() || '—'} />
        <Stat label="GEO" value="DE/EU-W" />
      </div>

      <Clock />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Stat label="CPU" value={cpuTxt} />
        <Stat label="RAM" value={ramTxt} />
        <Stat label="UP" value={upTxt} />
        <div style={{ width: 1, height: 32, background: 'var(--line)' }} />
        <div className="hud-label" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>
          STATE
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {states.map((s) => {
            const a = s === state;
            return (
              <button
                key={s}
                onClick={() => setState(s)}
                className="hud-label"
                style={{
                  fontSize: 8.5,
                  padding: '5px 9px',
                  background: a ? 'oklch(0.78 0.13 215 / 0.18)' : 'transparent',
                  border: `1px solid ${a ? CYAN : 'var(--line-soft)'}`,
                  color: a ? CYAN_BRIGHT : 'var(--cyan-dim)',
                  textShadow: a ? `0 0 6px ${CYAN}` : 'none',
                  letterSpacing: '0.28em',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export function VoiceOverlay({
  state,
  onClose,
  transcript,
  micError,
  micName,
  diag,
}: {
  state: OSState;
  onClose: () => void;
  transcript?: string;
  micError?: string;
  micName?: string;
  diag?: {
    hasGemini: boolean;
    geminiOk: boolean;
    geminiErr: string;
    model: string;
    sttModel?: string;
    hasAnthropic?: boolean;
    hasGithub?: boolean;
    githubModel?: string;
    githubFallback?: string;
    hasOllama?: boolean;
    ollamaModel?: string;
    ollamaSTTModel?: string;
    hasQwen?: boolean;
    qwenModel?: string;
    hasBrowserSTT?: boolean;
  } | null;
}) {
  const STATUS_LABEL: Record<OSState, string> = {
    idle: 'STANDBY',
    listening: 'LISTENING',
    processing: 'PROCESSING',
    speaking: 'RESPONDING',
  };
  const STATUS_COLOR: Record<OSState, string> = {
    idle: 'var(--cyan-dim)',
    listening: CYAN_BRIGHT,
    processing: AMBER,
    speaking: '#c8fb4e',
  };
  return (
    <div
      className="anim-fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--ink-0)' }}
    >
      <VariantCinematic state={state} />

      {/* ── Status bar ── */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1002,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          background: 'oklch(0.04 0.012 245 / 0.9)',
          border: `1px solid ${CYAN}33`,
          padding: '8px 28px',
          borderRadius: 3,
        }}
      >
        {/* Pulse dot */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: STATUS_COLOR[state],
            boxShadow: `0 0 8px ${STATUS_COLOR[state]}`,
            display: 'inline-block',
            animation: state === 'listening' ? 'pulse-ring 1.2s ease-in-out infinite' : 'none',
          }}
        />
        <span
          className="hud-label"
          style={{ fontSize: 10, color: STATUS_COLOR[state], letterSpacing: '0.5em' }}
        >
          {STATUS_LABEL[state]}
        </span>
        {/* Mic info */}
        {micName && (
          <span
            className="font-mono"
            style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.18em' }}
          >
            ◎ {micName.slice(0, 32)}
          </span>
        )}
      </div>

      {/* ── JARVIS response text — only when speaking ── */}
      {state === 'speaking' && transcript && (
        <div
          style={{
            position: 'absolute',
            bottom: '22%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1002,
            textAlign: 'center',
            maxWidth: 720,
            background: 'oklch(0.04 0.012 245 / 0.92)',
            border: `1px solid ${CYAN}55`,
            padding: '14px 32px',
            borderRadius: 4,
            boxShadow: `0 0 20px ${CYAN}22`,
          }}
        >
          <div
            className="hud-label"
            style={{ fontSize: 9, color: CYAN_BRIGHT, letterSpacing: '0.6em', marginBottom: 8 }}
          >
            // JARVIS
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 13, color: 'var(--fg)', letterSpacing: '0.04em', lineHeight: 1.65 }}
          >
            {transcript}
          </div>
        </div>
      )}

      {/* ── Error display ── */}
      {micError && (
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1003,
            textAlign: 'center',
            maxWidth: 600,
            background: 'oklch(0.08 0.02 25 / 0.95)',
            border: '1px solid #ff4444aa',
            padding: '10px 24px',
            borderRadius: 4,
          }}
        >
          <div
            className="hud-label"
            style={{ fontSize: 9, color: '#ff6666', letterSpacing: '0.5em', marginBottom: 4 }}
          >
            ⚠ ERROR
          </div>
          <div className="font-mono" style={{ fontSize: 11, color: '#ffaaaa', letterSpacing: '0.06em' }}>
            {micError}
          </div>
        </div>
      )}

      {/* ── Diagnostics panel (bottom-left) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 80,
          zIndex: 1002,
          background: 'oklch(0.04 0.012 245 / 0.88)',
          border: `1px solid ${CYAN}22`,
          padding: '12px 20px',
          borderRadius: 3,
          minWidth: 240,
        }}
      >
        <div
          className="hud-label"
          style={{ fontSize: 9, color: CYAN_BRIGHT, letterSpacing: '0.4em', marginBottom: 10 }}
        >
          ◆ SYSTEM STATUS
        </div>
        {/* STT — Browser Web Speech (primary) → Ollama → Gemini */}
        <DiagRow
          label={diag?.hasBrowserSTT ? 'BROWSER STT' : diag?.hasOllama ? 'OLLAMA STT' : 'GEMINI STT'}
          ok={diag?.hasBrowserSTT ? true : diag?.hasOllama ? true : diag?.hasGemini && diag?.geminiOk}
          pending={!diag}
          detail={
            diag?.hasBrowserSTT
              ? `webSpeechRecognition · chrome built-in · free`
              : diag?.hasOllama
                ? `${diag.ollamaSTTModel ?? 'whisper'} · ollama${diag.hasGemini ? ' → gemini fallback' : ''}`
                : diag?.geminiErr ||
                  (diag?.hasGemini ? `${diag?.sttModel ?? 'flash-lite'} · transcribe` : 'KEY MISSING')
          }
        />
        {/* Response model — shows which AI is active */}
        <DiagRow
          label="JARVIS RESPONSE"
          ok={
            diag
              ? diag.hasOllama || diag.hasQwen || diag.hasAnthropic || diag.hasGithub || diag.hasGemini
              : undefined
          }
          pending={!diag}
          detail={
            diag?.hasOllama
              ? `${diag.ollamaModel ?? 'qwen3-coder-next'} · ollama`
              : diag?.hasQwen
                ? `${diag.qwenModel ?? 'qwen-plus'} · dashscope`
                : diag?.hasGithub
                  ? `${diag.githubModel ?? 'gpt-4.1-mini'} → ${diag.githubFallback ?? 'gpt-4o-mini'} · github pro`
                  : diag?.hasAnthropic
                    ? `claude · anthropic`
                    : diag?.hasGemini
                      ? `${diag.model} · gemini`
                      : 'NO KEY'
          }
        />
        {/* Mic */}
        <DiagRow
          label="MICROPHONE"
          ok={!micError || !micError.includes('blocked')}
          detail={micName || 'Detecting…'}
        />
        {/* Voice synth */}
        <DiagRow label="VOICE SYNTH" ok detail="speechSynthesis" />
      </div>

      {/* ── Controls (bottom-right) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          right: 80,
          zIndex: 1002,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <div
          className="font-mono"
          style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.3em', marginBottom: 4 }}
        >
          {state === 'listening'
            ? '● Speak now'
            : state === 'processing'
              ? '◌ Processing…'
              : state === 'speaking'
                ? '▶ JARVIS speaking'
                : ''}
        </div>
        <button
          onClick={onClose}
          className="hud-label"
          style={{
            padding: '10px 20px',
            fontSize: 10,
            color: CYAN_BRIGHT,
            background: 'oklch(0.04 0.012 245 / 0.7)',
            border: `1px solid ${CYAN}`,
            letterSpacing: '0.32em',
            boxShadow: `0 0 10px ${CYAN}66`,
            textShadow: `0 0 6px ${CYAN}`,
            cursor: 'pointer',
          }}
        >
          ✕ EXIT VOICE
        </button>
      </div>
    </div>
  );
}

function DiagRow({
  label,
  ok,
  pending,
  detail,
}: {
  label: string;
  ok?: boolean;
  pending?: boolean;
  detail?: string;
}) {
  const col = pending ? 'var(--cyan-dim)' : ok ? '#c8fb4e' : '#ff6666';
  const sym = pending ? '○' : ok ? '●' : '✕';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <span style={{ color: col, fontSize: 9, width: 10 }}>{sym}</span>
      <span
        className="hud-label"
        style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.3em', width: 100 }}
      >
        {label}
      </span>
      <span
        className="font-mono"
        style={{ fontSize: 8.5, color: ok ? 'var(--fg)' : col, letterSpacing: '0.1em' }}
      >
        {detail || '—'}
      </span>
    </div>
  );
}

export function AppBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 30%, oklch(0.12 0.03 215 / 0.55) 0%, oklch(0.04 0.012 245) 70%)',
        }}
      />
      <div className="hex-grid" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
      <div className="scanlines" style={{ position: 'absolute', inset: 0 }} />
      <div className="grain" style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

export function ScreenHeader({
  tag,
  title,
  subtitle,
  right,
}: {
  tag: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}
    >
      <div>
        <div
          className="hud-label glow-cyan-sm"
          style={{ fontSize: 9.5, color: 'oklch(0.78 0.15 75)', letterSpacing: '0.4em' }}
        >
          ◆ {tag}
        </div>
        <div
          className="font-display glow-cyan"
          style={{ fontSize: 24, color: CYAN_BRIGHT, marginTop: 6, letterSpacing: '0.18em' }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            className="font-mono"
            style={{ fontSize: 11, color: 'var(--cyan-dim)', marginTop: 6, letterSpacing: '0.08em' }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

export function Chip({
  children,
  active,
  onClick,
  color = CYAN,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="hud-label"
      style={{
        fontSize: 9,
        padding: '6px 10px',
        letterSpacing: '0.28em',
        background: active ? 'oklch(0.78 0.13 215 / 0.18)' : 'transparent',
        border: `1px solid ${active ? color : 'var(--line-soft)'}`,
        color: active ? CYAN_BRIGHT : 'var(--cyan-dim)',
        textShadow: active ? `0 0 6px ${color}` : 'none',
      }}
    >
      {children}
    </button>
  );
}
