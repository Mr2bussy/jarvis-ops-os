import type { RiskAssessment, RiskClass } from '../types';

const TRADING_ORDER_ENDPOINTS = new Set(['order', 'orders', 'order_send', 'position_close', 'close_all']);

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/[sfq]/i,
  /\bformat\s+[a-z]:/i,
  /\bRemove-Item\b.+-Recurse.+-Force/i,
];

export function classifyToolRisk(toolName: string, args: Record<string, unknown>): RiskAssessment {
  if (toolName === 'shell_exec') {
    const cmd = String(args.command ?? '');
    for (const p of DESTRUCTIVE_PATTERNS) {
      if (p.test(cmd)) {
        return {
          class: 'destructive',
          requiresHitl: true,
          reason: `Destructive shell pattern detected: ${cmd.slice(0, 120)}`,
        };
      }
    }
    return {
      class: 'shell',
      requiresHitl: true,
      reason: 'Shell execution requires approval when HITL armed',
    };
  }

  if (toolName === 'mt5_call') {
    const endpoint = String(args.endpoint ?? '').toLowerCase();
    if (TRADING_ORDER_ENDPOINTS.has(endpoint) || endpoint.includes('order')) {
      return {
        class: 'trading',
        requiresHitl: true,
        reason: `Trading mutation endpoint: ${endpoint}`,
      };
    }
    return { class: 'read', requiresHitl: false, reason: 'MT5 read-only poll' };
  }

  if (toolName === 'write_file') {
    return { class: 'write', requiresHitl: false, reason: 'Workspace write (path-gated elsewhere)' };
  }

  if (toolName === 'read_file') {
    return { class: 'read', requiresHitl: false, reason: 'Read-only file access' };
  }

  return { class: 'read', requiresHitl: false, reason: 'Unknown tool treated as low risk' };
}

export function riskClassWeight(risk: RiskClass): number {
  switch (risk) {
    case 'read':
      return 0;
    case 'write':
      return 1;
    case 'shell':
      return 2;
    case 'trading':
      return 3;
    case 'destructive':
      return 4;
    default: {
      const _exhaustive: never = risk;
      return _exhaustive;
    }
  }
}
