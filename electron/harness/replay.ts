// @ts-nocheck
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Full replay log for harness runs — one JSONL file per run.
 *
 * Every agent run leaves a record that can be read back event by event: what the
 * run was asked to do, every tool call with its arguments, how the risk gate
 * classified it, what the human decided at each HITL prompt, and how the run
 * ended. Without this, an agent that did something surprising leaves nothing but
 * an activity-ring one-liner.
 *
 * Two constraints shape this module:
 *
 * 1. **No `electron` import.** The destination directory is a parameter, exactly
 *    like `electron/security/paths.ts`, so the whole thing is unit-testable
 *    without booting the app. `service.ts` binds it to
 *    `app.getPath('userData')/jarvis-db/runs`.
 * 2. **Secrets never reach disk.** Tool arguments routinely carry keys, tokens
 *    and file contents. Everything written goes through `redactSecrets` first —
 *    that function, not the JSONL plumbing, is the load-bearing part of this
 *    file.
 */

export type ReplayEventType =
  | 'run_start'
  | 'tool_call'
  | 'tool_result'
  | 'risk'
  | 'hitl_request'
  | 'hitl_decision'
  | 'case_result'
  | 'note'
  | 'run_end';

export interface ReplayEvent {
  runId: string;
  /** 1-based position inside the run; makes ordering explicit even if mtimes collide. */
  seq: number;
  at: string;
  type: ReplayEventType;
  payload: Record<string, unknown>;
}

export const REDACTED = '[REDACTED]';

/** Longest string kept verbatim. A `write_file` argument can be 100k of source. */
const MAX_STRING_CHARS = 4000;

/** Guards against pathological nesting (and, with the seen-set, against cycles). */
const MAX_DEPTH = 12;

/**
 * Key names whose *value* is secret regardless of what the value looks like.
 * Compared after stripping `_`, `-` and spaces, so `api_key`, `API-KEY` and
 * `apiKey` all collapse to `apikey`.
 */
const SECRET_KEY_PARTS = [
  'apikey',
  'secret',
  'password',
  'passwd',
  'passphrase',
  'credential',
  'privatekey',
  'accesskey',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authtoken',
  'bearer',
  'authorization',
  'cookie',
  'signature',
];

/**
 * Exact matches only. `token` cannot be a substring rule: `maxTokens`,
 * `tokensIn` and `tokensOut` are cost telemetry we want to keep in the log.
 */
const SECRET_KEY_EXACT = ['key', 'token', 'auth', 'pwd', 'pass'];

/**
 * Value shapes that are secret wherever they appear — including inside an
 * innocently-named field such as `command` or `content`. Matched globally so a
 * key embedded in a longer string is blanked while its context survives.
 */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{8,}/g, // Anthropic
  /sk-[A-Za-z0-9_-]{16,}/g, // OpenAI (incl. sk-proj-)
  /AIza[0-9A-Za-z_-]{20,}/g, // Google
  /gh[pousr]_[A-Za-z0-9]{16,}/g, // GitHub PAT / OAuth / refresh
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g, // Slack
  /AKIA[0-9A-Z]{16}/g, // AWS access key id
  /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}/g, // JWT
  /\bBearer\s+[A-Za-z0-9._-]{8,}/gi,
  // Long hex: the MT5 bridge token is 48 hex chars, and most homegrown tokens
  // look the same. Costs us the occasional git SHA in a log line; worth it.
  /\b[0-9a-f]{32,}\b/gi,
];

/**
 * `apiKey=<value>` / `token: "<value>"` inside free text — the shape secrets
 * take in a shell command or a config blob, where the key name is part of the
 * string rather than an object key.
 */
const INLINE_SECRET_RE =
  /((?:api[_-]?key|apikey|api[_-]?secret|client[_-]?secret|secret|token|password|passwd|pwd|authorization|auth|bearer|access[_-]?key|private[_-]?key)["']?\s*[:=]\s*)(["']?)([^\s"',;}]{4,})\2/gi;

function normalizeKey(key: string): string {
  return key.replace(/[_\-\s]/g, '').toLowerCase();
}

/** True when the key name alone is enough to condemn the value. */
export function isSecretKey(key: string): boolean {
  const k = normalizeKey(key);
  if (SECRET_KEY_EXACT.includes(k)) return true;
  return SECRET_KEY_PARTS.some((part) => k.includes(part));
}

function redactString(input: string): string {
  // Shape patterns run first. `Authorization: Bearer <token>` must be eaten by
  // the Bearer rule as a whole; if the label rule went first it would blank the
  // word "Bearer" and leave the token behind it exposed.
  let out = input;
  for (const re of SECRET_VALUE_PATTERNS) {
    out = out.replace(re, REDACTED);
  }
  out = out.replace(
    INLINE_SECRET_RE,
    (_m, label: string, quote: string) => `${label}${quote}${REDACTED}${quote}`,
  );
  // Truncate *after* redaction, never before: a secret past the cut-off must
  // still be recognised and removed rather than silently kept in the tail.
  if (out.length > MAX_STRING_CHARS) {
    return `${out.slice(0, MAX_STRING_CHARS)}…[+${out.length - MAX_STRING_CHARS} chars]`;
  }
  return out;
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };

  if (depth >= MAX_DEPTH) return '[TRUNCATED: max depth]';

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    return value.map((v) => redactValue(v, depth + 1, seen));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return '[CIRCULAR]';
    seen.add(obj);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // A secret-named key is blanked whatever it holds — including a nested
      // object, which would otherwise leak the secret one level down.
      out[k] = isSecretKey(k) ? REDACTED : redactValue(v, depth + 1, seen);
    }
    return out;
  }

  return String(value);
}

/**
 * Remove secret material from an arbitrary value before it is written anywhere.
 *
 * Redacts on two independent signals — a secret-looking key name, and a
 * secret-looking value — so a key survives neither `{ apiKey: 'plain-text' }`
 * nor `{ note: 'use sk-ant-…' }`. Recurses through nested objects and arrays.
 */
export function redactSecrets(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet<object>());
}

/** Convenience wrapper for tool arguments, which are always a record. */
export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out = redactSecrets(args);
  return out && typeof out === 'object' && !Array.isArray(out) ? (out as Record<string, unknown>) : {};
}

// ── Run files ────────────────────────────────────────────────────────────────

/**
 * Run ids become file names, so they are constrained rather than sanitised: a
 * caller-supplied `../../config` must fail loudly, not resolve outside `dir`.
 */
const RUN_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

export function assertSafeRunId(runId: string): void {
  if (!RUN_ID_RE.test(runId) || runId === '.' || runId === '..') {
    throw new Error(`Invalid runId: ${runId}`);
  }
}

export function newRunId(now: Date = new Date(), suffix?: string): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const rand = Math.random().toString(36).slice(2, 8);
  const tail = suffix ? `-${suffix.replace(/[^A-Za-z0-9._-]/g, '')}`.slice(0, 40) : '';
  return `run-${stamp}-${rand}${tail}`;
}

export function runFilePath(dir: string, runId: string): string {
  assertSafeRunId(runId);
  return path.join(dir, `${runId}.jsonl`);
}

export interface RunFileInfo {
  runId: string;
  filePath: string;
  bytes: number;
  modifiedMs: number;
}

/** Every persisted run in `dir`, newest first. Missing directory → empty list. */
export function listRuns(dir: string): RunFileInfo[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const runs: RunFileInfo[] = [];
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    const filePath = path.join(dir, name);
    try {
      const st = fs.statSync(filePath);
      if (!st.isFile()) continue;
      runs.push({
        runId: name.slice(0, -'.jsonl'.length),
        filePath,
        bytes: st.size,
        modifiedMs: st.mtimeMs,
      });
    } catch {
      /* raced with rotation — ignore */
    }
  }
  return runs.sort((a, b) => b.modifiedMs - a.modifiedMs);
}

/**
 * Read one run back, in order.
 *
 * Malformed lines are skipped instead of throwing: a process killed mid-append
 * leaves a truncated final line, and the 200 good events before it are exactly
 * what someone investigating that crash needs.
 */
export function readRun(dir: string, runId: string): ReplayEvent[] {
  const file = runFilePath(dir, runId);
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const events: ReplayEvent[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as ReplayEvent);
    } catch {
      /* truncated or corrupt line */
    }
  }
  return events;
}

export interface RotationPolicy {
  /** Runs whose file is older than this are deleted. */
  maxAgeDays?: number;
  /** Total bytes kept in the directory; oldest runs go first. */
  maxTotalBytes?: number;
  /** Hard cap on run count, independent of size. */
  maxRuns?: number;
}

export const DEFAULT_ROTATION: Required<RotationPolicy> = {
  maxAgeDays: 14,
  maxTotalBytes: 32 * 1024 * 1024,
  maxRuns: 500,
};

/**
 * Enforce the retention policy. Returns the run ids that were deleted.
 *
 * Age first, then size/count from the oldest end — the newest run is the one an
 * operator is most likely to be looking at, so it is the last thing to go.
 */
export function rotateRuns(dir: string, policy: RotationPolicy = {}, nowMs: number = Date.now()): string[] {
  const p = { ...DEFAULT_ROTATION, ...policy };
  const removed: string[] = [];
  const remove = (info: RunFileInfo): void => {
    try {
      fs.rmSync(info.filePath, { force: true });
      removed.push(info.runId);
    } catch {
      /* leave it for the next rotation */
    }
  };

  const maxAgeMs = p.maxAgeDays * 24 * 60 * 60 * 1000;
  const survivors: RunFileInfo[] = [];
  for (const run of listRuns(dir)) {
    if (nowMs - run.modifiedMs > maxAgeMs) remove(run);
    else survivors.push(run);
  }

  // survivors is newest-first; walk from the oldest end while over budget.
  let total = survivors.reduce((a, r) => a + r.bytes, 0);
  for (let i = survivors.length - 1; i >= 0; i--) {
    const overSize = total > p.maxTotalBytes;
    const overCount = i + 1 > p.maxRuns;
    if (!overSize && !overCount) break;
    total -= survivors[i].bytes;
    remove(survivors[i]);
  }

  return removed;
}

// ── Recorder ─────────────────────────────────────────────────────────────────

export interface RunRecorderOptions {
  dir: string;
  runId?: string;
  /** Injectable clock — tests need deterministic timestamps. */
  now?: () => Date;
  /** `false` disables rotation entirely (used by tests that assert on old runs). */
  rotation?: RotationPolicy | false;
}

/**
 * Append-only writer for a single run.
 *
 * Never throws. A replay log that crashes the run it is describing would be a
 * strictly worse outcome than a missing log line, so write failures are counted
 * and swallowed.
 */
export class RunRecorder {
  readonly runId: string;
  readonly dir: string;
  readonly filePath: string;
  /** Number of events that could not be written (disk full, permissions, …). */
  writeFailures = 0;

  private seq = 0;
  private readonly now: () => Date;

  constructor(opts: RunRecorderOptions) {
    this.dir = opts.dir;
    this.now = opts.now ?? (() => new Date());
    this.runId = opts.runId ?? newRunId(this.now());
    assertSafeRunId(this.runId);
    this.filePath = runFilePath(this.dir, this.runId);

    if (opts.rotation !== false) {
      try {
        rotateRuns(this.dir, opts.rotation ?? {}, this.now().getTime());
      } catch {
        /* rotation is housekeeping — never fatal */
      }
    }
  }

  /** Write one event. Returns what was persisted (post-redaction) for callers/tests. */
  event(type: ReplayEventType, payload: Record<string, unknown> = {}): ReplayEvent {
    const entry: ReplayEvent = {
      runId: this.runId,
      seq: ++this.seq,
      at: this.now().toISOString(),
      type,
      // Only the payload is redacted; the envelope is generated here and never
      // carries user or model data.
      payload: redactArgs(payload),
    };
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      this.writeFailures++;
    }
    return entry;
  }

  runStart(payload: Record<string, unknown>): ReplayEvent {
    return this.event('run_start', payload);
  }

  toolCall(call: { id?: string; name: string; arguments?: Record<string, unknown> }): ReplayEvent {
    return this.event('tool_call', {
      toolCallId: call.id,
      tool: call.name,
      arguments: call.arguments ?? {},
    });
  }

  toolResult(result: {
    toolCallId?: string;
    tool?: string;
    ok: boolean;
    output?: string;
    error?: string;
  }): ReplayEvent {
    return this.event('tool_result', {
      toolCallId: result.toolCallId,
      tool: result.tool,
      ok: result.ok,
      output: result.output,
      error: result.error,
    });
  }

  risk(tool: string, assessment: { class: string; requiresHitl: boolean; reason: string }): ReplayEvent {
    return this.event('risk', {
      tool,
      riskClass: assessment.class,
      requiresHitl: assessment.requiresHitl,
      reason: assessment.reason,
    });
  }

  hitlRequest(entry: { id: string; reason: string; payload?: Record<string, unknown> }): ReplayEvent {
    return this.event('hitl_request', { hitlId: entry.id, reason: entry.reason, payload: entry.payload });
  }

  hitlDecision(entry: { id: string; approved: boolean; reason?: string; timedOut?: boolean }): ReplayEvent {
    return this.event('hitl_decision', {
      hitlId: entry.id,
      approved: entry.approved,
      reason: entry.reason,
      timedOut: entry.timedOut ?? false,
    });
  }

  /** Benchmark case result — `outcome` keeps skipped cases distinguishable in the log. */
  caseResult(entry: { id: string; outcome: string; caseScore?: number; notes?: string }): ReplayEvent {
    return this.event('case_result', {
      caseId: entry.id,
      outcome: entry.outcome,
      caseScore: entry.caseScore,
      notes: entry.notes,
    });
  }

  runEnd(payload: Record<string, unknown>): ReplayEvent {
    return this.event('run_end', payload);
  }
}

export function createRunRecorder(opts: RunRecorderOptions): RunRecorder {
  return new RunRecorder(opts);
}
