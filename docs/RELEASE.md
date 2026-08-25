# Release — signed Windows builds

`.github/workflows/release.yml` turns a pushed `v*` tag into a published GitHub
Release: NSIS installer, `latest.yml` (auto-update feed), `.blockmap`, and
`SHA256SUMS.txt`.

**Code-signing + installer smoke:** `docs/CODE-SIGNING.md` — dry-run always;
full smoke when `CSC_LINK` / `VERIFY_INSTALLER=1`; unsigned releases fail-soft.

## Packaged keys (safeStorage)

Before shipping to operators, migrate secrets from `.env` into **Admin → Connections**.
Packaged builds ignore `.env` entirely. See `docs/PACKAGED-SAFESTORAGE-MIGRATION.md`.

Set `UPDATE_FEED_URL` in Connections to the GitHub Releases download base URL that
hosts `latest.yml` (from this workflow). Use repo **Variables** (`UPDATE_FEED_URL`)
only as CI documentation — never commit real feed URLs or signing material.

## Secrets

| Secret             | Required | Purpose                                                                     |
| ------------------ | -------- | --------------------------------------------------------------------------- |
| `CSC_LINK`         | no       | Code-signing certificate: base64 of the `.pfx`, or an `https://` URL to it. |
| `CSC_KEY_PASSWORD` | no       | Password of that `.pfx`.                                                    |
| `GITHUB_TOKEN`     | built-in | Provided by Actions; used to create the release and upload artefacts.       |

**Without `CSC_LINK` the workflow still succeeds and produces an UNSIGNED
installer.** The certificate lives with the operator, not in this repo, so a
missing secret must never block a release. The run logs `SIGNING: disabled …`
and raises a GitHub warning annotation; that annotation is the only difference
you will see, so read it before shipping the binary to anyone.

To sign, add both secrets under _Settings → Secrets and variables → Actions_:

```powershell
# produce the value for CSC_LINK from a local .pfx
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\jarvis.pfx")) | Set-Clipboard
```

Signing options live in `package.json` → `build.win.signtoolOptions`:

- `signingHashAlgorithms: ["sha256"]` — SHA-1 is not produced at all.
- `publisherName: null` — **prepared, intentionally unset.** electron-builder
  then takes the publisher name from the certificate's common name. Only set it
  if you must pin the name, and then it has to match the CN of the certificate
  in `CSC_LINK` _exactly_, or the installer's auto-update signature check fails.
- `afterSign` is deliberately **not** set — that hook is macOS notarisation, and
  this project ships Windows.

> Note (electron-builder 26): these two options moved from `build.win.*` into
> `build.win.signtoolOptions.*`. The old location is rejected by the config
> schema, so it cannot simply be copied from older documentation.

## Cutting a release

```bash
# 1. bump the version — electron-builder derives the release tag from it
#    (edit "version" in package.json), then commit
git tag v1.2.3
git push origin v1.2.3
```

The workflow refuses to continue when the tag and `package.json`'s `version`
disagree, because electron-builder would otherwise publish the installer to a
release named after the _package_ version rather than the tag you pushed.

`ci.yml` triggers on the same push (lint, typecheck, unit tests, build), so the
quality gate runs alongside the packaging job.

## Verifying a download

`SHA256SUMS.txt` is generated on the same runner that produced the installer and
attached to the release. Download both, then:

```powershell
# Windows / PowerShell
Get-FileHash -Algorithm SHA256 '.\JARVIS Operations OS Setup 1.2.3.exe'
# compare the hash with the matching line in SHA256SUMS.txt
```

```bash
# Linux / macOS / Git Bash — checks every listed file at once
sha256sum -c SHA256SUMS.txt
```

A signed build can additionally be checked with
`Get-AuthenticodeSignature '.\JARVIS Operations OS Setup 1.2.3.exe'` — `Status`
must be `Valid`. For an unsigned build that call reports `NotSigned`, and the
checksum is the only integrity proof available.
