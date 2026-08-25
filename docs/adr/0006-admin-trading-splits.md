# ADR 0006: Split Admin and Trading screen monoliths

**Status:** Accepted (2026-08-25)

## Context

`Admin.tsx` (~1.9k) and `TradingContent.tsx` (~3.3k) mixed shell routing with large tab/widget implementations, violating the D6 600-line budget and blocking review.

## Decision

1. **Admin:** extract `ModelsTab` + `ConnectorsTab` (+ shared `admin-data.ts`) under `src/screens/admin/`. `Admin.tsx` remains the tab shell (Paths / Tools / Social still inline for a follow-up).
2. **Trading:** extract ZeusBot connector + strategies into `src/screens/trading/ZeusBotPanel.tsx`; re-export `ZeusBotMiniPlayer` for Bridge.
3. Document ceilings in `.file-size-budget.json` and ratchet them down as further tabs (GodMode, widgets) move out.

## Consequences

- File-size gate watches both shells and extracted modules.
- Further splits (Admin Paths/Tools/Social; Trading GodMode/widgets) should each get a short ADR addendum or new ADR.

## Alternatives considered

- Rename-only file moves without extracting logic — rejected (D6 requires real modules).
