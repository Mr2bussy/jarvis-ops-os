// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { isInNewsWindow, type EconCalendarEvent } from './economic-calendar';

describe('economic-calendar', () => {
  it('detects HIGH impact news window', () => {
    const now = new Date('2026-08-25T12:00:00.000Z');
    const events: EconCalendarEvent[] = [
      {
        time: '12:00',
        event: 'NFP',
        country: 'USD',
        impact: 'HIGH',
        forecast: '—',
        prev: '—',
        actual: '—',
        at: '2026-08-25T12:10:00.000Z',
      },
    ];
    expect(isInNewsWindow(events, now, 30, 30)).toBe(true);
  });

  it('ignores LOW impact', () => {
    const now = new Date('2026-08-25T12:00:00.000Z');
    const events: EconCalendarEvent[] = [
      {
        time: '12:00',
        event: 'Speeches',
        country: 'USD',
        impact: 'LOW',
        forecast: '—',
        prev: '—',
        actual: '—',
        at: '2026-08-25T12:05:00.000Z',
      },
    ];
    expect(isInNewsWindow(events, now)).toBe(false);
  });
});
