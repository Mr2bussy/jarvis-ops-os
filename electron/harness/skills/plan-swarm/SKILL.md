---
name: plan-swarm
description: Decompose multi-step plans into JARVIS swarm roles (Planner → Executor → Verifier). Generative guidance for planSwarm — not ECC /orchestrate.
triggers: orchestrate, swarm, multi-step plan, decompose plan, parallel agents, sequential pipeline
origin: ECC/adapted
---

# Plan → Swarm (JARVIS)

Adapt ECC `plan-orchestrate` to the JARVIS swarm router (`electron/harness/swarm/router.ts`).

## Modes

| Mode       | When                          | Roles                               |
| ---------- | ----------------------------- | ----------------------------------- |
| solo       | Default                       | Single agent                        |
| sequential | multi-step / refactor / audit | Planner → Executor                  |
| parallel   | explicit "parallel" / "swarm" | Researcher + Implementer + Verifier |

## Decomposition recipe

1. Restate the goal in one sentence.
2. List verify checkpoints (commands or harness verifiers).
3. Assign each step a role focus (plan / code / verify / security).
4. Prefer sequential for dependent steps; parallel only when legs do not share mutable state.

## Security / verify enrichment

If the plan touches secrets, IPC, shell, MT5, or HITL:

- Add an explicit **Verifier** checkpoint citing G08/G11/G14 when relevant
- Load `security-review` skill triggers in the implement/verify legs

## Do not

- Invent ECC `/orchestrate` slash commands inside JARVIS
- Spawn unbounded subagents
- Skip HITL on destructive legs
