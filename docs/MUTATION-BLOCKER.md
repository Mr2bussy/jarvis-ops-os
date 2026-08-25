# Mutation testing (D3)

**Date:** 2026-08-25  
**Status:** Score gate **met** on the calibrated 3-file set; full 5-module set is configured and should be re-measured after allowlist/quant test expansion.

## What is installed

- `devDependencies`: `@stryker-mutator/core`, `@vitest-mutator/vitest-runner` → `@stryker-mutator/vitest-runner`
- Config: `stryker.config.json` — **full 5-module money/security set**
- Focused Vitest surface: `vitest.mutation.config.ts`
- Script: `pnpm test:mutation`
- `thresholds.break: 70` (irreversible)

## Mutate set (PLAN D3)

```
electron/security/command-allowlist.ts
electron/harness/governance/risk-gate.ts
src/lib/quant.ts
src/lib/prop-accounts.ts
src/lib/trading-math.ts
```

## Prior measured scores

| Scope                                             | Score     | Notes                                               |
| ------------------------------------------------- | --------- | --------------------------------------------------- |
| 3-file (risk-gate + prop-accounts + trading-math) | **76.40** | exit 0, break 70                                    |
| Full 5-file (earlier)                             | **57.56** | allowlist ~34%, quant ~46% dragged overall under 70 |

Allowlist unit + threat + fuzz coverage was expanded in the D1–D3 lock session; re-run `pnpm test:mutation` to refresh the 5-module score. Keep `break: 70` — do not lower the threshold to greenwash.

## Windows notes

1. `vitest.mutation.config.ts` — related test files only; `pool: 'forks'`
2. `vitest.related: false`
3. `tempDirName: "stryker-tmp"` same drive; `inPlace: false`
4. `symlinkNodeModules: true`

## Operator

```bash
pnpm test:mutation
# report: reports/mutation/mutation.html
```
