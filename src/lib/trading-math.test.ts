import { describe, it, expect, vi, afterEach } from 'vitest';
import { fmtCountdown, yyyymm, pearson, toReturns, deribitDte } from './trading-math';

afterEach(() => vi.useRealTimers());

describe('fmtCountdown', () => {
  it('formats a future epoch as Hh MMm', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const target = Date.now() + 2 * 3_600_000 + 5 * 60_000; // +2h05m
    expect(fmtCountdown(target)).toBe('2h05m');
  });
  it('returns -- for a past epoch', () => {
    expect(fmtCountdown(Date.now() - 1000)).toBe('--');
  });
});

describe('yyyymm', () => {
  it('zero-pads the month', () => {
    expect(yyyymm(new Date(2026, 0, 15))).toBe('202601'); // January
    expect(yyyymm(new Date(2026, 11, 1))).toBe('202612'); // December
  });
});

describe('pearson', () => {
  it('returns 1 for a perfectly correlated series', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBe(1);
  });
  it('returns -1 for a perfectly anti-correlated series', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBe(-1);
  });
  it('returns 0 for fewer than 3 paired points', () => {
    expect(pearson([1, 2], [3, 4])).toBe(0);
  });
  it('returns 0 when a series has no variance (avoids divide-by-zero)', () => {
    expect(pearson([5, 5, 5, 5], [1, 2, 3, 4])).toBe(0);
  });
});

describe('toReturns', () => {
  it('computes period-over-period simple returns', () => {
    const r = toReturns([100, 110, 99]);
    expect(r).toHaveLength(2);
    expect(r[0]).toBeCloseTo(0.1, 5);
    expect(r[1]).toBeCloseTo(-0.1, 5);
  });
  it('returns an empty array for a single point', () => {
    expect(toReturns([100])).toEqual([]);
  });
});

describe('deribitDte', () => {
  it('parses a 2-digit-day expiry code and yields a positive DTE', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-01T00:00:00Z'));
    const dte = deribitDte('31MAY25');
    expect(dte).toBeGreaterThan(29);
    expect(dte).toBeLessThan(31);
  });
  it('parses a 1-digit-day expiry code', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(deribitDte('1JAN26')).toBeGreaterThanOrEqual(0);
  });
  it('never goes negative for a past expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    expect(deribitDte('1JAN26')).toBe(0);
  });
});
