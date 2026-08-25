// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { resolveBinary, isResolved, type BinaryProbes } from './resolve-binary';

/**
 * A fake filesystem describing the exact machine state that broke speech-to-text:
 * `ffmpeg.exe` on PATH is a zero-byte symlink, and the real binary lives in a
 * WinGet package directory that is not on PATH at all.
 */
function fakeFs(spec: {
  pathDirs: string[];
  files: Record<string, number>;
  links?: Record<string, string>;
  unfollowable?: string[];
}): BinaryProbes {
  const links = spec.links ?? {};
  const unfollowable = new Set(spec.unfollowable ?? []);
  return {
    pathDirs: () => spec.pathDirs,
    join: (dir, name) => `${dir}\\${name}`,
    exists: (p) => p in spec.files || p in links,
    realpath: (p) => {
      if (unfollowable.has(p)) throw new Error('EACCES: cannot follow reparse point');
      return links[p] ?? p;
    },
    size: (p) => spec.files[p] ?? 0,
  };
}

const WINGET_LINK = 'C:\\WinGet\\Links\\ffmpeg.exe';
const WINGET_REAL = 'C:\\WinGet\\Packages\\Gyan.FFmpeg\\bin\\ffmpeg.exe';

describe('resolveBinary — the ffmpeg symlink defect', () => {
  it('resolves past a PATH symlink to the file that will actually execute', () => {
    const probes = fakeFs({
      pathDirs: ['C:\\WinGet\\Links'],
      files: { [WINGET_REAL]: 180_000 },
      links: { [WINGET_LINK]: WINGET_REAL },
    });
    const r = resolveBinary(probes, { names: ['ffmpeg.exe'] });
    expect(isResolved(r)).toBe(true);
    if (isResolved(r)) {
      expect(r.path).toBe(WINGET_REAL);
      expect(r.wasSymlink).toBe(true);
      expect(r.detail).toContain('→');
    }
  });

  it('rejects a symlink whose target is a zero-byte stub', () => {
    // This is what made spawn return a nonsense exit code instead of failing.
    const probes = fakeFs({
      pathDirs: ['C:\\WinGet\\Links'],
      files: { [WINGET_REAL]: 0 },
      links: { [WINGET_LINK]: WINGET_REAL },
    });
    const r = resolveBinary(probes, { names: ['ffmpeg.exe'] });
    expect(isResolved(r)).toBe(false);
  });

  it('rejects a reparse point it cannot follow rather than spawning it', () => {
    const probes = fakeFs({
      pathDirs: ['C:\\WinGet\\Links'],
      files: {},
      links: { [WINGET_LINK]: WINGET_REAL },
      unfollowable: [WINGET_LINK],
    });
    const r = resolveBinary(probes, { names: ['ffmpeg.exe'] });
    expect(isResolved(r)).toBe(false);
    if (!isResolved(r)) expect(r.inspected).toContain(WINGET_LINK);
  });

  it('falls back to a known install directory when PATH is unusable', () => {
    const probes = fakeFs({
      pathDirs: ['C:\\WinGet\\Links'],
      files: { [WINGET_REAL]: 180_000 },
      links: { [WINGET_LINK]: WINGET_REAL },
      unfollowable: [WINGET_LINK],
    });
    const r = resolveBinary(probes, {
      names: ['ffmpeg.exe'],
      extraDirs: ['C:\\WinGet\\Packages\\Gyan.FFmpeg\\bin'],
    });
    expect(isResolved(r)).toBe(true);
    if (isResolved(r)) {
      expect(r.path).toBe(WINGET_REAL);
      expect(r.via).toBe('extra-dir');
    }
  });
});

describe('resolveBinary — the python / MetaTrader5 defect', () => {
  const VENV = 'C:\\hermes\\venv\\Scripts\\python.exe';
  const REAL = 'C:\\Programs\\Python312\\python.exe';

  const probes = fakeFs({
    // PATH order is exactly the broken one: venv first.
    pathDirs: ['C:\\hermes\\venv\\Scripts', 'C:\\Programs\\Python312'],
    files: { [VENV]: 250_000, [REAL]: 250_000 },
  });

  it('takes the first PATH hit when no requirement is given', () => {
    const r = resolveBinary(probes, { names: ['python.exe'] });
    expect(isResolved(r)).toBe(true);
    if (isResolved(r)) expect(r.path).toBe(VENV);
  });

  it('skips an interpreter that cannot satisfy the requirement', () => {
    // The whole point: PATH order must not decide which interpreter is used.
    const r = resolveBinary(probes, {
      names: ['python.exe'],
      verify: (p) => p === REAL, // stands in for "can import MetaTrader5"
    });
    expect(isResolved(r)).toBe(true);
    if (isResolved(r)) expect(r.path).toBe(REAL);
  });

  it('reports failure with the candidates it inspected when nothing qualifies', () => {
    const r = resolveBinary(probes, { names: ['python.exe'], verify: () => false });
    expect(isResolved(r)).toBe(false);
    if (!isResolved(r)) {
      expect(r.inspected).toEqual([VENV, REAL]);
      expect(r.detail).toMatch(/Anforderung/);
    }
  });
});

describe('resolveBinary — overrides', () => {
  const OVERRIDE = 'D:\\tools\\ffmpeg\\ffmpeg.exe';

  it('prefers a valid operator override over anything on PATH', () => {
    const probes = fakeFs({
      pathDirs: ['C:\\bin'],
      files: { 'C:\\bin\\ffmpeg.exe': 100, [OVERRIDE]: 180_000 },
    });
    const r = resolveBinary(probes, { names: ['ffmpeg.exe'] }, OVERRIDE);
    expect(isResolved(r)).toBe(true);
    if (isResolved(r)) {
      expect(r.path).toBe(OVERRIDE);
      expect(r.via).toBe('override');
    }
  });

  it('falls through to discovery when the override is stale', () => {
    // A saved path that no longer exists must not disable the feature.
    const probes = fakeFs({ pathDirs: ['C:\\bin'], files: { 'C:\\bin\\ffmpeg.exe': 180_000 } });
    const r = resolveBinary(probes, { names: ['ffmpeg.exe'] }, 'D:\\gone\\ffmpeg.exe');
    expect(isResolved(r)).toBe(true);
    if (isResolved(r)) {
      expect(r.path).toBe('C:\\bin\\ffmpeg.exe');
      expect(r.via).toBe('path');
    }
  });

  it('tries every candidate name per directory', () => {
    const probes = fakeFs({ pathDirs: ['C:\\bin'], files: { 'C:\\bin\\python3.exe': 250_000 } });
    const r = resolveBinary(probes, { names: ['python.exe', 'python3.exe'] });
    expect(isResolved(r)).toBe(true);
    if (isResolved(r)) expect(r.path).toBe('C:\\bin\\python3.exe');
  });

  it('ignores empty PATH entries without crashing', () => {
    const probes = fakeFs({ pathDirs: ['', 'C:\\bin', ''], files: { 'C:\\bin\\ffmpeg.exe': 180_000 } });
    const r = resolveBinary(probes, { names: ['ffmpeg.exe'] });
    expect(isResolved(r)).toBe(true);
  });

  it('reports a clean failure for an empty PATH', () => {
    const probes = fakeFs({ pathDirs: [], files: {} });
    const r = resolveBinary(probes, { names: ['ffmpeg.exe'] });
    expect(isResolved(r)).toBe(false);
    if (!isResolved(r)) expect(r.inspected).toEqual([]);
  });
});
