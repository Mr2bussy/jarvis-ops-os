/**
 * Per-command gating for the Advanced Mode console.
 *
 * Before this, `console:runCmd` was governed by a single global toggle: Advanced
 * Mode off meant nothing ran, on meant *everything* ran. That forces the operator
 * to leave the gate open for routine work, which is exactly when it stops
 * protecting anything.
 *
 * This module splits the decision in two:
 *
 *   - **Allowlisted** — inspection commands with no write effect (`git status`,
 *     `dir`, `node --version`). These run without Advanced Mode.
 *   - **Everything else** — still requires Advanced Mode, exactly as before.
 *
 * ## The property that actually matters
 *
 * A naive allowlist checks the first word and waves the line through. That is
 * trivially defeated: `git status && del /s /q C:\` starts with an allowlisted
 * command. So a line is allowlisted only when it contains *no shell control
 * syntax at all* — no chaining, no piping, no substitution, no redirection.
 * The moment a line can express a second command, it leaves the fast path and
 * falls back to the Advanced Mode gate.
 *
 * File-read commands (`type` / `cat`) additionally require every path-like
 * argument to sit inside configured roots (`isPathInRoots`). A whole-line regex
 * that accepts any single token was a traversal hole; argument parsing closes it.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { isPathInRoots } from './paths';

export type CommandVerdict =
  | { allowed: true; reason: string }
  | { allowed: false; requiresAdvancedMode: true; reason: string };

/**
 * Shell syntax that can introduce a second command, redirect output, or expand
 * into arbitrary text. Presence of any of these disqualifies the fast path,
 * regardless of how harmless the leading executable looks.
 */
const CONTROL_SYNTAX = /[;&|><`$\n\r]|\|\||&&|\$\(|%[A-Za-z_]+%/;

/**
 * Read-only inspection commands. Each entry is matched against the whole line,
 * anchored, so `git status` passes but `git push` does not.
 *
 * Kept deliberately small. Growing it is a security decision, not a convenience
 * one — every addition must be a command that cannot write, delete, install, or
 * transmit.
 *
 * `type` / `cat` still appear here for shape matching, but `classifyCommand`
 * validates path arguments separately before allowing them.
 */
export const DEFAULT_ALLOWLIST: { pattern: RegExp; label: string }[] = [
  { pattern: /^git\s+(status|log|diff|show|branch|remote\s+-v|rev-parse)\b[^]*$/i, label: 'git (read-only)' },
  { pattern: /^(dir|ls)\b[^]*$/i, label: 'directory listing' },
  { pattern: /^(pwd|cd)\s*$/i, label: 'working directory' },
  { pattern: /^(node|npm|pnpm|python|py|pip)\s+(-v|--version)\s*$/i, label: 'tool version' },
  { pattern: /^(whoami|hostname|date|time)\s*$/i, label: 'host identity' },
  { pattern: /^(type|cat)\s+\S+\s*$/i, label: 'file read' },
  { pattern: /^(systeminfo|ver)\s*$/i, label: 'system info' },
  { pattern: /^ipconfig(\s+\/all)?\s*$/i, label: 'network config' },
  { pattern: /^tasklist\b[^]*$/i, label: 'process list' },
  { pattern: /^(npm|pnpm)\s+(ls|list|outdated)\b[^]*$/i, label: 'dependency listing' },
];

export interface ClassifyOptions {
  /** Operator-added entries, stored alongside the defaults. */
  extra?: { pattern: RegExp; label: string }[];
  /**
   * Roots that path-like arguments must stay inside. Defaults to cwd + home
   * (Desktop/Documents). Callers that know the vault/workspace should pass them.
   */
  pathRoots?: ReadonlyArray<string>;
}

const FILE_READ_CMD = /^(type|cat)$/i;

/** Tokenize a shell line without executing it — whitespace split, simple quotes. */
export function tokenizeCommand(line: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) {
        tokens.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

/**
 * Heuristic: argument looks like a filesystem path (not a flag).
 * Flags (`-v`, `--version`, `/all`) are excluded.
 */
export function looksLikePathArg(arg: string): boolean {
  if (!arg) return false;
  if (arg.startsWith('-')) return false;
  if (/^\/[A-Za-z][A-Za-z0-9_-]*$/.test(arg)) return false; // cmd.exe switches like /all
  if (arg.includes('://')) return true; // file:// etc.
  if (/^[A-Za-z]:[\\/]/.test(arg)) return true;
  if (arg.startsWith('\\\\') || arg.startsWith('//')) return true;
  if (arg.includes('..')) return true;
  if (/[\\/]/.test(arg)) return true;
  // bare relative file names for type/cat (e.g. package.json, README.md)
  if (/\.[A-Za-z0-9]{1,12}$/.test(arg)) return true;
  return false;
}

/**
 * Fast-path path check for type/cat. Any `..` segment, URI scheme (file://), or
 * path outside roots forces Advanced Mode — relative resolution under cwd must
 * not launder traversal payloads like `....//....//etc/passwd`.
 */
export function isAllowlistedReadPath(target: string, roots: ReadonlyArray<string>): boolean {
  if (!target || !looksLikePathArg(target)) return false;
  // URI schemes other than Windows drive letters (C:\...)
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/i.test(target) && !/^[A-Za-z]:[\\/]/.test(target)) {
    return false;
  }
  if (target.includes('://')) return false;
  if (target.startsWith('\\\\?\\') || target.startsWith('//?/')) return false;
  // Traversal / dot-abuse — never on the allowlist fast path
  if (target.includes('..')) return false;
  return isPathInRoots(target, roots);
}

export function defaultAllowlistPathRoots(): string[] {
  const home = os.homedir();
  return [process.cwd(), home, path.join(home, 'Desktop'), path.join(home, 'Documents')];
}

/**
 * Decide whether a command may run without the Advanced Mode gate.
 *
 * Never returns "denied" outright — a command that is not allowlisted simply
 * falls back to the existing gate, which the operator can open deliberately.
 * This module narrows the default-open surface; it does not add a new veto.
 */
export function classifyCommand(raw: unknown, opts: ClassifyOptions = {}): CommandVerdict {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { allowed: false, requiresAdvancedMode: true, reason: 'Leerer Befehl' };
  }
  const cmd = raw.trim();

  if (CONTROL_SYNTAX.test(cmd)) {
    return {
      allowed: false,
      requiresAdvancedMode: true,
      reason: 'Enthält Shell-Steuerzeichen — kann einen zweiten Befehl ausführen',
    };
  }

  const tokens = tokenizeCommand(cmd);
  if (tokens.length === 0) {
    return { allowed: false, requiresAdvancedMode: true, reason: 'Leerer Befehl' };
  }

  const bin = tokens[0];
  const args = tokens.slice(1);
  const roots = (opts.pathRoots?.length ? opts.pathRoots : defaultAllowlistPathRoots()).filter(Boolean);

  // File-read fast path: command allowlisted only when every path-like arg is in roots.
  if (FILE_READ_CMD.test(bin)) {
    if (args.length !== 1) {
      return {
        allowed: false,
        requiresAdvancedMode: true,
        reason: 'file read erwartet genau ein Pfadargument',
      };
    }
    const target = args[0];
    if (!isAllowlistedReadPath(target, roots)) {
      return {
        allowed: false,
        requiresAdvancedMode: true,
        reason: 'Pfadargument außerhalb erlaubter Roots',
      };
    }
    return { allowed: true, reason: 'Allowlist: file read' };
  }

  for (const entry of [...DEFAULT_ALLOWLIST, ...(opts.extra ?? [])]) {
    if (entry.pattern.test(cmd)) {
      return { allowed: true, reason: `Allowlist: ${entry.label}` };
    }
  }

  return {
    allowed: false,
    requiresAdvancedMode: true,
    reason: 'Nicht auf der Allowlist',
  };
}
