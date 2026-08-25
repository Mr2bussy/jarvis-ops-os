import { useEffect, useState } from 'react';
import { VoiceOrb, StepRow } from './primitives';
import { CYAN, CYAN_BRIGHT, AMBER, colorFor } from '../theme';
import { DIRECTIVE, TEAMS, DIVISIONS, TICKER } from '../data/jarvis-data';
import type { OSState } from './os-types';

function ClockBlock() {
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
        style={{ fontSize: 22, color: CYAN_BRIGHT, letterSpacing: '0.18em' }}
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

export default function VariantCinematic({ state }: { state: OSState }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* scale-to-fit: render at 1920×1080 and scale down to fill container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 1920,
          height: 1080,
          transform: 'translate(-50%, -50%) scale(var(--vc-scale, 1))',
          transformOrigin: 'center center',
          background: 'var(--ink-0)',
          overflow: 'hidden',
        }}
        ref={(el) => {
          if (!el) return;
          const parent = el.parentElement!;
          const sx = parent.clientWidth / 1920;
          const sy = parent.clientHeight / 1080;
          const s = Math.min(sx, sy);
          el.style.setProperty('--vc-scale', String(s));
          el.style.transform = `translate(-50%, -50%) scale(${s})`;
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 50%, oklch(0.10 0.03 215 / 0.5) 0%, oklch(0.03 0.01 245) 70%)',
          }}
        />
        <div className="hex-grid" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />
        <div className="grain" style={{ position: 'absolute', inset: 0, opacity: 1 }} />
        <div className="vignette" style={{ position: 'absolute', inset: 0 }} />
        <div className="scanlines" style={{ position: 'absolute', inset: 0 }} />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <VoiceOrb state={state} size={780} />
        </div>

        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {[
            [40, 40],
            [1880, 40],
            [40, 1040],
            [1880, 1040],
          ].map(([x, y], i) => {
            const dx = i % 2 === 0 ? 1 : -1;
            const dy = i < 2 ? 1 : -1;
            return (
              <g key={i} stroke={CYAN} strokeWidth="1" fill="none" opacity="0.7">
                <line x1={x} y1={y} x2={x + dx * 40} y2={y} />
                <line x1={x} y1={y} x2={x} y2={y + dy * 40} />
              </g>
            );
          })}
        </svg>

        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 80,
            right: 80,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              className="font-display glow-cyan"
              style={{ fontSize: 13, color: CYAN_BRIGHT, letterSpacing: '0.4em' }}
            >
              J · A · R · V · I · S
            </div>
            <div
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--cyan-dim)', letterSpacing: '0.32em', marginTop: 4 }}
            >
              OPERATIONS · BRIDGE · 04.21.7
            </div>
          </div>
          <ClockBlock />
          <div style={{ textAlign: 'right' }}>
            <div
              className="hud-label glow-cyan-sm anim-flicker"
              style={{ fontSize: 11, color: CYAN_BRIGHT, letterSpacing: '0.4em' }}
            >
              // {state.toUpperCase()}
            </div>
            <div
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--cyan-dim)', letterSpacing: '0.22em', marginTop: 4 }}
            >
              SESSION · A7F-2204
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 130,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
          }}
        >
          <div className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.6em' }}>
            ◆ ACTIVE DIRECTIVE · MO-Δ7
          </div>
          <div
            className="font-display glow-cyan anim-flicker"
            style={{ fontSize: 28, color: CYAN_BRIGHT, letterSpacing: '0.22em', marginTop: 8 }}
          >
            {DIRECTIVE.title}
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 11,
              color: 'var(--cyan-dim)',
              letterSpacing: '0.18em',
              marginTop: 6,
              maxWidth: 800,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {DIRECTIVE.brief}
          </div>
        </div>

        <div style={{ position: 'absolute', left: 80, top: 240, width: 360 }}>
          <div
            className="hud-label glow-cyan-sm"
            style={{ fontSize: 9, color: CYAN_BRIGHT, marginBottom: 10, letterSpacing: '0.32em' }}
          >
            ◤ TIMELINE
          </div>
          {DIRECTIVE.steps.map((s) => (
            <StepRow key={s.i} step={s} dense />
          ))}
        </div>

        <div style={{ position: 'absolute', right: 80, top: 240, width: 360 }}>
          <div
            className="hud-label glow-cyan-sm"
            style={{
              fontSize: 9,
              color: CYAN_BRIGHT,
              marginBottom: 10,
              letterSpacing: '0.32em',
              textAlign: 'right',
            }}
          >
            DIVISION ROLLUP ◥
          </div>
          {Object.entries(DIVISIONS).map(([k, d]) => {
            const teams = TEAMS.filter((t) => t.div === k);
            const live = teams.filter((t) => t.status === 'live').length;
            const c = colorFor(d.color);
            return (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: '1px dashed var(--line-soft)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: c,
                      boxShadow: `0 0 6px ${c}`,
                    }}
                  />
                  <div className="hud-label" style={{ fontSize: 9.5, color: 'var(--fg)' }}>
                    {d.label}
                  </div>
                </div>
                <div className="font-mono glow-cyan-sm" style={{ fontSize: 10, color: c }}>
                  {live}/{teams.length}
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 14 }}>
            <div
              className="font-display glow-cyan"
              style={{ fontSize: 32, color: CYAN_BRIGHT, textAlign: 'right' }}
            >
              17<span style={{ fontSize: 12, color: 'var(--cyan-dim)' }}> CELLS</span>
            </div>
            <div
              className="font-mono"
              style={{ fontSize: 9.5, color: 'var(--cyan-dim)', textAlign: 'right', letterSpacing: '0.22em' }}
            >
              184 AGENTS · 5 DIVISIONS
            </div>
          </div>
        </div>
      </div>{' '}
      {/* end outer scale wrapper */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 30, padding: '0 60px' }}>
        <div
          className="font-mono anim-ticker"
          style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            fontSize: 10,
            color: 'var(--cyan-dim)',
            letterSpacing: '0.32em',
            opacity: 0.6,
          }}
        >
          <div style={{ paddingRight: 100 }}>{TICKER.join('    ◆    ')}</div>
          <div style={{ paddingRight: 100 }}>{TICKER.join('    ◆    ')}</div>
        </div>
      </div>
    </div>
  );
}
