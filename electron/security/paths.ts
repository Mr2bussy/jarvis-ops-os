import * as path from 'node:path';

/**
 * Pure, dependency-free path-containment check used by the file-IO IPC handlers.
 *
 * Returns true iff `target` resolves to a location that is one of `roots` or sits
 * underneath one of them. Empty/falsy roots are ignored. The comparison is
 * case-insensitive (Windows-friendly) and — crucially — enforces a path-separator
 * boundary so that a sibling directory sharing a name prefix does NOT pass:
 *
 *   isPathInRoots('C:/data-secret/x', ['C:/data'])  // → false (not inside C:/data)
 *   isPathInRoots('C:/data/x',        ['C:/data'])  // → true
 *
 * Keeping this in its own module (no `electron` import) makes it unit-testable
 * without booting the Electron app.
 */
export function isPathInRoots(target: string, roots: ReadonlyArray<string>): boolean {
  if (!target) return false;
  const t = path.resolve(target).toLowerCase();
  return roots
    .filter((r): r is string => Boolean(r))
    .map((r) => path.resolve(r).toLowerCase())
    .some((root) => t === root || t.startsWith(root.endsWith(path.sep) ? root : root + path.sep));
}
