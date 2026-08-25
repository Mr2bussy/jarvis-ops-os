import type { RiskAssessment, RiskClass } from '../types';

const TRADING_ORDER_ENDPOINTS = new Set(['order', 'orders', 'order_send', 'position_close', 'close_all']);

/**
 * Intents whose effect cannot be undone by closing the tab.
 *
 * Anchored at the start of a word but deliberately open at the end. These are
 * stems, and German conjugates: with a trailing `\b`, `bestell` did not match
 * `Bestelle`, `bestellen` or `bestellt`, and `kauf` did not match `kaufe` —
 * precisely the forms a real instruction uses, so a purchase task slipped past
 * the gate as an ordinary browse. An over-broad match here costs one approval
 * prompt; an under-broad one costs an order nobody confirmed.
 */
const BROWSER_MUTATION_PATTERNS = [
  /\b(kauf|bestell|buy|purchase|checkout|order)/i,
  /\b(send|submit|post|publish|absend|ver(ö|oe)ffentlich)/i,
  /\b(delete|remove|l(ö|oe)sch|deactivate|k(ü|ue)ndig|cancel)/i,
  /\b(transfer|withdraw|(ü|ue)berweis|zahlung|payment|pay)/i,
  /\b(login|sign in|anmeld|password|passwort|credential)/i,
];

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/[sfq]/i,
  /\bformat\s+[a-z]:/i,
  /\bRemove-Item\b.+-Recurse.+-Force/i,
];

/**
 * Vendor-shaped credentials, mirroring the prefixes the commit-time secret
 * scanner uses (scripts/secret-patterns.mjs). Duplicated rather than imported:
 * that file is plain ESM under scripts/ so the pre-commit hook can run before any
 * build, and the electron tsconfig does not reach outside `electron/`.
 */
const CREDENTIAL_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'anthropic-api-key', pattern: /sk-ant-[A-Za-z0-9_-]{12,}/ },
  { name: 'openai-api-key', pattern: /\bsk-[A-Za-z0-9_-]{16,}/ },
  { name: 'google-api-key', pattern: /\bAIza[A-Za-z0-9_-]{30,}/ },
  { name: 'github-token', pattern: /\b(?:ghp_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})/ },
  { name: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'aws-access-key-id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'search-api-key', pattern: /\b(?:tvly|brv)-[A-Za-z0-9_-]{12,}/ },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { name: 'private-key-block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'inline-api-key', pattern: /\bapi[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_\-./+]{16,}/i },
];

/** Surrounding punctuation a human types around a pasted value; stripped before shape analysis. */
const TOKEN_TRIM = /^["'`(<[{]+|["'`)>\]},.;:!?]+$/g;

/**
 * True when one whitespace-delimited token is an opaque blob rather than a word.
 *
 * The character class is the load-bearing part: `:` and `.` are outside it, so a
 * URL — the one long unbroken thing that legitimately appears in a search query —
 * can never satisfy it. What is left is base64/base64url/hex material.
 */
function looksLikeOpaqueToken(token: string): boolean {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(token)) return false;
  // Long + mixed case + digits: the signature of a generated key, not of a word
  // in any language (German compounds get long, but they carry no digits).
  if (token.length >= 40 && /[a-z]/.test(token) && /[A-Z]/.test(token) && /\d/.test(token)) return true;
  // Base64 padding is only ever produced by an encoder.
  if (token.length >= 32 && token.endsWith('=')) return true;
  // 64+ hex chars is a digest or a hex-encoded key; 40 is left alone so a git SHA
  // stays a searchable term.
  if (token.length >= 64 && /^[0-9a-fA-F]+$/.test(token)) return true;
  return false;
}

/**
 * @returns the name of the rule that fired, or null when the query is just a query.
 *
 * Deliberately biased toward false positives: a wrong hit costs the operator one
 * approval click, a miss costs a credential that can never be un-sent.
 */
export function looksLikeSecretQuery(query: string): string | null {
  if (!query) return null;
  for (const { name, pattern } of CREDENTIAL_PATTERNS) {
    if (pattern.test(query)) return name;
  }
  for (const rawToken of query.split(/\s+/)) {
    const token = rawToken.replace(TOKEN_TRIM, '');
    if (looksLikeOpaqueToken(token)) return 'high-entropy-token';
  }
  return null;
}

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

  if (toolName === 'browser_task') {
    const task = String(args.task ?? '');
    // A browsing agent that can click is a state-changing agent. Anything that
    // reads as a submit/purchase/publish intent is treated as destructive, and
    // everything else still needs approval when the gate is armed — the page it
    // lands on decides what a click does, not the prompt that sent it there.
    if (BROWSER_MUTATION_PATTERNS.some((p) => p.test(task))) {
      return {
        class: 'destructive',
        requiresHitl: true,
        reason: `Browser task requests an irreversible action: ${task.slice(0, 120)}`,
      };
    }
    return {
      class: 'browser',
      requiresHitl: true,
      reason: 'Browser automation requires approval when HITL armed',
    };
  }

  if (toolName === 'web_search') {
    const query = String(args.query ?? '');
    // Read-only in the ordinary sense: it changes nothing on this machine and
    // nothing at the far end, so the default is the cheapest class there is and
    // no approval is asked for.
    //
    // The exception is what makes this tool interesting. A search box is an
    // outbound channel — whatever text goes in lands in a third party's request
    // logs, permanently. An agent that has just read a `.env` file and now wants
    // to "search" for its contents is exfiltrating, and being read-only does not
    // make that undoable. So a credential-shaped query is classified
    // `destructive`, not `browser`: it is the least reversible thing in the
    // system, and any weight-based policy must treat it that way.
    const leak = looksLikeSecretQuery(query);
    if (leak) {
      return {
        class: 'destructive',
        requiresHitl: true,
        // The rule name only — never a slice of the query. This string is pushed
        // to the activity feed and the run log, and copying the secret in there
        // would leak it a second time to fix the first leak. The operator still
        // sees the full arguments in the approval payload, where they need them.
        reason: `Search query looks like a secret (${leak}) — exfiltration risk, approval required`,
      };
    }
    return {
      class: 'read',
      requiresHitl: false,
      reason: 'Web search reads only; the query leaves the machine',
    };
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
    case 'browser':
      return 2;
    case 'shell':
      return 3;
    case 'trading':
      return 4;
    case 'destructive':
      return 5;
    default: {
      const _exhaustive: never = risk;
      return _exhaustive;
    }
  }
}
