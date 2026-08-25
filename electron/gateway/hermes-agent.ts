/**
 * Call the installed Nous Hermes Agent CLI so Voice/Bridge use Hermes pools + tools
 * (file, terminal, browser) against a real workspace — not JARVIS routedComplete.
 */
// @ts-nocheck

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { getFeatureFlag } from '../config/flags';

export type HermesAttachment = {
  name: string;
  path?: string;
  text?: string;
};

export type HermesAgentResult = {
  ok: boolean;
  text: string;
  err?: string;
  ms: number;
};

export type HermesAgentOpts = {
  timeoutMs?: number;
  systemHint?: string;
  workspaceCwd?: string;
  sessionName?: string;
  attachments?: HermesAttachment[];
};

type MemTurn = { role: 'user' | 'assistant'; text: string };

/** In-process multi-turn memory — Hermes `--continue` is unreliable under Electron (no Win32 console). */
const sessionMemory = new Map<string, MemTurn[]>();
const MAX_MEMORY_TURNS = 12;

function resolveHermesExe(): string | null {
  const candidates = [
    process.env.HERMES_EXE,
    path.join(process.env.LOCALAPPDATA || '', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'hermes.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'hermes', 'hermes-agent', 'venv', 'bin', 'hermes'),
    path.join(os.homedir(), '.local', 'bin', 'hermes'),
    'hermes',
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (c === 'hermes') return c;
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function resolveHermesHome(): string {
  return process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || '', 'hermes');
}

/** Repo / operator vault Hermes should treat as its working directory. */
export function resolveJarvisWorkspace(preferred?: string): string {
  if (preferred && fs.existsSync(preferred)) return preferred;
  const env = process.env.JARVIS_WORKSPACE;
  if (env && fs.existsSync(env)) return env;
  // dist-electron/gateway → repo root
  const fromDist = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(fromDist, 'package.json'))) return fromDist;
  return process.cwd();
}

export function isHermesSessionMiss(raw: string): boolean {
  return /No session found matching/i.test(raw);
}

export function stripHermesNoise(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => {
      if (!l.trim()) return false;
      if (/^session_id:/i.test(l)) return false;
      if (/^⚠/.test(l)) return false;
      if (/^API call failed/i.test(l)) return false;
      if (/^Error:/i.test(l)) return false;
      if (/No auxiliary LLM/i.test(l)) return false;
      if (/No session found matching/i.test(l)) return false;
      if (/Use 'hermes sessions list'/i.test(l)) return false;
      if (/No Windows console found/i.test(l)) return false;
      if (/NoConsoleScreenBufferError/i.test(l)) return false;
      if (/^Traceback \(most recent call last\)/i.test(l)) return false;
      if (/^\s*File "/.test(l)) return false;
      return true;
    });
  return lines.join('\n').trim();
}

function buildPrompt(user: string, opts: HermesAgentOpts, workspace: string): string {
  const hint =
    opts.systemHint ||
    'You are JARVIS via Hermes Agent on this PC (file + terminal tools). Talk like a relaxed, sharp colleague — natural spoken German matching the operator, warm but concise. Never robotic, never military. No bullets or markdown when speaking. 1–3 short sentences unless they ask for depth. Skip stiff openers (Affirmative, Processing, Verstanden). Use contractions and natural rhythm.';

  const session = opts.sessionName || 'jarvis-voice';
  const history = sessionMemory.get(session) ?? [];

  const parts: string[] = [hint, `Workspace (cwd): ${workspace}`, `Session: ${session}`];

  if (history.length) {
    parts.push('', 'Recent conversation (continue naturally):');
    for (const turn of history.slice(-MAX_MEMORY_TURNS)) {
      parts.push(`${turn.role === 'user' ? 'Operator' : 'JARVIS'}: ${turn.text}`);
    }
  }

  parts.push('', `Operator: ${user.trim()}`);

  for (const a of opts.attachments ?? []) {
    if (a.text?.trim()) {
      parts.push('', `--- ATTACHED FILE: ${a.name} ---`, a.text.slice(0, 40_000), '--- END FILE ---');
    } else if (a.path) {
      parts.push('', `Attached file path (use file tools to open): ${a.path}`);
    } else {
      parts.push('', `Attached: ${a.name}`);
    }
  }
  return parts.join('\n');
}

function rememberTurn(session: string, user: string, assistant: string): void {
  const prev = sessionMemory.get(session) ?? [];
  prev.push(
    { role: 'user', text: user.slice(0, 4000) },
    { role: 'assistant', text: assistant.slice(0, 4000) },
  );
  while (prev.length > MAX_MEMORY_TURNS * 2) prev.shift();
  sessionMemory.set(session, prev);
}

/** Test helper — clear in-process session memory. */
export function clearHermesSessionMemory(session?: string): void {
  if (session) sessionMemory.delete(session);
  else sessionMemory.clear();
}

function hermesEnv(): NodeJS.ProcessEnv {
  const hermesHome = resolveHermesHome();
  const hermesBin = path.join(hermesHome, 'hermes-agent', 'venv', 'Scripts');
  const pathExtra = [
    hermesBin,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama') : '',
  ]
    .filter(Boolean)
    .join(path.delimiter);
  return {
    ...process.env,
    HERMES_HOME: hermesHome,
    HERMES_ACCEPT_HOOKS: '1',
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    // Avoid prompt_toolkit trying to attach a Win32 console buffer under Electron.
    TERM: process.env.TERM || 'dumb',
    NO_COLOR: '1',
    PATH: `${pathExtra}${path.delimiter}${process.env.PATH || ''}`,
  };
}

/**
 * One-shot turn via Hermes Agent with tools enabled (chat, not -z).
 *
 * We deliberately do NOT use `--continue` / `--resume`: on Windows under Electron
 * (no console screen buffer) those paths crash in prompt_toolkit, and a missing
 * named session previously leaked "No session found matching 'jarvis-voice'" as
 * the spoken reply. Continuity is kept in-process via sessionMemory.
 */
export async function hermesAgentComplete(
  prompt: string,
  opts: HermesAgentOpts = {},
): Promise<HermesAgentResult> {
  const t0 = Date.now();
  const exe = resolveHermesExe();
  if (!exe) {
    return {
      ok: false,
      text: '',
      err: 'Hermes Agent nicht gefunden (hermes.exe).',
      ms: Date.now() - t0,
    };
  }

  const timeoutMs = opts.timeoutMs ?? 120_000;
  const user = prompt.trim();
  if (!user) return { ok: false, text: '', err: 'empty prompt', ms: Date.now() - t0 };

  const workspace = resolveJarvisWorkspace(opts.workspaceCwd);
  const session = opts.sessionName || 'jarvis-voice';
  const wrapped = buildPrompt(user, opts, workspace);

  const chat = await runHermes(
    exe,
    ['chat', '-q', wrapped, '-Q', '--yolo', '--accept-hooks', '--source', 'jarvis'],
    timeoutMs,
    workspace,
  );
  if (chat.ok && chat.text) {
    rememberTurn(session, user, chat.text);
    return { ...chat, ms: Date.now() - t0 };
  }

  return {
    ok: false,
    text: '',
    err: chat.err || 'Hermes returned empty',
    ms: Date.now() - t0,
  };
}

function runHermes(exe: string, args: string[], timeoutMs: number, cwd: string): Promise<HermesAgentResult> {
  return new Promise((resolve) => {
    const child = spawn(exe, args, {
      windowsHide: true,
      cwd: fs.existsSync(cwd) ? cwd : process.cwd(),
      env: hermesEnv(),
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      resolve({
        ok: false,
        text: '',
        err: `Hermes timeout after ${timeoutMs}ms`,
        ms: timeoutMs,
      });
    }, timeoutMs);

    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, text: '', err: String(e.message || e), ms: 0 });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const combined = `${stdout}\n${stderr}`;
      if (isHermesSessionMiss(combined)) {
        resolve({
          ok: false,
          text: '',
          err: 'Hermes session missing (internal — retry without continue)',
          ms: 0,
        });
        return;
      }
      const cleaned = stripHermesNoise(stdout) || stripHermesNoise(stderr);
      const errLine = combined
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => /^Error:|^API call failed|NoConsoleScreenBufferError|No Windows console found/i.test(l));

      if (code === 0 && cleaned) {
        resolve({ ok: true, text: cleaned, ms: 0 });
        return;
      }
      if (cleaned && !errLine) {
        resolve({ ok: true, text: cleaned, ms: 0 });
        return;
      }
      resolve({
        ok: false,
        text: '',
        err: (errLine || cleaned || `hermes exit ${code}`).slice(0, 240),
        ms: 0,
      });
    });
  });
}

export function hermesAgentAvailable(): boolean {
  return Boolean(resolveHermesExe());
}

/** Session warm pool — pre-spawn probe to reduce first-turn latency. */
const warmPoolReady = new Map<string, boolean>();

export async function warmHermesSession(sessionName = 'jarvis-voice'): Promise<{ ok: boolean; ms: number }> {
  if (!getFeatureFlag('hermes.warmPool')) return { ok: false, ms: 0 };
  if (warmPoolReady.get(sessionName)) return { ok: true, ms: 0 };
  const t0 = Date.now();
  if (!hermesAgentAvailable()) return { ok: false, ms: Date.now() - t0 };
  try {
    const r = await hermesAgentComplete('ping', { sessionName, timeoutMs: 15_000 });
    warmPoolReady.set(sessionName, r.ok);
    return { ok: r.ok, ms: Date.now() - t0 };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}
