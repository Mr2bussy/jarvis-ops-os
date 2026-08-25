/**
 * Secret-detection rules shared by the pre-commit hook (scripts/scan-secrets.mjs)
 * and the CI tree scan.
 *
 * Plain ESM on purpose: the hook must run before any build step and must not pull
 * in a dependency, so the rules cannot live in src/. The vitest suite imports this
 * exact file, so the rules that gate commits are the rules that are under test.
 */
// @ts-nocheck


/** In-line escape hatch for deliberate matches (fixtures, docs, the tests below). */
export const ALLOW_MARKER = 'secret-scan:allow';

/**
 * Order matters: the first hit wins, so a specific vendor prefix must come before
 * the broader rule that would otherwise swallow it (anthropic before the `sk-`
 * catch-all). Patterns are non-global so `.test()` stays stateless across lines.
 */
export const SECRET_PATTERNS = [
  { name: 'anthropic-api-key', pattern: /sk-ant-[A-Za-z0-9_-]{16,}/ },
  { name: 'openai-api-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: 'google-api-key', pattern: /\bAIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/ },
  { name: 'github-token', pattern: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'aws-access-key-id', pattern: /\bAKIA[0-9A-Z]{16}(?![0-9A-Z])/ },
  { name: 'private-key-block', pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/ },
  { name: 'generic-api-key', pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{20,}/i },
];

/** Lockfiles are machine-generated hash soup and produce nothing but false positives. */
export const SKIP_FILENAMES = new Set(['pnpm-lock.yaml', 'package-lock.json']);

/**
 * Frozen / vendor / generated trees ÔÇö not something a commit can still fix, and
 * scanning them only produces noise that slows CI (Phase 0 compare copies, etc.).
 */
export const SKIP_DIRECTORIES = [
  '_archive',
  '_compare',
  '.compare',
  'node_modules',
  'node_modules.partial.bak',
  'node_modules.partial.bak.disabled',
  'dist',
  'dist-electron',
  'dist_new',
  'coverage',
  'playwright-report',
  'test-results',
  'release',
  'design-previews',
  '.jarvis-home',
  'build-assets',
];

/** Skip very large tracked files ÔÇö unlikely to hide a credential line-by-line. */
export const MAX_SCAN_BYTES = 512 * 1024;

/** Binary payloads have no meaningful "line" to report and are scanned as noise. */
export const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.icns', '.bmp',
  '.pdf', '.zip', '.gz', '.7z', '.exe', '.dll', '.node', '.wasm',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.wav', '.webm', '.mov',
]);

/**
 * @param {string} filePath repo-relative path, either separator style
 * @returns {boolean} true when the file is excluded from scanning
 */
export function shouldSkipPath(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0) return true;
  const name = parts[parts.length - 1];
  if (SKIP_FILENAMES.has(name)) return true;
  // Match vendor/archive dirs at any path segment (e.g. repo/_compare/... or nested).
  if (parts.some((segment) => SKIP_DIRECTORIES.includes(segment))) return true;
  const dot = name.lastIndexOf('.');
  return dot > 0 && SKIP_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

/**
 * @param {string} line
 * @returns {string | null} name of the first matching pattern, or null
 */
export function scanLine(line) {
  if (line.includes(ALLOW_MARKER)) return null;
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(line)) return name;
  }
  return null;
}

/**
 * @param {string} text full file contents
 * @returns {{ line: number, rule: string }[]} 1-based line numbers of every finding
 */
export function scanText(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const rule = scanLine(lines[i]);
    if (rule) findings.push({ line: i + 1, rule });
  }
  return findings;
}
