// @ts-nocheck
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isPathInRoots } from '../../security/paths';
import { classifyCommand } from '../../security/command-allowlist';
import type { CaseOutcome } from './scoring';

function read(root: string, rel: string): string {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return '';
  }
}

export interface GoldenCheckResult {
  outcome: CaseOutcome;
  /** Convenience mirror of `outcome === 'pass'`; a skipped case is never a success. */
  success: boolean;
  notes: string;
}

function verdict(ok: boolean, passNotes: string, failNotes: string): GoldenCheckResult {
  return ok
    ? { outcome: 'pass', success: true, notes: passNotes }
    : { outcome: 'fail', success: false, notes: failNotes };
}

/**
 * A case we deliberately do not measure here. The reason is mandatory: it is the
 * only thing that distinguishes "no evidence yet" from "we forgot".
 */
function skip(reason: string): GoldenCheckResult {
  return { outcome: 'skipped', success: false, notes: `SKIPPED: ${reason}` };
}

/**
 * Golden cases whose Definition of Done cannot be established without an LLM
 * call, and therefore cannot run inside `runDeterministicGolden` (which must
 * stay offline and token-free).
 *
 * - **G13** "Summarize open positions from fixture JSON": the DoD is that a
 *   *generated natural-language summary* reproduces the fixture's numbers with
 *   no invented symbols. Producing that text requires a model, and grading it
 *   requires reading model output. A file-existence check would assert
 *   something the case does not claim, so it would be a fake pass.
 * - **G15** "Repeat task with memory speedup": the DoD compares turn counts of
 *   two full agent runs. Turns only exist once a model drives the loop. The
 *   memory half of the case (an index hit for a prior session) is covered by
 *   the memory unit tests, but "fewer turns on the second run" is not
 *   observable without spending tokens.
 */
export const LLM_REQUIRED_GOLDEN_IDS = ['G13', 'G15'] as const;

/**
 * Deterministic golden checks — no LLM call, no network, no app boot.
 *
 * Two kinds of check live here:
 *   - **behavioural** (G10, G11): call the real, pure implementation and assert
 *     what it returns. Strongest evidence available offline.
 *   - **source-invariant** (G01–G09, G12): assert that the architectural
 *     invariant the case is about is still present in the codebase. Weaker, but
 *     it is what a "where is X enforced?" case actually asks.
 */
export function runDeterministicGolden(caseId: string, workspaceRoot: string): GoldenCheckResult {
  switch (caseId) {
    case 'G01': {
      const pkg = read(workspaceRoot, 'package.json');
      const ok = pkg.includes('"lint"') || pkg.includes('eslint');
      return verdict(ok, 'eslint script present', 'eslint not configured');
    }
    case 'G02': {
      const ipcTest = read(workspaceRoot, 'electron/security/ipc.test.ts');
      const ipc = read(workspaceRoot, 'electron/security/ipc.ts');
      const ok = ipc.includes('zod') && ipcTest.length > 0;
      return verdict(ok, 'zod IPC boundary + tests', 'IPC zod missing');
    }
    case 'G03': {
      // The old check required `router.ts` to stay under 800 characters, which
      // reported a FAIL as soon as the extracted module legitimately grew. File
      // size was never the DoD — "new module imported, tests pass" is. So we
      // check the extraction is real (exported + covered) *and* actually wired
      // into the god-file rather than left as dead code beside it.
      const router = read(workspaceRoot, 'electron/ai/router.ts');
      const routerTest = read(workspaceRoot, 'electron/ai/router.test.ts');
      const main = read(workspaceRoot, 'electron/main.ts');
      const extracted = router.includes('export function detectProviderFrom');
      const covered = routerTest.includes('detectProviderFrom');
      const wired = /from\s+'\.\/ai\/router'/.test(main) && main.includes('detectProviderFrom');
      const ok = extracted && covered && wired;
      return verdict(
        ok,
        'provider router extracted, unit-tested and imported by main',
        `extraction incomplete (exported=${extracted} tested=${covered} imported=${wired})`,
      );
    }
    case 'G04': {
      const main = read(workspaceRoot, 'electron/main.ts');
      const ok = main.includes('X-JARVIS-Token') && main.includes('ensureBridgeToken');
      return verdict(ok, 'MT5 auth in main process', 'MT5 auth not found');
    }
    case 'G05': {
      const preload = read(workspaceRoot, 'electron/preload.ts');
      const ok = !preload.includes('ANTHROPIC_API_KEY') && preload.includes('contextBridge');
      return verdict(ok, 'no secrets in preload', 'renderer may expose secrets');
    }
    case 'G06': {
      const agents = read(workspaceRoot, 'AGENTS.md');
      const ok = agents.includes('Simplicity first') || agents.includes('Think before coding');
      return verdict(ok, 'Karpathy pushback rules in AGENTS.md', 'missing guardrails');
    }
    case 'G08': {
      // The old check rejected any `/apiKey\s*[:=]/i` hit in preload.ts. That
      // matched the *type annotation* `apiKey: string` in the postToX payload
      // interface — a parameter name, not stored key material — so this
      // safety-critical case reported FAIL while the invariant held. What G08
      // actually forbids is the renderer holding secret *values*: a literal key,
      // or the preload reading one out of the environment. Both are checked
      // below; a channel that forwards a key by name over IPC is the approved
      // path, not a violation.
      const preload = read(workspaceRoot, 'electron/preload.ts');
      const usesBridge = preload.includes('contextBridge');
      const literalSecret = /\b(sk-ant-|sk-[A-Za-z0-9]{20}|AIza[0-9A-Za-z_-]{10}|ghp_)/.test(preload);
      const readsEnvSecret = /process\.env\.[A-Za-z_]*(KEY|SECRET|TOKEN|PASSWORD)/.test(preload);
      const ok = usesBridge && !literalSecret && !readsEnvSecret;
      return verdict(
        ok,
        'renderer uses contextBridge only; no secret values in preload',
        `secret leak risk (bridge=${usesBridge} literal=${literalSecret} env=${readsEnvSecret})`,
      );
    }
    case 'G09': {
      // DoD: "job present after app restart". Persistence is the whole case, so
      // all three halves must exist — a store path, a write on mutation, and a
      // re-arm on startup. Dropping the startup call is the failure mode that
      // silently loses every schedule, so it is checked as a *call*, not just a
      // definition.
      const main = read(workspaceRoot, 'electron/main.ts');
      const hasStore = main.includes('scheduled-jobs.json');
      const persists =
        main.includes('function persistScheduledJobs') && /\n\s*persistScheduledJobs\(\);/.test(main);
      const restores =
        main.includes('function loadScheduledJobs') && /\n\s*loadScheduledJobs\(\);/.test(main);
      const ok = hasStore && persists && restores;
      return verdict(
        ok,
        'scheduled jobs persisted to scheduled-jobs.json and re-armed on startup',
        `schedule persistence incomplete (store=${hasStore} persist=${persists} restore=${restores})`,
      );
    }
    case 'G10': {
      // Behavioural half: the allowlist is the thing that decides whether a
      // command may skip the Advanced Mode gate, so we ask it directly. A
      // mutating command, and an allowlisted command with a chained payload,
      // must both fall back to the gate.
      const mutating = classifyCommand('del /s /q C:\\');
      const chained = classifyCommand('git status && del /s /q C:\\');
      const readOnly = classifyCommand('git status');
      const gateHolds = !mutating.allowed && !chained.allowed && readOnly.allowed;
      // Source half: the handler must consult Advanced Mode *before* exec().
      const main = read(workspaceRoot, 'electron/main.ts');
      const start = main.indexOf("'console:runCmd'");
      const handler = start < 0 ? '' : main.slice(start, start + 2000);
      const gateIdx = handler.indexOf('getAdvancedMode()');
      const execIdx = handler.indexOf('exec(');
      const wired = gateIdx >= 0 && execIdx > gateIdx;
      const ok = gateHolds && wired;
      return verdict(
        ok,
        'non-allowlisted commands denied without Advanced Mode; gate checked before exec',
        `advanced-mode gate weak (allowlist=${gateHolds} handler=${wired})`,
      );
    }
    case 'G11': {
      // Behavioural: run the real containment check the file IPC handlers use.
      const root = path.resolve('C:/jarvis-bench-root');
      const siblingPrefix = isPathInRoots(path.resolve('C:/jarvis-bench-root-secret/evil.txt'), [root]);
      const traversal = isPathInRoots(path.resolve(root, '..', '..', 'windows', 'system32', 'x.dll'), [root]);
      const inside = isPathInRoots(path.join(root, 'ok.txt'), [root]);
      const ok = !siblingPrefix && !traversal && inside;
      return verdict(
        ok,
        'path containment rejects traversal and sibling-prefix, allows workspace paths',
        `containment broken (sibling=${siblingPrefix} traversal=${traversal} inside=${inside})`,
      );
    }
    case 'G12': {
      const main = read(workspaceRoot, 'electron/main.ts');
      const ok = main.includes("'jarvis:mt5'") || main.includes('zeus:mt5');
      return verdict(ok, 'MT5 IPC handler in main', 'MT5 handler missing');
    }
    case 'G13':
      return skip('DoD grades a generated summary against a fixture — requires an LLM call');
    case 'G15':
      return skip('DoD compares turn counts of two full agent runs — requires an LLM call');
    default:
      return skip(`no deterministic check defined for ${caseId}`);
  }
}

export const DETERMINISTIC_GOLDEN_IDS = [
  'G01',
  'G02',
  'G03',
  'G04',
  'G05',
  'G06',
  'G08',
  'G09',
  'G10',
  'G11',
  'G12',
] as const;
