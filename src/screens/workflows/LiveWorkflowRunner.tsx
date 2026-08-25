// @ts-nocheck
import { useState } from 'react';
import { HoloPanel, VoiceOrb } from '../../components/primitives';
import { Chip } from '../../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, VIOLET } from '../../theme';
import { LS, lsGet, lsSet, runResearch, runContent, runPlanDay } from '../../lib/claude';
import type { LiveWF } from './types';

export function LiveWorkflowRunner({ wf, onClose }: { wf: LiveWF; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [channel, setChannel] = useState('X / Twitter');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    setOutput('');
    try {
      let res = '';
      if (wf.kind === 'research') {
        const topic = input || 'Generative AI tooling for prosumer content creators, 2026 outlook';
        const step1 = await runResearch(topic);
        const step2 = await runResearch(
          `Given this research:\n\n${step1}\n\nNow provide: 1) 3 counterpoints, 2) 5 concrete action items, 3) a one-paragraph executive summary.`,
        );
        res = `## RESEARCH BRIEF\n\n${step1}\n\n---\n\n## ANALYSIS & ACTIONS\n\n${step2}`;
      } else if (wf.kind === 'content') {
        const brief = input || 'JARVIS-style AI assistants for power users';
        const draft1 = await runContent(`Draft 1 (Informative angle): ${brief}`, channel);
        const draft2 = await runContent(`Draft 2 (Contrarian/provocative angle): ${brief}`, channel);
        const draft3 = await runContent(`Draft 3 (Story-driven angle with hook): ${brief}`, channel);
        res = `## DRAFT 1 — INFORMATIVE\n\n${draft1}\n\n---\n\n## DRAFT 2 — CONTRARIAN\n\n${draft2}\n\n---\n\n## DRAFT 3 — STORY-DRIVEN\n\n${draft3}`;
      } else if (wf.kind === 'planday') {
        const tasks =
          input ||
          "1. Trader bot review\n2. Edit Q3 video\n3. Counsel call 14:00\n4. Workout\n5. Prep tomorrow's stream";
        const plan = await runPlanDay(tasks);
        const optimized = await runResearch(
          `Given this day plan:\n\n${plan}\n\nProvide: 1) energy/focus optimization suggestions, 2) which tasks to delegate or drop, 3) a 3-item end-of-day success checklist.`,
        );
        res = `## DAY PLAN\n\n${plan}\n\n---\n\n## OPTIMIZATION\n\n${optimized}`;
      }
      setOutput(res);
      // Persist run
      const runs = lsGet<any[]>(LS.runs, []);
      runs.unshift({
        id: `RUN-${Date.now()}`,
        wf: wf.name,
        kind: wf.kind,
        input,
        channel,
        output: res,
        at: new Date().toISOString(),
        steps: wf.kind === 'content' ? 3 : 2,
      });
      lsSet(LS.runs, runs.slice(0, 30));
    } catch (e: any) {
      setError(String(e?.message || e));
    }
    setBusy(false);
  }

  const channels = ['X / Twitter', 'YouTube', 'Instagram', 'Newsletter', 'Twitch'];

  return (
    <div
      className="anim-fade-in"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'oklch(0.04 0.012 245 / 0.92)',
        zIndex: 50,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="hud-label" style={{ fontSize: 9, color: AMBER, letterSpacing: '0.4em' }}>
            ◆ LIVE WORKFLOW · {wf.id}
          </div>
          <div className="font-display glow-cyan" style={{ fontSize: 20, color: CYAN_BRIGHT, marginTop: 4 }}>
            {wf.name}
          </div>
          <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--cyan-dim)', marginTop: 4 }}>
            {wf.desc}
          </div>
        </div>
        <button
          onClick={onClose}
          className="hud-label"
          style={{
            padding: '6px 12px',
            fontSize: 9,
            color: CYAN_BRIGHT,
            border: `1px solid ${CYAN}80`,
            letterSpacing: '0.28em',
          }}
        >
          ✕ CLOSE
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, flex: 1, minHeight: 0 }}>
        <HoloPanel
          label="INPUT"
          code="IN-Δ"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          {wf.kind === 'content' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {channels.map((c) => (
                <Chip key={c} active={channel === c} onClick={() => setChannel(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              wf.kind === 'research'
                ? 'Topic — e.g. "AI hardware shortages H2 2026"'
                : wf.kind === 'content'
                  ? 'Brief — e.g. "5 ways JARVIS-style AI outperforms ChatGPT for power users"'
                  : "Today's tasks — one per line. Add deadlines if any."
            }
            style={{
              flex: 1,
              minHeight: 200,
              background: 'oklch(0.06 0.014 240 / 0.6)',
              border: '1px solid var(--line)',
              color: 'var(--fg)',
              padding: 12,
              fontFamily: 'JetBrains Mono',
              fontSize: 12,
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
            }}
          />
          <button
            onClick={run}
            disabled={busy}
            className="hud-label anim-pulse-soft"
            style={{
              marginTop: 10,
              padding: '12px',
              fontSize: 11,
              letterSpacing: '0.32em',
              color: busy ? 'var(--cyan-dim)' : CYAN_BRIGHT,
              background: 'oklch(0.78 0.13 215 / 0.14)',
              border: `1px solid ${CYAN}`,
              cursor: busy ? 'wait' : 'pointer',
              boxShadow: `0 0 12px ${CYAN}55`,
              textShadow: `0 0 6px ${CYAN}`,
            }}
          >
            {busy ? '◌ RUNNING…' : '▶ RUN WORKFLOW'}
          </button>
          {error && (
            <div className="font-mono" style={{ fontSize: 10, color: AMBER, marginTop: 8 }}>
              ⚠ {error}
            </div>
          )}
        </HoloPanel>

        <HoloPanel
          label="OUTPUT"
          code="OUT-Δ"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
          bodyClassName="nx-scroll"
        >
          {!output && !busy && (
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--cyan-dim)', lineHeight: 1.5 }}>
              Output will stream here. Press RUN.
            </div>
          )}
          {busy && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 14,
              }}
            >
              <VoiceOrb state="processing" size={160} />
              <div
                className="hud-label glow-violet"
                style={{ fontSize: 10, color: VIOLET, letterSpacing: '0.4em' }}
              >
                // PROCESSING
              </div>
            </div>
          )}
          {output && (
            <pre
              className="font-mono anim-fade-up"
              style={{
                fontSize: 11,
                color: 'var(--fg)',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {output}
            </pre>
          )}
        </HoloPanel>
      </div>
    </div>
  );
}
