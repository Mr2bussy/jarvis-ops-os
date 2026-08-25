# Code signing + installer smoke (D7 → 12)

**Stand:** 25. August 2026  
**Status:** mechanism locked / waiting for Zac OV cert (`CSC_LINK`)

Without real `CSC_LINK` / `CSC_KEY_PASSWORD` GitHub secrets, a release must **never**
block on signing. Unsigned installers still publish; SmartScreen will warn. Closing
the last tooth to **12/12** is an operator action: add the cert secrets — then the
**Reject unsigned build when CSC_LINK present** step proves unsigned artefacts are
rejected (Authenticode must be `Valid`).

---

## Environment variables / secrets

| Name                        | Where                                                          | Required          | Purpose                                                                                                    |
| --------------------------- | -------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `CSC_LINK`                  | GitHub Actions **secret**                                      | for signed builds | Base64 of the `.pfx`, or an `https://` URL to the certificate file.                                        |
| `CSC_KEY_PASSWORD`          | GitHub Actions **secret**                                      | with `CSC_LINK`   | Password for that `.pfx`.                                                                                  |
| `VERIFY_INSTALLER`          | GitHub Actions **variable** (or local env)                     | no                | `1` = run **full** installer smoke and treat Authenticode `Valid` as required when `CSC_LINK` is also set. |
| `UPDATE_FEED_URL`           | Admin Connections (safeStorage) + optional GitHub **variable** | packaged prod     | Auto-update feed base; packaged apps fail-closed without it (log + UI badge).                              |
| `GITHUB_TOKEN` / `GH_TOKEN` | Actions built-in                                               | yes (CI)          | Publish release artefacts.                                                                                 |

Local encode for `CSC_LINK`:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\jarvis.pfx")) | Set-Clipboard
```

Signing options live in `package.json` → `build.win.signtoolOptions` (`sha256`,
`publisherName: null`). See also `docs/RELEASE.md`.

---

## CI behaviour (`.github/workflows/release.yml`)

| Step                                   | When                                       | Blocking?                                                                                           |
| -------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Report signing status                  | always                                     | no (warning annotation if unsigned)                                                                 |
| Package + publish                      | always                                     | yes (unsigned OK if secrets missing)                                                                |
| SBOM (`SBOM.json`)                     | always                                     | yes — attached to release                                                                           |
| **Installer smoke dry-run**            | always                                     | **yes** — no certs, no install                                                                      |
| Packaged migration + connections smoke | always                                     | yes (presence-only, exit 0)                                                                         |
| **Reject unsigned when CSC_LINK set**  | `CSC_LINK` present                         | **yes** — Authenticode must be `Valid`                                                              |
| **Installer smoke full**               | `CSC_LINK` set **or** `VERIFY_INSTALLER=1` | yes when `VERIFY_INSTALLER=1`; otherwise continue-on-error if only secrets present and smoke flakes |

**Fail-soft (default without secrets):** release succeeds, artefacts are UNSIGNED,
dry-run smoke still proves the mechanism. Log lines:

- `SIGNING: disabled (no CSC_LINK)`
- `::warning title=UNSIGNED BUILD::…`

**With secrets:** unsigned artefacts are **rejected** — that is the 12th tooth for D7.

---

## Local commands

```powershell
# Always safe — no certs, no installer required
pwsh -NoProfile -File scripts/installer-smoke.ps1 -DryRun
pnpm smoke:migration
pnpm smoke:connections

# After a local electron-builder run produced release/*.exe
pwsh -NoProfile -File scripts/installer-smoke.ps1 -SkipUninstall

# Force Authenticode Valid check when you already signed locally
$env:VERIFY_INSTALLER = '1'
$env:CSC_LINK = '…'   # or leave set from your shell if you exported it
pwsh -NoProfile -File scripts/installer-smoke.ps1
```

---

## Remaining tooth (Zac)

1. Obtain an OV/EV code-signing certificate (`.pfx` + password).
2. Add repo secrets `CSC_LINK` and `CSC_KEY_PASSWORD`.
3. Push a `v*` tag that matches `package.json` `version`.
4. Confirm release log: `SIGNING: enabled` + **Reject unsigned** step green + Authenticode `Valid`.
5. Optional: set `VERIFY_INSTALLER=1` for full silent-install smoke on every tag.
6. Set `UPDATE_FEED_URL` in Admin Connections to the Releases feed hosting `latest.yml`.

Until steps 1–2: treat D7 as **11/12 mechanism locked** (or **12/12** once CSC_LINK is live and unsigned rejection fires). Not a code gap.
