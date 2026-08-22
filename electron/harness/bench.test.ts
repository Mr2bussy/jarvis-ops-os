import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ActivityRing } from '../activity-ring';
import { isPathInRoots } from '../security/paths';
import { classifyToolRisk } from './governance/risk-gate';
import { parseDoneClaim, verifyCompletion } from './governance/anti-early-victory';
import { JarvisPrimeHarness } from './service';
import { scoreCase, meanHarnessScore } from './eval/scoring';
import { SAFETY_REGRESSION_IDS } from './eval/benchmark-cases';

describe('bench G07 activity ring', () => {
  it('push appears in recent activity', () => {
    const ring = new ActivityRing();
    ring.push('HARNESS', 'PING', 'bench-G07');
    const recent = ring.recent(10);
    expect(recent.some((e) => e.action === 'PING' && e.target === 'bench-G07')).toBe(true);
  });
});

describe('bench G11 path traversal', () => {
  it('rejects sibling prefix path on Windows', () => {
    const root = path.resolve('C:/data');
    expect(isPathInRoots('C:/data-secret/evil.txt', [root])).toBe(false);
    expect(isPathInRoots(path.join(root, 'ok.txt'), [root])).toBe(true);
  });
});

describe('bench G14 trading HITL', () => {
  it('order endpoints require HITL when classified', () => {
    const r = classifyToolRisk('mt5_call', { endpoint: 'order_send' });
    expect(r.requiresHitl).toBe(true);
    expect(r.class).toBe('trading');
  });
});

describe('bench G16 refine + snapshot', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-harness-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('creates snapshot and skill metadata', () => {
    const h = new JarvisPrimeHarness({
      userDataDir: tmp,
      workspaceRoot: tmp,
      complete: async () => 'ok',
      hitlArmed: true,
      toolDeps: { allowedRoots: [tmp] },
    });
    const out = h.refine({
      sessionId: 's1',
      evidence: 'vitest green on ipc schema',
      lesson: 'Validate all IPC payloads with zod',
      skillName: 'ipc-zod',
    });
    expect(out.ok).toBe(true);
    expect(out.snapshotId).toMatch(/^snap_/);
    const state = h.continual.getState();
    expect(state.skillDescriptions.some((s) => s.name === 'ipc-zod')).toBe(true);
    expect(state.memories.length).toBeGreaterThan(0);
  });
});

describe('bench G17 anti-early-victory', () => {
  it('continues when verifier fails after done claim', async () => {
    const v = await verifyCompletion({ claimedDone: true, verifierId: 'tests' }, async () => ({
      ok: false,
      detail: 'tests still failing',
    }));
    expect(v.shouldContinue).toBe(true);
    expect(v.ok).toBe(false);
  });

  it('detects done claims in assistant text', () => {
    expect(parseDoneClaim('Task complete.')).toBe(true);
    expect(parseDoneClaim('Still working on the fix')).toBe(false);
  });
});

describe('harness smoke aggregate', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-harness-smoke-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('runs automated smoke cases with safety regression at 100', () => {
    const h = new JarvisPrimeHarness({
      userDataDir: tmp,
      workspaceRoot: tmp,
      complete: async () => 'stub',
      toolDeps: { allowedRoots: [tmp] },
    });
    const run = h.runAutomatedBenchSmoke();
    expect(run.cases.length).toBeGreaterThan(0);
    expect(run.harnessScore).toBeGreaterThan(0);

    for (const id of SAFETY_REGRESSION_IDS) {
      const c = run.cases.find((x) => x.id === id);
      if (c) expect(c.safety).toBe(100);
    }
  });
});

describe('scoring math', () => {
  it('weights success heavily', () => {
    const high = scoreCase({
      success: true,
      correctness: 100,
      turns: 4,
      baselineTurns: 4,
      surgical: 100,
      safety: 100,
      recovery: 100,
    });
    const low = scoreCase({
      success: false,
      correctness: 100,
      turns: 4,
      baselineTurns: 4,
      surgical: 100,
      safety: 100,
      recovery: 100,
    });
    expect(high).toBeGreaterThan(low);
    expect(meanHarnessScore([{ caseScore: high } as any, { caseScore: low } as any])).toBeCloseTo(
      (high + low) / 2,
    );
  });
});
