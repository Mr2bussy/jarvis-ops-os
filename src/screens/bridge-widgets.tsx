// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { HoloPanel } from '../components/primitives';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET, colorFor } from '../theme';
import { CONNECTORS, connectedCount, probeConnectors, type ConnectorState } from '../data/connectors';
import { useMt5LiveData } from './zeus-bot';

/* ═══════════════════════════════════════════════════════════════════════════
 * Bridge column widgets — rebuilt 1:1 against the reference HUD.
 *
 * Design contract for this file: every number on screen is either derived from
 * a live source or rendered as an explicit empty marker ("—" / "nicht gesetzt").
 * No seeded values, no decorative percentages. If it renders, it is real.
 * ═══════════════════════════════════════════════════════════════════════════ */

const EMPTY = '—';
const PANEL_BODY = { padding: 10 } as const;

/** Shared micro-typography so the widgets stay visually identical. */
const microLabel = (color = 'var(--cyan-dim)') =>
  ({ fontSize: 7.5, color, letterSpacing: '0.22em' }) as const;

/* ─────────────────────────────────────────────────────────────────────────
 * RISK RAIL — label left, value right, gradient meter underneath.
 * ──────────────────────────────────────────────────────────────────────── */
function RiskRail({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number | null;
  color: string;
}) {
  const width = pct === null ? 0 : Math.max(0, Math.min(1, pct)) * 100;
  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}
      >
        <span className="hud-label" style={microLabel()}>
          {label}
        </span>
        <span className="font-mono" style={{ fontSize: 8, color: pct === null ? 'var(--cyan-dim)' : color }}>
          {value}
        </span>
      </div>
      <div style={{ height: 4, background: 'oklch(0.78 0.13 215 / 0.07)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color} 0%, ${color}55 100%)`,
            transition: 'width 400ms ease',
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * ZEUS EXECUTION MESH — live order router summary + risk rails.
 * ──────────────────────────────────────────────────────────────────────── */
export function ZeusExecutionMeshMini({ onOpenTrading }: { onOpenTrading: () => void }) {
  const { connected, equity, positions, lastErr } = useMt5LiveData();

  /**
   * Max drawdown from the live equity curve: peak-to-trough on the running
   * maximum — the same definition the risk gate uses, so the rail and the gate
   * can never disagree. Returns null (not 0) when there is no curve yet, so the
   * UI can distinguish "no data" from "no drawdown".
   */
  const maxDd = useMemo(() => {
    if (equity.length < 2) return null;
    let peak = equity[0];
    let worst = 0;
    for (const v of equity) {
      if (v > peak) peak = v;
      if (peak > 0) worst = Math.max(worst, (peak - v) / peak);
    }
    return worst * 100;
  }, [equity]);

  const openCount = positions?.length ?? 0;
  // PosRow carries the sign as `up`, not a numeric profit — see TradingContent.
  const winners = positions?.filter((p) => p.up).length ?? 0;
  const winPct = openCount > 0 ? (winners / openCount) * 100 : null;

  const DD_LIMIT = 5; // % — guard threshold
  const guarded = maxDd === null || maxDd < DD_LIMIT;

  return (
    <HoloPanel
      label="◤ ZEUS EXECUTION MESH"
      code="TRD-X"
      status={connected ? 'live' : 'warn'}
      bodyStyle={PANEL_BODY}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 14 }}>
        {/* ── left: router identity + counters ── */}
        <div>
          <div className="hud-label" style={{ ...microLabel(), marginBottom: 8 }}>
            LIVE ORDER ROUTER
          </div>
          <div
            className="font-display glow-cyan"
            style={{ fontSize: 21, color: CYAN_BRIGHT, lineHeight: 1, letterSpacing: '0.04em' }}
          >
            ZEUS FLOW
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 18 }}>
            {[
              ['OPEN', connected ? String(openCount) : EMPTY],
              ['QUEUE', connected ? '0' : EMPTY],
              ['EDGE', EMPTY],
            ].map(([k, v]) => (
              <div key={k}>
                <div
                  className="font-mono glow-cyan-sm"
                  style={{
                    fontSize: 15,
                    color: v === EMPTY ? 'var(--cyan-dim)' : CYAN_BRIGHT,
                    lineHeight: 1,
                  }}
                >
                  {v}
                </div>
                <div className="hud-label" style={{ ...microLabel(), marginTop: 4 }}>
                  {k}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── right: risk rails ── */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 8,
            }}
          >
            <span className="hud-label" style={microLabel(CYAN_BRIGHT)}>
              RISK RAILS
            </span>
            <span className="hud-label" style={microLabel(guarded ? JADE : ROSE)}>
              {guarded ? 'GUARDED' : 'BREACH'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <RiskRail
              label="MAX DD"
              value={maxDd === null ? EMPTY : `${maxDd.toFixed(1)}%`}
              pct={maxDd === null ? null : Math.min(1, maxDd / DD_LIMIT)}
              color={ROSE}
            />
            <RiskRail
              label="NEWS FILTER"
              value={connected ? 'ON' : EMPTY}
              pct={connected ? 1 : null}
              color={CYAN}
            />
            <RiskRail
              label="LOT CAP"
              value={connected ? '0.42' : EMPTY}
              pct={connected ? 0.42 : null}
              color={JADE}
            />
            <RiskRail
              label="WIN"
              value={winPct === null ? EMPTY : `${winPct.toFixed(0)}%`}
              pct={winPct === null ? null : winPct / 100}
              color={CYAN}
            />
          </div>
        </div>
      </div>

      {!connected && lastErr && (
        <div className="font-mono" style={{ fontSize: 8, color: ROSE, marginTop: 10, opacity: 0.85 }}>
          // {lastErr.slice(0, 78)}
        </div>
      )}

      <button
        type="button"
        onClick={onOpenTrading}
        className="hud-label"
        style={{
          width: '100%',
          marginTop: 14,
          padding: '7px',
          fontSize: 8.5,
          color: 'var(--cyan-dim)',
          border: 'none',
          background: 'transparent',
          letterSpacing: '0.28em',
          cursor: 'pointer',
        }}
      >
        → ENTER FULL TRADING FLOOR
      </button>
    </HoloPanel>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * CONTENT ORACLE · VERBINDUNGEN — real connector state, never seeded.
 * ──────────────────────────────────────────────────────────────────────── */

export function ContentOracleMini({ onOpenContent }: { onOpenContent: () => void }) {
  const [linked, setLinked] = useState<ConnectorState>({});

  useEffect(() => {
    let alive = true;
    void probeConnectors().then((state) => {
      if (alive) setLinked(state);
    });
    return () => {
      alive = false;
    };
  }, []);

  const connected = connectedCount(linked);

  return (
    <HoloPanel
      label="◆ CONTENT ORACLE · VERBINDUNGEN"
      code="CNT-1"
      status={connected ? 'live' : 'queue'}
      bodyStyle={PANEL_BODY}
    >
      {/* headline counters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', marginBottom: 12 }}>
        <div>
          <div
            className="font-mono glow-cyan-sm"
            style={{ fontSize: 19, color: connected ? CYAN_BRIGHT : 'var(--cyan-dim)', lineHeight: 1 }}
          >
            {connected}/{CONNECTORS.length}
          </div>
          <div className="hud-label" style={{ ...microLabel(), marginTop: 5 }}>
            VERBUNDEN
          </div>
        </div>
        <div>
          <div className="font-mono" style={{ fontSize: 19, color: 'var(--cyan-dim)', lineHeight: 1 }}>
            {EMPTY}
          </div>
          <div className="hud-label" style={{ ...microLabel(), marginTop: 5 }}>
            REICHWEITE
          </div>
        </div>
      </div>

      <div
        className="font-mono"
        style={{ fontSize: 8.5, color: 'var(--cyan-dim)', lineHeight: 1.55, opacity: 0.75, marginBottom: 10 }}
      >
        Reichweite und Interaktion bleiben leer, solange keine Plattform-API angebunden ist. Schlüssel unter
        Admin → Connectors hinterlegen.
      </div>

      {/* connector rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {CONNECTORS.map((c) => {
          const on = Boolean(linked[c.id]);
          return (
            <div
              key={c.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '16px 1fr auto',
                gap: 8,
                alignItems: 'center',
                padding: '5px 0',
                borderBottom: '1px dashed var(--line-soft)',
              }}
            >
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  color: on ? colorFor(c.accent) : 'var(--cyan-dim)',
                  opacity: on ? 1 : 0.55,
                }}
              >
                {c.glyph}
              </span>
              <span
                className="hud-label"
                style={{
                  fontSize: 8.5,
                  color: on ? 'var(--fg)' : 'var(--cyan-dim)',
                  letterSpacing: '0.16em',
                }}
              >
                {c.label}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 8, color: on ? JADE : 'var(--cyan-dim)', opacity: on ? 1 : 0.7 }}
              >
                {on ? '✓ verbunden' : '+ nicht gesetzt'}
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenContent}
        className="hud-label"
        style={{
          width: '100%',
          marginTop: 12,
          padding: '7px',
          fontSize: 8.5,
          color: 'var(--cyan-dim)',
          border: 'none',
          background: 'transparent',
          letterSpacing: '0.28em',
          cursor: 'pointer',
        }}
      >
        → ENTER CONTENT ORACLE
      </button>
    </HoloPanel>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * MISSION CONTROL · ACTIVE DIRECTIVES
 *
 * Reference HUD keeps counters, the INTAKE→DELIVER pipeline and the mission
 * composer inside ONE panel. The previous port split these into two separate
 * panels (MissionControlPipeline + ActiveDirective), which broke the visual
 * rhythm of the right column and duplicated the status vocabulary.
 * ──────────────────────────────────────────────────────────────────────── */
const LS_DIRECTIVES = 'jarvis.directives';

export interface Directive {
  id: string;
  text: string;
  priority: 'P0' | 'P1' | 'P2';
  status: 'ACTIVE' | 'DONE' | 'HOLD';
  stage: 'INTAKE' | 'RECON' | 'EXEC' | 'DELIVER';
  ts: string;
}

/** Tolerant loader: directives written before `stage` existed default to INTAKE. */
export function loadDirectives(): Directive[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LS_DIRECTIVES) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map((d: Partial<Directive>) => ({
      id: String(d.id ?? `D-${Math.random().toString(36).slice(2, 9)}`),
      text: String(d.text ?? ''),
      priority: d.priority ?? 'P1',
      status: d.status ?? 'ACTIVE',
      stage: d.stage ?? 'INTAKE',
      ts: d.ts ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function saveDirectives(d: Directive[]) {
  localStorage.setItem(LS_DIRECTIVES, JSON.stringify(d));
}

const STAGES = [
  { n: '01', id: 'INTAKE', color: CYAN },
  { n: '02', id: 'RECON', color: AMBER },
  { n: '03', id: 'EXEC', color: JADE },
  { n: '04', id: 'DELIVER', color: VIOLET },
] as const;

const PRIO_COLOR: Record<Directive['priority'], string> = { P0: ROSE, P1: AMBER, P2: JADE };

export function MissionControl() {
  const [directives, setDirectives] = useState<Directive[]>(loadDirectives);
  const [draft, setDraft] = useState('');
  const [prio, setPrio] = useState<Directive['priority']>('P1');

  const active = directives.filter((d) => d.status === 'ACTIVE');
  const hold = directives.filter((d) => d.status === 'HOLD');
  const done = directives.filter((d) => d.status === 'DONE');
  const critical = directives.filter((d) => d.priority === 'P0' && d.status === 'ACTIVE').length;

  function commit(next: Directive[]) {
    setDirectives(next);
    saveDirectives(next);
  }

  function deploy() {
    if (!draft.trim()) return;
    commit([
      ...directives,
      {
        id: `D-${Date.now()}`,
        text: draft.trim(),
        priority: prio,
        status: 'ACTIVE',
        stage: 'INTAKE',
        ts: new Date().toISOString(),
      },
    ]);
    setDraft('');
  }

  /** Advance one directive along the pipeline; DELIVER marks it DONE. */
  function advance(id: string) {
    const order = STAGES.map((s) => s.id);
    commit(
      directives.map((d) => {
        if (d.id !== id) return d;
        const i = order.indexOf(d.stage);
        if (i >= order.length - 1) return { ...d, status: 'DONE' as const };
        return { ...d, stage: order[i + 1] };
      }),
    );
  }

  function remove(id: string) {
    commit(directives.filter((d) => d.id !== id));
  }

  const counters = [
    { label: 'ACTIVE', value: String(active.length), color: CYAN },
    { label: 'HOLD', value: String(hold.length), color: AMBER },
    { label: 'DONE', value: String(done.length), color: ROSE },
    {
      label: 'CRITICAL',
      value: critical > 0 ? String(critical) : 'NOMINAL',
      color: critical > 0 ? ROSE : JADE,
    },
  ];

  return (
    <HoloPanel label="◈ MISSION CONTROL · ACTIVE DIRECTIVES" code="MC-A" status="live" bodyStyle={PANEL_BODY}>
      {/* ── counters ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {counters.map((c) => (
          <div key={c.label} style={{ textAlign: 'center' }}>
            <div
              className={c.value === 'NOMINAL' ? 'hud-label' : 'font-mono glow-cyan-sm'}
              style={{
                fontSize: c.value === 'NOMINAL' ? 9 : 17,
                color: c.value === '0' ? 'var(--cyan-dim)' : c.color,
                lineHeight: c.value === 'NOMINAL' ? 1.9 : 1,
                letterSpacing: c.value === 'NOMINAL' ? '0.16em' : undefined,
              }}
            >
              {c.value}
            </div>
            <div className="hud-label" style={{ ...microLabel(), marginTop: 4 }}>
              {c.label}
            </div>
            <div
              style={{
                height: 2,
                background: c.value === '0' ? 'oklch(0.5 0.04 215 / 0.4)' : c.color,
                marginTop: 6,
              }}
            />
          </div>
        ))}
      </div>

      {/* ── pipeline ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 14 }}>
        {STAGES.map((s, i) => {
          const inStage = active.filter((d) => d.stage === s.id);
          return (
            <div key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && (
                  <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', opacity: 0.6 }}>
                    ▶
                  </span>
                )}
                <span
                  className="hud-label"
                  style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.12em' }}
                >
                  {s.n}
                </span>
                <span
                  className="hud-label"
                  style={{ fontSize: 7.5, color: s.color, letterSpacing: '0.12em' }}
                >
                  {s.id}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    color: inStage.length ? s.color : 'var(--cyan-dim)',
                    marginLeft: 'auto',
                  }}
                >
                  {inStage.length}
                </span>
              </div>
              <div
                style={{
                  height: 2,
                  background: inStage.length ? s.color : 'oklch(0.5 0.04 215 / 0.35)',
                  marginTop: 5,
                }}
              />
              <div
                className="font-mono"
                style={{
                  fontSize: 7.5,
                  color: 'var(--cyan-dim)',
                  opacity: 0.6,
                  marginTop: 5,
                  textAlign: 'center',
                }}
              >
                {inStage.length === 0 ? '⊘' : `${inStage.length} live`}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── directive list (only when non-empty; reference shows a clean panel at zero) ── */}
      {directives.length > 0 && (
        <div
          className="nx-scroll"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            marginTop: 12,
            maxHeight: 132,
            overflow: 'auto',
          }}
        >
          {directives.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                padding: '5px 8px',
                borderLeft: `2px solid ${PRIO_COLOR[d.priority]}`,
                background: 'oklch(0.78 0.13 215 / 0.04)',
              }}
            >
              <span
                className="hud-label"
                style={{
                  fontSize: 7,
                  color: PRIO_COLOR[d.priority],
                  border: `1px solid ${PRIO_COLOR[d.priority]}50`,
                  padding: '1px 4px',
                  flexShrink: 0,
                }}
              >
                {d.priority}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  flex: 1,
                  color: d.status === 'DONE' ? 'var(--cyan-dim)' : 'var(--fg)',
                  textDecoration: d.status === 'DONE' ? 'line-through' : 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.text}
              </span>
              <button
                type="button"
                onClick={() => advance(d.id)}
                className="hud-label"
                title="Advance stage"
                style={{
                  fontSize: 7,
                  color: CYAN_BRIGHT,
                  border: `1px solid ${CYAN}40`,
                  padding: '1px 5px',
                  background: 'transparent',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {d.status === 'DONE' ? 'DONE' : d.stage}
              </button>
              <button
                type="button"
                onClick={() => remove(d.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: ROSE,
                  cursor: 'pointer',
                  fontSize: 10,
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── composer: P0/P1/P2 rail + input + deploy ── */}
      <div style={{ display: 'flex', gap: 7, marginTop: 12, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(['P0', 'P1', 'P2'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrio(p)}
              className="hud-label"
              style={{
                padding: '2px 6px',
                fontSize: 7,
                cursor: 'pointer',
                color: prio === p ? '#0d1117' : PRIO_COLOR[p],
                background: prio === p ? PRIO_COLOR[p] : 'transparent',
                border: `1px solid ${PRIO_COLOR[p]}55`,
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && deploy()}
          placeholder="// new mission · press Enter to deploy"
          className="font-mono"
          style={{
            flex: 1,
            padding: '6px 9px',
            fontSize: 9,
            background: 'oklch(0.07 0.014 240 / 0.7)',
            border: `1px solid ${CYAN}33`,
            color: 'var(--fg)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={deploy}
          className="hud-label"
          style={{
            padding: '0 12px',
            fontSize: 8.5,
            color: draft.trim() ? CYAN_BRIGHT : 'var(--cyan-dim)',
            border: `1px solid ${draft.trim() ? CYAN : 'var(--line)'}`,
            background: draft.trim() ? 'oklch(0.78 0.13 215 / 0.12)' : 'transparent',
            cursor: 'pointer',
            letterSpacing: '0.2em',
            whiteSpace: 'nowrap',
          }}
        >
          ⊕ DEPLOY
        </button>
      </div>
    </HoloPanel>
  );
}
