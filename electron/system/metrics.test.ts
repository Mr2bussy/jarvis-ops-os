import { describe, it, expect } from 'vitest';
import { cpuDelta, type CpuTimes } from './metrics';

const t = (user: number, idle: number): CpuTimes => ({ user, nice: 0, sys: 0, idle, irq: 0 });

describe('cpuDelta', () => {
  it('reports 0 utilisation when only idle advanced', () => {
    const r = cpuDelta([t(0, 0)], [t(0, 100)]);
    expect(r.overall).toBe(0);
    expect(r.perCore[0]).toBe(0);
  });

  it('reports full utilisation when no idle advanced', () => {
    const r = cpuDelta([t(0, 0)], [t(100, 0)]);
    expect(r.overall).toBe(1);
    expect(r.perCore[0]).toBe(1);
  });

  it('reports 50% when half the ticks were idle', () => {
    expect(cpuDelta([t(0, 0)], [t(50, 50)]).overall).toBeCloseTo(0.5, 5);
  });

  it('averages across cores for the overall figure', () => {
    const r = cpuDelta([t(0, 0), t(0, 0)], [t(100, 0), t(0, 100)]);
    expect(r.perCore).toEqual([1, 0]);
    expect(r.overall).toBeCloseTo(0.5, 5);
  });

  it('returns 0 (no divide-by-zero) when no time advanced', () => {
    const r = cpuDelta([t(10, 10)], [t(10, 10)]);
    expect(r.overall).toBe(0);
    expect(r.perCore[0]).toBe(0);
  });
});
