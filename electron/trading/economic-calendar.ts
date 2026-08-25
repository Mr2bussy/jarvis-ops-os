/**
 * Economic calendar feed for prop/news-ban windows.
 * Primary: Forex Factory weekly JSON (nfs.faireconomy.media).
 */
// @ts-nocheck

import { apiRateLimiter, rateLimitOrThrow } from '../security/rate-limiter';

export type EconImpact = 'HIGH' | 'MED' | 'LOW';

export interface EconCalendarEvent {
  time: string;
  event: string;
  country: string;
  impact: EconImpact;
  forecast: string;
  prev: string;
  actual: string;
  /** ISO timestamp when known */
  at?: string;
}

const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

let cache: { at: number; events: EconCalendarEvent[] } | null = null;
const CACHE_MS = 15 * 60_000;

function mapImpact(raw: string): EconImpact {
  const u = raw.toUpperCase();
  if (u.includes('HIGH') || u === '3') return 'HIGH';
  if (u.includes('MED') || u === '2') return 'MED';
  return 'LOW';
}

function normalizeRow(row: Record<string, unknown>): EconCalendarEvent | null {
  const title = String(row.title ?? row.event ?? '').trim();
  if (!title) return null;
  const date = String(row.date ?? row.datetime ?? '');
  const time = date
    ? new Date(date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '—';
  return {
    time,
    event: title.slice(0, 120),
    country: String(row.country ?? row.currency ?? '').slice(0, 8),
    impact: mapImpact(String(row.impact ?? '')),
    forecast: String(row.forecast ?? '—'),
    prev: String(row.previous ?? row.prev ?? '—'),
    actual: String(row.actual ?? '—'),
    at: date || undefined,
  };
}

/** Fetch this week's calendar (cached 15 min). */
export async function fetchEconomicCalendar(force = false): Promise<{
  ok: boolean;
  events: EconCalendarEvent[];
  source: string;
  reason?: string;
}> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return { ok: true, events: cache.events, source: 'cache' };
  }
  try {
    rateLimitOrThrow(apiRateLimiter, 'econ-calendar');
  } catch (err: unknown) {
    if (cache) return { ok: true, events: cache.events, source: 'cache-rate-limited' };
    return { ok: false, events: [], source: 'rate-limit', reason: String((err as Error).message) };
  }
  try {
    const res = await fetch(FF_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return { ok: false, events: cache?.events ?? [], source: 'ff', reason: `HTTP ${res.status}` };
    }
    const raw = (await res.json()) as unknown;
    const rows = Array.isArray(raw) ? raw : [];
    const events = rows
      .map((r) => normalizeRow(r as Record<string, unknown>))
      .filter((e): e is EconCalendarEvent => Boolean(e));
    cache = { at: Date.now(), events };
    return { ok: true, events, source: 'faireconomy-ff' };
  } catch (err: unknown) {
    return {
      ok: false,
      events: cache?.events ?? [],
      source: 'error',
      reason: String((err as Error)?.message ?? err).slice(0, 160),
    };
  }
}

/** True when a HIGH-impact event falls inside [now - beforeMin, now + afterMin]. */
export function isInNewsWindow(
  events: EconCalendarEvent[],
  now = new Date(),
  beforeMin = 30,
  afterMin = 30,
): boolean {
  const t = now.getTime();
  for (const e of events) {
    if (e.impact !== 'HIGH' || !e.at) continue;
    const at = Date.parse(e.at);
    if (!Number.isFinite(at)) continue;
    if (t >= at - beforeMin * 60_000 && t <= at + afterMin * 60_000) return true;
  }
  return false;
}
