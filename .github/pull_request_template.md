## Summary

<!-- What changed and why? -->

## Bugfix + test (required for fixes)

<!-- D3 lock: every bugfix must include a test that failed before the fix. -->

- [ ] If this PR fixes a bug, I added a regression test that would fail on the previous behaviour.
- [ ] If no bugfix, N/A ÔÇö explain below:

## Test plan

- [ ] `pnpm verify` (or relevant slices) passes locally
- [ ] Allowlist / security tests green if touching `electron/security/**`

## Checklist

- [ ] No secrets committed (`.env` stays untracked)
- [ ] Coverage not regressed (`pnpm test:cov` + `node scripts/coverage-ratchet.mjs`)
