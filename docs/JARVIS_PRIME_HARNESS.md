# JARVIS Prime Harness — Implementation Status

> Benchmark matrix: `docs/HARNESS_BENCHMARK_MATRIX.md` · Baseline: `benchmarks/BASELINE.md`

## Architecture

```
electron/harness/     Agent loop, continual/refine, memory, governance, eval
electron/gateway/     Hermes Router (omnichannel rebrand)
electron/activity-ring.ts
```

## Hermes Router (= Omnichannel Gateway)

Same project pattern as Hermes messaging gateway, rebranded **hermes-router** for JARVIS.

| Platform       | Inbound                   | Outbound                    |
| -------------- | ------------------------- | --------------------------- |
| Telegram       | getUpdates poll → harness | sendMessage                 |
| Discord        | —                         | channel messages            |
| Slack          | —                         | incoming webhook            |
| Cron/Workflows | —                         | deliver after scheduled LLM |

UI: Sidebar **Hermes Router** · IPC: `gateway:*` · Config: `userData/gateway/config.json`

## Commands

```bash
pnpm test
pnpm bench:smoke
pnpm bench:weekly
pnpm bench:run
```

## Phase status — ALL COMPLETE

| Phase                   | Status |
| ----------------------- | ------ |
| 0 Rules + bench         | Done   |
| 1 Pi-pattern loop       | Done   |
| 2 Continual + refine    | Done   |
| 3 Memory + skills       | Done   |
| 4 Swarm router          | Done   |
| 5 Tools + HITL modal    | Done   |
| 6 Hermes Router gateway | Done   |
| 7 Weekly eval + critic  | Done   |

## Verified

- `pnpm test` — **113** tests (harness + gateway + weekly report)
- `pnpm bench:smoke` — G07–G17 smoke
- `pnpm bench:weekly` — full loop → `docs/benchmarks/WEEKLY-<date>.md`
- Weekly cron: Monday 06:00 UTC in main process
