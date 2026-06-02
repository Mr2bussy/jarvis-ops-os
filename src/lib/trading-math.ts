/**
 * Pure trading/data helpers extracted from trading-data.ts so they can be unit-tested
 * without standing up the React hooks they used to sit beside.
 */

/** "3h05m"-style countdown to an epoch ("--" once it's in the past). */
export function fmtCountdown(epochMs: number): string {
  const diff = epochMs - Date.now();
  if (diff < 0) return '--';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h${String(m).padStart(2, '0')}m`;
}

/** "YYYYMM" (used to build the US Treasury feed URL). */
export function yyyymm(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Pearson correlation of two series; 0 if fewer than 3 paired points. Rounded to 2dp. */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const mA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const mB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0,
    dA = 0,
    dB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - mA,
      db = b[i] - mB;
    num += da * db;
    dA += da * da;
    dB += db * db;
  }
  return dA * dB > 0 ? +(num / Math.sqrt(dA * dB)).toFixed(2) : 0;
}

/** Period-over-period simple returns from a close series. */
export function toReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) r.push(closes[i] / closes[i - 1] - 1);
  return r;
}

/** Days-to-expiry from a Deribit expiry code like "31MAY25" (expiry assumed 08:00). */
export function deribitDte(expStr: string): number {
  const MONTHS: Record<string, number> = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
  };
  const numLen = expStr.match(/^\d+/)?.[0].length ?? 0;
  const day = +expStr.slice(0, numLen);
  const monthStr = expStr.slice(numLen, numLen + 3);
  const yearSuffix = expStr.slice(numLen + 3);
  const year = 2000 + +yearSuffix;
  const exp = new Date(year, MONTHS[monthStr] ?? 0, day, 8, 0, 0);
  return Math.max(0, (exp.getTime() - Date.now()) / 86_400_000);
}
