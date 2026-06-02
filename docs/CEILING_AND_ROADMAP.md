# Strict Ceiling Analysis & Roadmap — the remaining 4 dimensions

> Brutally honest answer to: _"how far can we realistically push these to 9/10?"_
> Legend: 🟢 I can do it here, fully verified (typecheck/test/build/lint) ·
> 🟡 doable here but partly unverifiable (needs an app launch) · 🧱 **hard wall —
> needs YOU** (money, a certificate, a VM, or a multi-day human effort).

## TL;DR — the uncomfortable truth

| Dimension       | Now | **Realistic ceiling I can verify here** | True 9/10 also needs                                            |
| --------------- | --- | --------------------------------------- | --------------------------------------------------------------- |
| 🏛 Architecture | 8.5 | **9** 🟢                                | nothing external — pure mechanical work                         |
| 🛠 Code Quality | 8   | **9** 🟢                                | nothing external — but it's the most _laborious_ (10 god-files) |
| 🧪 Tests        | 5   | **8, maybe 9** 🟡                       | E2E that may not run headless in this sandbox                   |
| 📦 Distribution | 4   | **6 (hard cap)** 🧱                     | a code-signing cert + a clean VM — **impossible without you**   |

**So: 2 of 4 reach a real 9 by me. Tests lands ~8 (9 is borderline). Distribution
is walled at ~6 — 9 is literally not a coding problem.**

---

## 🏛 Architecture — ceiling **9** 🟢 (achievable, ~2 sessions)

9/10 DoD: no `(window as any).jarvisBridge`; typed IPC client; state store; clean modules.

| Step | What                                                                                                                                    | Verifiable?                           | Effort |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| A1   | `src/lib/bridge.ts` typed wrapper + `hasBridge()`; migrate **all 17** `(window as any).jarvisBridge` sites (System 9 · App 4 · Admin 4) | 🟢 tsc/build                          | M      |
| A2   | `src/store.ts` (zustand): move `screen`, `state`, `diag`, config flags out of `App.tsx` prop-drilling                                   | 🟡 tsc/build (runtime = launch smoke) | M      |
| A3   | Finish `main.ts` module split (`config/`, `system/`, `apps/`, `trading/`, `scheduler/`)                                                 | 🟢 tsc/build                          | L      |

**Verdict: a genuine 9 is reachable here.** A2 carries minor runtime risk (state migration) that wants one launch smoke-test, but it's mechanical and type-safe.

---

## 🛠 Code Quality — ceiling **9** 🟢 (achievable but the heaviest lift, ~3–4 sessions)

9/10 DoD: 0 ESLint errors (✅ done) · Prettier enforced (✅) · **no file > 600 lines** (❌) · warnings ≈ 0.

The wall here is purely **labor**, not capability. Files > 600 lines:

```
TradingContent 3372 · Workflows 2349 · ContentModule 1398 · Arsenal 1303
Agents 1211 · main.ts ~1200 · trading-data 966 · CodeAnimation 810
Admin 808 · Bridge 754
```

| Step | What                                                                                                                                              | Verifiable?       | Effort |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------ |
| Q1   | Delete the `_*.py` generator scaffolding (dead weight)                                                                                            | 🟢                | S      |
| Q2   | Drive 61 ESLint **warnings → ~0** (unused vars, exhaustive-deps)                                                                                  | 🟢 lint           | M      |
| Q3   | **Component test net** (RTL + jsdom + mocked bridge) per god-screen BEFORE splitting                                                              | 🟢 vitest         | L      |
| Q4   | Split god-files behind the net: `TradingContent → GodModeTab/ZeusTab/MarketDataTab`, `Workflows → List/Editor/Schedule`, etc., one tab per commit | 🟢 tsc/test/build | XL     |

**Verdict: 9 is reachable here, but Q4 is the single biggest time sink in the whole project** (≈12k lines to reorganize). Realistic honest landing without weeks: **8.5–9**. The split MUST follow Q3 or it's blind refactoring.

---

## 🧪 Tests — ceiling **8 (realistic), 9 borderline** 🟡 (~2–3 sessions)

9/10 DoD: **≥80% lines across `src/lib` + `electron` non-UI** + **≥1 E2E smoke**.

| Step | What                                                                                                                                                                                          | Verifiable?                                                               | Effort |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| T1   | Refactor `main.ts` handlers into modules (shared with A3/Q4), then unit-test them with `vi.mock('electron')` + mocked `fetch` (config round-trip, provider routing, apps registry, scheduler) | 🟢 vitest                                                                 | L      |
| T2   | `renderHook` tests for `trading-data.ts` hooks + `claude.ts` workflow fns (mocked bridge, fake timers)                                                                                        | 🟢 vitest                                                                 | M      |
| T3   | Raise `coverage.include` to all of `src/lib` + `electron/**` non-UI; lift threshold to 80%                                                                                                    | 🟢                                                                        | S      |
| T4   | **E2E smoke** (Playwright `_electron.launch`) — click every screen, assert 0 console errors                                                                                                   | 🧱/🟡 **may not run headless in this sandbox** (Electron needs a display) | M      |

**Verdict — strict:** T1–T3 are real and get unit/integration coverage to ~80% → **a solid 8**. The **9 hinges on T4 (E2E)**, and E2E launching a full Electron app in this sandbox is _uncertain_ (no display/GPU). If it runs → 9. If not → it's a task for your machine. I won't claim 9 I can't prove.

---

## 📦 Distribution — ceiling **6 (HARD CAP)** 🧱 — 9 is NOT a coding problem

9/10 DoD: **signed** installer from CI · auto-update · bridge without Python · **clean-VM verified**.

| Step | What                                                                              | Who                                                                    |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1   | CI workflow (lint/typecheck/test/build)                                           | 🟢 **done**                                                            |
| D2   | `electron-updater` wiring + `release.yml` (publish on tag)                        | 🟢 config only — I can write it                                        |
| D3   | **PyInstaller** `bridge.exe` + `spawn('bridge.exe')` + bundle as `extraResources` | 🟡 I can _build & smoke-test_ the exe here (removes the Python prereq) |
| D4   | **Code signing** (Authenticode cert)                                              | 🧱 **YOU** — buy an OV/EV cert (~€200–500/yr, identity check, days)    |
| D5   | **Clean Windows VM** install + smoke checklist                                    | 🧱 **YOU** — no VM exists in this sandbox                              |
| D6   | Auto-update verified end-to-end (real GitHub release + signature)                 | 🧱 needs D4 + a published release                                      |

**Verdict — strict:** I can take Distribution to **~6** (CI + updater config + a working bundled `bridge.exe`). **Reaching 9 is impossible without you** doing D4+D5: an unsigned installer triggers SmartScreen "unknown publisher", which by definition is not a 9/10 distribution. No amount of my effort changes that.

---

## Recommended execution order (max ROI, strict)

```
1. main.ts decomposition         → feeds Architecture(A3) + Code Quality(Q) + Tests(T1)   [the keystone]
2. Typed IPC wrapper (A1)         → Architecture quick win, unblocks clean tests
3. Handler/lib unit tests (T1/T2) → Tests → 80%
4. Component test net (Q3)        → safety for the god-split
5. God-file split (Q4)           → Code Quality → 9   [the marathon]
6. zustand store (A2)             → Architecture → 9
7. Warnings → 0 (Q2), delete _*.py (Q1)
8. PyInstaller bridge.exe (D3) + updater config (D2)
9. Attempt Playwright E2E (T4)    → if it runs, Tests → 9
—— HARD WALL ——
10. YOU: code-signing cert (D4) + clean-VM test (D5) → Distribution → 9
```

## Honest landing if we execute steps 1–9 (everything I _can_ do, verified)

| Dimension       | Realistic result                                                   |
| --------------- | ------------------------------------------------------------------ |
| 🏛 Architecture | **9**                                                              |
| 🛠 Code Quality | **9** (8.5 if the god-split is only partial)                       |
| 🧪 Tests        | **8** unit/integration; **9** only if E2E runs in this environment |
| 📦 Distribution | **6** — then frozen until you provide cert + VM                    |

**Bottom line:** with sustained work I can get Architecture and Code Quality to a real **9**,
Tests to a **strong 8** (9 contingent on E2E), and Distribution to **6** — the last
three points of Distribution are yours to unlock, not mine.
