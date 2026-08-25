# Scorecard — 12 von 10 (independent measurement)

> Reconcile pass · 2026-08-25 · workspace `G:\JAvis og rn` · commit after D4–D8 lock ship  
> Rule from [`PLAN-12-VON-10.md`](./PLAN-12-VON-10.md): **10 = property achieved. 12 = property machine-enforced (lock fails the build).**  
> Formula: **overall % = sum(D1…D8) / 96 × 100**.

## `pnpm verify` (this pass)

| Field                          | Value                                                                                                                                                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command                        | `VERIFY_E2E=1 VERIFY_EVAL=1 JARVIS_E2E_STUB=1 pnpm verify`                                                                                                                                                                                          |
| Result                         | **exit 0** — doctor, secrets, audit-gate, eslint, lint:hex, tsc×2, gen:ipc --check, test:security, cov+ratchet, depcruise, check:size, honesty --fail, eval-score-gate (≥70 → 76.4), optional packaged smokes, playwright **golden-five stubs** 6/6 |
| Default `pnpm verify` (no env) | Same required chain **except** eval-score-gate and playwright are **SKIP** unless `VERIFY_EVAL=1` / `VERIFY_E2E=1`                                                                                                                                  |

Branch protection on private `main`: **HTTP 403** (GitHub Pro / public required) — confirmed via `gh api …/branches/main/protection`.

---

## D1–D8 scores (honest /12)

| D      | Dimension           |  Score | Evidence (fails build / proven)                                                                                                                                                                    | Why not higher                                                                                                                                                       |
| ------ | ------------------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Projekthygiene      | **12** | `doctor --tree` hard-deny `.compare`/`_compare`/`*.bak*`; `--self-test` fixtures; husky pre-commit; CI Doctor steps; in `pnpm verify`                                                              | —                                                                                                                                                                    |
| **D2** | Sicherheit          | **11** | Threat-model proofs; allowlist fuzz ≥10k (`command-allowlist.fuzz.test.ts`); `scan-secrets --fail-on-new`; `audit-gate`; `pnpm test:security` in verify+CI; `fast-check` restored as direct devDep | `electronegativity` missing / CI `\|\| true`; 32 high/critical **waived** not fixed                                                                                  |
| **D3** | Testzustand         | **11** | Coverage ratchet in verify+CI; flaky job ×3; Stryker break-70 (3-file **76.40**; 5-module **61.03** recorded, floor not lowered); PR template                                                      | **Branch protection 403** — cannot require `verify` on private repo without Pro/public                                                                               |
| **D4** | Testabdeckung / IPC | **11** | `scripts/gen-ipc.mjs --check` in verify (129 channels, handler + preloadKey ironclad); generated IPC.md + preload map/invokes                                                                      | Full `preload.ts` + `global.d.ts` still hand-maintained — not pure single-source codegen (PLAN 12)                                                                   |
| **D5** | Datenehrlichkeit    | **11** | `Sourced` + `<Value>`; `honesty-report.mjs --fail` in verify (fabricated-money / bare agent-count fail)                                                                                            | No compiler/ESLint ban making every bare screen number a type error; 53 advisory warns remain                                                                        |
| **D6** | Architektur         | **11** | `.dependency-cruiser.cjs` + `pnpm depcruise` in verify; `check-file-size.mjs` + `.file-size-budget.json` fail on overrun                                                                           | Watch ceilings still document monoliths (`main` 1710/1800, `TradingContent` 2768/2900) — not a hard 600-line budget                                                  |
| **D7** | Auslieferreife      | **10** | `release.yml` on `v*`; installer dry-run always; `REQUIRE_SIGNED=1` → exit 1 without `CSC_LINK` (proven); Authenticode reject when `CSC_LINK` set; SBOM + checksums                                | No OV/`CSC_LINK` on a real tag; full installer smoke soft unless `VERIFY_INSTALLER=1`; PLAN 12 (“signed + auto-accepted”) not met — **not 12 for “mechanism alone”** |
| **D8** | UI / Produkt        | **10** | `lint-no-hex.mjs` in default verify; e2e a11y/perf/visual/golden-five present; `VERIFY_E2E=1` runs stub golden-five as blocking                                                                    | Default verify **SKIPS** Playwright; stub suite is not axe/perf budgets; CI does not set `VERIFY_E2E=1` — **not 11/12**                                              |

**Sum:** 12+11+11+11+11+11+10+10 = **87**  
**Overall % toward 12/10:** 87 / 96 × 100 = **90.625%** → report **~91%**

Agent claims of D4–D6 = 12 and D7 = 12 / D8 = 11 over-credit optional or incomplete PLAN teeth. This card scores only locks that fail `pnpm verify` / hard CI (or a proven red exit), not aspirational wiring.

---

## Claim vs measured

| D   |  Agent claim | Prior scorekeeper | This pass |
| --- | -----------: | ----------------: | --------: |
| D1  |           12 |                11 |    **12** |
| D2  |           12 |                10 |    **11** |
| D3  |  11 (BP 403) |                10 |    **11** |
| D4  |           12 |                10 |    **11** |
| D5  |           12 |                 9 |    **11** |
| D6  |           12 |                10 |    **11** |
| D7  | 12 mechanism |              9–10 |    **10** |
| D8  |           11 |                 9 |    **10** |

---

## What still blocks 100% (12 on every D)

1. **D3:** GitHub Pro or public repo → apply [`BRANCH-PROTECTION.md`](./BRANCH-PROTECTION.md) requiring check `verify`.
2. **D2:** Install + block `electronegativity`; shrink `.audit-exceptions.json`.
3. **D4:** Generate full preload + `global.d.ts` from registry (no hand drift).
4. **D5:** ESLint/compiler: bare metrics in `src/screens/**` must be `Sourced` / `<Value>`.
5. **D6:** Lower `.file-size-budget.json` toward 600 and finish splits.
6. **D7:** Zac OV (`CSC_LINK`) + blocking `VERIFY_INSTALLER=1` on a real `v*` release.
7. **D8:** Make axe/perf/visual fail **default** CI/`pnpm verify` (not stub-only under optional `VERIFY_E2E`).

---

## README Fertigstellungsgrad

Updated to **~91%** (87/96).

### Verify footer (reconcile)

```
VERIFY_E2E=1 VERIFY_EVAL=1 JARVIS_E2E_STUB=1 pnpm verify → exit 0
  doctor --tree + --self-test · secrets --fail-on-new · audit-gate · eslint
  lint:hex · tsc×2 · gen:ipc --check · test:security · test:cov · coverage-ratchet
  depcruise · check:size · honesty --fail · eval-score-gate (76.4)
  packaged/connections optional · playwright golden-five stubs 6/6
```
