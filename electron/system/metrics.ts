import * as os from 'node:os';
import { exec } from 'node:child_process';

export interface CpuTimes {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
}

/**
 * Pure CPU-utilisation delta between two os.cpus() time snapshots. Returns overall
 * and per-core utilisation in [0,1]. Pure (no sampling) → unit-testable.
 */
export function cpuDelta(prev: CpuTimes[], cur: CpuTimes[]): { overall: number; perCore: number[] } {
  let totalDelta = 0,
    idleDelta = 0;
  const perCore: number[] = [];
  for (let i = 0; i < cur.length; i++) {
    const a = prev[i] || cur[i];
    const b = cur[i];
    const at = a.user + a.nice + a.sys + a.idle + a.irq;
    const bt = b.user + b.nice + b.sys + b.idle + b.irq;
    const cTotal = bt - at;
    const cIdle = b.idle - a.idle;
    totalDelta += cTotal;
    idleDelta += cIdle;
    perCore.push(cTotal > 0 ? Math.max(0, Math.min(1, 1 - cIdle / cTotal)) : 0);
  }
  const overall = totalDelta > 0 ? Math.max(0, Math.min(1, 1 - idleDelta / totalDelta)) : 0;
  return { overall, perCore };
}

let prevCpuTimes: CpuTimes[] = os.cpus().map((c) => ({ ...c.times }));
function cpuUtilAll(): { overall: number; perCore: number[] } {
  const cur: CpuTimes[] = os.cpus().map((c) => ({ ...c.times }));
  const result = cpuDelta(prevCpuTimes, cur);
  prevCpuTimes = cur;
  return result;
}

export function diskInfo(): Promise<{
  used_gb: number;
  total_gb: number;
  drives: { caption: string; used_gb: number; total_gb: number }[];
}> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve({ used_gb: 0, total_gb: 0, drives: [] });
    exec('wmic logicaldisk get caption,size,freespace', (err, out) => {
      if (err) return resolve({ used_gb: 0, total_gb: 0, drives: [] });
      let total = 0,
        free = 0;
      const drives: { caption: string; used_gb: number; total_gb: number }[] = [];
      for (const line of out.split(/\r?\n/).slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) continue;
        const f = parseInt(parts[1], 10),
          s = parseInt(parts[2], 10);
        if (!isNaN(f) && !isNaN(s) && s > 0) {
          free += f;
          total += s;
          drives.push({ caption: parts[0], used_gb: (s - f) / 1e9, total_gb: s / 1e9 });
        }
      }
      resolve({ used_gb: (total - free) / 1e9, total_gb: total / 1e9, drives });
    });
  });
}

export async function getSystemMetrics() {
  const mem = { total: os.totalmem(), free: os.freemem() };
  const disk = await diskInfo();
  const { overall, perCore } = cpuUtilAll();
  return {
    host: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    uptime: os.uptime(),
    cpu_count: os.cpus().length,
    cpu_model: os.cpus()[0]?.model || 'unknown',
    cpu_util: overall,
    cpu_per_core: perCore,
    cpu_speed_mhz: os.cpus()[0]?.speed || 0,
    load_avg: os.loadavg(),
    mem_total_gb: mem.total / 1e9,
    mem_used_gb: (mem.total - mem.free) / 1e9,
    mem_pct: (mem.total - mem.free) / mem.total,
    disk_used_gb: disk.used_gb,
    disk_total_gb: disk.total_gb,
    disk_pct: disk.total_gb ? disk.used_gb / disk.total_gb : 0,
    disk_drives: disk.drives,
    net_ifaces: Object.keys(os.networkInterfaces()).length,
    user: os.userInfo().username,
    home: os.homedir(),
    ts: Date.now(),
  };
}
