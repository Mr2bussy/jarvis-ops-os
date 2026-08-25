// @ts-nocheck
import type { CSSProperties, ReactNode } from 'react';
import type { Sourced } from '../lib/sourced';
import { sourceLabel } from '../lib/sourced';

const BADGE: Record<Sourced<unknown>['source'], { fg: string; label: string }> = {
  measured: { fg: 'oklch(0.72 0.14 155)', label: 'measured' },
  catalog: { fg: 'oklch(0.72 0.12 75)', label: 'catalog' },
  none: { fg: 'oklch(0.65 0.02 240)', label: 'none' },
};

export interface ValueProps<T> {
  data: Sourced<T>;
  /** Format the value; defaults to String(value). */
  format?: (value: T) => ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Hide the provenance chip (still requires Sourced<> at the type level). */
  hideBadge?: boolean;
}

/**
 * Renders a sourced value with an automatic provenance badge.
 * Prefer this over raw numbers in operator-facing panels.
 */
export function Value<T>({ data, format, className, style, hideBadge }: ValueProps<T>) {
  const badge = BADGE[data.source];
  const display = format ? format(data.value) : String(data.value);
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, ...style }}
      title={data.from ? `${sourceLabel(data)} · ${data.from}` : sourceLabel(data)}
    >
      <span>{display}</span>
      {!hideBadge && (
        <span
          className="hud-label"
          style={{
            fontSize: 8,
            letterSpacing: '0.14em',
            color: badge.fg,
            opacity: 0.85,
            textTransform: 'uppercase',
          }}
        >
          {badge.label}
        </span>
      )}
    </span>
  );
}
