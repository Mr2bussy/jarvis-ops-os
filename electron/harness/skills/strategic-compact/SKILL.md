---
name: strategic-compact
description: Compact JARVIS harness context at logical phase boundaries — not mid-implementation. Preserves continual memory and skill index.
triggers: compact, context full, context pressure, long session, phase boundary, clear context
origin: ECC/adapted
---

# Strategic Compact (JARVIS)

Prefer compacting at **phase boundaries**, not on arbitrary turn counts.

## When to compact

| Transition            | Compact? | Why                                        |
| --------------------- | -------- | ------------------------------------------ |
| Research → Plan       | Yes      | Keep the plan; drop raw exploration        |
| Plan → Implement      | Yes      | Plan lives in todos/files                  |
| Implement → Verify    | Maybe    | Keep if verifier needs recent paths        |
| Debug → Next feature  | Yes      | Drop dead-end traces                       |
| Mid-implementation    | **No**   | Paths and partial state are costly to lose |
| After failed approach | Yes      | Clear before retry                         |

## What should survive (write before compact)

- Continual harness memories / skill descriptions (`harness/continual-state.json`)
- Snapshot via refine (`/refine` path in harness)
- Files on disk and git state
- Active HITL / kill-switch state

## What may be dropped

- Intermediate tool dumps and large file reads
- Dead-end debug hypotheses
- Duplicate skill bodies already indexed in the trigger table

## Operator actions

1. Persist important conclusions with harness refine / memory index.
2. Summarize the next phase in one short paragraph.
3. Start the next phase with that summary as the user message — do not rely on invisible chat history alone.

## Lazy skill loading

Keep only the skill **trigger table** in baseline context. Load a full `SKILL.md` body only when the user message matches its triggers (see `skills/loader.ts`).
