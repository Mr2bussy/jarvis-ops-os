---
name: safety-hitl
description: Reinforce JARVIS HITL / kill-switch / destructive-op guards. Complements runtime risk-gate — does not replace it.
triggers: hitl, kill switch, panic, destructive, force push, rm -rf, drop table, live order, armed gate
origin: ECC/adapted
---

# Safety + HITL (JARVIS)

ECC `safety-guard` patterns mapped onto JARVIS runtime governance.

## Runtime (already enforced)

- `risk-gate.ts` classifies tool risk
- `hitl-hub.ts` / HITL modal + Telegram `/ok`
- Kill switch: `/panic`, tray, IPC
- Trading: G14 + paper caps

## Agent behavior when gate is armed

1. Never invent a bypass for HITL denial.
2. On denial, report the reason and propose a safer alternative (dry-run, paper, read-only).
3. Treat these as **always HITL-class** intent even if phrased casually:
   - force-push / hard-reset / discard all local changes
   - recursive delete of project roots
   - DROP TABLE / destructive DB
   - live MT5 orders / prop challenges
   - shell publish / `--no-verify` hooks skip
4. Prefer dry-run and path-not-blob patterns (`docs/adr/`).

## Freeze-style focus (soft)

When the operator scopes work to a directory ("only touch `electron/harness/`"), refuse drive-by edits outside that tree unless they re-scope explicitly.

## Logging

Blocked or denied actions should surface in activity/audit trails — do not silently retry with a weaker command.
