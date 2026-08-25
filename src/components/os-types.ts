/** Shared OS / shell state types — kept out of shell.tsx to avoid import cycles. */
export type OSState = 'idle' | 'listening' | 'processing' | 'speaking';

export type ScreenId =
  | 'bridge'
  | 'agents'
  | 'workflows'
  | 'briefings'
  | 'trading'
  | 'content'
  | 'apps'
  | 'system'
  | 'console'
  | 'arsenal'
  | 'admin'
  | 'integrations'
  | 'code'
  | 'evals'
  | 'gateway';
