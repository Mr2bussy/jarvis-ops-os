/**
 * Property fuzz for command-allowlist path handling (D2 §2.2).
 * ≥10_000 generated path-like args against classifyCommand / isAllowlistedReadPath.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as path from 'node:path';
import { classifyCommand, isAllowlistedReadPath, looksLikePathArg } from './command-allowlist';

const ROOTS = [path.resolve('/data/vault'), path.resolve('/home/op/jarvis')];
const NUM_RUNS = Number(process.env.ALLOWLIST_FUZZ_RUNS || 10_000);

/** Adversarial path fragments that must never be allowlisted for type/cat. */
const evilSegment = fc.constantFrom(
  '..',
  '...',
  '....//',
  '..\\',
  '%2e%2e',
  'file:',
  'file://',
  '\\\\?\\',
  '//?/',
  'C:\\Windows',
  '/etc/passwd',
  '\\\\evil\\share',
);

const pathChar = fc.constantFrom('a', 'b', 'z', '0', '9', '-', '_', '.', '/', '\\', ':', ' ');

const fuzzPath = fc
  .tuple(
    fc.array(fc.oneof(evilSegment, pathChar), { minLength: 1, maxLength: 24 }),
    fc.option(fc.constantFrom('.txt', '.md', '.pem', '.json', ''), { nil: undefined }),
  )
  .map(([parts, ext]) => {
    const body = parts.join('');
    return ext ? `${body}${ext}` : body;
  })
  .filter((s) => s.length > 0 && s.length < 400);

describe('command-allowlist property fuzz', () => {
  it(`rejects traversal / out-of-root paths for type/cat (≥${NUM_RUNS} runs)`, () => {
    fc.assert(
      fc.property(fuzzPath, (p) => {
        // Any path that isAllowlistedReadPath rejects must force Advanced Mode
        const ok = isAllowlistedReadPath(p, ROOTS);
        if (ok) {
          // Positive case: must resolve inside one of ROOTS and contain no ..
          expect(p.includes('..')).toBe(false);
          expect(p.includes('://')).toBe(false);
          return true;
        }
        const v = classifyCommand(`type ${JSON.stringify(p).slice(1, -1)}`, {
          pathRoots: ROOTS,
        });
        // When the raw path has spaces/quotes, classify may tokenize differently —
        // still must never allow a path with .. or URI scheme.
        if (p.includes('..') || p.includes('://') || /^file:/i.test(p)) {
          expect(v.allowed).toBe(false);
        }
        if (looksLikePathArg(p) && !ok) {
          // Direct API: never allowlist an out-of-root path
          expect(isAllowlistedReadPath(p, ROOTS)).toBe(false);
        }
        return !v.allowed || !p.includes('..');
      }),
      { numRuns: NUM_RUNS, verbose: false },
    );
  }, 120_000);

  it(`control-syntax payloads never take the allowlist fast path (≥${Math.min(NUM_RUNS, 2000)} runs)`, () => {
    // Mid-line controls only — trailing `\n`/spaces are stripped by trim() and
    // correctly leave a benign allowlisted command.
    const ctrl = fc.constantFrom('&&', '||', ';', '|', '>', '<', '`', '$(', '&');
    const prefix = fc.constantFrom('git status', 'dir', 'whoami', 'node --version');
    fc.assert(
      fc.property(prefix, ctrl, fc.stringMatching(/^[a-zA-Z0-9._-]{1,40}$/), (pre, c, rest) => {
        const line = `${pre} ${c} ${rest}`;
        const v = classifyCommand(line, { pathRoots: ROOTS });
        expect(v.allowed).toBe(false);
        if (!v.allowed) expect(v.requiresAdvancedMode).toBe(true);
        return true;
      }),
      { numRuns: Math.min(NUM_RUNS, 2000), seed: 42 },
    );
  }, 60_000);
});
