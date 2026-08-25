/**
 * Voice Mode stage — ChatGPT-like orb, JARVIS HUD chrome.
 * No timeline / division mock data. Driven only by live mic level + OS state.
 */
// @ts-nocheck

import { useHudClock } from '../lib/hud-clock';
import { VoiceOrb } from './primitives';
import { CYAN, CYAN_BRIGHT, AMBER } from '../theme';

export function VoiceModeStage({
  state,
  micLevel = 0,
  lastHeard,
  transcript,
  micError,
}: {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  micLevel?: number;
  lastHeard?: string;
  transcript?: string;
  micError?: string;
}) {
  const { hh, mm, ss, dateLabel, tzLabel } = useHudClock();
  const intensity = Math.max(0.35, Math.min(1.6, 0.45 + micLevel * 2.2));
  const orbState =
    state === 'speaking'
      ? 'speaking'
      : state === 'processing'
        ? 'processing'
        : state === 'idle'
          ? 'idle'
          : 'listening';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--ink-0)' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 42%, oklch(0.14 0.04 215 / 0.45) 0%, oklch(0.04 0.012 245) 62%)',
        }}
      />
      <div className="hex-grid" style={{ position: 'absolute', inset: 0, opacity: 0.22 }} />
      <div className="scanlines" style={{ position: 'absolute', inset: 0, opacity: 0.35 }} />
      <div className="vignette" style={{ position: 'absolute', inset: 0 }} />

      {/* Top chrome */}
      <div
        style={{
          position: 'absolute',
          top: 28,
          left: 40,
          right: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          zIndex: 2,
        }}
      >
        <div>
          <div
            className="font-display glow-cyan"
            style={{ fontSize: 14, color: CYAN_BRIGHT, letterSpacing: '0.42em' }}
          >
            J · A · R · V · I · S
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 10, color: 'var(--cyan-dim)', letterSpacing: '0.28em', marginTop: 6 }}
          >
            VOICE · HERMES ROUTE
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            className="font-display glow-cyan"
            style={{ fontSize: 20, color: CYAN_BRIGHT, letterSpacing: '0.16em' }}
          >
            {hh}:{mm}
            <span className="anim-blink">:</span>
            {ss}
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.16em' }}
          >
            {tzLabel} · {dateLabel}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            className="hud-label glow-cyan-sm"
            style={{ fontSize: 11, color: CYAN_BRIGHT, letterSpacing: '0.36em' }}
          >
            // {state.toUpperCase()}
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.18em', marginTop: 6 }}
          >
            MIC {(micLevel * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Orb */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <VoiceOrb state={orbState} size={480} intensity={intensity} />
      </div>

      {/* Conversation strip */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '18%',
          transform: 'translateX(-50%)',
          width: 'min(640px, 86vw)',
          zIndex: 2,
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        {lastHeard && (
          <div
            className="font-mono"
            style={{ fontSize: 11, color: 'var(--cyan-dim)', letterSpacing: '0.08em', marginBottom: 10 }}
          >
            YOU · {lastHeard.slice(0, 180)}
          </div>
        )}
        {transcript && (
          <div
            style={{
              padding: '14px 22px',
              background: 'oklch(0.05 0.014 240 / 0.82)',
              border: `1px solid ${CYAN}44`,
            }}
          >
            <div
              className="hud-label"
              style={{ fontSize: 9, color: CYAN_BRIGHT, letterSpacing: '0.5em', marginBottom: 8 }}
            >
              // JARVIS
            </div>
            <div className="font-mono" style={{ fontSize: 14, color: 'var(--fg)', lineHeight: 1.55 }}>
              {transcript}
            </div>
          </div>
        )}
        {micError && (
          <div className="font-mono" style={{ fontSize: 12, color: AMBER, marginTop: 10 }}>
            {micError}
          </div>
        )}
      </div>
    </div>
  );
}
