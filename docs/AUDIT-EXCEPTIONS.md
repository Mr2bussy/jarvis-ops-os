# Audit exceptions (D2 §2.6)

`pnpm audit --audit-level=high` is **blocking** in `pnpm verify` via
`scripts/audit-gate.mjs`. Advisories listed here are **accepted** until an
upstream package ships a clean tree; every row must name the blast radius and
why it is not exploitable in the packaged Electron runtime.

Re-review when upgrading `electron-builder`, `vite`, `electron`, or `vitest`.

| Advisory ID | Severity | Package              | Path (summary)                               | Why accepted                                               | Review by  |
| ----------- | -------- | -------------------- | -------------------------------------------- | ---------------------------------------------------------- | ---------- |
| 1120422     | critical | shell-quote          | concurrently (dev)                           | Dev-only `pnpm dev` orchestrator; not shipped in installer | 2026-09-25 |
| 1123944     | high     | shell-quote          | concurrently (dev)                           | Same as above                                              | 2026-09-25 |
| 1123940     | critical | tar                  | electron-builder / node-gyp                  | Build-time packaging only; not loaded by running app       | 2026-09-25 |
| 1123941     | high     | tar                  | electron-builder / node-gyp                  | Build-time only                                            | 2026-09-25 |
| 1145647     | high     | tar                  | electron-builder / node-gyp                  | Build-time only                                            | 2026-09-25 |
| 1124279     | high     | app-builder-lib      | electron-builder                             | Linux AppImage path; we ship NSIS Windows                  | 2026-09-25 |
| 1124278     | high     | builder-util-runtime | electron-updater                             | Affects PRIVATE-TOKEN redirect; we do not set that header  | 2026-09-25 |
| 1123686     | high     | adm-zip              | electron-builder tree                        | Build-time ZIP handling                                    | 2026-09-25 |
| 1120654     | high     | tmp                  | electron-builder tree                        | Build temp dirs; not runtime                               | 2026-09-25 |
| 1120743     | high     | form-data            | transitive (dev tooling)                     | Not used for untrusted multipart in app IPC                | 2026-09-25 |
| 1123967     | high     | axios                | transitive (dev tooling)                     | Not a production dependency of the Electron main/renderer  | 2026-09-25 |
| 1123896     | high     | brace-expansion      | transitive                                   | DoS on crafted glob; mitigated via override where possible | 2026-09-25 |
| 1123897     | high     | brace-expansion      | transitive                                   | Same family                                                | 2026-09-25 |
| 1123898     | high     | brace-expansion      | transitive                                   | Same family                                                | 2026-09-25 |
| 1130588     | high     | brace-expansion      | transitive                                   | Same family                                                | 2026-09-25 |
| 1130589     | high     | brace-expansion      | transitive                                   | Same family                                                | 2026-09-25 |
| 1130591     | high     | brace-expansion      | transitive                                   | Same family                                                | 2026-09-25 |
| 1130734     | high     | brace-expansion      | transitive                                   | Same family                                                | 2026-09-25 |
| 1130736     | high     | brace-expansion      | transitive                                   | Same family                                                | 2026-09-25 |
| 1130737     | high     | brace-expansion      | transitive                                   | Same family                                                | 2026-09-25 |
| 1123911     | high     | js-yaml              | transitive (dev)                             | Config parse in tooling; no untrusted YAML in runtime      | 2026-09-25 |
| 1138115     | high     | js-yaml              | transitive (dev)                             | Same                                                       | 2026-09-25 |
| 1138811     | high     | nanoid               | vite→postcss tree                            | Dev bundler; override bumped where lock allows             | 2026-09-25 |
| 1139427     | high     | nanoid               | vite→postcss tree                            | Same                                                       | 2026-09-25 |
| 1139510     | high     | postcss              | vite                                         | Dev bundler source-map load; not in packaged app           | 2026-09-25 |
| 1124066     | high     | sharp                | optional / tooling                           | Image pipeline not used in product path                    | 2026-09-25 |
| 1121187     | high     | undici               | node-gyp / electron get / jsdom              | Dev install + test harness                                 | 2026-09-25 |
| 1121244     | high     | undici               | same                                         | Same                                                       | 2026-09-25 |
| 1121245     | high     | undici               | same                                         | Same                                                       | 2026-09-25 |
| 1121247     | high     | undici               | same                                         | Same                                                       | 2026-09-25 |
| 1130718     | high     | undici               | same                                         | Same                                                       | 2026-09-25 |
| 1123525     | high     | vite                 | vite itself                                  | Dev server only (`pnpm dev`); production uses built assets | 2026-09-25 |
| 1112659     | high     | tar                  | electron-builder / electronegativity pre-gyp | Build/scan-time extract only; not loaded by packaged app   | 2026-09-25 |
| 1113300     | high     | tar                  | same                                         | Build/scan-time only                                       | 2026-09-25 |
| 1113375     | high     | tar                  | same                                         | Build/scan-time only                                       | 2026-09-25 |
| 1114200     | high     | tar                  | same                                         | Build/scan-time only                                       | 2026-09-25 |
| 1114302     | high     | tar                  | same                                         | Build/scan-time only                                       | 2026-09-25 |
| 1114680     | high     | tar                  | same                                         | Build/scan-time only                                       | 2026-09-25 |

## How the gate works

```bash
node scripts/audit-gate.mjs          # used by pnpm verify
pnpm audit --audit-level=high        # raw report (will exit non-zero until upstreams clear)
```

Machine-readable allowlist: `.audit-exceptions.json` (IDs only). Keep this markdown
in sync when adding or removing IDs.
