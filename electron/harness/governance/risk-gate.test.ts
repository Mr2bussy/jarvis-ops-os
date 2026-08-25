// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { classifyToolRisk, looksLikeSecretQuery, riskClassWeight } from './risk-gate';

// Fixtures that are deliberately credential-shaped. They are inert placeholders,
// but the commit-time scanner cannot know that — hence the escape hatch.
const ANTHROPIC_KEY = 'sk-ant-api03-AbCdEf1234567890XyZaBcDeFgHiJkLmNoPqRsTuV'; // secret-scan:allow
const AWS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE'; // secret-scan:allow
const SLACK_TOKEN = 'xoxb-2401234567-8901234567-AbCdEfGhIjKlMnOpQrStUvWx'; // secret-scan:allow
const GITHUB_TOKEN = 'ghp_AbCdEf1234567890GhIjKlMnOpQrStUvWx'; // secret-scan:allow
const GOOGLE_KEY = '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'; // secret-scan:allow
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
// 49 chars, mixed case, digits, no separators — the shape of a pasted token.
const OPAQUE_TOKEN = 'Ab3Cd4Ef5Gh6Ij7Kl8Mn9Op0Qr1St2Uv3Wx4Yz5Ab6Cd7Ef8G';

describe('classifyToolRisk — existing tools', () => {
  it('flags destructive shell patterns above plain shell', () => {
    const rm = classifyToolRisk('shell_exec', { command: 'rm -rf /' });
    expect(rm.class).toBe('destructive');
    expect(rm.requiresHitl).toBe(true);
    const ls = classifyToolRisk('shell_exec', { command: 'ls -la' });
    expect(ls.class).toBe('shell');
    expect(ls.requiresHitl).toBe(true);
  });

  it('separates MT5 order endpoints from read-only polls', () => {
    expect(classifyToolRisk('mt5_call', { endpoint: 'order_send' })).toMatchObject({
      class: 'trading',
      requiresHitl: true,
    });
    expect(classifyToolRisk('mt5_call', { endpoint: 'status' })).toMatchObject({
      class: 'read',
      requiresHitl: false,
    });
  });

  it('treats an irreversible browser intent as destructive and everything else as browser', () => {
    // Regression guard. BROWSER_MUTATION_PATTERNS was authored with raw 0x08
    // backspace bytes where `\b` was meant, so every pattern silently matched
    // nothing and *no* browser task was ever classified destructive. Nothing in
    // the suite exercised the positive branch, so it stayed invisible. If these
    // assertions ever flip to 'browser' again, the escapes have been eaten.
    expect(classifyToolRisk('browser_task', { task: 'buy the laptop in the cart' }).class).toBe(
      'destructive',
    );
    expect(classifyToolRisk('browser_task', { task: 'Bestellung absenden' }).class).toBe('destructive');
    // Regression: the stems used to carry a trailing , so German conjugation
    // walked straight past the gate — "Bestelle …" and "kaufe …" were graded as
    // an ordinary browse and would have run without approval.
    for (const task of [
      'Bestelle das Produkt im Warenkorb',
      'kaufe den Artikel sofort',
      'bestellt jetzt zwei Stück',
      'Rechnung bezahlen und absenden',
      'Konto löschen',
    ]) {
      expect(classifyToolRisk('browser_task', { task }).class, task).toBe('destructive');
    }

    expect(classifyToolRisk('browser_task', { task: 'Open the docs page and read it' })).toMatchObject({
      class: 'browser',
      requiresHitl: true,
    });
  });

  it('classifies file access without demanding approval', () => {
    expect(classifyToolRisk('read_file', { path: 'a.txt' })).toMatchObject({
      class: 'read',
      requiresHitl: false,
    });
    expect(classifyToolRisk('write_file', { path: 'a.txt' })).toMatchObject({
      class: 'write',
      requiresHitl: false,
    });
  });

  it('orders the risk weights so destructive outranks everything', () => {
    expect(riskClassWeight('read')).toBe(0);
    expect(riskClassWeight('destructive')).toBe(5);
    expect(riskClassWeight('destructive')).toBeGreaterThan(riskClassWeight('browser'));
  });
});

describe('classifyToolRisk — web_search', () => {
  it('treats an ordinary query as read-only with no approval needed', () => {
    const r = classifyToolRisk('web_search', { query: 'electron context isolation best practices' });
    expect(r.class).toBe('read');
    expect(r.requiresHitl).toBe(false);
    expect(riskClassWeight(r.class)).toBe(0);
  });

  it('leaves German prose and long compounds alone', () => {
    for (const q of [
      'Wie funktioniert die Donaudampfschifffahrtsgesellschaft?',
      'MT5 Bridge Verbindung schlägt fehl — was tun',
      'was bedeutet HITL im Agenten-Kontext',
    ]) {
      expect(classifyToolRisk('web_search', { query: q })).toMatchObject({
        class: 'read',
        requiresHitl: false,
      });
    }
  });

  it('does not trip over URLs, hashes or version strings in a query', () => {
    for (const q of [
      'https://www.electronjs.org/docs/latest/tutorial/security#context-isolation',
      'site:github.com/electron/electron/blob/main/docs/tutorial/security.md sandbox',
      'git commit 9f2b1c4d8e7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c revert',
      'typescript 5.5.3 release notes',
    ]) {
      expect(classifyToolRisk('web_search', { query: q }).requiresHitl).toBe(false);
    }
  });

  it('escalates an Anthropic-shaped key to destructive + approval', () => {
    const r = classifyToolRisk('web_search', { query: `what is ${ANTHROPIC_KEY}` });
    expect(r.class).toBe('destructive');
    expect(r.requiresHitl).toBe(true);
    expect(r.reason).toMatch(/anthropic-api-key/);
  });

  it('escalates a long opaque base64-ish chain', () => {
    const r = classifyToolRisk('web_search', { query: `decode this: ${OPAQUE_TOKEN}` });
    expect(r.class).toBe('destructive');
    expect(r.requiresHitl).toBe(true);
    expect(r.reason).toMatch(/high-entropy-token/);
  });

  it('never copies the secret itself into the log-facing reason string', () => {
    const r = classifyToolRisk('web_search', { query: `lookup ${ANTHROPIC_KEY}` });
    expect(r.reason).not.toContain(ANTHROPIC_KEY);
    expect(r.reason).not.toContain('sk-ant');
  });

  it('handles a missing or non-string query without throwing', () => {
    expect(classifyToolRisk('web_search', {})).toMatchObject({ class: 'read', requiresHitl: false });
    expect(classifyToolRisk('web_search', { query: 42 })).toMatchObject({ class: 'read' });
  });
});

describe('looksLikeSecretQuery', () => {
  it('names the rule for each vendor credential shape', () => {
    expect(looksLikeSecretQuery(ANTHROPIC_KEY)).toBe('anthropic-api-key');
    expect(looksLikeSecretQuery(`aws ${AWS_KEY_ID}`)).toBe('aws-access-key-id');
    expect(looksLikeSecretQuery(`slack ${SLACK_TOKEN}`)).toBe('slack-token');
    expect(looksLikeSecretQuery(`gh ${GITHUB_TOKEN}`)).toBe('github-token');
    expect(looksLikeSecretQuery(`google ${GOOGLE_KEY}`)).toBe('google-api-key');
    expect(looksLikeSecretQuery(`token ${JWT}`)).toBe('jwt');
    expect(looksLikeSecretQuery('tvly-dev-AbCdEf1234567890XyZa')).toBe('search-api-key');
    expect(looksLikeSecretQuery('-----BEGIN RSA PRIVATE KEY----- MIIEow')).toBe('private-key-block'); // secret-scan:allow
  });

  it('catches a key pasted inside a URL-shaped query string', () => {
    expect(looksLikeSecretQuery('https://api.example.com/v1?api_key=AbCdEf1234567890GhIjKl')).toBe(
      'inline-api-key',
    );
  });

  it('catches base64 padding and long hex digests', () => {
    expect(looksLikeSecretQuery(`blob ${'QUJDZGVmZ2hpams'.repeat(3)}=`)).toBe('high-entropy-token');
    expect(looksLikeSecretQuery(`hash ${'a1b2c3d4'.repeat(8)}`)).toBe('high-entropy-token');
  });

  it('strips surrounding punctuation before judging a token', () => {
    expect(looksLikeSecretQuery(`is "${OPAQUE_TOKEN}" a key?`)).toBe('high-entropy-token');
  });

  it('leaves a 40-char git SHA searchable', () => {
    expect(looksLikeSecretQuery(`fix ${'a'.repeat(8)}${'0123456789abcdef'.repeat(2)}`)).toBeNull();
  });

  it('returns null for an empty query', () => {
    expect(looksLikeSecretQuery('')).toBeNull();
  });
});
