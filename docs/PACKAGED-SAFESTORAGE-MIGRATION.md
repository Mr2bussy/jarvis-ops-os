# Packaged Build — safeStorage Migration

**Stand:** 25. August 2026  
**Audience:** Operator Zac · Desktop (Electron packaged) deployments

---

## The packaged rule

When `app.isPackaged === true`, `getDecryptedKey()` in `electron/config/store.ts` **does not read `.env`**.  
Only values entered through **Admin → Connections** (or `config:setKey` IPC) exist in the encrypted store.

Dev/unpackaged builds still fall back to `.env` for convenience.

---

## Before you ship an installer

Migrate these keys from `.env` into Admin **before** cutting a release tag:

| Priority | Key(s)                                                   | Why                                      |
| -------- | -------------------------------------------------------- | ---------------------------------------- |
| P0       | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`  | Chat / Briefings                         |
| P0       | `JARVIS_MODEL`                                           | Default LLM route                        |
| P0       | `JARVIS_AGENTS_PATH`, `JARVIS_SKILLS_INDEX`              | Vault scan / Arsenal                     |
| P0       | `COMPOSIO_API_KEY`                                       | Integrations + E-Commerce sync           |
| P1       | `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD`                | Email employee live fetch                |
| P1       | `UPDATE_FEED_URL`                                        | Auto-update feed (`latest.yml` base URL) |
| P1       | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL`                 | Hermes deliver                           |
| P2       | Search keys (`BRAVE_*`, `TAVILY_*`, …)                   | Web search                               |
| P2       | Social keys (`YOUTUBE_*`, `TWITTER_*`, `INSTAGRAM_*`, …) | Content publish gates                    |

See `docs/ADMIN-CONNECTIONS.md` for the full checklist and maturity badges.

---

## Migration workflow (dev → packaged)

1. Start JARVIS **unpackaged** with your working `.env`.
2. Open **Admin → Connections** and paste each secret (same names as env vars).
3. Confirm probes: Composio catalog, MT5 ping, IMAP status, vault self-test.
4. Build installer: `pnpm build && pnpm exec electron-builder --win`.
5. Install on a **clean VM** (or run `scripts/installer-smoke.ps1` locally).
6. Launch packaged app — verify Bridge self-test and Connections show `connected`.
7. Optional: set `UPDATE_FEED_URL` to your GitHub Releases generic feed, e.g.  
   `https://github.com/<org>/<repo>/releases/download/v1.0.0/`  
   (must host `latest.yml` + `.exe` from `electron-builder --publish always`).

---

## Storage mechanics

- File: `%APPDATA%/jarvis-ops-os/jarvis-config.json` (userData path varies by `appId`).
- Encryption: Electron `safeStorage` (OS keychain). Fallback: base64 when encryption unavailable.
- Rotation hints: `KEY__SET_AT` timestamps → Admin shows `needs_rotate` after ~90 days (advisory only).
- Export: **Admin → Export config** writes redacted JSON to Documents — **not** a full secret backup.

---

## Auto-update

Packaged startup (`electron/updater/auto-update.ts` + `configureAutoUpdater` in `main.ts`):

1. Reads `UPDATE_FEED_URL` from safeStorage (then env fallbacks in **dev only**).
2. `autoUpdater.autoDownload = false` — operator confirms download via Production IPC.
3. On tag releases, CI uploads `latest.yml` — point `UPDATE_FEED_URL` at that feed base URL.
4. **Fail-closed (packaged):** missing feed → update check disabled, console warning, TopBar **NO UPDATE FEED** badge.

Without `UPDATE_FEED_URL` in packaged builds, updates are not offered (policy, not a silent skip).

Automated checklist smoke:

```bash
pnpm smoke:migration          # presence-only
node scripts/packaged-migration-smoke.mjs --strict   # fail if P0 keys missing
pnpm smoke:connections
```

---

## Troubleshooting

| Symptom                       | Cause                           | Fix                                              |
| ----------------------------- | ------------------------------- | ------------------------------------------------ |
| Packaged app “empty brain”    | Keys only in `.env`             | Re-enter keys in Admin                           |
| Composio / Shopify sync gated | OAuth not linked                | Integrations → Composio → Shopify ACTIVE         |
| IMAP classify never runs      | Creds missing or imapflow error | Admin IMAP + check `production:imap-idle-status` |
| Update never offered          | No feed URL                     | Set `UPDATE_FEED_URL` in Connections             |

---

## Related docs

- `docs/RELEASE.md` — signing, tags, checksums
- `docs/ADMIN-CONNECTIONS.md` — connection matrix
- `scripts/installer-smoke.ps1` — installer lifecycle scaffold
