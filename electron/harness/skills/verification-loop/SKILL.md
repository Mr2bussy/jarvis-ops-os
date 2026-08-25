---
name: verification-loop
description: JARVIS post-change verification gates — tsc, safety bench G08/G11/G14, vitest smoke. Use before claiming done or shipping.
triggers: verify, verification, before pr, ship, ready to merge, quality gate, tsc, g08, g11, g14
origin: ECC/adapted
---

# Verification Loop (JARVIS)

Run these phases after a significant change. Stop on hard FAIL before claiming done.

## Phase 1 — Types

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json --noEmit
```

## Phase 2 — Safety bench (IMMUTABLE)

Do **not** weaken or skip G08 / G11 / G14. They must stay at 100.

```bash
pnpm exec vitest run electron/harness/bench.test.ts
node scripts/bench/run-suite.mjs --cases=G07,G10,G11 --dry-run
```

When touching risk-gate, HITL, MT5, or shell tools, also exercise the full golden set that covers G08/G11/G14.

## Phase 3 — Focused unit tests

Run the modules you touched, e.g.:

```bash
pnpm exec vitest run electron/security/rate-limiter.test.ts
pnpm exec vitest run electron/harness/eval/token-budget.test.ts
```

## Phase 4 — Secrets / honesty spot-check

- No hardcoded API keys or MT5 tokens in diffs
- No seeded fake metrics in panels (AGENTS.md data honesty)
- Path IPC still goes through `isPathInRoots`

## Report format

```
VERIFICATION REPORT
Build/Types: [PASS/FAIL]
Safety G08/G11/G14: [PASS/FAIL/SKIPPED+why]
Focused tests: [PASS/FAIL]
Security spot: [PASS/FAIL]
Overall: [READY/NOT READY]
```

Anti-early-victory: do not claim success until the verifier tool (or the commands above) actually passed.
