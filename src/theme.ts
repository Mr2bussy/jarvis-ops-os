export const CYAN = 'oklch(0.78 0.13 215)';
export const CYAN_BRIGHT = 'oklch(0.92 0.08 210)';
export const CYAN_DIM = 'oklch(0.58 0.10 215)';
export const VIOLET = 'oklch(0.62 0.16 290)';
export const AMBER = 'oklch(0.78 0.15 75)';
export const ROSE = 'oklch(0.66 0.20 22)';
export const JADE = 'oklch(0.74 0.13 165)';

export type AccentName = 'cyan' | 'violet' | 'amber' | 'rose' | 'jade';

export function colorFor(name?: AccentName | string): string {
  switch (name) {
    case 'violet': return VIOLET;
    case 'amber':  return AMBER;
    case 'rose':   return ROSE;
    case 'jade':   return JADE;
    default:       return CYAN;
  }
}
