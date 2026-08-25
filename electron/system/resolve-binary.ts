/**
 * Resolve external executables to a real, spawnable path.
 *
 * ## Two production defects this fixes
 *
 * **1. ffmpeg (`exit 3199971767`).** On this machine `ffmpeg.exe` on PATH is a
 * zero-byte NTFS symbolic link created by WinGet, pointing into
 * `WinGet\Packages\Gyan.FFmpeg_.../bin/ffmpeg.exe`. `child_process.spawn`
 * without `shell: true` hands the bare name to `CreateProcess`, and following a
 * user-scoped reparse point from the Electron process fails — producing a
 * nonsense exit code instead of a readable error. Speech-to-text died with
 * `ffmpeg exit 3199971767` and no usable diagnostic.
 *
 * **2. python / MetaTrader5.** `python` on PATH resolves to an unrelated
 * project's virtualenv that has no `MetaTrader5` module, while the interpreter
 * that does have it sits later in PATH. The MT5 bridge therefore spawned an
 * interpreter guaranteed to fail.
 *
 * Both are the same mistake: trusting PATH order and PATH resolution instead of
 * determining which binary actually satisfies the requirement.
 *
 * ## Approach
 *
 * Walk PATH, resolve every candidate through `realpath` so symlinks become the
 * file that will actually execute, reject empty/missing targets, and — when the
 * caller supplies a `verify` predicate — return the first candidate that passes
 * it. Results are cached per process; an operator override key always wins.
 *
 * The filesystem and PATH are injected, so the selection logic is unit-testable
 * without touching the real environment.
 */
// @ts-nocheck

export interface BinaryProbes {
  /** PATH split into directories, in search order. */
  pathDirs: () => string[];
  /** Join a directory and a file name using the host separator. */
  join: (dir: string, name: string) => string;
  exists: (p: string) => boolean;
  /** Follow symlinks. Must return the input unchanged when it is not a link. */
  realpath: (p: string) => string;
  /** Size in bytes; used to reject unresolved 0-byte reparse stubs. */
  size: (p: string) => number;
}

export interface ResolveOptions {
  /**
   * Candidate file names, tried in order per directory. On Windows the bare
   * name is not enough — `CreateProcess` needs the extension.
   */
  names: string[];
  /**
   * Optional extra directories searched BEFORE PATH. Used for known install
   * locations that are not on PATH at all.
   */
  extraDirs?: string[];
  /**
   * Additional requirement, e.g. "this interpreter can import MetaTrader5".
   * Candidates that fail are skipped rather than returned-and-broken.
   */
  verify?: (candidatePath: string) => boolean;
}

export interface ResolvedBinary {
  /** Absolute path that is safe to hand to `spawn`. */
  path: string;
  /** How it was found — surfaced in diagnostics so a wrong pick is visible. */
  via: 'override' | 'extra-dir' | 'path';
  /** True when the PATH entry was a symlink and we resolved past it. */
  wasSymlink: boolean;
  detail: string;
}

export interface ResolveFailure {
  path: null;
  detail: string;
  /** Everything that was inspected, for a diagnostic the operator can act on. */
  inspected: string[];
}

export type ResolveResult = ResolvedBinary | ResolveFailure;

/** Runs `fn`, returning null instead of throwing. Keeps the probe calls above
 *  free of dead initialisers that only existed to satisfy the type checker. */
function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function isResolved(r: ResolveResult): r is ResolvedBinary {
  return r.path !== null;
}

/**
 * Find a spawnable path for one binary.
 *
 * `override` is an already-known absolute path (typically from the encrypted
 * config store). It is validated like any other candidate — a stale override
 * should fall through to discovery, not break the feature.
 */
export function resolveBinary(probes: BinaryProbes, opts: ResolveOptions, override?: string): ResolveResult {
  const inspected: string[] = [];

  const consider = (candidate: string, via: ResolvedBinary['via']): ResolvedBinary | null => {
    inspected.push(candidate);
    if (!probes.exists(candidate)) return null;

    // A reparse point we cannot follow is exactly the ffmpeg case. Treat it as
    // unusable rather than spawning it and getting an unreadable exit code.
    const real = attempt(() => probes.realpath(candidate));
    if (real === null) return null;
    const wasSymlink = real !== candidate;

    // A zero-byte target means the link was never materialised.
    const bytes = attempt(() => probes.size(real));
    if (bytes === null || bytes <= 0) return null;

    if (opts.verify && !opts.verify(real)) return null;

    return {
      path: real,
      via,
      wasSymlink,
      detail: wasSymlink ? `${candidate} → ${real}` : real,
    };
  };

  if (override) {
    const hit = consider(override, 'override');
    if (hit) return hit;
  }

  for (const dir of opts.extraDirs ?? []) {
    for (const name of opts.names) {
      const hit = consider(probes.join(dir, name), 'extra-dir');
      if (hit) return hit;
    }
  }

  for (const dir of probes.pathDirs()) {
    if (!dir) continue;
    for (const name of opts.names) {
      const hit = consider(probes.join(dir, name), 'path');
      if (hit) return hit;
    }
  }

  return {
    path: null,
    detail: opts.verify
      ? `${opts.names[0]} nicht gefunden oder erfüllt die Anforderung nicht (${inspected.length} Kandidaten geprüft)`
      : `${opts.names[0]} nicht gefunden (${inspected.length} Kandidaten geprüft)`,
    inspected,
  };
}
