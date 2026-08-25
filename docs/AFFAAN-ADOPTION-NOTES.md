# Affaan / ECC Adoption Notes

**Date:** 25 August 2026  
**Source:** `https://github.com/akhyarsadad/claude-agent-affaan.git` (ECC / `ecc-universal`, compare tree at `_compare/claude-agent-affaan`)  
**Target:** JARVIS Ops OS (`G:\JAvis og rn`)  
**Policy:** Surgical import of portable patterns only — no wholesale IDE harness copy; trading / voice / MT5 untouched.

See also: `docs/JARVIS-VS-AFFAAN-COMPARISON.md` §11 recommendations.

---

## Imported (adapted)

| Asset                             | JARVIS path                                          | Upstream                                              | Adaptation                                                                        |
| --------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| verification-loop skill           | `electron/harness/skills/verification-loop/SKILL.md` | `skills/verification-loop/`                           | JARVIS commands (`tsc`, vitest, **G08/G11/G14**); anti-early-victory language     |
| security-review skill             | `electron/harness/skills/security-review/SKILL.md`   | `skills/security-review/`                             | Mapped to `AGENTS.md` IMMUTABLE invariants (CSP, HITL, path allowlist, MT5 token) |
| strategic-compact skill           | `electron/harness/skills/strategic-compact/SKILL.md` | `skills/strategic-compact/`                           | Phase-boundary compact + continual/refine survival; no Claude Code hooks          |
| safety-hitl skill                 | `electron/harness/skills/safety-hitl/SKILL.md`       | `skills/safety-guard/`                                | Documents runtime risk-gate / HITL / panic; soft freeze-to-dir                    |
| context-budget skill              | `electron/harness/skills/context-budget/SKILL.md`    | `skills/context-budget/` + token-budget-advisor ideas | Heuristics + depth levels; ties to `BenchTokenBudget`                             |
| plan-swarm skill                  | `electron/harness/skills/plan-swarm/SKILL.md`        | `skills/plan-orchestrate/`                            | JARVIS `planSwarm` roles — **not** ECC `/orchestrate`                             |
| Skill loader + lazy triggers      | `electron/harness/skills/loader.ts`                  | ECC trigger-table pattern in strategic-compact        | Materialize to `userData/harness/skills/` without clobbering local edits          |
| Security / Verifier agent prompts | `electron/harness/agents/*.agent.md`                 | `agents/security-reviewer.md`, review discipline      | Seeded into local vault via `materializeLocalAgentsVault`                         |
| Token heuristics                  | `electron/harness/eval/token-budget.ts`              | context-budget prose `words×1.3`                      | Additive; existing chars/4 bench path kept                                        |
| Swarm security/verify legs        | `electron/harness/swarm/router.ts`                   | plan-orchestrate role enrichment                      | Sequential plan gains SecurityReviewer + Verifier on security/verify keywords     |
| Packaging                         | `package.json` `extraResources`                      | ECC skill distribution idea                           | `harness-skills` + `harness-agents` beside packaged app                           |

**Wiring:** `JarvisPrimeHarness` injects skill trigger table + matched bodies into the session system supplement (`electron/harness/service.ts`).

---

## Skipped (and why)

| Upstream                                                                        | Why skipped                                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ~790 ECC skills wholesale                                                       | Token bloat; comparison doc forbids blind copy — curated Ops subset only                            |
| Claude Code / Cursor / Codex hook graphs (`hooks/hooks.json`, bash dispatchers) | Wrong runtime; JARVIS governance is Electron main + risk-gate                                       |
| `skill-comply` Python grader                                                    | Heavy dependency; JARVIS already has golden-automation + G08/G11/G14 — revisit later as optional CI |
| `continuous-learning-v2` observer hooks                                         | Overlaps continual store / refine / memory index; full port would fight constitution                |
| `doctor.js` as separate CLI                                                     | JARVIS already has `electron/system/selftest.ts` (`jarvis:system-selftest`)                         |
| AgentShield npm package                                                         | Optional future; runtime HITL already stronger for desktop Ops                                      |
| Framework skills (Spring, Django, SwiftUI, …)                                   | Unrelated to Ops OS                                                                                 |
| Trading/voice/MT5 anything from ECC                                             | ECC has none; JARVIS features preserved                                                             |
| ECC install.sh / multi-harness IDE layouts                                      | Product class mismatch                                                                              |

---

## Respect for harness constitution

- Did **not** edit IMMUTABLE sections of `AGENTS.md`.
- Did **not** change risk-gate scoring formulas or weaken HITL.
- Safety bench cases **G08 / G11 / G14** not modified.
- Skill bodies reinforce invariants; they do not replace runtime enforcement.

---

## Verification

```bash
pnpm exec tsc -p electron/tsconfig.json --noEmit
pnpm exec vitest run electron/harness/skills/loader.test.ts electron/harness/eval/token-budget.test.ts electron/harness/swarm/router.test.ts electron/harness/bench.test.ts
```

---

_No commit in this step unless the operator asks._
