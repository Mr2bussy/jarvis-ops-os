# Two-Instance Pattern (separate userData)

Electron shares one `userData` by default. Two JARVIS processes on the same profile collide (bridge token, SQLite locks, flags).

## Pattern

| Profile    | Purpose         | Launch                |
| ---------- | --------------- | --------------------- |
| Live       | Production      | default `userData`    |
| Experiment | Dry-run / flags | `--user-data-dir=...` |

### Windows example

```bat
:: Live
electron .

:: Experiment (dry-run)
set JARVIS_DRY_RUN=1
electron . --user-data-dir="%LOCALAPPDATA%\jarvis-ops-os-experiment"
```

Or set `app.setPath('userData', ...)` early via env `JARVIS_USER_DATA` if wired in a future launcher.

## Rules

- Never point experiment + live at the same DB directory.
- Prefer `JARVIS_DRY_RUN=1` on the experiment profile.
- Single-instance lock still applies per userData path.
