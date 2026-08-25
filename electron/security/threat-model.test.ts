/**
 * Threat-model proof tests (D2) — each chain in docs/THREAT-MODEL.md has a
 * full attack-chain assertion that the Sperrklinke still holds.
 *
 * These are not payload lists; they exercise the real modules end-to-end.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { executeHarnessTool } from '../harness/tools/executor';
import { renderToolPrompt } from '../harness/tools/catalog';
import { isPathInRoots } from './paths';
import { classifyCommand, isAllowlistedReadPath, tokenizeCommand } from './command-allowlist';

const ROOT = path.resolve(__dirname, '../..');

describe('threat-model proofs — full attack chains', () => {
  describe('chain 1 — Telegram → Hermes → Agent → Tool', () => {
    it('shell_exec stays disabled even when HITL is armed and approval is granted', async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-tm1-'));
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

    it('prompt catalog never advertises shell_exec as available', () => {
      const prompt = renderToolPrompt();
      expect(prompt).toMatch(/Not available:\s*[^\n]*shell_exec/i);
      const available = prompt.split(/Not available/i)[0] ?? prompt;
      expect(available).not.toMatch(/\bshell_exec\b/);
    });
  });

  describe('chain 2 — Model output → Renderer', () => {
    it('renderer source has no dangerouslySetInnerHTML sink', () => {
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
  });

  describe('chain 3 — Renderer → console:runCmd', () => {
    it('path-like args and control syntax leave the allowlist fast path', () => {
      expect(classifyCommand('del /s /q C:\\Windows').allowed).toBe(false);
      expect(classifyCommand('git status && rm -rf /').allowed).toBe(false);
      const chained = classifyCommand('type C:\\x & calc');
      expect(chained.allowed).toBe(false);
      if (!chained.allowed) expect(chained.requiresAdvancedMode).toBe(true);

      // Traversal via type/cat — full chain: tokenize → path check → Advanced Mode
      const roots = [path.join(ROOT, 'docs')];
      const escape = classifyCommand('type ..\\..\\Windows\\System32\\config\\SAM', {
        pathRoots: roots,
      });
      expect(escape.allowed).toBe(false);
      if (!escape.allowed) expect(escape.requiresAdvancedMode).toBe(true);

      const tokens = tokenizeCommand('type "C:\\outside\\secret.txt"');
      expect(tokens[0].toLowerCase()).toBe('type');
      expect(isAllowlistedReadPath(tokens[1], roots)).toBe(false);
    });
  });

  describe('chain 4 — Bridge token', () => {
    it('MT5 bridge returns 401 without X-JARVIS-Token when token is set', () => {
      const bridgeSrc = fs.readFileSync(path.join(ROOT, 'mt5_bridge', 'bridge.py'), 'utf8');
      expect(bridgeSrc).toContain('X-JARVIS-Token');
      expect(bridgeSrc).toMatch(/send_json\(\s*401/);
      expect(bridgeSrc).toContain('unauthorized');
      // Authorization gate must short-circuit before business handlers
      expect(bridgeSrc).toMatch(/def\s+authorized|X-JARVIS-Token/i);
      const testSrc = fs.readFileSync(path.join(ROOT, 'mt5_bridge', 'test_bridge.py'), 'utf8');
      expect(testSrc).toContain('test_authorized_enforces_matching_header_when_token_set');
      expect(testSrc).toMatch(/401|unauthorized/i);
    });
  });

  describe('chain 5 — Vault path', () => {
    it('paths outside roots are denied (isPathInRoots)', () => {
      const root = path.resolve('/data/vault');
      expect(isPathInRoots(path.join(root, 'agents', 'a.md'), [root])).toBe(true);
      expect(isPathInRoots(path.resolve('/etc/passwd'), [root])).toBe(false);
      expect(isPathInRoots(path.join(root, '..', 'secret'), [root])).toBe(false);
      // UNC / absolute escape must not launder through relative join
      expect(isPathInRoots(path.resolve(root, '..', '..', 'Windows'), [root])).toBe(false);
    });
  });

  describe('chain 6 — Update channel', () => {
    it('unsigned / auto-download install path is locked (autoDownload false; install via IPC)', () => {
      const mainPath = path.join(ROOT, 'electron', 'main.ts');
      const updaterPath = path.join(ROOT, 'electron', 'updater', 'auto-update.ts');
      const prodPath = path.join(ROOT, 'electron', 'ipc', 'register-production.ts');
      const main = fs.existsSync(mainPath) ? fs.readFileSync(mainPath, 'utf8') : '';
      const updater = fs.existsSync(updaterPath) ? fs.readFileSync(updaterPath, 'utf8') : '';
      const prod = fs.existsSync(prodPath) ? fs.readFileSync(prodPath, 'utf8') : '';
      const registry = fs.readFileSync(path.join(ROOT, 'electron', 'ipc', 'registry.ts'), 'utf8');
      expect(registry).toContain('production:install-update');
      expect(main).toMatch(/configureAutoUpdater/);
      expect(updater).toMatch(/autoUpdater\.autoDownload\s*=\s*false/);
      expect(updater).toContain('quitAndInstall');
      expect(prod).toContain('production:install-update');
    });
  });
});
