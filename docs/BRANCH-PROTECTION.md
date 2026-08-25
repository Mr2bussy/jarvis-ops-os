# Branch protection on `main`

## Status (2026-08-25)

Remote: `https://github.com/Mr2bussy/jarvis-ops-os` (private).  
`gh` authenticated as **Mr2bussy**.

**Blocker:** Classic branch protection **and** repository rulesets return HTTP 403 on this private repo:

> Upgrade to GitHub Pro or make this repository public to enable this feature.

Until Zac upgrades the plan **or** makes the repo public, GitHub will not store a server-side require-check rule. Local + CI gates still fail hard (`pnpm verify`, job `verify`).

## Required status check name

CI defines a job named **`verify`** (see `.github/workflows/ci.yml`). That is the check to require. It now aggregates **quality + flaky + python-bridge**.

Wait until at least one successful CI run on `main` has published the `verify` check before enabling the rule (GitHub only lists checks that have run).

## Apply with `gh` (when Pro / public unlocks the API)

```bash
gh auth status
gh repo view --json nameWithOwner,defaultBranchRef

OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
# PowerShell-friendly body file:
@'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["verify"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
'@ | Set-Content -Encoding utf8 protect.json

gh api --method PUT `
  -H "Accept: application/vnd.github+json" `
  "repos/${OWNER_REPO}/branches/main/protection" `
  --input protect.json
```

- `enforce_admins: false` — Zac (admin) is **not** locked out of emergency pushes.
- `allow_force_pushes: false` — no force-push to `main`.

## UI fallback (same unlock required)

GitHub → **Settings → Branches → Add branch protection rule** → pattern `main`:

1. Require status checks to pass → select **`verify`**
2. Require branches to be up to date
3. Leave **Do not allow bypassing the above settings** **off** (admins can recover)
4. Do not allow force pushes / deletions

## Verify

```bash
gh api repos/Mr2bussy/jarvis-ops-os/branches/main/protection --jq ".required_status_checks.contexts"
# expect: ["verify"]
```

If this still returns 403, the plan/visibility blocker above is still active — document the date, do not claim D3=12 for branch-protection alone.
