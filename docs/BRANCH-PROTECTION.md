# Branch protection on `main`

This repo currently has **no GitHub remote** and/or **`gh` is not authenticated** on this machine, so protection could not be applied automatically. Use the steps below once the repo is on GitHub and `gh auth login` succeeds.

## Required status check name

CI defines a job named **`verify`** (see `.github/workflows/ci.yml`). That is the check to require in branch protection.

Wait until at least one successful CI run on `main` has published the `verify` check before enabling the rule (GitHub only lists checks that have run).

## Apply with `gh` (recommended)

Replace `OWNER/REPO` with your GitHub slug (or omit and run from a clone with `origin` set).

```bash
# Confirm auth + remote
gh auth status
gh repo view --json nameWithOwner,defaultBranchRef

# Enable branch protection on main:
# - require status check "verify"
# - enforce_admins=false so repo admins (Zac) are not locked out of emergency pushes
# - block force-push and branch deletion
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  repos/OWNER/REPO/branches/main/protection \
  --input - <<'EOF'
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
EOF
```

If your default branch is not `main`, change the path segment.

### Using the current clone once `origin` exists

```bash
OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${OWNER_REPO}/branches/main/protection" \
  --input - <<'EOF'
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
EOF
```

## UI fallback

GitHub ÔåÆ **Settings ÔåÆ Branches ÔåÆ Add branch protection rule** ÔåÆ Branch name pattern `main`:

1. Enable **Require status checks to pass before merging**
2. Require branches to be up to date
3. Select check **`verify`**
4. Leave **Do not allow bypassing the above settings** **off** (admins can still recover)
5. Enable **Do not allow force pushes** and **Do not allow deletions**

## Verify

```bash
gh api repos/OWNER/REPO/branches/main/protection --jq ".required_status_checks.contexts"
# expect: ["verify"]
```
