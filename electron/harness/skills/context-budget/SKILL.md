---
name: context-budget
description: Heuristic token/context budgeting for JARVIS sessions — estimate prompt size and prefer lean supplements.
triggers: token budget, context budget, token count, context window, how many tokens, response depth, brief answer
origin: ECC/adapted
---

# Context Budget (JARVIS)

## Estimation heuristics

| Content      | Estimate      |
| ------------ | ------------- |
| Prose        | `words × 1.3` |
| Code / mixed | `chars / 4`   |

Use the dominant mode. Accuracy is heuristic (~±15%).

## Response depth (when operator asks)

| Level           | Target         | Include                 |
| --------------- | -------------- | ----------------------- |
| 25% Essential   | 2–4 sentences  | Direct answer only      |
| 50% Moderate    | 1–3 paragraphs | Answer + one example    |
| 75% Detailed    | Structured     | Alternatives, pros/cons |
| 100% Exhaustive | Unbounded      | Full analysis           |

If the operator already set a depth this session, keep it until they change it.

## Harness budget

Bench runs use `BenchTokenBudget` (`eval/token-budget.ts`) with a hard USD cap. Do not blow the bench budget to polish prose.

## Lean context rules

- Prefer skill trigger table over pasting every SKILL.md
- Cap memory hits and skill bodies (loader already limits)
- After large tool outputs, summarize before the next turn
