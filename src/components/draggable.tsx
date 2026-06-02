/**
 * draggable.tsx — Universal drag-and-drop primitives for JARVIS Ops OS
 * - DraggableTabs: reorderable + deletable tab bar with localStorage persistence
 * - DraggableGrid: reorderable widget/panel grid with localStorage persistence
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { CYAN, JADE, ROSE, AMBER } from '../theme';

/* ── Types ─────────────────────────────────────────────────────────────────── */
export interface DragTab {
  id: string;
  label: string;
  color: string;
  count?: string | number;
  /** If true, the tab can never be deleted (pinned). Default: false */
  pinned?: boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function lsGet<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DraggableTabs
   ─────────────────────────────────────────────────────────────────────────────
   Props:
     storageKey   — unique key for localStorage (e.g. "jarvis.tabs.console")
     defaultTabs  — canonical tab list; used for reset + order merging
     active       — currently active tab id (controlled from outside)
     onActivate   — called when a tab is clicked
     extra        — optional extra right-side JSX (e.g. RESCAN button)
   ═══════════════════════════════════════════════════════════════════════════════ */
interface DraggableTabsProps {
  storageKey: string;
  defaultTabs: DragTab[];
  active: string;
  onActivate: (id: string) => void;
  extra?: React.ReactNode;
  style?: React.CSSProperties;
}

export function DraggableTabs({ storageKey, defaultTabs, active, onActivate, extra, style }: DraggableTabsProps) {
  type Saved = { order: string[]; hidden: string[] };

  const [state, setState_] = useState<Saved>(() => {
    const saved = lsGet<Saved>(storageKey, { order: defaultTabs.map(t => t.id), hidden: [] });
    // merge: keep only known ids, append new ones
    const knownIds = new Set(defaultTabs.map(t => t.id));
    const order = [...saved.order.filter(id => knownIds.has(id)), ...defaultTabs.map(t => t.id).filter(id => !saved.order.includes(id))];
    return { order, hidden: saved.hidden.filter(id => knownIds.has(id)) };
  });

  const dragSrcRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  function save(next: Saved) { setState_(next); lsSet(storageKey, next); }

  const ordered = state.order
    .map(id => defaultTabs.find(t => t.id === id))
    .filter((t): t is DragTab => !!t);

  const visible = ordered.filter(t => !state.hidden.includes(t.id));
  const hiddenTabs = ordered.filter(t => state.hidden.includes(t.id));

  function toggleHide(id: string) {
    const t = defaultTabs.find(t => t.id === id);
    if (t?.pinned) return;
    const hidden = state.hidden.includes(id)
      ? state.hidden.filter(h => h !== id)
      : [...state.hidden, id];
    const next = { ...state, hidden };
    save(next);
    // if we hid the active tab, activate the first visible
    if (hidden.includes(active)) {
      const first = state.order.find(oid => !hidden.includes(oid));
      if (first) onActivate(first);
    }
  }

  function reset() {
    const next: Saved = { order: defaultTabs.map(t => t.id), hidden: [] };
    save(next);
    onActivate(defaultTabs[0]?.id ?? active);
  }

  // Drag handlers
  function onDragStart(id: string) { dragSrcRef.current = id; }
  function onDragOverTab(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (dragSrcRef.current && dragSrcRef.current !== id) setDragOver(id);
  }
  function onDrop(targetId: string) {
    const src = dragSrcRef.current;
    if (!src || src === targetId) { setDragOver(null); return; }
    const order = [...state.order];
    const from = order.indexOf(src), to = order.indexOf(targetId);
    if (from === -1 || to === -1) { setDragOver(null); return; }
    order.splice(from, 1);
    order.splice(to, 0, src);
    save({ ...state, order });
    setDragOver(null);
  }
  function onDragEnd() { dragSrcRef.current = null; setDragOver(null); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0, ...style }}>
      {/* Tab strip */}
      <div style={{ display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.08)', minHeight: 32 }}>
        {visible.map(t => {
          const isActive = active === t.id;
          const isDragTarget = dragOver === t.id;
          return (
            <div
              key={t.id}
              draggable
              onDragStart={() => onDragStart(t.id)}
              onDragOver={e => onDragOverTab(e, t.id)}
              onDrop={() => onDrop(t.id)}
              onDragEnd={onDragEnd}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px 5px 12px',
                cursor: 'grab',
                background: isActive ? `${t.color}12` : isDragTarget ? `${t.color}1a` : 'transparent',
                borderLeft: `1px solid ${isActive ? t.color + '88' : isDragTarget ? t.color + '55' : 'rgba(255,255,255,0.07)'}`,
                borderRight: `1px solid ${isActive ? t.color + '88' : isDragTarget ? t.color + '55' : 'rgba(255,255,255,0.07)'}`,
                borderTop: `1px solid ${isActive ? t.color + '88' : isDragTarget ? t.color + '55' : 'rgba(255,255,255,0.07)'}`,
                borderBottom: isActive ? `2px solid ${t.color}` : '1px solid rgba(255,255,255,0.07)',
                position: 'relative', top: 1,
                transition: 'background 0.12s, border-color 0.12s',
                marginRight: 2,
                outline: isDragTarget ? `1px dashed ${t.color}88` : 'none',
              }}
            >
              <button
                onClick={() => onActivate(t.id)}
                className="hud-label"
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: isActive ? t.color : 'rgba(255,255,255,0.38)',
                  fontSize: 9, letterSpacing: '0.18em', cursor: 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                {t.label}
                {t.count !== undefined && (
                  <span style={{ opacity: 0.5, marginLeft: 5, fontSize: 8 }}>·{typeof t.count === 'number' ? t.count.toLocaleString() : t.count}</span>
                )}
              </button>
              {/* Delete/hide X — shown in editMode or on hover */}
              {!t.pinned && (
                <button
                  onClick={e => { e.stopPropagation(); toggleHide(t.id); }}
                  title="Hide tab (can be restored)"
                  className="hud-label"
                  style={{
                    background: 'none', border: 'none', padding: '0 0 0 2px',
                    color: ROSE, fontSize: 8, cursor: 'pointer',
                    opacity: editMode ? 0.9 : 0,
                    transition: 'opacity 0.15s',
                    lineHeight: 1,
                  }}
                  onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                  onMouseOut={e => (e.currentTarget.style.opacity = editMode ? '0.9' : '0')}
                >✕</button>
              )}
            </div>
          );
        })}

        {/* Edit-mode toggle */}
        <button
          onClick={() => setEditMode(m => !m)}
          title={editMode ? 'Exit edit mode' : 'Enter edit mode (rearrange + hide tabs)'}
          className="hud-label"
          style={{
            marginLeft: 6, marginBottom: 3, padding: '2px 7px',
            fontSize: 7.5, letterSpacing: '0.14em', cursor: 'pointer',
            color: editMode ? AMBER : 'rgba(255,255,255,0.2)',
            border: `1px solid ${editMode ? AMBER + '66' : 'rgba(255,255,255,0.1)'}`,
            background: editMode ? `${AMBER}12` : 'transparent',
          }}
        >
          {editMode ? '✓ DONE' : '⋮ EDIT'}
        </button>

        {/* Hidden tab restore menu */}
        {editMode && hiddenTabs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 6, marginBottom: 3 }}>
            {hiddenTabs.map(t => (
              <button key={t.id} onClick={() => toggleHide(t.id)} className="hud-label"
                title={`Restore "${t.label}"`}
                style={{ padding: '2px 7px', fontSize: 7.5, cursor: 'pointer',
                  color: t.color, border: `1px dashed ${t.color}55`,
                  background: `${t.color}0a`, letterSpacing: '0.1em' }}>
                + {t.label.replace(/^[^ ]+ /, '')}
              </button>
            ))}
          </div>
        )}

        {/* Reset to defaults */}
        {editMode && (
          <button onClick={reset} className="hud-label" title="Reset tab order and restore all hidden tabs"
            style={{ marginLeft: 4, marginBottom: 3, padding: '2px 7px', fontSize: 7.5, cursor: 'pointer',
              color: JADE, border: `1px solid ${JADE}44`, background: 'transparent', letterSpacing: '0.14em' }}>
            ↺ RESET
          </button>
        )}

        {/* Edit mode hint */}
        {editMode && (
          <span className="hud-label" style={{ marginLeft: 8, marginBottom: 3, fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>
            DRAG TO REORDER · ✕ TO HIDE
          </span>
        )}

        <div style={{ flex: 1 }} />
        {extra}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DraggableGrid
   ─────────────────────────────────────────────────────────────────────────────
   Wraps a list of items in a reorderable drag-and-drop grid.
   Each item must have a stable `id` string.
   ═══════════════════════════════════════════════════════════════════════════════ */
interface DraggableGridProps<T extends { id: string }> {
  storageKey: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  columns?: number;
  gap?: number;
  style?: React.CSSProperties;
}

export function DraggableGrid<T extends { id: string }>({
  storageKey, items, renderItem, columns = 2, gap = 10, style,
}: DraggableGridProps<T>) {
  const [order, setOrder_] = useState<string[]>(() => {
    const saved = lsGet<string[]>(storageKey, items.map(i => i.id));
    const knownIds = new Set(items.map(i => i.id));
    return [...saved.filter(id => knownIds.has(id)), ...items.map(i => i.id).filter(id => !saved.includes(id))];
  });

  const dragSrcRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  function save(next: string[]) { setOrder_(next); lsSet(storageKey, next); }

  const sorted = order.map(id => items.find(i => i.id === id)).filter((i): i is T => !!i);

  function onDragStart(id: string) { dragSrcRef.current = id; }
  function onDragOver(e: React.DragEvent, id: string) { e.preventDefault(); if (dragSrcRef.current !== id) setDragOver(id); }
  function onDrop(targetId: string) {
    const src = dragSrcRef.current;
    if (!src || src === targetId) { setDragOver(null); return; }
    const arr = [...order];
    const from = arr.indexOf(src), to = arr.indexOf(targetId);
    arr.splice(from, 1); arr.splice(to, 0, src);
    save(arr);
    setDragOver(null);
  }
  function onDragEnd() { dragSrcRef.current = null; setDragOver(null); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, flex: 1, ...style }}>
      {/* Edit toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={() => setEditMode(m => !m)} className="hud-label"
          style={{ padding: '2px 8px', fontSize: 7.5, cursor: 'pointer', letterSpacing: '0.14em',
            color: editMode ? AMBER : 'rgba(255,255,255,0.2)',
            border: `1px solid ${editMode ? AMBER + '55' : 'rgba(255,255,255,0.1)'}`,
            background: editMode ? `${AMBER}10` : 'transparent' }}>
          {editMode ? '✓ DONE' : '⠿ ARRANGE'}
        </button>
        {editMode && (
          <button onClick={() => save(items.map(i => i.id))} className="hud-label"
            style={{ marginLeft: 4, padding: '2px 8px', fontSize: 7.5, cursor: 'pointer',
              color: JADE, border: `1px solid ${JADE}44`, background: 'transparent', letterSpacing: '0.14em' }}>
            ↺ RESET
          </button>
        )}
        {editMode && (
          <span className="hud-label" style={{ marginLeft: 10, fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', alignSelf: 'center' }}>
            DRAG CARDS TO REARRANGE
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap, flex: 1, overflowY: 'auto', alignContent: 'start' }} className="nx-scroll">
        {sorted.map((item, idx) => (
          <div
            key={item.id}
            draggable={editMode}
            onDragStart={() => onDragStart(item.id)}
            onDragOver={e => onDragOver(e, item.id)}
            onDrop={() => onDrop(item.id)}
            onDragEnd={onDragEnd}
            style={{
              outline: dragOver === item.id ? `1px dashed ${AMBER}88` : editMode ? `1px dashed rgba(255,255,255,0.1)` : 'none',
              cursor: editMode ? 'grab' : 'default',
              opacity: dragSrcRef.current === item.id ? 0.45 : 1,
              transition: 'outline 0.1s, opacity 0.1s',
            }}
          >
            {renderItem(item, idx)}
          </div>
        ))}
      </div>
    </div>
  );
}
