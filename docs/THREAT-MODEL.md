# Threat model ÔÇö JARVIS Operations OS

> Six attack chains and the Sperrklinke that breaks each one.
> Proofs live in `electron/security/threat-model.test.ts` (plus `mt5_bridge/test_bridge.py` for chain 4).

| #   | Chain                                  | Lock                                                  | Proof                                           |
| --- | -------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| 1   | Telegram ÔåÆ Hermes ÔåÆ Agent ÔåÆ Tool | `shell_exec` disabled in harness executor             | `threat-model.test.ts` chain 1 ┬À `executor.ts` |
| 2   | Model output ÔåÆ Renderer              | No `dangerouslySetInnerHTML` in `src/`                | chain 2 filesystem scan                         |
| 3   | Renderer ÔåÆ `console:runCmd`          | Allowlist + Advanced Mode; control syntax rejected    | chain 3 ┬À `command-allowlist.ts`               |
| 4   | Bridge token                           | MT5 without `X-JARVIS-Token` ÔåÆ 401                  | chain 4 ┬À `test_bridge.py`                     |
| 5   | Vault path                             | Path outside roots ÔåÆ denied                         | chain 5 ┬À `paths.ts` / executor G11            |
| 6   | Update channel                         | `autoDownload = false`; install only via explicit IPC | chain 6 ┬À `main.ts`                            |

## Operator notes

- Harness agents must never gain a shell. Advanced Mode console is human-initiated and audited.
- Renderer CSP (`electron/security/csp.ts`) forbids `unsafe-eval`; WASM is scoped to audio workers only.
- Secret scan: `node scripts/scan-secrets.mjs --all --fail-on-new` (vendor trees ignored).
