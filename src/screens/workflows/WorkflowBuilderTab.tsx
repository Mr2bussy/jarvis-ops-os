// @ts-nocheck
import { useState } from 'react';
import { Stat } from '../../components/primitives';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, VIOLET, ROSE, colorFor } from '../../theme';
import { TEAMS, DIVISIONS } from '../../data/jarvis-data';
import type { WorkflowNode } from '../../data/os-data';
import { runContent } from '../../lib/claude';
import type { BuilderWF, TplDef, WBChat } from './types';
import { loadBuilderWFs, saveBuilderWFs } from './storage';
import { WF_TEMPLATES } from './templates';
import { WorkflowDAG } from './WorkflowDAG';

// ── WorkflowBuilderTab ────────────────────────────────────────────────────
const SRC_COLOR = (s: string) =>
  s === 'n8n' ? JADE : s === 'github' ? VIOLET : s === 'jarvis' ? CYAN_BRIGHT : ROSE;

export function WorkflowBuilderTab() {
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
    {
      role: 'jarvis',
      text: "JARVIS WORKFLOW ARCHITECT online. Describe any automation and I'll help design the optimal node structure, trigger logic, and edge connections.",
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const allCats = ['ALL', ...Array.from(new Set(WF_TEMPLATES.map((t) => t.category)))];
  const filtered = WF_TEMPLATES.filter(
    (t) =>
      (cat === 'ALL' || t.category === cat) &&
      (!search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.desc.toLowerCase().includes(search.toLowerCase()) ||
        t.tags.some((tg) => tg.toLowerCase().includes(search.toLowerCase()))),
  );

  const selTplObj = WF_TEMPLATES.find((t) => t.id === selTpl);
  const selLibObj = library.find((w) => w.id === selLib);
  const previewWF: (TplDef & { savedAt?: string }) | null = selLibObj ?? selTplObj ?? null;

  function startEdit() {
    if (!selLibObj) return;
    setEditDraft({
      name: selLibObj.name,
      desc: selLibObj.desc,
      trigger: selLibObj.trigger,
      category: selLibObj.category,
      owner: selLibObj.owner,
      tags: [...selLibObj.tags],
    });
    setSelNode(null);
    setEditMode(true);
  }
  function saveLibEdit() {
    if (!selLibObj) return;
    const updated = library.map((w) => (w.id === selLibObj.id ? ({ ...w, ...editDraft } as BuilderWF) : w));
    setLibrary(updated);
    saveBuilderWFs(updated);
    setEditMode(false);
    setEditDraft({});
  }
  function updateNode(id: string, changes: Partial<WorkflowNode>) {
    if (!selLibObj) return;
    const nodes = selLibObj.nodes.map((n) => (n.id === id ? { ...n, ...changes } : n));
    const updated = library.map((w) => (w.id === selLibObj.id ? { ...w, nodes } : w));
    setLibrary(updated);
    saveBuilderWFs(updated);
  }
  function addNode() {
    if (!selLibObj || !newNodeLabel.trim()) return;
    const maxX = Math.max(...selLibObj.nodes.map((n) => n.x), 0);
    const newN: WorkflowNode = {
      id: `n${selLibObj.nodes.length + 1}`,
      x: maxX + 200,
      y: 100,
      label: newNodeLabel.trim(),
      team: newNodeTeam,
    };
    const updated = library.map((w) => (w.id === selLibObj.id ? { ...w, nodes: [...w.nodes, newN] } : w));
    setLibrary(updated);
    saveBuilderWFs(updated);
    setNewNodeLabel('');
  }
  function deleteNode(id: string) {
    if (!selLibObj) return;
    const nodes = selLibObj.nodes.filter((n) => n.id !== id);
    const edges = selLibObj.edges.filter(([a, b]) => a !== id && b !== id);
    const updated = library.map((w) => (w.id === selLibObj.id ? { ...w, nodes, edges } : w));
    setLibrary(updated);
    saveBuilderWFs(updated);
    if (selNode === id) setSelNode(null);
  }
  function addEdge() {
    if (!selLibObj || !addEdgeFrom.trim() || !addEdgeTo.trim() || addEdgeFrom === addEdgeTo) return;
    const exists = selLibObj.edges.some(([a, b]) => a === addEdgeFrom && b === addEdgeTo);
    if (exists) return;
    const edges: [string, string][] = [...selLibObj.edges, [addEdgeFrom.trim(), addEdgeTo.trim()]];
    const updated = library.map((w) => (w.id === selLibObj.id ? { ...w, edges } : w));
    setLibrary(updated);
    saveBuilderWFs(updated);
    setAddEdgeFrom('');
    setAddEdgeTo('');
  }
  function deleteEdge(a: string, b: string) {
    if (!selLibObj) return;
    const edges = selLibObj.edges.filter(([ea, eb]) => !(ea === a && eb === b));
    const updated = library.map((w) => (w.id === selLibObj.id ? { ...w, edges } : w));
    setLibrary(updated);
    saveBuilderWFs(updated);
  }
  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMsgs((m) => [...m, { role: 'user', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const ctx = previewWF
        ? `Active workflow context: "${previewWF.name}" (${previewWF.nodes.length} nodes, category: ${previewWF.category}). `
        : '';
      const reply = await runContent(
        `${ctx}User asks: ${userMsg}\n\nYou are JARVIS Workflow Architect — an expert in automation design. Reply concisely with actionable workflow design advice: node suggestions, trigger patterns, edge logic, or best practices. Plain text only, no markdown.`,
        'workflow',
      );
      setChatMsgs((m) => [...m, { role: 'jarvis', text: reply }]);
    } catch {
      setChatMsgs((m) => [...m, { role: 'jarvis', text: 'Connection error. Check Claude integration.' }]);
    } finally {
      setChatLoading(false);
    }
  }
  function applyTemplate(tpl: TplDef) {
    const wf: BuilderWF = {
      ...tpl,
      id: 'BLD-' + Date.now(),
      savedAt: new Date().toISOString(),
      fromTemplate: tpl.id,
    };
    const updated = [...library, wf];
    setLibrary(updated);
    saveBuilderWFs(updated);
    setSelLib(wf.id);
    setPanel('library');
  }
  function createCustom() {
    const wf: BuilderWF = {
      id: 'BLD-' + Date.now(),
      name: 'New Workflow',
      desc: 'Custom workflow — edit to define.',
      category: 'CUSTOM',
      source: 'custom',
      trigger: 'On-demand',
      tags: [],
      owner: 'ARC-OPT',
      nodes: [
        { id: 'n1', x: 60, y: 100, label: 'Trigger', team: 'ARC-OPT' },
        { id: 'n2', x: 280, y: 100, label: 'Process', team: 'ARC-OPT' },
        { id: 'n3', x: 500, y: 100, label: 'Deliver', team: 'ARC-OPT' },
      ],
      edges: [
        ['n1', 'n2'],
        ['n2', 'n3'],
      ],
      savedAt: new Date().toISOString(),
    };
    const updated = [...library, wf];
    setLibrary(updated);
    saveBuilderWFs(updated);
    setSelLib(wf.id);
    setPanel('library');
    setEditDraft({
      name: wf.name,
      desc: wf.desc,
      trigger: wf.trigger,
      category: wf.category,
      owner: wf.owner,
      tags: [],
    });
    setEditMode(true);
  }
  function deleteLib(id: string) {
    const updated = library.filter((w) => w.id !== id);
    setLibrary(updated);
    saveBuilderWFs(updated);
    if (selLib === id) {
      setSelLib(null);
      setEditMode(false);
    }
  }
  function exportJson(wf: BuilderWF | TplDef) {
    const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wf.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inCss: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: 10,
    background: 'oklch(0.05 0.01 240/0.9)',
    border: '1px solid var(--line)',
    color: 'var(--fg)',
    outline: 'none',
    fontFamily: 'var(--font-mono)',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 8 }}>
      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`SEARCH ${WF_TEMPLATES.length} TEMPLATES…`}
          style={{
            padding: '5px 10px',
            fontSize: 10,
            background: 'oklch(0.05 0.01 240/0.9)',
            border: '1px solid var(--line)',
            color: 'var(--fg)',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
            width: 210,
          }}
        />
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', flex: 1 }}>
          {allCats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className="hud-label"
              style={{
                padding: '3px 7px',
                fontSize: 7.5,
                cursor: 'pointer',
                letterSpacing: '0.1em',
                color: cat === c ? '#0d1117' : CYAN_BRIGHT,
                background: cat === c ? CYAN_BRIGHT : 'transparent',
                border: `1px solid ${CYAN}45`,
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="hud-label"
            style={{
              padding: '5px 12px',
              fontSize: 8.5,
              cursor: 'pointer',
              letterSpacing: '0.16em',
              color: chatOpen ? '#0d1117' : VIOLET,
              background: chatOpen ? VIOLET : 'transparent',
              border: `1px solid ${VIOLET}60`,
            }}
          >
            ⬡ JARVIS {chatOpen ? '◂' : '▸'}
          </button>
          <button
            onClick={() => setPanel(panel === 'library' ? 'templates' : 'library')}
            className="hud-label"
            style={{
              padding: '5px 12px',
              fontSize: 8.5,
              cursor: 'pointer',
              letterSpacing: '0.16em',
              color: panel === 'library' ? '#0d1117' : AMBER,
              background: panel === 'library' ? AMBER : 'transparent',
              border: `1px solid ${AMBER}60`,
            }}
          >
            ◆ LIBRARY ({library.length})
          </button>
          <button
            onClick={createCustom}
            className="hud-label"
            style={{
              padding: '5px 12px',
              fontSize: 8.5,
              cursor: 'pointer',
              color: JADE,
              border: `1px solid ${JADE}60`,
              background: 'transparent',
              letterSpacing: '0.16em',
            }}
          >
            + NEW
          </button>
        </div>
      </div>

      {/* ── 3-panel grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: chatOpen ? '260px 1fr 300px' : '260px 1fr',
          gap: 10,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ── Left: list ── */}
        <div
          style={{
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            minHeight: 0,
            paddingRight: 3,
          }}
        >
          <div
            className="hud-label"
            style={{
              fontSize: 7.5,
              color: 'var(--cyan-dim)',
              letterSpacing: '0.24em',
              flexShrink: 0,
              marginBottom: 2,
            }}
          >
            {panel === 'templates'
              ? `${filtered.length} / ${WF_TEMPLATES.length} TEMPLATES`
              : `${library.length} SAVED WORKFLOWS`}
          </div>

          {panel === 'templates' ? (
            filtered.map((tpl) => {
              const sc = SRC_COLOR(tpl.source);
              const active = selTpl === tpl.id && !selLib;
              return (
                <div
                  key={tpl.id}
                  onClick={() => {
                    setSelTpl(tpl.id);
                    setSelLib(null);
                    setEditMode(false);
                  }}
                  style={{
                    padding: '7px 9px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    borderLeft: `3px solid ${active ? CYAN_BRIGHT : sc}`,
                    border: `1px solid ${active ? CYAN : 'var(--line-soft)'}`,
                    background: active ? 'oklch(0.78 0.13 215/0.09)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span
                      className="hud-label"
                      style={{
                        fontSize: 8.5,
                        color: active ? CYAN_BRIGHT : 'var(--fg)',
                        letterSpacing: '0.1em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {tpl.name}
                    </span>
                    <span
                      style={{
                        fontSize: 6.5,
                        color: sc,
                        fontFamily: 'Orbitron',
                        border: `1px solid ${sc}50`,
                        padding: '0 3px',
                        flexShrink: 0,
                        marginLeft: 4,
                        letterSpacing: '0.12em',
                      }}
                    >
                      {tpl.source.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span className="font-mono" style={{ fontSize: 7.5, color: AMBER }}>
                      ◆ {tpl.category}
                    </span>
                    <span className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>
                      {tpl.nodes.length}n · {tpl.edges.length}e
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <>
              {library.length === 0 && (
                <div
                  className="font-mono"
                  style={{
                    fontSize: 9.5,
                    color: 'var(--cyan-dim)',
                    padding: 16,
                    textAlign: 'center',
                    lineHeight: 1.6,
                  }}
                >
                  Library empty.
                  <br />
                  Browse templates → USE.
                </div>
              )}
              {library.map((wf) => {
                const sc = SRC_COLOR(wf.source);
                const active = selLib === wf.id;
                return (
                  <div
                    key={wf.id}
                    onClick={() => {
                      setSelLib(wf.id);
                      setSelTpl(null);
                      setEditMode(false);
                    }}
                    style={{
                      padding: '7px 9px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      borderLeft: `3px solid ${active ? AMBER : sc}`,
                      border: `1px solid ${active ? AMBER : 'var(--line-soft)'}`,
                      background: active ? `${AMBER}09` : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        className="hud-label"
                        style={{
                          fontSize: 8.5,
                          color: active ? AMBER : 'var(--fg)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          letterSpacing: '0.1em',
                        }}
                      >
                        {wf.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLib(wf.id);
                        }}
                        style={{
                          fontSize: 9,
                          color: 'var(--cyan-dim)',
                          border: 'none',
                          cursor: 'pointer',
                          background: 'transparent',
                          padding: '0 3px',
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)' }}>
                      {wf.nodes.length}n · {wf.category} · {new Date(wf.savedAt).toLocaleDateString()}
                    </div>
                    {wf.fromTemplate && (
                      <div className="font-mono" style={{ fontSize: 7.5, color: sc }}>
                        ↳ tpl: {wf.fromTemplate}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={createCustom}
                className="hud-label"
                style={{
                  marginTop: 6,
                  padding: '8px',
                  fontSize: 8.5,
                  color: JADE,
                  border: `1px solid ${JADE}60`,
                  cursor: 'pointer',
                  letterSpacing: '0.2em',
                  background: 'transparent',
                  flexShrink: 0,
                }}
              >
                + CREATE NEW WORKFLOW
              </button>
            </>
          )}
        </div>

        {/* ── Center: detail / editor ── */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          {!previewWF ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 12,
                opacity: 0.5,
              }}
            >
              <div
                className="font-display"
                style={{ fontSize: 14, color: CYAN_BRIGHT, letterSpacing: '0.24em' }}
              >
                SELECT A TEMPLATE
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--cyan-dim)' }}>
                {WF_TEMPLATES.length} curated workflows · {allCats.length - 1} categories
              </div>
              <div
                style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 400 }}
              >
                {(['n8n', 'github', 'jarvis', 'custom'] as const).map((s) => (
                  <span
                    key={s}
                    className="hud-label"
                    style={{
                      fontSize: 8,
                      color: SRC_COLOR(s),
                      border: `1px solid ${SRC_COLOR(s)}45`,
                      padding: '3px 8px',
                      letterSpacing: '0.16em',
                    }}
                  >
                    {s.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 7.5,
                        color: SRC_COLOR(previewWF.source),
                        fontFamily: 'Orbitron',
                        letterSpacing: '0.18em',
                        border: `1px solid ${SRC_COLOR(previewWF.source)}50`,
                        padding: '1px 5px',
                      }}
                    >
                      {previewWF.source.toUpperCase()}
                    </span>
                    <span
                      className="hud-label"
                      style={{ fontSize: 7.5, color: AMBER, letterSpacing: '0.16em' }}
                    >
                      ◆ {previewWF.category}
                    </span>
                    <span
                      className="hud-label"
                      style={{ fontSize: 7.5, color: 'var(--cyan-dim)', letterSpacing: '0.12em' }}
                    >
                      {previewWF.nodes.length}N · {previewWF.edges.length}E
                    </span>
                  </div>
                  {editMode && selLibObj ? (
                    <input
                      value={editDraft.name ?? ''}
                      onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                      style={{ ...inCss, fontSize: 14, fontFamily: 'var(--font-display)', marginBottom: 0 }}
                    />
                  ) : (
                    <div
                      className="font-display glow-cyan"
                      style={{ fontSize: 14, color: CYAN_BRIGHT, lineHeight: 1.2 }}
                    >
                      {previewWF.name}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  {!selLib && selTplObj && (
                    <button
                      onClick={() => applyTemplate(selTplObj)}
                      className="hud-label"
                      style={{
                        padding: '7px 14px',
                        fontSize: 8.5,
                        color: JADE,
                        border: `1px solid ${JADE}60`,
                        cursor: 'pointer',
                        letterSpacing: '0.2em',
                        background: `${JADE}10`,
                      }}
                    >
                      ◆ USE TEMPLATE
                    </button>
                  )}
                  {selLib && !editMode && (
                    <button
                      onClick={startEdit}
                      className="hud-label"
                      style={{
                        padding: '7px 14px',
                        fontSize: 8.5,
                        color: AMBER,
                        border: `1px solid ${AMBER}60`,
                        cursor: 'pointer',
                        letterSpacing: '0.2em',
                        background: 'transparent',
                      }}
                    >
                      ✎ EDIT
                    </button>
                  )}
                  {selLib && editMode && (
                    <>
                      <button
                        onClick={saveLibEdit}
                        className="hud-label"
                        style={{
                          padding: '7px 14px',
                          fontSize: 8.5,
                          color: JADE,
                          border: `1px solid ${JADE}60`,
                          cursor: 'pointer',
                          letterSpacing: '0.2em',
                          background: `${JADE}12`,
                        }}
                      >
                        ✓ SAVE
                      </button>
                      <button
                        onClick={() => setEditMode(false)}
                        className="hud-label"
                        style={{
                          padding: '5px 10px',
                          fontSize: 8,
                          color: 'var(--cyan-dim)',
                          border: '1px solid var(--line-soft)',
                          cursor: 'pointer',
                          background: 'transparent',
                        }}
                      >
                        CANCEL
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => exportJson(previewWF)}
                    className="hud-label"
                    style={{
                      padding: '5px 10px',
                      fontSize: 8,
                      color: CYAN_BRIGHT,
                      border: `1px solid ${CYAN}50`,
                      cursor: 'pointer',
                      letterSpacing: '0.14em',
                      background: 'transparent',
                    }}
                  >
                    ↓ JSON
                  </button>
                </div>
              </div>

              {/* Metadata editor / display */}
              {editMode && selLibObj ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div
                      className="hud-label"
                      style={{
                        fontSize: 7.5,
                        color: 'var(--cyan-dim)',
                        letterSpacing: '0.2em',
                        marginBottom: 3,
                      }}
                    >
                      DESCRIPTION
                    </div>
                    <textarea
                      value={editDraft.desc ?? ''}
                      onChange={(e) => setEditDraft((d) => ({ ...d, desc: e.target.value }))}
                      rows={3}
                      style={{ ...inCss, resize: 'vertical', lineHeight: 1.45 }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <div
                        className="hud-label"
                        style={{
                          fontSize: 7.5,
                          color: 'var(--cyan-dim)',
                          letterSpacing: '0.2em',
                          marginBottom: 3,
                        }}
                      >
                        TRIGGER
                      </div>
                      <input
                        value={editDraft.trigger ?? ''}
                        onChange={(e) => setEditDraft((d) => ({ ...d, trigger: e.target.value }))}
                        style={inCss}
                      />
                    </div>
                    <div>
                      <div
                        className="hud-label"
                        style={{
                          fontSize: 7.5,
                          color: 'var(--cyan-dim)',
                          letterSpacing: '0.2em',
                          marginBottom: 3,
                        }}
                      >
                        OWNER TEAM
                      </div>
                      <input
                        value={editDraft.owner ?? ''}
                        onChange={(e) => setEditDraft((d) => ({ ...d, owner: e.target.value }))}
                        style={inCss}
                      />
                    </div>
                    <div>
                      <div
                        className="hud-label"
                        style={{
                          fontSize: 7.5,
                          color: 'var(--cyan-dim)',
                          letterSpacing: '0.2em',
                          marginBottom: 3,
                        }}
                      >
                        TAGS (comma-separated)
                      </div>
                      <input
                        value={(editDraft.tags ?? []).join(', ')}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            tags: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }))
                        }
                        style={inCss}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 10, color: 'var(--cyan-dim)', lineHeight: 1.55 }}
                  >
                    {previewWF.desc}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                    {previewWF.tags.map((tag) => (
                      <span
                        key={tag}
                        className="font-mono"
                        style={{
                          fontSize: 7.5,
                          color: 'oklch(0.55 0.08 215)',
                          border: '1px solid var(--line-soft)',
                          padding: '0 4px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 14 }}>
                <Stat
                  label="TRIGGER"
                  value={editMode && editDraft.trigger ? editDraft.trigger : previewWF.trigger}
                />
                <Stat label="OWNER" value={editMode && editDraft.owner ? editDraft.owner : previewWF.owner} />
                <Stat label="NODES" value={`${previewWF.nodes.length}`} />
                <Stat label="EDGES" value={`${previewWF.edges.length}`} />
              </div>

              {/* DAG Preview */}
              <div>
                <div
                  className="hud-label"
                  style={{ fontSize: 9, color: AMBER, letterSpacing: '0.3em', marginBottom: 5 }}
                >
                  ◆ DAG PREVIEW
                </div>
                <div
                  style={{
                    padding: 8,
                    border: '1px solid var(--line-soft)',
                    background: 'oklch(0.05 0.012 240/0.6)',
                  }}
                >
                  <WorkflowDAG workflow={{ ...previewWF, status: 'active', runs: 0 }} />
                </div>
              </div>

              {/* Nodes */}
              <div>
                <div
                  className="hud-label"
                  style={{ fontSize: 9, color: CYAN_BRIGHT, letterSpacing: '0.28em', marginBottom: 5 }}
                >
                  ◆ NODES{' '}
                  {selLib && editMode ? (
                    <span style={{ color: 'var(--cyan-dim)', fontWeight: 400 }}>· CLICK NODE TO EDIT</span>
                  ) : (
                    ''
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {previewWF.nodes.map((n) => {
                    const t = TEAMS.find((x) => x.id === n.team);
                    const c = t ? colorFor(DIVISIONS[t.div]?.color ?? 'cyan') : 'oklch(0.65 0.08 215)';
                    const isSelNode = selNode === n.id;
                    return (
                      <div key={n.id}>
                        <div
                          onClick={() => {
                            if (selLib && editMode) {
                              if (isSelNode) {
                                setSelNode(null);
                              } else {
                                setSelNode(n.id);
                                setNodeDraft({ label: n.label, team: n.team });
                              }
                            }
                          }}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '28px 90px 1fr 52px auto',
                            gap: 6,
                            alignItems: 'center',
                            padding: '4px 8px',
                            background: isSelNode
                              ? 'oklch(0.10 0.018 240/0.85)'
                              : 'oklch(0.07 0.012 240/0.5)',
                            border: `1px solid ${isSelNode ? CYAN : 'var(--line-soft)'}`,
                            cursor: selLib && editMode ? 'pointer' : 'default',
                          }}
                        >
                          <span className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)' }}>
                            {n.id}
                          </span>
                          <span
                            style={{
                              fontSize: 7.5,
                              color: c,
                              fontFamily: 'Orbitron',
                              letterSpacing: '0.08em',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {n.team}
                          </span>
                          <span className="font-mono" style={{ fontSize: 9.5, color: 'var(--fg)' }}>
                            {n.label}
                          </span>
                          <span
                            className="font-mono"
                            style={{ fontSize: 7.5, color: 'var(--cyan-dim)', textAlign: 'right' }}
                          >
                            ({n.x},{n.y})
                          </span>
                          {selLib && editMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNode(n.id);
                              }}
                              style={{
                                fontSize: 9,
                                color: 'var(--cyan-dim)',
                                border: 'none',
                                cursor: 'pointer',
                                background: 'transparent',
                                padding: '0 2px',
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {isSelNode && selLib && editMode && (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 6,
                              padding: '7px 10px',
                              background: 'oklch(0.09 0.016 240/0.9)',
                              border: '1px solid var(--line)',
                              borderTop: 'none',
                            }}
                          >
                            <div>
                              <div
                                className="hud-label"
                                style={{
                                  fontSize: 7.5,
                                  color: 'var(--cyan-dim)',
                                  letterSpacing: '0.18em',
                                  marginBottom: 3,
                                }}
                              >
                                LABEL
                              </div>
                              <input
                                value={nodeDraft.label}
                                onChange={(e) => setNodeDraft((d) => ({ ...d, label: e.target.value }))}
                                style={inCss}
                              />
                            </div>
                            <div>
                              <div
                                className="hud-label"
                                style={{
                                  fontSize: 7.5,
                                  color: 'var(--cyan-dim)',
                                  letterSpacing: '0.18em',
                                  marginBottom: 3,
                                }}
                              >
                                TEAM ID
                              </div>
                              <input
                                value={nodeDraft.team}
                                onChange={(e) => setNodeDraft((d) => ({ ...d, team: e.target.value }))}
                                style={inCss}
                              />
                            </div>
                            <button
                              onClick={() => {
                                updateNode(n.id, nodeDraft);
                                setSelNode(null);
                              }}
                              className="hud-label"
                              style={{
                                gridColumn: '1/-1',
                                padding: '5px',
                                fontSize: 8.5,
                                color: JADE,
                                border: `1px solid ${JADE}60`,
                                cursor: 'pointer',
                                letterSpacing: '0.18em',
                                background: `${JADE}10`,
                              }}
                            >
                              ✓ UPDATE NODE
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selLib && editMode && (
                  <div
                    style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px', gap: 6, marginTop: 6 }}
                  >
                    <input
                      value={newNodeLabel}
                      onChange={(e) => setNewNodeLabel(e.target.value)}
                      placeholder="Node label…"
                      style={inCss}
                      onKeyDown={(e) => e.key === 'Enter' && addNode()}
                    />
                    <input
                      value={newNodeTeam}
                      onChange={(e) => setNewNodeTeam(e.target.value)}
                      placeholder="Team ID"
                      style={inCss}
                    />
                    <button
                      onClick={addNode}
                      className="hud-label"
                      style={{
                        padding: '4px 8px',
                        fontSize: 8.5,
                        color: JADE,
                        border: `1px solid ${JADE}60`,
                        cursor: 'pointer',
                        letterSpacing: '0.14em',
                        background: 'transparent',
                      }}
                    >
                      + NODE
                    </button>
                  </div>
                )}
              </div>

              {/* Edges */}
              <div>
                <div
                  className="hud-label"
                  style={{ fontSize: 9, color: CYAN_BRIGHT, letterSpacing: '0.28em', marginBottom: 5 }}
                >
                  ◆ EDGES
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {previewWF.edges.map(([a, b], i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 9,
                          color: CYAN_BRIGHT,
                          padding: '2px 6px',
                          border: `1px solid ${CYAN}40`,
                          background: 'oklch(0.07 0.012 240/0.5)',
                        }}
                      >
                        {a}→{b}
                      </span>
                      {selLib && editMode && (
                        <button
                          onClick={() => deleteEdge(a, b)}
                          style={{
                            fontSize: 8,
                            color: 'var(--cyan-dim)',
                            border: 'none',
                            cursor: 'pointer',
                            background: 'transparent',
                            padding: 0,
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {selLib && editMode && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 90px 80px',
                      gap: 6,
                      marginTop: 6,
                      alignItems: 'center',
                    }}
                  >
                    <input
                      value={addEdgeFrom}
                      onChange={(e) => setAddEdgeFrom(e.target.value)}
                      placeholder="From (n1)"
                      style={inCss}
                    />
                    <input
                      value={addEdgeTo}
                      onChange={(e) => setAddEdgeTo(e.target.value)}
                      placeholder="To (n2)"
                      style={inCss}
                      onKeyDown={(e) => e.key === 'Enter' && addEdge()}
                    />
                    <button
                      onClick={addEdge}
                      className="hud-label"
                      style={{
                        padding: '4px 8px',
                        fontSize: 8.5,
                        color: CYAN_BRIGHT,
                        border: `1px solid ${CYAN}60`,
                        cursor: 'pointer',
                        letterSpacing: '0.12em',
                        background: 'transparent',
                      }}
                    >
                      + EDGE
                    </button>
                  </div>
                )}
              </div>

              {selLib && showJson && (
                <div>
                  <div
                    className="hud-label"
                    style={{ fontSize: 9, color: AMBER, letterSpacing: '0.28em', marginBottom: 4 }}
                  >
                    ◆ RAW JSON
                  </div>
                  <pre
                    className="font-mono"
                    style={{
                      fontSize: 8.5,
                      color: 'var(--fg)',
                      background: 'oklch(0.04 0.01 240/0.95)',
                      border: '1px solid var(--line-soft)',
                      padding: 10,
                      overflow: 'auto',
                      maxHeight: 280,
                      lineHeight: 1.4,
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(previewWF, null, 2)}
                  </pre>
                </div>
              )}
              {selLib && (
                <button
                  onClick={() => setShowJson((v) => !v)}
                  className="hud-label"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '4px 10px',
                    fontSize: 8,
                    color: 'var(--cyan-dim)',
                    border: '1px solid var(--line-soft)',
                    cursor: 'pointer',
                    letterSpacing: '0.12em',
                    background: 'transparent',
                  }}
                >
                  {showJson ? 'HIDE JSON' : 'VIEW JSON'}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Right: Jarvis chat ── */}
        {chatOpen && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              border: `1px solid ${VIOLET}50`,
              background: 'oklch(0.04 0.014 285/0.95)',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${VIOLET}35`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div>
                <div
                  className="font-display"
                  style={{ fontSize: 9.5, color: VIOLET, letterSpacing: '0.24em' }}
                >
                  ⬡ JARVIS ARCHITECT
                </div>
                <div className="font-mono" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>
                  Workflow design AI assistant
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                style={{
                  fontSize: 11,
                  color: 'var(--cyan-dim)',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: 0,
              }}
            >
              {chatMsgs.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    className="hud-label"
                    style={{
                      fontSize: 7,
                      color: m.role === 'user' ? CYAN_BRIGHT : VIOLET,
                      letterSpacing: '0.2em',
                    }}
                  >
                    {m.role === 'user' ? 'YOU' : '⬡ JARVIS'}
                  </div>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 9.5,
                      color: 'var(--fg)',
                      lineHeight: 1.55,
                      padding: '7px 10px',
                      maxWidth: '92%',
                      background: m.role === 'user' ? 'oklch(0.78 0.13 215/0.12)' : `${VIOLET}0f`,
                      border: `1px solid ${m.role === 'user' ? CYAN + '25' : VIOLET + '28'}`,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="font-mono" style={{ fontSize: 9, color: VIOLET }}>
                  ⬡ JARVIS thinking…
                </div>
              )}
            </div>
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${VIOLET}28`, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  placeholder="Describe a workflow or ask…"
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: 9.5,
                    background: `${VIOLET}0a`,
                    border: `1px solid ${VIOLET}35`,
                    color: 'var(--fg)',
                    outline: 'none',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <button
                  onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="hud-label"
                  style={{
                    padding: '6px 12px',
                    fontSize: 8.5,
                    color: chatLoading ? 'var(--cyan-dim)' : VIOLET,
                    border: `1px solid ${VIOLET}55`,
                    cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed',
                    letterSpacing: '0.18em',
                    background: 'transparent',
                  }}
                >
                  SEND
                </button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[
                  'Design a CI/CD pipeline',
                  'Add parallel error handling',
                  'Suggest webhook triggers',
                  'Optimize for speed',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setChatInput(q)}
                    className="font-mono"
                    style={{
                      fontSize: 7.5,
                      color: VIOLET,
                      border: `1px solid ${VIOLET}30`,
                      cursor: 'pointer',
                      padding: '2px 6px',
                      background: 'transparent',
                    }}
                  >
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
