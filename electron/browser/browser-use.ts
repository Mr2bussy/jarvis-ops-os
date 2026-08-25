// @ts-nocheck
import { app } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolvePython } from '../system/binaries';
import { isResolved } from '../system/resolve-binary';

/**
 * Main-process client for the browser-use sidecar (`browser_bridge/bridge.py`).
 *
 * Deliberately main-process only. The renderer never gets a direct channel to
 * browser automation: reaching it means going through the harness tool layer,
 * which classifies every task through the risk gate and — when the gate is
 * armed — waits for human approval. A "click the confirm button on this page"
 * task is exactly the kind of irreversible action that must not be one
 * compromised renderer call away.
 */

const HOST = '127.0.0.1';
const DEFAULT_PORT = 1237;

export interface BrowserBridgeStatus {
  running: boolean;
  installed: boolean;
  detail: string;
  port: number;
}

export interface BrowserTaskResult {
  ok: boolean;
  state?: 'running' | 'done' | 'error';
  id?: string;
  result?: string;
  err?: string;
}

let proc: ChildProcess | null = null;
let port = DEFAULT_PORT;

function bridgePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'browser_bridge', 'bridge.py')
    : path.join(app.getAppPath(), 'browser_bridge', 'bridge.py');
}

function isAlive(): boolean {
  if (!proc?.pid) return false;
  try {
    process.kill(proc.pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function call<T>(
  endpoint: string,
  token: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
  try {
    const res = await fetch(`http://${HOST}:${port}/api/v1/${endpoint}`, {
      method: init?.method ?? 'GET',
      headers: {
        'X-JARVIS-Token': token,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const json = (await res.json()) as T & { error?: string };
    if (!res.ok && json?.error) throw new Error(json.error);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Spawn the sidecar if it is not already up. No-op when Python is absent. */
export function startBrowserBridge(token: string, onActivity?: (detail: string) => void): void {
  const script = bridgePath();
  if (!fs.existsSync(script)) return;
  if (isAlive()) return;
  proc = null;
  try {
    // Same PATH-resolution trap as the MT5 bridge: spawn the interpreter we
    // actually verified, not whatever name resolution happens to hand us.
    const py = resolvePython();
    if (!isResolved(py)) {
      onActivity?.(`python nicht gefunden: ${py.detail}`);
      return;
    }
    proc = spawn(py.path, [script, String(port)], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, JARVIS_BRIDGE_TOKEN: token },
    });
    proc.unref();
    onActivity?.(`browser bridge :${port}`);
  } catch {
    /* python not on PATH — status() will report it */
  }
}

export function stopBrowserBridge(): void {
  if (proc?.pid) {
    try {
      process.kill(proc.pid);
    } catch {
      /* already gone */
    }
  }
  proc = null;
}

export async function browserBridgeStatus(token: string): Promise<BrowserBridgeStatus> {
  try {
    const r = await call<{ ok: boolean; installed: boolean; detail: string }>('status', token, {
      timeoutMs: 3000,
    });
    return { running: true, installed: Boolean(r.installed), detail: r.detail, port };
  } catch (e: unknown) {
    return {
      running: false,
      installed: false,
      detail: String((e as Error)?.message ?? e),
      port,
    };
  }
}

/**
 * Run one browser task to completion.
 *
 * The sidecar answers immediately with a job id because a real browsing session
 * runs for minutes; this polls until it settles or the deadline passes. The
 * caller (the harness tool) has already cleared the risk gate by this point.
 */
export async function runBrowserTask(
  token: string,
  opts: { task: string; maxSteps?: number; headless?: boolean; timeoutMs?: number },
): Promise<BrowserTaskResult> {
  try {
    const started = await call<{ id: string; state: string }>('task', token, {
      method: 'POST',
      body: { task: opts.task, maxSteps: opts.maxSteps ?? 12, headless: opts.headless ?? true },
      timeoutMs: 10_000,
    });
    const deadline = Date.now() + (opts.timeoutMs ?? 180_000);
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      const job = await call<{ state: BrowserTaskResult['state']; result?: string; error?: string }>(
        `task/${started.id}`,
        token,
        { timeoutMs: 5000 },
      );
      if (job.state === 'done') return { ok: true, state: 'done', id: started.id, result: job.result };
      if (job.state === 'error') return { ok: false, state: 'error', id: started.id, err: job.error };
    }
    return { ok: false, state: 'running', id: started.id, err: 'Zeitlimit erreicht — Task läuft weiter' };
  } catch (e: unknown) {
    return { ok: false, err: String((e as Error)?.message ?? e) };
  }
}

export function setBrowserBridgePort(p: number): void {
  if (Number.isInteger(p) && p > 0 && p < 65536) port = p;
}
