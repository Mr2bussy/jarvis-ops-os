# Runbook — Email Employee

## Symptoms

- IMAP IDLE `unavailable` / `error`
- Classify returns wrong category

## Checks

1. Flag `email.enabled`
2. Keys `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD`
3. `imapflow` installed (`pnpm list imapflow`)
4. `production:imap-idle-status`

## Recovery

- Fix credentials → restart IDLE from Setup
- Scaffold mode without imapflow is expected until dep is present

## Dry-run

Draft replies still compute; send paths honor `JARVIS_DRY_RUN`.
