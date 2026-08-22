import { useCallback, useEffect, useState } from 'react';
import { CYAN, CYAN_BRIGHT, AMBER } from '../theme';

type HitlEntry = {
  id: string;
  createdAt: string;
  reason: string;
  payload: Record<string, unknown>;
};

export function HarnessHitlModal() {
  const [queue, setQueue] = useState<HitlEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const h = window.jarvisBridge?.harness;
    if (!h) return;
    const res = await h.hitlPending();
    if (res.ok && Array.isArray(res.data)) {
      setQueue(res.data as HitlEntry[]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 2000);
    const h = window.jarvisBridge?.harness;
    const off = h?.onHitlRequest?.((entry: HitlEntry) => {
      setQueue((prev) => {
        if (prev.some((p) => p.id === entry.id)) return prev;
        return [entry, ...prev];
      });
    });
    return () => {
      clearInterval(iv);
      off?.();
    };
  }, [refresh]);

  async function resolve(id: string, approved: boolean) {
    setBusy(id);
    try {
      await window.jarvisBridge?.harness?.hitlResolve(id, approved);
      setQueue((q) => q.filter((e) => e.id !== id));
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  if (queue.length === 0) return null;

  const current = queue[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'oklch(0.02 0.02 240 / 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          border: `1px solid ${AMBER}66`,
          borderRadius: 10,
          background: 'oklch(0.08 0.018 240 / 0.98)',
          padding: 22,
          boxShadow: `0 0 40px ${AMBER}22`,
        }}
      >
        <div className="font-display" style={{ color: AMBER, fontSize: 16, marginBottom: 8 }}>
          Human approval required
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 12 }}>
          HITL gate · {queue.length} pending
        </div>
        <div style={{ color: CYAN_BRIGHT, fontSize: 14, marginBottom: 10 }}>{current.reason}</div>
        <pre
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            background: 'oklch(0.05 0.012 240)',
            padding: 10,
            borderRadius: 6,
            overflow: 'auto',
            maxHeight: 160,
            border: '1px solid var(--line)',
          }}
        >
          {JSON.stringify(current.payload, null, 2)}
        </pre>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            type="button"
            disabled={busy === current.id}
            onClick={() => resolve(current.id, true)}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: `${CYAN}33`,
              border: `1px solid ${CYAN}`,
              color: CYAN_BRIGHT,
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy === current.id}
            onClick={() => resolve(current.id, false)}
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'oklch(0.12 0.04 25 / 0.4)',
              border: '1px solid #f8717166',
              color: '#fca5a5',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
