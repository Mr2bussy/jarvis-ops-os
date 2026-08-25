// @ts-nocheck
import type { CalendarProposal, EmployeeResult } from './types';

export interface CalendarEventInput {
  title: string;
  start: string;
  end: string;
  attendees?: string[];
}

export interface ExistingEvent {
  title: string;
  start: string;
  end: string;
}

/** Conflict check against known events — Google OAuth insert stays behind HITL. */
export function proposeCalendarInsert(
  input: CalendarEventInput,
  existing: ExistingEvent[] = [],
): EmployeeResult<{ proposal: CalendarProposal }> {
  const startMs = Date.parse(input.start);
  const endMs = Date.parse(input.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { ok: false, reason: 'Ungültiges Start- oder Enddatum' };
  }
  if (endMs <= startMs) return { ok: false, reason: 'Ende muss nach Start liegen' };

  const conflicts: string[] = [];
  for (const ev of existing) {
    const es = Date.parse(ev.start);
    const ee = Date.parse(ev.end);
    if (!Number.isFinite(es) || !Number.isFinite(ee)) continue;
    if (startMs < ee && endMs > es) {
      conflicts.push(`${ev.title} (${ev.start} – ${ev.end})`);
    }
  }

  return {
    ok: true,
    proposal: {
      title: input.title,
      start: input.start,
      end: input.end,
      attendees: input.attendees ?? [],
      conflicts,
      requiresHitl: true,
    },
  };
}

/** Scaffold status for Google Calendar OAuth — no token = honest empty state. */
export function calendarOAuthStatus(accessToken?: string): EmployeeResult<{ ready: boolean }> {
  if (!accessToken?.trim()) {
    return { ok: false, reason: 'Google Calendar OAuth nicht verbunden — Setup → Integrations' };
  }
  return { ok: true, ready: true };
}
