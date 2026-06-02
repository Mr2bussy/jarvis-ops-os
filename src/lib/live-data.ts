import { useState, useEffect, useCallback } from 'react';

export interface LiveScanData {
  total: number;
  byCategory: Record<string, number>;
  lastModTs: number;
  scanTs: number;
}

export interface LiveData {
  agentCount: number;
  skillsTotal: number;
  byCategory: Record<string, number>;
  lastModTs: number;
  host: string;
  user: string;
  scanTs: number;
}

const FALLBACK: LiveData = {
  agentCount: 0,
  skillsTotal: 0,
  byCategory: {},
  lastModTs: 0,
  host: '',
  user: '',
  scanTs: 0,
};

/** Polls workspace + live-scan IPC on a fixed interval. */
export function useJarvisLive(intervalMs = 8000) {
  const [data, setData] = useState<LiveData>(FALLBACK);
  const [lastRefresh, setLastRefresh] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [ws, scan] = await Promise.all([
        window.jarvisBridge.workspace(),
        window.jarvisBridge.liveScan(),
      ]);
      setData({
        agentCount:   scan.total  > 0 ? scan.total  : (ws.agentCount  || 0),
        skillsTotal:  ws.skillsTotal || 0,
        byCategory:   scan.byCategory || {},
        lastModTs:    scan.lastModTs  || 0,
        host:         ws.host || '',
        user:         ws.user || '',
        scanTs:       scan.scanTs  || Date.now(),
      });
      setLastRefresh(Date.now());
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, intervalMs);
    return () => clearInterval(iv);
  }, [refresh, intervalMs]);

  return { data, refresh, lastRefresh };
}
