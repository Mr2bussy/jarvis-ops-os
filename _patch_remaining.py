#!/usr/bin/env python3
"""Patch script: A2 (Workflows scheduling), A3 (Agent Run), A4 (Admin pings), B2 (Social types/preload), global.d.ts types"""
import os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
errors = []

def read(rel):
    return open(os.path.join(BASE, rel), 'r', encoding='utf-8-sig').read()

def write(rel, content):
    open(os.path.join(BASE, rel), 'w', encoding='utf-8', newline='\r\n').write(content)

def patch(rel, old, new, label=''):
    path = os.path.join(BASE, rel)
    content = open(path, 'r', encoding='utf-8-sig').read()
    if old not in content:
        msg = f"  \u2717 NOT FOUND [{label or rel}]: {repr(old[:80])}"
        print(msg); errors.append(msg)
        return False
    open(path, 'w', encoding='utf-8', newline='\r\n').write(content.replace(old, new, 1))
    print(f"  \u2713 {label or rel}")
    return True

# =============================================================================
# 1. electron/preload.ts  —  testProvider, postToX, postToInstagram
# =============================================================================
patch(
    'electron/preload.ts',
    "  workflowListScheduled: () => ipcRenderer.invoke('workflow:list-scheduled'),\n});",
    """  workflowListScheduled: () => ipcRenderer.invoke('workflow:list-scheduled'),

  // Provider live ping (A4)
  testProvider: (provider: string) => ipcRenderer.invoke('config:test-provider', provider),

  // Social Media posting (B2)
  postToX: (payload: { text: string; apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }) =>
    ipcRenderer.invoke('social:post-x', payload),
  postToInstagram: (payload: { imageUrl: string; caption: string; accessToken: string; igUserId: string }) =>
    ipcRenderer.invoke('social:post-ig', payload),
});""",
    'preload.ts: add testProvider/postToX/postToInstagram'
)

# =============================================================================
# 2. src/global.d.ts  —  add missing type declarations
# =============================================================================
patch(
    'src/global.d.ts',
    "      ollamaTranscribe: (payload: { audioBase64: string; mimeType: string }) => Promise<string>;\n    };\n  }\n}",
    """      ollamaTranscribe: (payload: { audioBase64: string; mimeType: string }) => Promise<string>;

      // Console / Dev tools
      consoleRun: (cmd: string) => Promise<string>;

      // System Tools
      systemTools: {
        openTool:   (toolId: string)  => Promise<void>;
        getProcs:   ()                => Promise<unknown[]>;
        clearTemp:  ()                => Promise<{ freed: number }>;
        memReduce:  ()                => Promise<{ freed: number }>;
        fileSearch: (query: string)   => Promise<string[]>;
        netScan:    ()                => Promise<unknown[]>;
      };

      // Workflow Scheduler
      workflowSchedule: (config: { id: string; expression: string; workflowId: string; workflowName: string; prompt: string; channel: string }) => Promise<{ ok: boolean; id?: string }>;
      workflowCancel: (id: string) => Promise<boolean>;
      workflowListScheduled: () => Promise<{ id: string; workflowId: string; workflowName: string; expression: string; runCount: number; lastRun?: number }[]>;

      // Provider live ping (A4)
      testProvider: (provider: string) => Promise<{ ok: boolean; status?: number; error?: string }>;

      // Social Media (B2)
      postToX: (payload: { text: string; apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }) => Promise<{ ok: boolean; id?: string; error?: string }>;
      postToInstagram: (payload: { imageUrl: string; caption: string; accessToken: string; igUserId: string }) => Promise<{ ok: boolean; id?: string; error?: string }>;
    };
  }
}""",
    'global.d.ts: add missing types'
)

# =============================================================================
# 3. src/screens/Admin.tsx  —  real API pings for openai / qwen / n8n
# =============================================================================
patch(
    'src/screens/Admin.tsx',
    """      } else if (c.id === 'ollama') {
        const r = await b.hasOllama?.();
        setStatus(s => ({ ...s, [c.id]: r ? 'ok' : 'err' }));
      } else {
        // Generic: just check if key is stored
        const km = CONN_KEY_MAP[c.id];
        if (km) {
          const firstKey = Object.values(km)[0];
          const has = await b.config.hasKey(firstKey);
          setStatus(s => ({ ...s, [c.id]: has ? 'ok' : 'err' }));
        } else {
          setStatus(s => ({ ...s, [c.id]: 'ok' }));
        }
      }""",
    """      } else if (c.id === 'ollama') {
        const r = await b.hasOllama?.();
        setStatus(s => ({ ...s, [c.id]: r ? 'ok' : 'err' }));
      } else if (['openai', 'qwen', 'n8n'].includes(c.id)) {
        const r = await (b as any).testProvider?.(c.id);
        setStatus(s => ({ ...s, [c.id]: r?.ok ? 'ok' : 'err' }));
      } else {
        // Generic: just check if key is stored
        const km = CONN_KEY_MAP[c.id];
        if (km) {
          const firstKey = Object.values(km)[0];
          const has = await b.config.hasKey(firstKey);
          setStatus(s => ({ ...s, [c.id]: has ? 'ok' : 'err' }));
        } else {
          setStatus(s => ({ ...s, [c.id]: 'ok' }));
        }
      }""",
    'Admin.tsx: real pings for openai/qwen/n8n'
)

# =============================================================================
# 4. src/screens/Agents.tsx  —  A3: run state + runAgent + RUN button + panel
# =============================================================================

# 4a. Add run state after importRef
patch(
    'src/screens/Agents.tsx',
    "  const importRef = useRef<HTMLInputElement>(null);\n\n  function toast",
    """  const importRef = useRef<HTMLInputElement>(null);

  // Run agent state (A3)
  const [runPanel, setRunPanel]           = useState(false);
  const [missionInput, setMissionInput]   = useState('');
  const [missionOutput, setMissionOutput] = useState('');
  const [missionBusy, setMissionBusy]     = useState(false);

  function toast""",
    'Agents.tsx: add run state'
)

# 4b. Add runAgent function after handleImport
patch(
    'src/screens/Agents.tsx',
    "    e.target.value = '';\n  }\n\n  const filtered = AGENTS.filter",
    """    e.target.value = '';
  }

  async function runAgent(a: AgentEntry) {
    if (!missionInput.trim()) { toast('\u26a0 Enter a mission first'); return; }
    setMissionBusy(true); setMissionOutput('');
    try {
      let system = `You are ${a.name}. ${a.desc}\\nCategory: ${a.cat} | Model: ${a.model}`;
      const fp = `${BOOST_AGENTS_PATH}\\\\${slugify(a.name)}.agent.md`;
      try {
        const r = await window.jarvisBridge.readFileContent(fp);
        if (r.ok && r.content) system = r.content;
      } catch {}
      markAgentUsed(a.id);
      const result = await window.jarvisBridge.complete({
        messages: [{ role: 'user', content: missionInput }],
        system, maxTokens: 2000,
      });
      setMissionOutput(typeof result === 'string' ? result : String(result));
      toast(`\u25c9 ${a.name} mission complete`);
    } catch (e: any) { setMissionOutput(`ERROR: ${String(e?.message || e)}`); }
    setMissionBusy(false);
  }

  const filtered = AGENTS.filter""",
    'Agents.tsx: add runAgent function'
)

# 4c. Replace sidebar button grid — add RUN button + mission panel
OLD_SIDEBAR = """                <button onClick={() => setSelected(null)} className="hud-label" style={{ marginTop:10, width:'100%', padding:'5px', fontSize:8, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', letterSpacing:'0.22em', background:'transparent', cursor:'pointer' }}>CLOSE</button>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginTop:6 }}>
                  <button onClick={() => editContent === null ? loadEdit(selected) : setEditContent(null)} className="hud-label"
                    style={{ padding:'5px', fontSize:8, cursor:'pointer', color: AMBER, border:`1px solid ${AMBER}55`, background:`${AMBER}10`, letterSpacing:'0.18em' }}>
                    {editContent !== null ? '\u2715 CANCEL' : '\u270e EDIT'}
                  </button>
                  <button onClick={() => exportAgent(selected)} className="hud-label"
                    style={{ padding:'5px', fontSize:8, cursor:'pointer', color: VIOLET, border:`1px solid ${VIOLET}55`, background:`${VIOLET}10`, letterSpacing:'0.18em' }}>
                    \u2193 EXPORT
                  </button>
                </div>
                {editContent !== null && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      style={{ width:'100%', height:200, padding:'7px 8px', fontSize:8.5, lineHeight:1.5, color:'var(--fg)', background:'oklch(0.05 0.012 240)', border:`1px solid ${AMBER}55`, outline:'none', resize:'vertical', fontFamily:'var(--font-mono)', boxSizing:'border-box' }} />
                    <button onClick={() => saveEdit(selected)} disabled={editSaving} className="hud-label"
                      style={{ padding:'6px', fontSize:8, cursor:'pointer', color: JADE, border:`1px solid ${JADE}`, background:`${JADE}18`, letterSpacing:'0.18em', opacity: editSaving ? 0.5 : 1 }}>
                      {editSaving ? '\u25cc SAVING\u2026' : '\u25c9 SAVE'}
                    </button>
                  </div>
                )}"""

NEW_SIDEBAR = """                <button onClick={() => setSelected(null)} className="hud-label" style={{ marginTop:10, width:'100%', padding:'5px', fontSize:8, color:'var(--cyan-dim)', border:'1px solid var(--line-soft)', letterSpacing:'0.22em', background:'transparent', cursor:'pointer' }}>CLOSE</button>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginTop:6 }}>
                  <button onClick={() => { setRunPanel(r => !r); setMissionOutput(''); }} className="hud-label"
                    style={{ padding:'5px', fontSize:8, cursor:'pointer', color: JADE, border:`1px solid ${JADE}55`, background: runPanel ? `${JADE}20` : `${JADE}10`, letterSpacing:'0.18em' }}>
                    \u25ba RUN
                  </button>
                  <button onClick={() => editContent === null ? loadEdit(selected) : setEditContent(null)} className="hud-label"
                    style={{ padding:'5px', fontSize:8, cursor:'pointer', color: AMBER, border:`1px solid ${AMBER}55`, background:`${AMBER}10`, letterSpacing:'0.18em' }}>
                    {editContent !== null ? '\u2715 CANCEL' : '\u270e EDIT'}
                  </button>
                  <button onClick={() => exportAgent(selected)} className="hud-label"
                    style={{ padding:'5px', fontSize:8, cursor:'pointer', color: VIOLET, border:`1px solid ${VIOLET}55`, background:`${VIOLET}10`, letterSpacing:'0.18em' }}>
                    \u2193 EXPORT
                  </button>
                </div>
                {runPanel && editContent === null && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                    <div className="hud-label" style={{ fontSize:7.5, color: JADE, letterSpacing:'0.28em' }}>\u25ba MISSION INPUT</div>
                    <textarea value={missionInput} onChange={e => setMissionInput(e.target.value)}
                      placeholder="Describe the mission for this agent..."
                      style={{ width:'100%', height:80, padding:'7px 8px', fontSize:8.5, lineHeight:1.5, color:'var(--fg)', background:'oklch(0.05 0.012 240)', border:`1px solid ${JADE}55`, outline:'none', resize:'vertical', fontFamily:'var(--font-mono)', boxSizing:'border-box' }} />
                    <button onClick={() => runAgent(selected)} disabled={missionBusy} className="hud-label"
                      style={{ padding:'6px', fontSize:8, cursor:'pointer', color: JADE, border:`1px solid ${JADE}`, background:`${JADE}18`, letterSpacing:'0.18em', opacity: missionBusy ? 0.5 : 1 }}>
                      {missionBusy ? '\u25cc RUNNING\u2026' : '\u25ba EXECUTE MISSION'}
                    </button>
                    {missionOutput && (
                      <div style={{ marginTop:4, padding:'8px', background:'oklch(0.04 0.01 240)', border:`1px solid ${JADE}33`, maxHeight:180, overflowY:'auto' }}>
                        <div className="font-mono" style={{ fontSize:8.5, color:'var(--fg)', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{missionOutput}</div>
                      </div>
                    )}
                  </div>
                )}
                {editContent !== null && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      style={{ width:'100%', height:200, padding:'7px 8px', fontSize:8.5, lineHeight:1.5, color:'var(--fg)', background:'oklch(0.05 0.012 240)', border:`1px solid ${AMBER}55`, outline:'none', resize:'vertical', fontFamily:'var(--font-mono)', boxSizing:'border-box' }} />
                    <button onClick={() => saveEdit(selected)} disabled={editSaving} className="hud-label"
                      style={{ padding:'6px', fontSize:8, cursor:'pointer', color: JADE, border:`1px solid ${JADE}`, background:`${JADE}18`, letterSpacing:'0.18em', opacity: editSaving ? 0.5 : 1 }}>
                      {editSaving ? '\u25cc SAVING\u2026' : '\u25c9 SAVE'}
                    </button>
                  </div>
                )}"""

patch('src/screens/Agents.tsx', OLD_SIDEBAR, NEW_SIDEBAR, 'Agents.tsx: RUN button + mission panel')

# =============================================================================
# 5. src/screens/Workflows.tsx  —  A2: useEffect, schedule state/functions, SCHED button, modal
# =============================================================================

# 5a. Add useEffect to import
patch(
    'src/screens/Workflows.tsx',
    "import { useState, useCallback } from 'react';",
    "import { useState, useCallback, useEffect } from 'react';",
    'Workflows.tsx: add useEffect import'
)

# 5b. Add schedule state after mainTab state
patch(
    'src/screens/Workflows.tsx',
    "  const [mainTab, setMainTab]           = useState<'PIPELINE' | 'BUILDER'>('PIPELINE');\n\n  const WF_MAIN_TABS",
    """  const [mainTab, setMainTab]           = useState<'PIPELINE' | 'BUILDER'>('PIPELINE');

  // Scheduler state (A2)
  const [schedModal, setSchedModal] = useState<{ id: string; name: string } | null>(null);
  const [cronInput, setCronInput]   = useState('0 9 * * 1-5');
  const [schedJobs, setSchedJobs]   = useState<{ id: string; workflowId: string; workflowName: string; expression: string; runCount: number; lastRun?: number }[]>([]);
  const [schedToast, setSchedToast] = useState('');

  const WF_MAIN_TABS""",
    'Workflows.tsx: add schedule state'
)

# 5c. Add useEffect + schedule functions after hasCustom
patch(
    'src/screens/Workflows.tsx',
    "  const hasCustom = !!loadEdits()[wf.id];\n\n  // Real run data",
    """  const hasCustom = !!loadEdits()[wf.id];

  // Load scheduled jobs on mount (A2)
  useEffect(() => {
    (async () => {
      try {
        const jobs = await (window.jarvisBridge as any).workflowListScheduled?.();
        if (jobs) setSchedJobs(jobs);
      } catch {}
    })();
  }, []);

  async function scheduleWorkflow(wfId: string, wfName: string, expression: string) {
    try {
      const id = `sched_${wfId}_${Date.now()}`;
      const r = await (window.jarvisBridge as any).workflowSchedule?.({
        id, expression, workflowId: wfId, workflowName: wfName,
        prompt: `Run workflow "${wfName}" — automated scheduled execution.`,
        channel: 'schedule',
      });
      if (r?.ok) {
        const updated = await (window.jarvisBridge as any).workflowListScheduled?.();
        if (updated) setSchedJobs(updated);
        setSchedToast(`\u23f0 Scheduled: ${wfName}`);
        setTimeout(() => setSchedToast(''), 3000);
      }
    } catch (e: any) {
      setSchedToast(`\u26a0 Schedule error: ${String(e?.message || e).slice(0, 50)}`);
      setTimeout(() => setSchedToast(''), 4000);
    }
    setSchedModal(null);
  }

  async function cancelSchedule(id: string) {
    try {
      await (window.jarvisBridge as any).workflowCancel?.(id);
      setSchedJobs(j => j.filter(x => x.id !== id));
      setSchedToast('\u2715 Schedule cancelled');
      setTimeout(() => setSchedToast(''), 3000);
    } catch {}
  }

  // Real run data""",
    'Workflows.tsx: add schedule functions'
)

# 5d. Add SCHED button to LIVE workflow cards (► RUN / ✏ EDIT → add ⏰ SCHED)
OLD_WF_BUTTONS = """                <div style={{ display: 'flex', gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={e => { e.stopPropagation(); setRunning({ id: w.id, name: w.name, trigger: w.trigger, owner: w.owner, desc: w.desc, kind: 'research' }); }} className="hud-label"
                    style={{ flex: 1, padding: '4px 6px', fontSize: 8, color: JADE, border: `1px solid ${JADE}40`, cursor: 'pointer', letterSpacing: '0.16em', background: 'transparent' }}>
                    \u25ba RUN
                  </button>
                  <button onClick={e => { e.stopPropagation(); selectWf(w.id); setDraft({ name: w.name, desc: w.desc, trigger: w.trigger, owner: w.owner, status: w.status }); setEditing(true); }} className="hud-label"
                    style={{ flex: 1, padding: '4px 6px', fontSize: 8, color: CYAN_BRIGHT, border: `1px solid ${CYAN}40`, cursor: 'pointer', letterSpacing: '0.16em', background: 'transparent' }}>
                    \u270f EDIT
                  </button>
                </div>"""

NEW_WF_BUTTONS = """                <div style={{ display: 'flex', gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={e => { e.stopPropagation(); setRunning({ id: w.id, name: w.name, trigger: w.trigger, owner: w.owner, desc: w.desc, kind: 'research' }); }} className="hud-label"
                    style={{ flex: 1, padding: '4px 6px', fontSize: 8, color: JADE, border: `1px solid ${JADE}40`, cursor: 'pointer', letterSpacing: '0.16em', background: 'transparent' }}>
                    \u25ba RUN
                  </button>
                  <button onClick={e => { e.stopPropagation(); setSchedModal({ id: w.id, name: w.name }); setCronInput('0 9 * * 1-5'); }} className="hud-label"
                    style={{ flex: 1, padding: '4px 6px', fontSize: 8, color: AMBER, border: `1px solid ${AMBER}40`, cursor: 'pointer', letterSpacing: '0.16em', background: 'transparent' }}>
                    \u23f0 SCHED
                  </button>
                  <button onClick={e => { e.stopPropagation(); selectWf(w.id); setDraft({ name: w.name, desc: w.desc, trigger: w.trigger, owner: w.owner, status: w.status }); setEditing(true); }} className="hud-label"
                    style={{ flex: 1, padding: '4px 6px', fontSize: 8, color: CYAN_BRIGHT, border: `1px solid ${CYAN}40`, cursor: 'pointer', letterSpacing: '0.16em', background: 'transparent' }}>
                    \u270f EDIT
                  </button>
                </div>"""

patch('src/screens/Workflows.tsx', OLD_WF_BUTTONS, NEW_WF_BUTTONS, 'Workflows.tsx: add SCHED button')

# 5e. Add schedule toast + modal before LiveWorkflowRunner
OLD_RUNNER = "      {running && <LiveWorkflowRunner wf={running} onClose={() => setRunning(null)} />}\n    </div>\n  );\n}"
NEW_RUNNER = """      {running && <LiveWorkflowRunner wf={running} onClose={() => setRunning(null)} />}

      {/* Schedule Toast */}
      {schedToast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, padding: '8px 16px', background: 'oklch(0.08 0.02 240)', border: `1px solid ${AMBER}`, color: AMBER, fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
          {schedToast}
        </div>
      )}

      {/* Schedule Modal */}
      {schedModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}
          onClick={() => setSchedModal(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 360, background: 'oklch(0.07 0.018 240)', border: `1px solid ${AMBER}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.32em' }}>\u23f0 SCHEDULE WORKFLOW</div>
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg)' }}>{schedModal.name}</div>
            <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', marginTop: -4 }}>Cron expression (UTC)</div>
            <input value={cronInput} onChange={e => setCronInput(e.target.value)}
              style={{ padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'oklch(0.04 0.01 240)', border: `1px solid ${AMBER}55`, color: 'var(--fg)', outline: 'none' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[['Daily 09:00', '0 9 * * *'], ['Weekdays 09:00', '0 9 * * 1-5'], ['Mon 07:00', '0 7 * * 1'], ['Hourly', '0 * * * *'], ['Every 6h', '0 */6 * * *']].map(([label, expr]) => (
                <button key={label} onClick={() => setCronInput(expr)} className="hud-label"
                  style={{ padding: '3px 8px', fontSize: 8, color: cronInput === expr ? AMBER : 'var(--cyan-dim)', border: `1px solid ${cronInput === expr ? AMBER : 'var(--line-soft)'}`, background: cronInput === expr ? `${AMBER}15` : 'transparent', cursor: 'pointer', letterSpacing: '0.12em' }}>
                  {label}
                </button>
              ))}
            </div>
            {schedJobs.filter(j => j.workflowId === schedModal.id).length > 0 && (
              <div style={{ padding: '8px', background: 'oklch(0.04 0.01 240)', border: '1px solid var(--line-soft)' }}>
                <div className="hud-label" style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.24em', marginBottom: 6 }}>ACTIVE SCHEDULES</div>
                {schedJobs.filter(j => j.workflowId === schedModal.id).map(j => (
                  <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="font-mono" style={{ fontSize: 9, color: JADE }}>{j.expression}</span>
                    <button onClick={() => cancelSchedule(j.id)} className="hud-label"
                      style={{ padding: '2px 6px', fontSize: 7.5, color: ROSE, border: `1px solid ${ROSE}55`, background: 'transparent', cursor: 'pointer', letterSpacing: '0.12em' }}>
                      \u2715 CANCEL
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => scheduleWorkflow(schedModal.id, schedModal.name, cronInput)} className="hud-label"
                style={{ flex: 1, padding: '8px', fontSize: 9, color: JADE, border: `1px solid ${JADE}`, background: `${JADE}18`, cursor: 'pointer', letterSpacing: '0.2em' }}>
                \u25ba ACTIVATE
              </button>
              <button onClick={() => setSchedModal(null)} className="hud-label"
                style={{ flex: 1, padding: '8px', fontSize: 9, color: 'var(--cyan-dim)', border: '1px solid var(--line-soft)', background: 'transparent', cursor: 'pointer', letterSpacing: '0.2em' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}"""

patch('src/screens/Workflows.tsx', OLD_RUNNER, NEW_RUNNER, 'Workflows.tsx: schedule modal + toast')

# =============================================================================
# Summary
# =============================================================================
if errors:
    print(f"\n\u2717 {len(errors)} PATCH(ES) FAILED:")
    for e in errors: print(f"  {e}")
    sys.exit(1)
else:
    print("\n\u2713 All patches applied successfully!")
