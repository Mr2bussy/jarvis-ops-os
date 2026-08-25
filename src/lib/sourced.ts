/**
 * Provenance-tagged values (D5 — Datenehrlichkeit).
 *
 * A bare number in the UI is a lie waiting to happen. Every operator-visible
 * quantity should carry where it came from so panels can refuse silent fallbacks.
 */
// @ts-nocheck

export type SourceKind = 'measured' | 'catalog' | 'none';

export type Sourced<T> = {
  value: T;
  source: SourceKind;
  /** Epoch ms when the value was observed (measured). */
  at?: number;
  /** e.g. 'vault-scan', 'mt5:1234', 'agents-catalog.ts' */
  from?: string;
};

export function measured<T>(value: T, from: string, at = Date.now()): Sourced<T> {
  return { value, source: 'measured', from, at };
}

export function catalog<T>(value: T, from: string): Sourced<T> {
  return { value, source: 'catalog', from };
}

export function none<T>(value: T, from?: string): Sourced<T> {
  return { value, source: 'none', from };
}

export function sourceLabel(s: Pick<Sourced<unknown>, 'source'>): string {
  switch (s.source) {
    case 'measured':
      return 'measured';
    case 'catalog':
      return 'catalog';
    case 'none':
      return 'none';
    default: {
      const _exhaustive: never = s.source;
      return _exhaustive;
    }
  }
}
