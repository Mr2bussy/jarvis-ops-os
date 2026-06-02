import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { isPathInRoots } from './paths';

describe('isPathInRoots', () => {
  const root = path.resolve('/data/app');

  it('accepts a path inside a root', () => {
    expect(isPathInRoots(path.join(root, 'sub', 'file.txt'), [root])).toBe(true);
  });

  it('accepts the root itself', () => {
    expect(isPathInRoots(root, [root])).toBe(true);
  });

  it('rejects a sibling that only shares a name prefix (boundary check)', () => {
    expect(isPathInRoots(path.resolve('/data/app-secret/x'), [root])).toBe(false);
  });

  it('rejects a path outside all roots', () => {
    expect(isPathInRoots(path.resolve('/etc/passwd'), [root])).toBe(false);
  });

  it('rejects ../ traversal that escapes the root', () => {
    expect(isPathInRoots(path.join(root, '..', '..', 'etc', 'passwd'), [root])).toBe(false);
  });

  it('ignores empty/falsy roots', () => {
    expect(isPathInRoots(path.join(root, 'f'), ['', root, ''])).toBe(true);
    expect(isPathInRoots(path.join(root, 'f'), ['', ''])).toBe(false);
  });

  it('returns false for an empty target', () => {
    expect(isPathInRoots('', [root])).toBe(false);
  });

  it('matches case-insensitively (Windows-friendly)', () => {
    expect(isPathInRoots(path.join(root, 'F.TXT').toUpperCase(), [root])).toBe(true);
  });

  it('accepts a path under any one of several roots', () => {
    const r2 = path.resolve('/var/data');
    expect(isPathInRoots(path.join(r2, 'x'), [root, r2])).toBe(true);
  });
});
