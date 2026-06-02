import { useEffect, useState } from 'react';
import type { SysMetrics } from '../global';

export function useSystemMetrics(intervalMs = 1500): SysMetrics | null {
  const [m, setM] = useState<SysMetrics | null>(null);
  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const v = await window.jarvisBridge.systemMetrics();
        if (!stop) setM(v);
      } catch { /* ignore once */ }
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [intervalMs]);
  return m;
}

// Rolling history buffer for sparklines
export function useRollingHistory<T>(value: T | null | undefined, len = 60): T[] {
  const [hist, setHist] = useState<T[]>([]);
  useEffect(() => {
    if (value === null || value === undefined) return;
    setHist(h => {
      const n = [...h, value];
      return n.length > len ? n.slice(-len) : n;
    });
  }, [value, len]);
  return hist;
}
