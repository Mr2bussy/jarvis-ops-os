import { describe, it, expect } from 'vitest';
import { ALLOW_MARKER, SECRET_PATTERNS, scanLine, scanText, shouldSkipPath } from './secret-patterns.mjs';

/**
 * Fakes are assembled from parts so this test file does not itself contain a string
 * that the scanner would flag when it walks the tree in CI. The one literal that
 * cannot be split readably carries the in-line allow marker instead.
 */
const FAKE = {
  anthropic: `sk-ant-api03-${'A1b2C3d4E5f6G7h8'}${'IjKlMnOp'}`,
  openai: `sk-${'proj'}${'0123456789abcdefghijklmn'}`,
  google: `AIza${'B'.repeat(35)}`,
  githubClassic: `ghp_${'c'.repeat(36)}`,
  githubFineGrained: `github_pat_${'1'.repeat(22)}_${'d'.repeat(59)}`,
  slack: `xoxb-${'2'.repeat(12)}-${'3'.repeat(12)}-${'e'.repeat(24)}`,
  aws: `AKIA${'IOSFODNN7EXAMPLE'}`,
  generic: `  api_key: "${'f'.repeat(32)}",`,
};
const PRIVATE_KEY_HEADER = '-----BEGIN RSA PRIVATE KEY-----'; // secret-scan:allow

describe('SECRET_PATTERNS', () => {
  it('exposes unique rule names', () => {
    const names = SECRET_PATTERNS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps every pattern non-global so .test() is stateless', () => {
    for (const { name, pattern } of SECRET_PATTERNS) {
      expect(pattern.global, name).toBe(false);
    }
  });
});

describe('scanLine ÔÇö detection', () => {
  it.each([
    ['anthropic-api-key', FAKE.anthropic],
    ['openai-api-key', FAKE.openai],
    ['google-api-key', FAKE.google],
    ['github-token', FAKE.githubClassic],
    ['github-token', FAKE.githubFineGrained],
    ['slack-token', FAKE.slack],
    ['aws-access-key-id', FAKE.aws],
    ['generic-api-key', FAKE.generic],
  ])('flags %s', (rule, sample) => {
    expect(scanLine(sample)).toBe(rule);
  });

  it('flags a private key block header', () => {
    expect(scanLine(PRIVATE_KEY_HEADER)).toBe('private-key-block');
  });

  it('flags a PGP/EC variant of the private key header', () => {
    expect(scanLine(`${PRIVATE_KEY_HEADER.replace('RSA', 'EC')}`)).toBe('private-key-block');
    expect(scanLine(PRIVATE_KEY_HEADER.replace('RSA ', ''))).toBe('private-key-block');
  });

  it('reports the vendor-specific rule, not the broader sk- catch-all', () => {
    expect(scanLine(FAKE.anthropic)).toBe('anthropic-api-key');
  });

  it('finds a secret embedded in surrounding code', () => {
    expect(scanLine(`const client = new OpenAI({ apiKey: '${FAKE.openai}' });`)).toBe('openai-api-key');
  });

  it('matches api-key assignment with = and with a dash separator', () => {
    expect(scanLine(`API-KEY = "${'g'.repeat(24)}"`)).toBe('generic-api-key');
    expect(scanLine(`apikey='${'h'.repeat(21)}'`)).toBe('generic-api-key');
  });
});

describe('scanLine ÔÇö false positives', () => {
  it.each([
    'const total = a + b;',
    "import { readFileSync } from 'node:fs';",
    'const apiKey = process.env.ANTHROPIC_API_KEY;',
    'ANTHROPIC_API_KEY=',
    '// see https://docs.anthropic.com/en/api/getting-started',
    'sk-short',
    'AIzaTooShort',
    'AKIALOWERcase123',
    'xoxz-not-a-real-slack-prefix-000000000000',
    'ghp_short',
    'apiKey: config.value',
  ])('ignores %s', (line) => {
    expect(scanLine(line)).toBeNull();
  });

  it('ignores a placeholder shorter than the generic threshold', () => {
    expect(scanLine(`api_key: "${'i'.repeat(19)}"`)).toBeNull();
  });
});

describe('scanLine ÔÇö allow marker', () => {
  it('suppresses a match when the marker is on the same line', () => {
    expect(scanLine(`const fixture = '${FAKE.aws}'; // ${ALLOW_MARKER}`)).toBeNull();
  });

  it('does not suppress a match on a neighbouring line', () => {
    const text = [`// ${ALLOW_MARKER}`, `const leaked = '${FAKE.aws}';`].join('\n');
    expect(scanText(text)).toEqual([{ line: 2, rule: 'aws-access-key-id' }]);
  });
});

describe('scanText', () => {
  it('returns 1-based line numbers for every finding', () => {
    const text = ['const a = 1;', `const b = '${FAKE.google}';`, '', `x('${FAKE.slack}')`].join('\n');
    expect(scanText(text)).toEqual([
      { line: 2, rule: 'google-api-key' },
      { line: 4, rule: 'slack-token' },
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(scanText(`ok\r\n${FAKE.githubClassic}\r\nok`)).toEqual([{ line: 2, rule: 'github-token' }]);
  });

  it('returns an empty list for clean text', () => {
    expect(scanText('const a = 1;\nconst b = 2;\n')).toEqual([]);
  });
});

describe('shouldSkipPath', () => {
  it.each([
    'pnpm-lock.yaml',
    'package-lock.json',
    '_archive/legacy/main.ts',
    'docs/_archive/notes.md',
    'build-assets/icon.ico',
    'src/assets/logo.PNG',
  ])('skips %s', (path) => {
    expect(shouldSkipPath(path)).toBe(true);
  });

  it.each(['src/lib/quant.ts', 'electron/main.ts', '.env.example', 'scripts/scan-secrets.mjs'])(
    'scans %s',
    (path) => {
      expect(shouldSkipPath(path)).toBe(false);
    },
  );

  it('normalises Windows separators', () => {
    expect(shouldSkipPath('_archive\\legacy\\main.ts')).toBe(true);
    expect(shouldSkipPath('src\\lib\\quant.ts')).toBe(false);
  });

  it('skips an empty path rather than treating it as a file', () => {
    expect(shouldSkipPath('')).toBe(true);
  });

  it('does not treat a directory named like an archive suffix as _archive', () => {
    expect(shouldSkipPath('src/not_archive/x.ts')).toBe(false);
  });
});
