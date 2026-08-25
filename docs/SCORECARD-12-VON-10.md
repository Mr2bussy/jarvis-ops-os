# Scorecard — 12 von 10 (independent measurement)

> Independent reconcile · 2026-08-25 · workspace `G:\JAvis og rn`  
> Rule from [`PLAN-12-VON-10.md`](./PLAN-12-VON-10.md): **10 = property achieved. 12 = property machine-enforced (lock fails the build).**  
> Formula: **overall % = sum(D1…D8) / 96 × 100**.

## `pnpm verify` (measured this pass)

| Field                          | Value                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Command                        | `VERIFY_E2E=1 VERIFY_EVAL=1 JARVIS_E2E_STUB=1 pnpm verify`                                                 |
| Result                         | **exit 0** (2026-08-25)                                                                                    |
| Default `pnpm verify` (no env) | Required chain green; playwright SKIP unless `VERIFY_E2E=1`. **CI sets `VERIFY_E2E=1`**.                   |
| Coverage floor                 | **97.33%** lines/statements after fill tests (ratchet raised)                                              |
| Branch protection              | **HTTP 403** on private free tier (`gh api` + `scripts/check-branch-protection.mjs`) — Pro/public required |

Gates observed green: doctor (--tree + --self-test) · secrets --fail-on-new · audit-gate (38/38 waived) · electron-security-audit · eslint · lint:hex · tsc×2 · gen:ipc --check · test:security · cov+ratchet · depcruise · check:size · honesty --fail · check-kpi · branch-protection warn · eval-score-gate (76.4≥70) · playwright golden-five **8/8**.

---

## D1–D8 scores (honest /12)

| D      | Dimension           |  Score | Evidence (fails build / proven)                                                                                                                              | Why not higher                                                                                        |
| ------ | ------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **D1** | Projekthygiene      | **12** | `doctor --tree` hard-deny (`.compare`/`_compare`/`*.bak*`); `--self-test`; husky; CI Doctor; in `pnpm verify`                                                | —                                                                                                     |
| **D2** | Sicherheit          | **12** | Threat-model proofs · allowlist fuzz ≥10k · secrets --fail-on-new · audit-gate · `test:security` · **electron-security-audit blocking** (CSP/webPreferences) | 38 high/critical **waived** (not fixed); Electronegativity CLI broken → documented static substitute  |
| **D3** | Testzustand         | **11** | Coverage ratchet (floor **97.33%**) · flaky ×3 · Stryker break-70 · PR template · `check-branch-protection.mjs`                                              | **Branch protection / rulesets 403** — cannot require check `verify` on private free tier             |
| **D4** | Testabdeckung / IPC | **12** | `gen:ipc --check`: handlers ↔ registry ↔ preload invokes ↔ **`src/global.d.ts` leaf coverage** ↔ bridge-keys fingerprint                                     | Hand-shaped method signatures in `global.d.ts` remain; leaves are machine-locked                      |
| **D5** | Datenehrlichkeit    | **12** | `honesty-report --fail` · eslint `no-restricted-syntax` (fabricated `$1,234+` / bare agent-count) · `check-screen-kpi-literals` in verify                    | Not a TypeScript `Sourced<T>` compiler error; advisory em-dash warns remain                           |
| **D6** | Architektur         | **12** | depcruise · check:size · real splits (`register-apps`, GodModeTab, TerminalWidgets, StrategiesPanel, widget-registry) · ceilings ratcheted                   | `TerminalWidgets.tsx` still **3169/3200** — gate holds ceiling, not absolute 600-line ideal           |
| **D7** | Auslieferreife      | **10** | `release.yml` on `v*` · installer dry-run · `REQUIRE_SIGNED=1` rejects unsigned (proven) · SBOM + checksums                                                  | **No OV/`CSC_LINK`** on a real tag — mechanism ≠ signed+auto-accepted end-to-end                      |
| **D8** | UI / Produkt        | **11** | lint:hex in verify · CI `VERIFY_E2E=1` · golden-five **8/8** with page-load + first-paint on fixture shell                                                   | Budgets run against **stub HTML**, not full Electron axe/perf/visual (`JARVIS_E2E_STUB=0` still open) |

**Sum:** 12+12+11+12+12+12+10+11 = **92**  
**Overall % toward 12/10:** 92 / 96 × 100 = **95.833…%** → report **~96%**

---

## Claim check (agents vs this pass)

| D   | Agent claim | Prior scorekeeper |                           This pass |
| --- | ----------: | ----------------: | ----------------------------------: |
| D1  |          12 |             11→12 |                              **12** |
| D2  |          12 |             10→12 |                              **12** |
| D3  |          11 |                11 |                     **11** (BP 403) |
| D4  |          12 |             10→12 |                              **12** |
| D5  |          12 |              9→12 |                              **12** |
| D6  |          12 |             10→12 |                              **12** |
| D7  |    12 mech. |                10 |            **10** (no OV inventing) |
| D8  |          11 |              9→12 | **11** (stubs ≠ Electron a11y lock) |

Sibling 93/96 (~97%) over-credited **D8=12** while Playwright still stubs the real product shell. Independent pass keeps D8 at **11**.

---

## What still blocks 100% (96/96)

1. **D3:** GitHub Pro or public repo → apply [`BRANCH-PROTECTION.md`](./BRANCH-PROTECTION.md) requiring check `verify`.
2. **D7:** Zac OV certificate (`CSC_LINK`) + blocking signed installer on a real `v*` release.
3. **D8:** Green measured budgets under `JARVIS_E2E_STUB=0` (real Electron + axe/perf/visual).

---

## README Fertigstellungsgrad

Updated to **~96%** (92/96).

### Verify footer (this pass)

```
VERIFY_E2E=1 VERIFY_EVAL=1 JARVIS_E2E_STUB=1 pnpm verify → exit 0
  doctor · secrets · audit-gate · electron-security-audit · eslint (D5 syntax)
  lint:hex · tsc×2 · gen:ipc --check (global.d.ts) · test:security · cov+ratchet (97.33%)
  depcruise · check:size · honesty --fail · check-kpi · branch-protection warn
  eval-score-gate · playwright golden-five 8/8 (stub page-load + first-paint)
```
