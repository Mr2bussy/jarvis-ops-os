// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  REDACTED,
  RunRecorder,
  assertSafeRunId,
  createRunRecorder,
  isSecretKey,
  listRuns,
  newRunId,
  readRun,
  redactSecrets,
  rotateRuns,
  runFilePath,
} from './replay';
import { JarvisPrimeHarness } from './service';

const DAY_MS = 24 * 60 * 60 * 1000;

let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-replay-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Redaction is the load-bearing part of the replay log — everything else is plumbing. */
describe('redactSecrets', () => {
  it('redacts an Anthropic key wherever it sits', () => {
    const out = redactSecrets({ note: 'use sk-ant-api03-AAAABBBBCCCCDDDDEEEE for this call' }) as {
      // secret-scan:allow
      note: string;
    };
    expect(out.note).not.toContain('sk-ant-api03');
    expect(out.note).toContain(REDACTED);
    expect(out.note).toContain('for this call');
  });

  it('redacts Google AIza and GitHub ghp_ tokens', () => {
    const out = redactSecrets({
      google: 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q', // secret-scan:allow
      github: 'ghp_1234567890abcdefABCDEF1234567890', // secret-scan:allow
    }) as Record<string, string>;
    expect(out.google).toBe(REDACTED);
    expect(out.github).toBe(REDACTED);
  });

  it('redacts a generic apiKey field even when the value looks harmless', () => {
    const out = redactSecrets({ apiKey: 'hunter2', api_key: 'hunter2', 'API-KEY': 'hunter2' }) as Record<
      string,
      string
    >;
    expect(Object.values(out)).toEqual([REDACTED, REDACTED, REDACTED]);
  });

  it('redacts secrets nested in objects and arrays', () => {
    const out = redactSecrets({
      tool: 'mt5_call',
      arguments: {
        endpoint: 'account',
        headers: { Authorization: 'Bearer abcdefghijklmnop', 'x-api-key': 'plain-value' },
        history: [{ password: 'p4ssw0rd' }, { note: 'token ghp_1234567890abcdefABCDEF1234567890' }], // secret-scan:allow
      },
    }) as any;
    expect(out.arguments.endpoint).toBe('account');
    expect(out.arguments.headers.Authorization).toBe(REDACTED);
    expect(out.arguments.headers['x-api-key']).toBe(REDACTED);
    expect(out.arguments.history[0].password).toBe(REDACTED);
    expect(out.arguments.history[1].note).not.toContain('ghp_');
  });

  it('blanks a secret-named key that holds a whole object', () => {
    const out = redactSecrets({ credentials: { user: 'zac', pass: 'x' } }) as Record<string, unknown>;
    expect(out.credentials).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('zac');
  });

  it('redacts label=value secrets embedded in a shell command', () => {
    const out = redactSecrets({ command: 'curl -H "x-api-key: s0me-plain-token" https://x.dev' }) as {
      command: string;
    };
    expect(out.command).not.toContain('s0me-plain-token');
    expect(out.command).toContain('https://x.dev');
  });

  it('redacts JWTs and long hex bridge tokens', () => {
    const out = redactSecrets({
      jwt: 'eyJhbGciOi.eyJzdWIiOjEyMw.SflKxwRJSMeKKF2QT4',
      bridge: 'a'.repeat(48),
    }) as Record<string, string>;
    expect(out.jwt).toBe(REDACTED);
    expect(out.bridge).toBe(REDACTED);
  });

  it('keeps token telemetry and ordinary fields readable', () => {
    const out = redactSecrets({
      maxTokens: 2048,
      tokensIn: 10,
      tokensOut: 20,
      path: 'C:/repo/src/index.ts',
      author: 'zac',
      ok: true,
    }) as Record<string, unknown>;
    expect(out).toEqual({
      maxTokens: 2048,
      tokensIn: 10,
      tokensOut: 20,
      path: 'C:/repo/src/index.ts',
      author: 'zac',
      ok: true,
    });
  });

  it('survives circular structures instead of hanging', () => {
    const node: Record<string, unknown> = { name: 'a' };
    node.self = node;
    const out = redactSecrets(node) as Record<string, unknown>;
    expect(out.name).toBe('a');
    expect(out.self).toBe('[CIRCULAR]');
  });

  it('classifies key names', () => {
    expect(isSecretKey('apiKey')).toBe(true);
    expect(isSecretKey('access_token')).toBe(true);
    expect(isSecretKey('token')).toBe(true);
    expect(isSecretKey('maxTokens')).toBe(false);
    expect(isSecretKey('sessionId')).toBe(false);
  });

  it('never writes a secret to disk, even through an innocent field name', () => {
    const rec = new RunRecorder({ dir, runId: 'run-secret' });
    rec.toolCall({
      id: 'tc_1',
      name: 'shell_exec',
      arguments: { command: 'deploy --token sk-ant-api03-SUPERSECRETVALUE0001', apiKey: 'hunter2' }, // secret-scan:allow
    });
    const raw = fs.readFileSync(runFilePath(dir, 'run-secret'), 'utf8');
    expect(raw).not.toContain('sk-ant-api03-SUPERSECRETVALUE0001'); // secret-scan:allow
    expect(raw).not.toContain('hunter2');
    expect(raw).toContain(REDACTED);
  });
});

describe('run round-trip', () => {
  it('writes every event kind and reads the run back in order', () => {
    const rec = createRunRecorder({ dir, runId: 'run-roundtrip' });
    rec.runStart({ kind: 'session', sessionId: 's1', message: 'do the thing' });
    rec.risk('write_file', { class: 'write', requiresHitl: false, reason: 'workspace write' });
    rec.toolCall({ id: 'tc_1', name: 'write_file', arguments: { path: 'a.ts', content: 'x' } });
    rec.toolResult({ toolCallId: 'tc_1', tool: 'write_file', ok: true, output: 'Wrote a.ts' });
    rec.hitlRequest({ id: 'h1', reason: 'Trading mutation endpoint: order_send' });
    rec.hitlDecision({ id: 'h1', approved: false, timedOut: false });
    rec.runEnd({ ok: true, turns: 2 });

    const events = readRun(dir, 'run-roundtrip');
    expect(events.map((e) => e.type)).toEqual([
      'run_start',
      'risk',
      'tool_call',
      'tool_result',
      'hitl_request',
      'hitl_decision',
      'run_end',
    ]);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(events.every((e) => e.runId === 'run-roundtrip')).toBe(true);
    expect(events[2].payload).toMatchObject({
      tool: 'write_file',
      arguments: { path: 'a.ts', content: 'x' },
    });
    expect(events[5].payload).toMatchObject({ hitlId: 'h1', approved: false, timedOut: false });
    expect(rec.writeFailures).toBe(0);
  });

  it('lists runs newest first and returns nothing for an unknown run', () => {
    new RunRecorder({ dir, runId: 'run-a' }).runStart({});
    new RunRecorder({ dir, runId: 'run-b' }).runStart({});
    expect(
      listRuns(dir)
        .map((r) => r.runId)
        .sort(),
    ).toEqual(['run-a', 'run-b']);
    expect(readRun(dir, 'run-missing')).toEqual([]);
  });

  it('skips a corrupt trailing line instead of losing the whole run', () => {
    const rec = new RunRecorder({ dir, runId: 'run-torn' });
    rec.runStart({ sessionId: 's1' });
    rec.runEnd({ ok: true });
    fs.appendFileSync(rec.filePath, '{"runId":"run-torn","seq":3,"typ', 'utf8');
    expect(readRun(dir, 'run-torn')).toHaveLength(2);
  });

  it('rejects a runId that would escape the runs directory', () => {
    expect(() => assertSafeRunId('../../config')).toThrow(/Invalid runId/);
    expect(() => runFilePath(dir, 'a/b')).toThrow(/Invalid runId/);
    expect(() => assertSafeRunId(newRunId(new Date('2026-08-23T10:00:00Z')))).not.toThrow();
  });
});

describe('rotation', () => {
  const writeRun = (runId: string, ageDays: number, bytes = 200): void => {
    const file = runFilePath(dir, runId);
    fs.writeFileSync(file, 'x'.repeat(bytes), 'utf8');
    const when = new Date(Date.now() - ageDays * DAY_MS);
    fs.utimesSync(file, when, when);
  };

  it('removes runs older than maxAgeDays and keeps the recent ones', () => {
    writeRun('run-old-1', 30);
    writeRun('run-old-2', 15);
    writeRun('run-fresh', 1);

    const removed = rotateRuns(dir, { maxAgeDays: 14 });

    expect(removed.sort()).toEqual(['run-old-1', 'run-old-2']);
    expect(listRuns(dir).map((r) => r.runId)).toEqual(['run-fresh']);
  });

  it('drops the oldest runs when the directory exceeds its size budget', () => {
    writeRun('run-1', 5, 1000);
    writeRun('run-2', 3, 1000);
    writeRun('run-3', 1, 1000);

    const removed = rotateRuns(dir, { maxAgeDays: 365, maxTotalBytes: 2100 });

    expect(removed).toEqual(['run-1']);
    expect(listRuns(dir).map((r) => r.runId)).toEqual(['run-3', 'run-2']);
  });

  it('caps the number of retained runs', () => {
    writeRun('run-1', 5);
    writeRun('run-2', 3);
    writeRun('run-3', 1);

    rotateRuns(dir, { maxAgeDays: 365, maxRuns: 1 });

    expect(listRuns(dir).map((r) => r.runId)).toEqual(['run-3']);
  });

  it('rotates on recorder creation so the directory cannot grow unbounded', () => {
    writeRun('run-ancient', 90);
    createRunRecorder({ dir, runId: 'run-new', rotation: { maxAgeDays: 14 } }).runStart({});
    expect(listRuns(dir).map((r) => r.runId)).toEqual(['run-new']);
  });
});

describe('benchmark run logging', () => {
  let userData = '';

  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-replay-bench-'));
  });

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('records skipped cases as skipped, not as failures', () => {
    const harness = new JarvisPrimeHarness({
      userDataDir: userData,
      workspaceRoot: path.resolve(__dirname, '../..'),
      complete: async () => 'stub',
      toolDeps: { allowedRoots: [userData] },
      replayDir: dir,
    });

    const run = harness.runFullGoldenSuite();
    const runs = listRuns(dir);
    expect(runs).toHaveLength(1);

    const events = readRun(dir, runs[0].runId);
    const caseEvents = events.filter((e) => e.type === 'case_result');
    expect(caseEvents).toHaveLength(run.cases.length);

    const skipped = caseEvents.filter((e) => e.payload.outcome === 'skipped');
    expect(skipped.map((e) => e.payload.caseId)).toEqual(['G13', 'G15']);
    expect(String(skipped[0].payload.notes)).toMatch(/^SKIPPED:/);
    // A skipped case must not be counted as a failure anywhere in the record.
    expect(caseEvents.filter((e) => e.payload.outcome === 'fail').map((e) => e.payload.caseId)).not.toContain(
      'G13',
    );

    const end = events[events.length - 1];
    expect(end.type).toBe('run_end');
    expect(end.payload).toMatchObject({ skipped: 2, scored: run.cases.length - 2 });
  });
});
