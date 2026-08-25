// @ts-nocheck
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { resolveBinary, isResolved, type BinaryProbes, type ResolveResult } from './resolve-binary';

/**
 * Concrete binary lookups for the external tools JARVIS spawns.
 *
 * The selection logic lives in `resolve-binary.ts` (pure, unit-tested); this
 * file only supplies the real filesystem and the platform-specific search hints,
 * and caches the answer for the process lifetime.
 */

const probes: BinaryProbes = {
  pathDirs: () => (process.env.PATH ?? '').split(path.delimiter),
  join: (dir, name) => path.join(dir, name),
  exists: (p) => {
    try {
      // lstatSync, not existsSync: a broken symlink must register as "there but
      // unusable" so the caller can move on to the next candidate.
      fs.lstatSync(p);
      return true;
    } catch {
      return false;
    }
  },
  realpath: (p) => fs.realpathSync.native(p),
  size: (p) => {
    try {
      return fs.statSync(p).size;
    } catch {
      return 0;
    }
  },
};

const isWin = process.platform === 'win32';

function home(): string {
  return os.homedir();
}

/** Known install locations that are frequently absent from PATH. */
function ffmpegExtraDirs(): string[] {
  if (!isWin) return ['/usr/bin', '/usr/local/bin', '/opt/homebrew/bin'];
  const local = path.join(home(), 'AppData', 'Local');
  const dirs: string[] = [];
  // WinGet installs the real binary under Packages and only symlinks it into
  // Links — the symlink is exactly what fails to spawn, so search the package
  // directory directly.
  const pkgRoot = path.join(local, 'Microsoft', 'WinGet', 'Packages');
  try {
    for (const entry of fs.readdirSync(pkgRoot)) {
      if (!/ffmpeg/i.test(entry)) continue;
      const base = path.join(pkgRoot, entry);
      dirs.push(base, path.join(base, 'bin'));
      // Gyan builds nest one more level: ffmpeg-<version>-full_build/bin
      try {
        for (const sub of fs.readdirSync(base)) {
          if (/^ffmpeg-/i.test(sub)) dirs.push(path.join(base, sub, 'bin'));
        }
      } catch {
        /* not a directory */
      }
    }
  } catch {
    /* no WinGet packages */
  }
  dirs.push(
    'C:\\ffmpeg\\bin',
    path.join(local, 'Programs', 'ffmpeg', 'bin'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'ffmpeg', 'bin'),
  );
  return dirs;
}

function pythonExtraDirs(): string[] {
  if (!isWin) return ['/usr/bin', '/usr/local/bin'];
  const local = path.join(home(), 'AppData', 'Local');
  const dirs: string[] = [];
  const programs = path.join(local, 'Programs', 'Python');
  try {
    for (const entry of fs.readdirSync(programs)) dirs.push(path.join(programs, entry));
  } catch {
    /* no per-user Python */
  }
  for (const v of ['313', '312', '311', '310']) {
    dirs.push(`C:\\Python${v}`, path.join(process.env.ProgramFiles ?? 'C:\\Program Files', `Python${v}`));
  }
  return dirs;
}

let ffmpegCache: ResolveResult | null = null;
let pythonCache: ResolveResult | null = null;
const moduleCache = new Map<string, ResolveResult>();

/**
 * ffmpeg, resolved past the WinGet symlink.
 *
 * `override` comes from the encrypted config (`FFMPEG_PATH`) so an operator with
 * a custom build can point at it without touching PATH.
 */
export function resolveFfmpeg(override?: string): ResolveResult {
  if (ffmpegCache && isResolved(ffmpegCache)) return ffmpegCache;
  ffmpegCache = resolveBinary(
    probes,
    { names: isWin ? ['ffmpeg.exe'] : ['ffmpeg'], extraDirs: ffmpegExtraDirs() },
    override,
  );
  return ffmpegCache;
}

/** Any Python interpreter, no module requirement. */
export function resolvePython(override?: string): ResolveResult {
  if (pythonCache && isResolved(pythonCache)) return pythonCache;
  pythonCache = resolveBinary(
    probes,
    {
      names: isWin ? ['python.exe', 'python3.exe'] : ['python3', 'python'],
      extraDirs: pythonExtraDirs(),
    },
    override,
  );
  return pythonCache;
}

/**
 * A Python interpreter that can actually import `moduleName`.
 *
 * PATH order is not a statement about capability: on this machine the first
 * `python` is an unrelated virtualenv with no `MetaTrader5`, while the
 * interpreter that has it sits further down. Spawning the first hit guaranteed a
 * bridge that could never work, with no error pointing at the cause.
 */
export function resolvePythonWithModule(moduleName: string, override?: string): ResolveResult {
  const cached = moduleCache.get(moduleName);
  if (cached && isResolved(cached)) return cached;
  const result = resolveBinary(
    probes,
    {
      names: isWin ? ['python.exe', 'python3.exe'] : ['python3', 'python'],
      extraDirs: pythonExtraDirs(),
      verify: (candidate) => {
        try {
          const r = spawnSync(candidate, ['-c', `import ${moduleName}`], {
            windowsHide: true,
            timeout: 12_000,
            stdio: 'ignore',
          });
          return r.status === 0;
        } catch {
          return false;
        }
      },
    },
    override,
  );
  moduleCache.set(moduleName, result);
  return result;
}

/** Diagnostics for the self-test panel. */
export function binaryDiagnostics(): {
  ffmpeg: { ok: boolean; detail: string };
  python: { ok: boolean; detail: string };
  pythonMt5: { ok: boolean; detail: string };
} {
  const f = resolveFfmpeg();
  const p = resolvePython();
  const m = resolvePythonWithModule('MetaTrader5');
  return {
    ffmpeg: { ok: isResolved(f), detail: f.detail },
    python: { ok: isResolved(p), detail: p.detail },
    pythonMt5: { ok: isResolved(m), detail: m.detail },
  };
}

/** Drops cached lookups so a freshly installed tool is picked up without restart. */
export function clearBinaryCache(): void {
  ffmpegCache = null;
  pythonCache = null;
  moduleCache.clear();
}
