# ADR Index

Architecture Decision Records for JARVIS Operations OS.

| ADR                                  | Title                             | Status   |
| ------------------------------------ | --------------------------------- | -------- |
| [0001](0001-sqlite-wal.md)           | SQLite WAL as primary local store | Accepted |
| [0002](0002-path-not-blob.md)        | Path-not-blob IPC policy          | Accepted |
| [0003](0003-dry-run.md)              | Global JARVIS_DRY_RUN simulation  | Accepted |
| [0004](0004-ipc-registry.md)         | IPC channel registry + codegen    | Accepted |
| [0005](0005-register-ipc-modules.md) | Extract register-\* IPC from main | Accepted |
| [0006](0006-admin-trading-splits.md) | Split Admin + Trading monoliths   | Accepted |

Process: copy `NNNN-title.md`, fill Context / Decision / Consequences. Do not edit Accepted ADRs in place — supersede with a new ADR.
