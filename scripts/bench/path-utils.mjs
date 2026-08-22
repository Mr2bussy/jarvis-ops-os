import path from 'node:path';

/** Resolve bench output dir from env (preferred) or --out= flag — safe for paths with spaces. */
export function resolveOutDir(root, fallbackName) {
  if (process.env.BENCH_OUT_DIR) {
    return path.resolve(process.env.BENCH_OUT_DIR);
  }
  const hit = process.argv.find((a) => a.startsWith('--out='));
  if (hit) return path.resolve(hit.slice('--out='.length));
  return path.join(root, 'benchmarks', 'runs', fallbackName ?? new Date().toISOString().slice(0, 10));
}

/** Resolve run dir for critic from env, positional argv, or --run= flag. */
export function resolveRunDir() {
  if (process.env.BENCH_RUN_DIR) {
    return path.resolve(process.env.BENCH_RUN_DIR);
  }
  if (process.argv[2] && !process.argv[2].startsWith('--')) {
    return path.resolve(process.argv[2]);
  }
  const hit = process.argv.find((a) => a.startsWith('--run='));
  if (hit) return path.resolve(hit.slice('--run='.length));
  return null;
}
