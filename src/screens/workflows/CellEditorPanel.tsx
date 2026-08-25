// @ts-nocheck
import { Stat } from '../../components/primitives';
import { AMBER, JADE, colorFor } from '../../theme';
import { TEAMS, DIVISIONS } from '../../data/jarvis-data';
import type { CellEditData } from './types';

// ── Cell Editor Panel ──────────────────────────────────────────────────────────
export function CellEditorPanel({
  team,
  edits,
  draft,
  onDraftChange,
  onSave,
  onReset,
  onClose,
}: {
  team: (typeof TEAMS)[0];
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
    width: '100%',
    padding: '7px 10px',
    fontSize: 11,
    background: 'oklch(0.05 0.01 240 / 0.8)',
    border: `1px solid ${c}44`,
    color: 'var(--fg)' as const,
    outline: 'none',
    fontFamily: 'var(--font-mono)',
    boxSizing: 'border-box' as const,
  };
  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div
            className="hud-label"
            style={{ fontSize: 7.5, color: c, letterSpacing: '0.3em', marginBottom: 4 }}
          >
            CELL WORKFLOW EDITOR · {team.id} · {team.div}
          </div>
          <div className="font-display" style={{ fontSize: 15, color: c, letterSpacing: '0.12em' }}>
            {(draft.name ?? edits.name) || team.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {hasEdits && (
            <button
              onClick={onReset}
              className="hud-label"
              style={{
                padding: '5px 10px',
                fontSize: 8.5,
                color: AMBER,
                border: `1px solid ${AMBER}60`,
                cursor: 'pointer',
                letterSpacing: '0.2em',
                background: 'transparent',
              }}
            >
              ↺ RESET
            </button>
          )}
          <button
            onClick={onSave}
            className="hud-label"
            style={{
              padding: '5px 10px',
              fontSize: 8.5,
              color: JADE,
              border: `1px solid ${JADE}60`,
              cursor: 'pointer',
              letterSpacing: '0.2em',
              background: `${JADE}10`,
            }}
          >
            ◆ SAVE
          </button>
          <button
            onClick={onClose}
            className="hud-label"
            style={{
              padding: '5px 10px',
              fontSize: 8.5,
              color: 'var(--cyan-dim)',
              border: '1px solid var(--line-soft)',
              cursor: 'pointer',
              letterSpacing: '0.2em',
              background: 'transparent',
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <div>
        <div
          className="hud-label"
          style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 6 }}
        >
          OPERATIONAL STATUS
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['live', 'warn', 'idle'] as const).map((s) => {
            const sc = s === 'live' ? JADE : s === 'warn' ? AMBER : 'oklch(0.5 0.04 215)';
            const active = (draft.status ?? merged.status) === s;
            return (
              <button
                key={s}
                onClick={() => onDraftChange({ ...draft, status: s })}
                className="hud-label"
                style={{
                  padding: '6px 20px',
                  fontSize: 9,
                  cursor: 'pointer',
                  letterSpacing: '0.22em',
                  color: active ? '#0d1117' : sc,
                  background: active ? sc : 'transparent',
                  border: `1px solid ${sc}60`,
                }}
              >
                {s.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
      {[
        { label: 'CELL / WORKFLOW NAME', key: 'name' as const, placeholder: team.name },
        { label: 'LEAD AGENT / OWNER', key: 'lead' as const, placeholder: team.lead },
        {
          label: 'TRIGGER / SCHEDULE',
          key: 'trigger' as const,
          placeholder: 'e.g. daily 08:00 · on push · manual · cron',
        },
      ].map(({ label, key, placeholder }) => (
        <div key={key}>
          <div
            className="hud-label"
            style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4 }}
          >
            {label}
          </div>
          <input
            value={((draft[key] ?? edits[key]) || '') as string}
            onChange={(e) => onDraftChange({ ...draft, [key]: e.target.value })}
            placeholder={placeholder}
            style={fieldCss}
          />
        </div>
      ))}
      <div>
        <div
          className="hud-label"
          style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 4 }}
        >
          SCOPE · OPERATIONS · NOTES
        </div>
        <textarea
          value={((draft.notes ?? edits.notes) || '') as string}
          onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
          placeholder="Describe this workflow cell's operational scope, agent assignments, connected systems, escalation paths…"
          rows={5}
          style={{ ...fieldCss, resize: 'vertical' as const, lineHeight: 1.5 }}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          padding: '10px 12px',
          background: 'oklch(0.06 0.012 240 / 0.5)',
          border: '1px solid var(--line-soft)',
        }}
      >
        <Stat label="DIVISION" value={team.div} />
        <Stat label="AGENTS" value={`${team.agents}`} />
        <Stat label="TEAM ID" value={team.id} />
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          color: 'var(--cyan-dim)',
          lineHeight: 1.5,
          padding: '8px 10px',
          border: '1px dashed var(--line-soft)',
        }}
      >
        ⓘ Edits saved to localStorage · Name, status, trigger and notes persist across restarts.
      </div>
    </div>
  );
}
