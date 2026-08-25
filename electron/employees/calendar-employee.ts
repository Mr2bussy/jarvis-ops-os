// @ts-nocheck
import { getFeatureFlag } from '../config/flags';
import { BaseEmployee, validateEmployeeResult } from './base';
import { calendarOAuthStatus, proposeCalendarInsert, type ExistingEvent } from './calendar';
import type { EmployeeResult, EmployeeTask } from './types';

export class CalendarEmployee extends BaseEmployee {
  readonly id = 'calendar';
  readonly label = 'Kalender Agent';

  schedule(): string | null {
    return getFeatureFlag('calendar.enabled') ? '0 8 * * *' : null;
  }

  async runTask(task: EmployeeTask): Promise<EmployeeResult<Record<string, unknown>>> {
    switch (task.kind) {
      case 'propose': {
        const r = proposeCalendarInsert(
          {
            title: String(task.payload.title ?? ''),
            start: String(task.payload.start ?? ''),
            end: String(task.payload.end ?? ''),
            attendees: task.payload.attendees as string[] | undefined,
          },
          (task.payload.existing as ExistingEvent[]) ?? [],
        );
        if (!validateEmployeeResult(r, ['proposal'])) return { ok: false, reason: 'Vorschlag unvollständig' };
        return { ok: true, proposal: r.ok ? r.proposal : undefined };
      }
      case 'oauth-status': {
        const token = String(task.payload.token ?? '');
        const r = calendarOAuthStatus(token);
        return r.ok ? { ok: true, ready: r.ready } : r;
      }
      default:
        return { ok: false, reason: `Unbekannte Kalender-Aufgabe: ${task.kind}` };
    }
  }
}
