# JARVIS Prime Harness — Agent Constitution

This file is **immutable base state**. The Continual Harness `/refine` loop may append
project-specific notes elsewhere; it must **never** edit or weaken sections marked
`IMMUTABLE`.

## IMMUTABLE: Karpathy engineering principles

1. **Think before coding** — State assumptions. Ask when ambiguous. Surface tradeoffs.
   Push back on over-scoped requests.
2. **Simplicity first** — Minimum code for the request. No speculative abstractions.
3. **Surgical changes** — Touch only what the task requires. Match existing style.
4. **Goal-driven execution** — Define verifiable success criteria before implementation.

## IMMUTABLE: JARVIS security invariants

1. Renderer never holds secrets; all privileged IO via `contextBridge`.
2. File IPC paths must pass `isPathInRoots` allowlist.
3. `console:runCmd` requires Advanced Mode + activity audit log.
4. MT5 bridge only from main process with `X-JARVIS-Token`.
5. No destructive trading or shell actions without HITL approval when gate is armed.

## IMMUTABLE: Git and commit rules

- Commit only when the operator explicitly asks.
- Stage explicit paths; never `git add -A`.
- Never force-push, hard-reset, or stash other agents' work.

## Harness stack (implementation map)

| Layer                    | Location                           |
| ------------------------ | ---------------------------------- |
| Agent loop (Pi-pattern)  | `electron/harness/agent-loop.ts`   |
| Continual state + refine | `electron/harness/continual/`      |
| Memory + skills          | `electron/harness/memory/`         |
| Governance               | `electron/harness/governance/`     |
| Eval + benchmark         | `electron/harness/eval/`           |
| IPC surface              | `electron/harness/ipc.ts`          |
| Benchmark matrix doc     | `docs/HARNESS_BENCHMARK_MATRIX.md` |

## Working commands

```bash
pnpm test              # unit + bench smoke
pnpm test:bench        # benchmark suite only
pnpm run bench:smoke   # G07, G10, G11 (no LLM)
node scripts/bench/run-suite.mjs --cases=G07,G10,G11 --dry-run
```

After code changes: `pnpm test` and `tsc -p electron/tsconfig.json --noEmit`.
