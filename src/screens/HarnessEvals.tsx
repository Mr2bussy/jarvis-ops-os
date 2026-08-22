import { useCallback, useEffect, useState } from 'react';
import { CYAN, CYAN_BRIGHT } from '../theme';

type BenchCase = {
  id: string;
  success: boolean;
  caseScore: number;
  safety: number;
  notes?: string;
};

type BenchRun = {
  harness: string;
  harnessScore: number;
  criticScore: number;
  cases: BenchCase[];
};

export default function HarnessEvalsScreen() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [run, setRun] = useState<BenchRun | null>(null);
  const [err, setErr] = useState('');
  const [pendingHitl, setPendingHitl] = useState<number>(0);

  const refresh = useCallback(async () => {
    const h = window.jarvisBridge?.harness;
    if (!h) return;
    const st = await h.status();
    if (st.ok && st.data && typeof st.data === 'object' && 'pendingHitl' in st.data) {
      const p = (st.data as { pendingHitl?: unknown[] }).pendingHitl;
      setPendingHitl(Array.isArray(p) ? p.length : 0);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const [weekly, setWeekly] = useState<string>('');

  async function runWeekly() {
    setStatus('running');
    setErr('');
    try {
      const h = window.jarvisBridge?.harness;
      if (!h) throw new Error('Harness bridge unavailable');
      const res = await h.weeklyRun(false);
      if (!res.ok || !res.data) throw new Error(res.err ?? 'weekly failed');
      const d = res.data as {
        run: BenchRun;
        gates: { mvp: boolean; full: boolean; topsAll: boolean };
        reportPath?: string;
      };
      setRun(d.run);
      setWeekly(
        `MVP:${d.gates.mvp ? 'PASS' : 'FAIL'} · Full:${d.gates.full ? 'PASS' : 'FAIL'} · ${d.reportPath ?? ''}`,
      );
      setStatus('done');
    } catch (e: unknown) {
      setErr(String((e as Error)?.message ?? e));
      setStatus('error');
    }
  }

  async function runSmoke() {
    setStatus('running');
    setErr('');
    try {
      const h = window.jarvisBridge?.harness;
      if (!h) throw new Error('Harness bridge unavailable');
      const res = await h.benchSmoke();
      if (!res.ok || !res.data) throw new Error(res.err ?? 'bench failed');
      setRun(res.data as BenchRun);
      setStatus('done');
      await refresh();
    } catch (e: unknown) {
      setErr(String((e as Error)?.message ?? e));
      setStatus('error');
    }
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
      <div>
        <div className="font-display glow-cyan" style={{ fontSize: 22, color: CYAN_BRIGHT }}>
          JARVIS Prime — Harness Evals
        </div>
        <div style={{ color: 'var(--text-dim)', marginTop: 6, fontSize: 13 }}>
          Objective benchmark smoke (G07, G10, G11, G14, G16, G17). Full matrix in{' '}
          <code style={{ color: CYAN }}>docs/HARNESS_BENCHMARK_MATRIX.md</code>.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={runSmoke}
          disabled={status === 'running'}
          style={{
            padding: '10px 18px',
            background: `linear-gradient(135deg, ${CYAN}33, ${CYAN}11)`,
            border: `1px solid ${CYAN}55`,
            color: CYAN_BRIGHT,
            cursor: status === 'running' ? 'wait' : 'pointer',
            borderRadius: 6,
            fontFamily: 'inherit',
          }}
        >
          {status === 'running' ? 'Running smoke…' : 'Run benchmark smoke'}
        </button>
        <button
          type="button"
          onClick={runWeekly}
          disabled={status === 'running'}
          style={{
            padding: '10px 18px',
            border: '1px solid var(--line)',
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--text)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Run weekly eval
        </button>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Pending HITL: {pendingHitl}</span>
        {weekly && <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{weekly}</span>}
      </div>

      {err && (
        <div
          style={{
            color: '#f87171',
            fontSize: 13,
            padding: 12,
            border: '1px solid #f8717133',
            borderRadius: 6,
          }}
        >
          {err}
        </div>
      )}

      {run && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Stat label="Harness score" value={run.harnessScore.toFixed(1)} />
          <Stat label="Critic (stub)" value={run.criticScore.toFixed(1)} />
          <Stat label="Cases" value={String(run.cases.length)} />
        </div>
      )}

      {run && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--text-dim)', textAlign: 'left' }}>
              <th style={{ padding: '8px 6px' }}>Case</th>
              <th>Pass</th>
              <th>Score</th>
              <th>Safety</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {run.cases.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '8px 6px', color: CYAN_BRIGHT }}>{c.id}</td>
                <td style={{ color: c.success ? '#4ade80' : '#f87171' }}>{c.success ? 'PASS' : 'FAIL'}</td>
                <td>{c.caseScore.toFixed(1)}</td>
                <td>{c.safety}</td>
                <td style={{ color: 'var(--text-dim)' }}>{c.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 14,
        border: '1px solid var(--line)',
        borderRadius: 8,
        background: 'oklch(0.06 0.012 240 / 0.6)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: 26, color: CYAN_BRIGHT, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}
