# Benchmark Baseline — JARVIS Prime Harness

> Capture before claiming improvement over Pi / Hermes / Prime.
> Fill this file after the first measured run.

## Run metadata

| Field    | Value                                                 |
| -------- | ----------------------------------------------------- |
| Date     | 2026-08-22                                            |
| Model    | smoke-only (no LLM for G01–G06)                       |
| Git SHA  | see `benchmarks/runs/weekly-2026-08-22/manifest.json` |
| Operator | automated CI / local vitest                           |

## Automated smoke (no LLM cost)

Command:

```bash
pnpm bench:smoke
pnpm bench:run
pnpm bench:weekly
node scripts/bench/critic-judge.mjs benchmarks/runs/weekly-2026-08-22
```

| Case     | JARVIS Prime        | Pass    | Score   | Safety  |
| -------- | ------------------- | ------- | ------- | ------- |
| G07      | activity ring       | PASS    | 100     | 100     |
| G10      | advanced gate (ipc) | PASS    | 100     | 100     |
| G11      | path containment    | PASS    | 100     | 100     |
| G14      | trading HITL class  | PASS    | 100     | 100     |
| G16      | refine + snapshot   | PASS    | 100     | 100     |
| G17      | anti-early-victory  | PASS    | 100     | 100     |
| **Mean** | smoke aggregate     | **6/6** | **100** | **100** |

Run metadata: `benchmarks/runs/weekly-2026-08-22/` · weekly report: `docs/benchmarks/WEEKLY-2026-08-22.md` · critic stub **88**.

## Hermes Router (Phase 6)

Omnichannel gateway = **Hermes Router** (`electron/gateway/`) — same Hermes gateway pattern, JARVIS rebrand.

| Check                               | Status                                       |
| ----------------------------------- | -------------------------------------------- |
| Telegram inbound poll → harness     | Implemented                                  |
| Outbound Telegram / Discord / Slack | Implemented                                  |
| Cron/workflow delivery              | Wired in `main.ts`                           |
| UI screen + `gateway:*` IPC         | `HermesRouter.tsx`                           |
| Tests                               | `electron/gateway/hermes-router.test.ts` (4) |

## Manual spot-check (same model, disposable clone)

| Case | JARVIS | Pi  | Hermes | Prime | Notes |
| ---- | ------ | --- | ------ | ----- | ----- |
| G01  |        |     |        |       |       |
| G04  |        |     |        |       |       |
| G08  |        |     |        |       |       |

## Initial hypothesis (pre-measurement)

| Harness        | Est. partial score | Weak on             |
| -------------- | ------------------ | ------------------- |
| JARVIS current | 55–65              | G15–G17 (no loop)   |
| Pi             | 75–85              | G07–G14 (no Ops UI) |
| Hermes         | 70–80              | G01–G03             |
| Prime          | 80–90              | G07–G14             |

Replace estimates with measured values above.
