// @ts-nocheck
import { useEffect, useState } from 'react';

/**
 * Single source of truth for every HUD clock readout.
 *
 * The Bridge status strip previously carried a live `hh:mm:ss` next to the
 * literal string `UTC+02 · WED 13 MAY 2026`. Two components had their own copy
 * of that literal, so the date silently aged while the clock kept ticking.
 * Deriving both from the same tick makes that class of drift impossible.
 */
export interface HudClock {
  /** Zero-padded local hours. */
  hh: string;
  /** Zero-padded local minutes. */
  mm: string;
  /** Zero-padded local seconds. */
  ss: string;
  /** e.g. `WED 23 AUG 2026` */
  dateLabel: string;
  /** e.g. `UTC+02` — derived from the host offset, not assumed. */
  tzLabel: string;
  /** The underlying Date, for callers that need more than the labels. */
  now: Date;
}

export function useHudClock(tickMs = 1000): HudClock {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  const offsetMin = -now.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';

  return {
    hh: String(now.getHours()).padStart(2, '0'),
    mm: String(now.getMinutes()).padStart(2, '0'),
    ss: String(now.getSeconds()).padStart(2, '0'),
    dateLabel: now
      .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
      .replace(',', '')
      .toUpperCase(),
    tzLabel: `UTC${sign}${String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0')}`,
    now,
  };
}
