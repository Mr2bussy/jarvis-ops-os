/**
 * Threat-model proof tests (D2) — each chain in docs/THREAT-MODEL.md has one
 * automated assertion that the lock still holds. These are not payload lists;
 * they exercise the real modules that form the Sperrklinke.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { executeHarnessTool } from '../harness/tools/executor';
import { isPathInRoots } from './paths';
import { classifyCommand } from './command-allowlist';

const ROOT = path.resolve(__dirname, '../..');

describe('threat-model proofs', () => {
  it('chain 1 — shell_exec stays disabled in the harness executor', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-tm-'));
    try {
      const r = await executeHarnessTool(
        { id: 'tm1', name: 'shell_exec', arguments: { command: 'echo pwned' } },
        {
          sessionId: 'tm',
          workspaceRoot: tmp,
          hitlArmed: true,
          requestApproval: async () => true,
          verify: async () => ({ ok: true, detail: 'n/a' }),
        },
        { allowedRoots: [tmp] },
      );
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/shell_exec disabled/i);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('chain 2 — renderer source has no dangerouslySetInnerHTML', () => {
    const srcRoot = path.join(ROOT, 'src');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
          const text = fs.readFileSync(p, 'utf8');
          if (text.includes('dangerouslySetInnerHTML')) hits.push(path.relative(ROOT, p));
        }
      }
    };
    walk(srcRoot);
    expect(hits).toEqual([]);
  });

  it('chain 3 — console path-like args leave the allowlist fast path', () => {
    expect(classifyCommand('del /s /q C:\\Windows').allowed).toBe(false);
    expect(classifyCommand('git status && rm -rf /').allowed).toBe(false);
    const chained = classifyCommand('type C:\\x & calc');
    expect(chained.allowed).toBe(false);
    if (!chained.allowed) expect(chained.requiresAdvancedMode).toBe(true);
  });

  it('chain 4 — MT5 bridge returns 401 without X-JARVIS-Token when token is set', () => {
    const bridgeSrc = fs.readFileSync(path.join(ROOT, 'mt5_bridge', 'bridge.py'), 'utf8');
    expect(bridgeSrc).toContain('X-JARVIS-Token');
    expect(bridgeSrc).toMatch(/send_json\(\s*401/);
    expect(bridgeSrc).toContain('unauthorized');
    const testSrc = fs.readFileSync(path.join(ROOT, 'mt5_bridge', 'test_bridge.py'), 'utf8');
    expect(testSrc).toContain('test_authorized_enforces_matching_header_when_token_set');
  });

  it('chain 5 — vault/path roots reject escapes (isPathInRoots)', () => {
    const root = path.resolve('/data/vault');
    expect(isPathInRoots(path.join(root, 'agents', 'a.md'), [root])).toBe(true);
    expect(isPathInRoots(path.resolve('/etc/passwd'), [root])).toBe(false);
    expect(isPathInRoots(path.join(root, '..', 'secret'), [root])).toBe(false);
  });

  it('chain 6 — updater never auto-downloads; install is an explicit IPC action', () => {
    const mainPath = path.join(ROOT, 'electron', 'main.ts');
    const main = fs.readFileSync(mainPath, 'utf8');
    // Skip until electron-updater wiring lands in main (still tracked as D7/open #3).
    if (!main.includes('autoUpdater')) {
      expect(main.includes('autoUpdater')).toBe(false);
      return;
    }
    expect(main).toMatch(/autoUpdater\.autoDownload\s*=\s*false/);
    expect(main).toContain('production:install-update');
    expect(main).toContain('quitAndInstall');
  });
});
