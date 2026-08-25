import { useState } from 'react';
import { CYAN_BRIGHT, ROSE } from '../theme';
import { ZeusBotMiniPlayer, useMt5LiveData, WIDGET_REGISTRY, DEFAULT_LAYOUT } from './trading/ZeusBotPanel';
import type { WidgetId, PosRow } from './trading/ZeusBotPanel';
import { GodModeTab, GODMODE_SYMBOLS, type TradingTab } from './trading/GodModeTab';
import { WidgetCell } from './trading/TerminalWidgets';
import { useZeusTickers } from '../lib/trading-data';
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<'DARK' | 'DARKER' | 'MIDNIGHT'>('MIDNIGHT');
  const [density, setDensity] = useState<'COMPACT' | 'NORMAL' | 'WIDE'>('COMPACT');
  const [refresh, setRefresh] = useState<'250ms' | '500ms' | '1s' | '5s'>('500ms');
  const [alerts, setAlerts] = useState(true);
  const [sound, setSound] = useState(false);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0a0e14',
          border: '1px solid rgba(255,255,255,0.12)',
          padding: 24,
          minWidth: 360,
          maxWidth: 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span
            className="hud-label"
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.22em' }}
          >
            TERMINAL SETTINGS
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
        {[
          {
            l: 'THEME',
            opts: ['DARK', 'DARKER', 'MIDNIGHT'] as const,
            cur: theme,
            set: (v: any) => setTheme(v),
          },
          {
            l: 'DENSITY',
            opts: ['COMPACT', 'NORMAL', 'WIDE'] as const,
            cur: density,
            set: (v: any) => setDensity(v),
          },
          {
            l: 'REFRESH',
            opts: ['250ms', '500ms', '1s', '5s'] as const,
            cur: refresh,
            set: (v: any) => setRefresh(v),
          },
        ].map((row) => (
          <div key={row.l} style={{ marginBottom: 14 }}>
            <div
              className="hud-label"
              style={{
                fontSize: 8,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.15em',
                marginBottom: 6,
              }}
            >
              {row.l}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {row.opts.map((o: any) => (
                <button
                  key={o}
                  onClick={() => row.set(o)}
                  className="hud-label"
                  style={{
                    padding: '4px 10px',
                    fontSize: 8,
                    border: `1px solid ${row.cur === o ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)'}`,
                    background: row.cur === o ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: row.cur === o ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer',
                    letterSpacing: '0.1em',
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        ))}
        {[
          { l: 'PRICE ALERTS', v: alerts, s: setAlerts },
          { l: 'AUDIO ALERTS', v: sound, s: setSound },
        ].map((tog) => (
          <div
            key={tog.l}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <span
              className="hud-label"
              style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}
            >
              {tog.l}
            </span>
            <button
              onClick={() => tog.s(!tog.v)}
              style={{
                width: 40,
                height: 20,
                borderRadius: 10,
                background: tog.v ? '#00d08433' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${tog.v ? '#00d084' : 'rgba(255,255,255,0.12)'}`,
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  left: tog.v ? 22 : 3,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: tog.v ? '#00d084' : 'rgba(255,255,255,0.3)',
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>
        ))}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '8px 0',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
          }}
          className="hud-label"
        >
          APPLY &amp; CLOSE
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET LIBRARY PANEL
   ══════════════════════════════════════════════════════════════════ */
const CATEGORY_COLORS: Record<string, string> = {
  PRICE: '#ff1a6b',
  FLOW: '#00d084',
  RISK: '#ff1a6b',
  MACRO: '#ffb300',
  QUANT: '#00e5ff',
};

function WidgetLibraryPanel({
  activeIds,
  onAdd,
  onRemove,
  onClose,
}: {
  activeIds: WidgetId[];
  onAdd: (id: WidgetId) => void;
  onRemove: (id: WidgetId) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<string>('ALL');
  const cats = ['ALL', 'PRICE', 'FLOW', 'RISK', 'MACRO', 'QUANT'];
  const filtered = WIDGET_REGISTRY.filter((w) => cat === 'ALL' || w.category === cat);
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 340,
        background: '#08090f',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span
          className="hud-label"
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.22em' }}
        >
          WIDGET LIBRARY
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="hud-label"
            style={{
              padding: '3px 7px',
              fontSize: 7.5,
              border: `1px solid ${cat === c ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
              background: cat === c ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: cat === c ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              letterSpacing: '0.08em',
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }} className="nx-scroll">
        {filtered.map((w) => {
          const active = activeIds.includes(w.id);
          return (
            <div
              key={w.id}
              style={{
                padding: '10px 12px',
                marginBottom: 6,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? w.color + '55' : 'rgba(255,255,255,0.06)'}`,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 9.5, color: w.color, fontWeight: 600, marginBottom: 3 }}
                  >
                    {w.label}
                  </div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}
                  >
                    {w.desc}
                  </div>
                </div>
                <button
                  onClick={() => (active ? onRemove(w.id) : onAdd(w.id))}
                  style={{
                    padding: '4px 10px',
                    fontSize: 8,
                    border: `1px solid ${active ? '#ff1a6b55' : w.color + '55'}`,
                    background: active ? 'rgba(255,26,107,0.08)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#ff1a6b' : w.color,
                    cursor: 'pointer',
                    marginLeft: 8,
                    flexShrink: 0,
                  }}
                  className="hud-label"
                >
                  {active ? 'REMOVE' : 'ADD'}
                </button>
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                <span
                  className="hud-label"
                  style={{
                    fontSize: 6.5,
                    padding: '1px 5px',
                    border: `1px solid ${CATEGORY_COLORS[w.category] || 'rgba(255,255,255,0.15)'}22`,
                    color: CATEGORY_COLORS[w.category] || 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {w.category}
                </span>
                {active && (
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 6.5,
                      padding: '1px 5px',
                      border: '1px solid rgba(0,208,132,0.3)',
                      color: '#00d084',
                      letterSpacing: '0.08em',
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TRADING SCREEN — MAIN EXPORT
   ══════════════════════════════════════════════════════════════════ */
// TICKERS now served by useBinanceTickers() hook inside TradingScreen

/* ══════════════════════════════════════════════════════════════════
   MY SETUP — Custom layout builder with named presets
   ══════════════════════════════════════════════════════════════════ */
const LS_PRESETS_KEY = 'jarvis_trading_presets';
const LS_ACTIVE_KEY = 'jarvis_trading_active_preset';

interface Preset {
  id: string;
  name: string;
  cols: number;
  layout: WidgetId[];
}

function loadPresets(): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(LS_PRESETS_KEY) || '[]');
  } catch {
    return [];
  }
}
function savePresets(p: Preset[]) {
  localStorage.setItem(LS_PRESETS_KEY, JSON.stringify(p));
}

const STARTER_PRESETS: Preset[] = [
  {
    id: 'scalping',
    name: 'Scalping Desk',
    cols: 3,
    layout: ['PRICE_CHART', 'ORDER_BOOK', 'CVD', 'ORDER_TICKET', 'LIQUIDITY_MAP', 'EXECUTION_LOG'],
  },
  {
    id: 'macro',
    name: 'Macro View',
    cols: 3,
    layout: [
      'YIELD_CURVE',
      'CORRELATION',
      'SECTOR_ROTATION',
      'COT_POSITIONING',
      'CREDIT_SPREADS',
      'MACRO_POSITIONING',
    ],
  },
  {
    id: 'options',
    name: 'Options Flow',
    cols: 2,
    layout: ['GAMMA_EXPOSURE', 'VOL_SURFACE', 'OPTIONS_FLOW', 'DARK_POOL'],
  },
  {
    id: 'risk',
    name: 'Risk Monitor',
    cols: 2,
    layout: ['RISK_DASHBOARD', 'EQUITY_CURVE', 'POSITIONS', 'ORDER_TICKET'],
  },
];

function MySetupTab({
  connected,
  posRows,
  balance,
  equityArr,
  livePrice,
  activeSymbol = 'BTCUSD',
}: {
  connected: boolean;
  posRows: PosRow[];
  balance: number;
  equityArr: number[];
  livePrice: number;
  activeSymbol?: string;
}) {
  const [presets, setPresets] = useState<Preset[]>(() => {
    const p = loadPresets();
    return p.length ? p : STARTER_PRESETS;
  });
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(LS_ACTIVE_KEY) || 'scalping');
  const [editMode, setEditMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCols, setNewCols] = useState(3);
  const [pickOpen, setPickOpen] = useState(false);
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const activePreset = presets.find((p) => p.id === activeId) ?? presets[0];

  function persist(updated: Preset[]) {
    setPresets(updated);
    savePresets(updated);
  }

  function addPreset() {
    const name = newName.trim() || 'My Setup';
    const id = 'custom_' + Date.now();
    const np: Preset = { id, name, cols: newCols, layout: ['PRICE_CHART', 'EQUITY_CURVE'] };
    const updated = [...presets, np];
    persist(updated);
    setActiveId(id);
    localStorage.setItem(LS_ACTIVE_KEY, id);
    setNewName('');
    setEditMode(true);
  }

  function deletePreset(id: string) {
    const updated = presets.filter((p) => p.id !== id);
    persist(updated.length ? updated : STARTER_PRESETS);
    setActiveId(updated[0]?.id ?? 'scalping');
  }

  function patchActive(patch: Partial<Preset>) {
    const updated = presets.map((p) => (p.id === activePreset.id ? { ...p, ...patch } : p));
    persist(updated);
  }

  function addWidget(wid: WidgetId) {
    if (activePreset.layout.includes(wid)) return;
    patchActive({ layout: [...activePreset.layout, wid] });
  }
  function removeWidget(wid: WidgetId) {
    patchActive({ layout: activePreset.layout.filter((w) => w !== wid) });
  }
  function moveWidget(from: number, to: number) {
    const l = [...activePreset.layout];
    const [item] = l.splice(from, 1);
    l.splice(to, 0, item);
    patchActive({ layout: l });
  }

  const catColors: Record<string, string> = CATEGORY_COLORS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Preset tab strip ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '0 8px',
          height: 32,
          background: 'rgba(0,0,0,0.55)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <span
          className="hud-label"
          style={{
            fontSize: 7,
            color: 'rgba(255,255,255,0.22)',
            letterSpacing: '0.2em',
            marginRight: 8,
            whiteSpace: 'nowrap',
          }}
        >
          SETUPS:
        </span>
        <div
          style={{ flex: 1, display: 'flex', gap: 3, overflowX: 'auto', alignItems: 'center' }}
          className="nx-scroll"
        >
          {presets.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={() => {
                  setActiveId(p.id);
                  localStorage.setItem(LS_ACTIVE_KEY, p.id);
                  setEditMode(false);
                }}
                className="hud-label"
                style={{
                  padding: '3px 10px',
                  fontSize: 8,
                  border: `1px solid ${p.id === activeId ? 'rgba(255,179,0,0.7)' : 'rgba(255,255,255,0.1)'}`,
                  background: p.id === activeId ? 'rgba(255,179,0,0.09)' : 'transparent',
                  color: p.id === activeId ? '#ffb300' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </button>
              {p.id === activeId && presets.length > 1 && (
                <button
                  onClick={() => deletePreset(p.id)}
                  style={{
                    width: 14,
                    height: 14,
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,100,100,0.5)',
                    cursor: 'pointer',
                    fontSize: 10,
                    padding: 0,
                    marginLeft: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, alignItems: 'center', flexShrink: 0 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New setup name…"
            className="font-mono"
            style={{
              padding: '2px 7px',
              fontSize: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              outline: 'none',
              width: 120,
              height: 20,
            }}
          />
          <button
            onClick={addPreset}
            className="hud-label"
            style={{
              padding: '2px 8px',
              fontSize: 8,
              border: '1px solid rgba(255,179,0,0.4)',
              background: 'rgba(255,179,0,0.08)',
              color: '#ffb300',
              cursor: 'pointer',
              letterSpacing: '0.1em',
              height: 20,
            }}
          >
            + ADD
          </button>
          <button
            onClick={() => setEditMode((v) => !v)}
            className="hud-label"
            style={{
              padding: '2px 8px',
              fontSize: 8,
              border: `1px solid ${editMode ? 'rgba(0,229,255,0.6)' : 'rgba(255,255,255,0.15)'}`,
              background: editMode ? 'rgba(0,229,255,0.08)' : 'transparent',
              color: editMode ? '#00e5ff' : 'rgba(255,255,255,0.45)',
              cursor: 'pointer',
              letterSpacing: '0.1em',
              height: 20,
            }}
          >
            {editMode ? 'DONE' : 'EDIT'}
          </button>
        </div>
      </div>

      {/* ── Editor toolbar (only in edit mode) ────────────────────── */}
      {editMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '5px 10px',
            background: 'rgba(0,229,255,0.04)',
            borderBottom: '1px solid rgba(0,229,255,0.1)',
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <span className="hud-label" style={{ fontSize: 7.5, color: '#00e5ff', letterSpacing: '0.18em' }}>
            EDIT: {activePreset.name}
          </span>
          {/* rename */}
          <input
            defaultValue={activePreset.name}
            className="font-mono"
            onBlur={(e) => patchActive({ name: e.target.value.trim() || activePreset.name })}
            style={{
              padding: '2px 7px',
              fontSize: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(0,229,255,0.3)',
              color: 'rgba(255,255,255,0.8)',
              outline: 'none',
              width: 160,
            }}
          />
          {/* columns */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <span
              className="hud-label"
              style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}
            >
              COLS:
            </span>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => patchActive({ cols: n })}
                className="hud-label"
                style={{
                  width: 18,
                  height: 18,
                  fontSize: 8,
                  border: `1px solid ${activePreset.cols === n ? '#00e5ff' : 'rgba(255,255,255,0.15)'}`,
                  background: activePreset.cols === n ? 'rgba(0,229,255,0.1)' : 'transparent',
                  color: activePreset.cols === n ? '#00e5ff' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {n}
              </button>
            ))}
          </div>
          {/* add widgets */}
          <button
            onClick={() => setPickOpen((v) => !v)}
            className="hud-label"
            style={{
              padding: '2px 10px',
              fontSize: 8,
              border: `1px solid ${pickOpen ? '#00e5ff80' : 'rgba(255,255,255,0.18)'}`,
              background: pickOpen ? 'rgba(0,229,255,0.07)' : 'transparent',
              color: pickOpen ? '#00e5ff' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              letterSpacing: '0.12em',
            }}
          >
            + WIDGET
          </button>
          <span
            className="font-mono"
            style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}
          >
            drag to reorder · × to remove
          </span>
        </div>
      )}

      {/* ── Widget picker (edit mode + pickOpen) ──────────────────── */}
      {editMode && pickOpen && (
        <div
          style={{
            padding: '6px 10px',
            background: 'rgba(0,0,0,0.5)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
          }}
        >
          {WIDGET_REGISTRY.map((w) => {
            const active = activePreset.layout.includes(w.id);
            return (
              <button
                key={w.id}
                onClick={() => (active ? removeWidget(w.id) : addWidget(w.id))}
                className="hud-label"
                style={{
                  padding: '2px 8px',
                  fontSize: 7,
                  border: `1px solid ${active ? w.color + '88' : w.color + '33'}`,
                  background: active ? w.color + '18' : 'transparent',
                  color: active ? w.color : w.color + '88',
                  cursor: 'pointer',
                  letterSpacing: '0.07em',
                }}
              >
                {active ? '✓ ' : ''}
                {w.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Custom layout grid ────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 6 }} className="nx-scroll">
        {activePreset.layout.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <span
              className="hud-label"
              style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.28em' }}
            >
              SETUP LEER
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>
              Drücke EDIT → + WIDGET um Widgets hinzuzufügen
            </span>
            <button
              onClick={() => {
                setEditMode(true);
                setPickOpen(true);
              }}
              className="hud-label"
              style={{
                padding: '6px 18px',
                fontSize: 9,
                border: '1px solid rgba(255,179,0,0.5)',
                background: 'rgba(255,179,0,0.07)',
                color: '#ffb300',
                cursor: 'pointer',
                letterSpacing: '0.15em',
                marginTop: 6,
              }}
            >
              SETUP BAUEN
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activePreset.cols},1fr)`, gap: 5 }}>
            {activePreset.layout.map((wid, idx) => (
              <div
                key={wid}
                draggable={editMode}
                onDragStart={() => setDragSrc(idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(idx);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => {
                  if (dragSrc !== null && dragSrc !== idx) moveWidget(dragSrc, idx);
                  setDragSrc(null);
                  setDragOver(null);
                }}
                style={{
                  minHeight: 260,
                  position: 'relative',
                  cursor: editMode ? 'grab' : 'default',
                  outline: dragOver === idx ? '2px solid rgba(0,229,255,0.6)' : 'none',
                  opacity: dragSrc === idx ? 0.4 : 1,
                  transition: 'opacity 0.12s',
                }}
              >
                {/* remove button in edit mode */}
                {editMode && (
                  <button
                    onClick={() => removeWidget(wid)}
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: 5,
                      zIndex: 20,
                      width: 18,
                      height: 18,
                      background: 'rgba(255,26,107,0.2)',
                      border: '1px solid rgba(255,26,107,0.5)',
                      color: '#ff1a6b',
                      cursor: 'pointer',
                      fontSize: 11,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                )}
                {/* widget label chip in edit mode */}
                {editMode && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 5,
                      left: 5,
                      zIndex: 20,
                      padding: '1px 6px',
                      background: 'rgba(0,0,0,0.7)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      pointerEvents: 'none',
                    }}
                  >
                    <span
                      className="hud-label"
                      style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}
                    >
                      ⠿ DRAG
                    </span>
                  </div>
                )}
                <WidgetCell
                  id={wid}
                  connected={connected}
                  livePrice={livePrice}
                  posRows={posRows}
                  balance={balance}
                  equityArr={equityArr}
                  activeSymbol={activeSymbol}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   TRADING SCREEN — MAIN EXPORT (tabbed)
   ══════════════════════════════════════════════════════════════════ */
export function TradingScreen() {
  const { connected, positions: posRows, equity: equityArr, lastErr: mt5Err } = useMt5LiveData();
  const { tickers: liveTickers } = useZeusTickers(GODMODE_SYMBOLS);
  const btcTicker = liveTickers.find((t) => t.symbol === 'BTCUSD');
  const livePrice = btcTicker?.price ?? 0;
  const balance = equityArr.length > 0 ? equityArr[equityArr.length - 1] : 100000;

  const [tab, setTab] = useState<TradingTab>('TERMINAL');
  const [activeSymbol, setActiveSymbol] = useState<string>('BTCUSD');
  const [mt5Open, setMt5Open] = useState<boolean>(() => localStorage.getItem('zeus.connector.open') !== '0');
  const [layout, setLayout] = useState<WidgetId[][]>(DEFAULT_LAYOUT);
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [dragSrc, setDragSrc] = useState<[number, number] | null>(null);
  const activeIds = layout.flat();

  function toggleMt5() {
    setMt5Open((v) => {
      const next = !v;
      localStorage.setItem('zeus.connector.open', next ? '1' : '0');
      return next;
    });
  }
  function selectSymbol(sym: string) {
    setActiveSymbol(sym);
  }
  function goTerminalWithSymbol(sym: string) {
    setActiveSymbol(sym);
    setTab('TERMINAL');
  }

  function swapWidgets(r1: number, c1: number, r2: number, c2: number) {
    const nl = layout.map((row) => [...row]);
    const tmp = nl[r1][c1];
    nl[r1][c1] = nl[r2][c2];
    nl[r2][c2] = tmp;
    setLayout(nl);
  }
  function addWidget(id: WidgetId) {
    const nl = layout.map((row) => [...row]);
    const lastRow = nl[nl.length - 1];
    if (lastRow.length < 4) lastRow.push(id);
    else nl.push([id]);
    setLayout(nl);
  }
  function removeWidget(id: WidgetId) {
    const nl = layout.map((row) => row.filter((w) => w !== id)).filter((row) => row.length > 0);
    setLayout(nl.length > 0 ? nl : [['EQUITY_CURVE']]);
  }

  const TABS: { id: TradingTab; label: string; color: string }[] = [
    { id: 'TERMINAL', label: 'TERMINAL', color: '#00e5ff' },
    { id: 'MY_SETUP', label: 'MY SETUP', color: '#ffb300' },
    { id: 'GODMODE', label: '⚡ GODMODE', color: ROSE },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#030509',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* ── Bloomberg ticker bar ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '0 8px',
          height: 30,
          background: 'rgba(0,0,0,0.6)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <span
          className="hud-label"
          style={{
            fontSize: 8,
            color: 'rgba(255,255,255,0.28)',
            letterSpacing: '0.18em',
            marginRight: 10,
            whiteSpace: 'nowrap',
          }}
        >
          JARVIS PRO
        </span>
        <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
          {liveTickers.length === 0 &&
            [
              { symbol: 'BTC/USD', price: 0, change24h: 0 },
              { symbol: 'ETH/USD', price: 0, change24h: 0 },
            ].map((t) => (
              <div
                key={t.symbol}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 10px',
                  borderRight: '1px solid rgba(255,255,255,0.04)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  className="hud-label"
                  style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}
                >
                  {t.symbol}
                </span>
                <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                  ...
                </span>
              </div>
            ))}
          {liveTickers.map((t) => {
            const sym = t.symbol.replace('USDT', '/USD').replace(/^([A-Z]{2,5})(USD)$/, '$1/$2');
            const pos = t.change24h >= 0;
            const isActive = t.symbol === activeSymbol;
            return (
              <div
                key={t.symbol}
                onClick={() => selectSymbol(t.symbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 10px',
                  borderRight: '1px solid rgba(255,255,255,0.04)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(0,229,255,0.08)' : 'transparent',
                  borderBottom: isActive ? `1px solid ${CYAN_BRIGHT}` : '1px solid transparent',
                  transition: 'background 0.15s',
                }}
                title={`Set active: ${t.symbol}`}
              >
                <span
                  className="hud-label"
                  style={{
                    fontSize: 7.5,
                    color: isActive ? CYAN_BRIGHT : 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {sym}
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 9, color: isActive ? '#fff' : 'rgba(255,255,255,0.8)' }}
                >
                  {'$' +
                    t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="font-mono" style={{ fontSize: 8.5, color: pos ? '#00d084' : '#ff1a6b' }}>
                  {pos ? '+' : ''}
                  {t.change24h.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* Active symbol indicator */}
          {activeSymbol !== 'BTCUSD' && (
            <span
              className="hud-label"
              style={{
                fontSize: 7.5,
                color: CYAN_BRIGHT,
                border: `1px solid ${CYAN_BRIGHT}55`,
                padding: '1px 6px',
                letterSpacing: '0.12em',
              }}
            >
              {activeSymbol}
            </span>
          )}
          {tab === 'TERMINAL' &&
            [
              { l: 'WIDGETS', fn: () => setShowLibrary((v) => !v) },
              { l: 'SETTINGS', fn: () => setShowSettings((v) => !v) },
            ].map((btn) => (
              <button
                key={btn.l}
                onClick={btn.fn}
                className="hud-label"
                style={{
                  padding: '3px 9px',
                  fontSize: 7.5,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.55)',
                  cursor: 'pointer',
                  letterSpacing: '0.12em',
                }}
              >
                {btn.l}
              </button>
            ))}
          <button
            onClick={toggleMt5}
            className="hud-label"
            style={{
              padding: '3px 7px',
              fontSize: 7.5,
              border: `1px solid ${mt5Open ? 'rgba(0,229,255,0.35)' : 'rgba(255,255,255,0.12)'}`,
              background: mt5Open ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.03)',
              color: mt5Open ? CYAN_BRIGHT : 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              letterSpacing: '0.12em',
            }}
            title="Toggle MT5 connector"
          >
            MT5 {mt5Open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── MT5 connector strip (collapsible) ─────────────────────── */}
      {mt5Open && <ZeusBotMiniPlayer />}

      {/* ── MT5 error banner ─────────────────────────────────────────── */}
      {mt5Err && !connected && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            background: 'rgba(255,26,107,0.08)',
            borderBottom: '1px solid rgba(255,26,107,0.35)',
            flexShrink: 0,
          }}
        >
          <span
            style={{ fontSize: 9, color: '#ff1a6b', fontFamily: 'JetBrains Mono', letterSpacing: '0.12em' }}
          >
            ⚠ MT5 BRIDGE OFFLINE — {mt5Err}
          </span>
          <span
            style={{
              fontSize: 8,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'JetBrains Mono',
              marginLeft: 'auto',
            }}
          >
            Start ZeusBot bridge on port 1234 to activate live trading
          </span>
        </div>
      )}

      {/* ── Tab strip ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 8px',
          height: 28,
          background: 'rgba(0,0,0,0.4)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          gap: 2,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="hud-label"
            style={{
              padding: '4px 16px',
              fontSize: 8,
              cursor: 'pointer',
              letterSpacing: '0.18em',
              border: `1px solid ${tab === t.id ? t.color + '88' : 'rgba(255,255,255,0.08)'}`,
              borderBottom: tab === t.id ? '1px solid transparent' : '1px solid rgba(255,255,255,0.08)',
              background: tab === t.id ? t.color + '12' : 'transparent',
              color: tab === t.id ? t.color : 'rgba(255,255,255,0.3)',
              position: 'relative',
              top: 1,
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TERMINAL tab ──────────────────────────────────────────── */}
      {tab === 'TERMINAL' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 6 }} className="nx-scroll">
          {layout.map((row, ri) => (
            <div
              key={ri}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${row.length},1fr)`,
                gap: 5,
                marginBottom: 5,
              }}
            >
              {row.map((wid, ci) => (
                <div
                  key={wid}
                  draggable
                  onDragStart={() => setDragSrc([ri, ci])}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragSrc) swapWidgets(dragSrc[0], dragSrc[1], ri, ci);
                    setDragSrc(null);
                  }}
                  style={{ minHeight: 260, cursor: 'grab', position: 'relative' }}
                >
                  <WidgetCell
                    id={wid}
                    connected={connected}
                    livePrice={livePrice}
                    posRows={posRows}
                    balance={balance}
                    equityArr={equityArr}
                    onRemove={removeWidget}
                    activeSymbol={activeSymbol}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── MY SETUP tab ──────────────────────────────────────────── */}
      {tab === 'MY_SETUP' && (
        <MySetupTab
          connected={connected}
          posRows={posRows}
          balance={balance}
          equityArr={equityArr}
          livePrice={livePrice}
          activeSymbol={activeSymbol}
        />
      )}

      {/* ── GODMODE tab ───────────────────────────────────────────── */}
      {tab === 'GODMODE' && (
        <GodModeTab connected={connected} onNavigate={setTab} onSymbolSelect={selectSymbol} />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showLibrary && tab === 'TERMINAL' && (
        <WidgetLibraryPanel
          activeIds={activeIds}
          onAdd={addWidget}
          onRemove={removeWidget}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  );
}
