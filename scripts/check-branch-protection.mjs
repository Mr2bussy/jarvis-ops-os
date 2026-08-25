#!/usr/bin/env node
// @ts-nocheck
/**
 * check-branch-protection.mjs (D3) — warns when GitHub cannot enforce require-check.
 *
 * Free-tier private repos return HTTP 403 for classic branch protection / rulesets.
 * Exit codes:
 *   0 — protection present with required context "verify", OR warn-only mode (default)
 *   1 — only when BRANCH_PROTECTION_STRICT=1 and protection missing/403
 *
 * Always prints a clear STATUS line for the scorecard.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATUS_DOC = resolve(ROOT, 'docs/BRANCH-PROTECTION.md');
const STRICT = process.env.BRANCH_PROTECTION_STRICT === '1';

function ghApi(path) {
  // Single argv string avoids Windows gh parsing quirks with -H + path.
  const r = spawnSync('gh', ['api', path], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  return { status: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function main() {
  let ownerRepo = process.env.GITHUB_REPOSITORY || '';
  if (!ownerRepo) {
    const remote = spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
    });
    const m = (remote.stdout || '').match(/github\.com[:/]([^/]+\/[^/.]+)/i);
    ownerRepo = m ? m[1].replace(/\.git$/, '') : 'Mr2bussy/jarvis-ops-os';
  }

  const prot = ghApi(`repos/${ownerRepo}/branches/main/protection`);
  let statusLine = '';
  let ok = false;
  let irreversibleLock = false;

  if (prot.status === 0) {
    try {
      const json = JSON.parse(prot.stdout);
      const contexts =
        json.required_status_checks?.contexts ||
        json.required_status_checks?.checks?.map((c) => c.context) ||
        [];
      ok = contexts.includes('verify');
      statusLine = ok
        ? `STATUS: protected — required checks include verify (${contexts.join(', ')})`
        : `STATUS: protection exists but missing required context "verify" (have: ${contexts.join(', ') || 'none'})`;
      irreversibleLock = ok;
    } catch {
      statusLine = 'STATUS: protection payload unparseable';
    }
  } else if (/403|Upgrade to GitHub Pro|not accessible/i.test(prot.stdout + prot.stderr)) {
    statusLine =
      'STATUS: HTTP 403 — classic branch protection unavailable on private free-tier (needs Pro or public)';
  } else if (/404/.test(prot.stdout + prot.stderr)) {
    statusLine = 'STATUS: 404 — no branch protection rule on main';
  } else {
    statusLine = `STATUS: gh api failed (exit ${prot.status}) — ${(prot.stderr || prot.stdout).slice(0, 200)}`;
  }

  // Free-tier substitute tooth: CODEOWNERS present (review signal; not server-enforced without Pro)
  const codeowners =
    existsSync(resolve(ROOT, '.github/CODEOWNERS')) ||
    existsSync(resolve(ROOT, 'CODEOWNERS')) ||
    existsSync(resolve(ROOT, 'docs/CODEOWNERS'));
  if (codeowners) {
    statusLine += ' · CODEOWNERS present (soft review signal; not a Pro require-review lock)';
  }

  // Try rulesets (also Pro-gated on private free)
  const rules = ghApi(`repos/${ownerRepo}/rulesets`);
  if (rules.status === 0) {
    statusLine += ' · rulesets API reachable';
    try {
      const list = JSON.parse(rules.stdout);
      if (Array.isArray(list) && list.length) irreversibleLock = irreversibleLock || true;
    } catch {
      /* ignore */
    }
  } else if (/403/.test(rules.stdout + rules.stderr)) {
    statusLine += ' · rulesets also 403';
  }

  console.log(`check-branch-protection: ${ownerRepo}`);
  console.log(statusLine);
  console.log(
    irreversibleLock
      ? 'D3 lock: server-side require-check appears active → eligible for 12/12 on branch protection tooth'
      : 'D3 lock: no irreversible GitHub require-check — score stays ≤11 until Pro/public unlocks protection',
  );

  // Refresh status stamp in BRANCH-PROTECTION.md (non-destructive prepend note)
  if (existsSync(STATUS_DOC)) {
    let doc = readFileSync(STATUS_DOC, 'utf8');
    const stamp = `<!-- branch-protection-check: ${new Date().toISOString().slice(0, 10)} · ${statusLine} -->\n`;
    if (/<!-- branch-protection-check:/.test(doc)) {
      doc = doc.replace(/<!-- branch-protection-check:.*?-->\n/, stamp);
    } else {
      doc = stamp + doc;
    }
    writeFileSync(STATUS_DOC, doc);
  }

  if (STRICT && !irreversibleLock) {
    console.error('check-branch-protection: STRICT fail (BRANCH_PROTECTION_STRICT=1)');
    return 1;
  }
  // Default: warn-only so verify stays green; documents the tooth honestly.
  return 0;
}

process.exit(main());
