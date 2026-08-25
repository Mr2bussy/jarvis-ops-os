# JARVIS Operations OS vs. ECC (claude-agent-affaan) — Wettbewerbsvergleich

**Stand:** 24. August 2026  
**JARVIS (kanonisch):** `G:\JAvis og rn`  
**Vergleichsrepo (shallow clone):** `G:\JAvis og rn\.compare\claude-agent-affaan`  
**Hinweis zur Quelle:** Die URL `https://github.com/akhyarsadad/claude-agent-affaan.git` liefert inhaltlich **ECC v2.0.0-rc.1** (`ecc-universal`, Upstream: [affaan-m/ECC](https://github.com/affaan-m/ECC)). Der Vergleich ist daher **JARVIS Desktop Ops OS** vs. **ECC Harness-native Operator System** — unterschiedliche Produktklassen, aber überlappend in Agent/Harness/Sicherheit.

**Referenz intern:** `docs/JARVIS-CAPABILITY-REPORT.md`

---

## 1. Executive Summary

| Dimension                          | Gewinner                                          | Kurzbegründung                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop-Produkt / Operator-UI**  | **JARVIS**                                        | Vollständige Electron-App mit 13+ Screens, Voice-Stage, Trading-Cockpit — ECC hat keine vergleichbare Shell.                                         |
| **Cross-Harness Skill-Bibliothek** | **ECC**                                           | ~790 Skills, 12+ IDE-Harnesses, npm-Distribution, Community-Skalierung.                                                                              |
| **Trading / MT5 / Prop**           | **JARVIS**                                        | ZeusEdge, MT5-Bridge, Paper-Caps, Prop-Maxing — in ECC nicht vorhanden.                                                                              |
| **Voice (STT/TTS + Agent)**        | **JARVIS**                                        | Lokales Whisper, Hermes-Voice-Session, Push-to-Talk UI — ECC dokumentiert Voice nicht als Produktfeature.                                            |
| **Sicherheit & HITL (Runtime)**    | **JARVIS** (Runtime) / **ECC** (Breite)           | JARVIS: risk-gate + HITL-Modal + Telegram `/ok` live; ECC: AgentShield, Security-Guides, Supply-Chain-CI — breiter Katalog, weniger Desktop-Runtime. |
| **Evals / Benchmark-Disziplin**    | **JARVIS** (deterministisch) / **ECC** (Methodik) | JARVIS: G08/G11/G14 @ 100, wöchentliche Harness-Eval; ECC: verification-loop, skill-comply, Pass@k-Dokumentation.                                    |
| **Distribution / DX**              | **ECC**                                           | `install.sh`/`install.ps1`, npm, GitHub App, 12 Sprachen README.                                                                                     |
| **Production Readiness (Enduser)** | **JARVIS** (nach Launch-Fix)                      | NSIS geplant; Launcher nutzt `dist/` + Production-Electron; ECC ist Entwickler-Toolkit, kein installierbares Ops-OS.                                 |

**Ehrliches Fazit:** ECC gewinnt als ** universelles Agent-Betriebssystem für Entwickler-Harnesses**. JARVIS gewinnt als **integrierte Windows-Operations-Zentrale** für Trading, Voice, Gateway und Governance in einer App. Kein Repo ersetzt das andere — sinnvolle Strategie: **ECC-Patterns in JARVIS-Harness importieren**, ohne die Desktop-Shell aufzugeben.

---

## 2. Side-by-Side Capability Matrix

| Kategorie              | JARVIS Ops OS                         | ECC (Affaan)                             | Reifegrad J / E        |
| ---------------------- | ------------------------------------- | ---------------------------------------- | ---------------------- |
| **Produktform**        | Electron Desktop App                  | Harness-Plugin/Skill-Pack (npm)          | Prod-like / OSS-Mature |
| **UI-Screens**         | 13+ (Bridge, Trading, Workflows, …)   | Keine native GUI                         | ●●●●○ / ○○○○○          |
| **Agent Runtime**      | JarvisPrimeHarness + Hermes Agent CLI | Skills + Hooks + Subagent-Specs          | ●●●●○ / ●●●●●          |
| **Skills**             | Vault-Scan + skills-index.json        | ~790 SKILL.md                            | ●●●○○ / ●●●●●          |
| **Subagents**          | `.agent.md` Scanner + Teams           | agents/ + docs/i18n                      | ●●●○○ / ●●●●●          |
| **Memory**             | JSON-Index + Embeddings (Hybrid)      | continuous-learning-v2, session-bridge   | ●●●○○ / ●●●●○          |
| **Voice**              | Whisper STT + TTS + Voice Mode Stage  | —                                        | ●●●●○ / ○○○○○          |
| **Trading**            | MT5, ZeusEdge, Paper, Prop, Quant     | —                                        | ●●●●○ / ○○○○○          |
| **Gateway**            | Telegram/Discord/Slack Router         | unified-notifications-ops (Skill)        | ●●●●○ / ●●●○○          |
| **Integrations**       | Composio (~485 Apps)                  | MCP configs + Skill-Ökosystem            | ●●●○○ / ●●●●●          |
| **Browser Automation** | browser-use Sidecar (Python)          | windows-desktop-e2e Skill                | ●●●○○ / ●●●○○          |
| **Security Scan**      | command-allowlist, CSP, secret scan   | AgentShield, security-review Skill       | ●●●●○ / ●●●●●          |
| **HITL**               | risk-gate + Modal + Telegram Hub      | safety-guard, release-approval-gate      | ●●●●○ / ●●●●○          |
| **Tests**              | ~46 TS test modules + Playwright e2e  | ~138 JS/Py test files                    | ●●●○○ / ●●●●●          |
| **CI**                 | GitHub Actions (ci.yml, release.yml)  | Umfangreiche script-tests + supply-chain | ●●●○○ / ●●●●●          |
| **Packaging**          | electron-builder NSIS (geplant)       | npm ecc-universal, install scripts       | ●●○○○ / ●●●●●          |
| **i18n**               | DE Voice-Persona, teils DE UI         | 12+ Sprachen (docs)                      | ●●○○○ / ●●●●●          |

Legende: ● = ausgeprägt, ○ = fehlend oder schwach

---

## 3. Architekturvergleich

### 3.1 JARVIS — Dreischichtige Desktop-Architektur

```
React Renderer (Vite) ──IPC──► Electron Main ──► Sidecars / APIs
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            JarvisPrimeHarness   HermesRouter    mt5_bridge
            risk-gate/HITL       hermes-agent    browser-use
            Composio             Ollama/Gemini
```

- **Entry:** `electron/main.ts` → `dist-electron/main.js`
- **Renderer:** `src/App.tsx`, lazy-loaded Screens
- **Sicherheit:** `contextIsolation`, `sandbox`, CSP in `electron/security/csp.ts`
- **Secrets:** OS Keychain via `electron/config/store.ts`

### 3.2 ECC — Harness-native Schichtmodell

```
install.sh / npm ecc-universal
        │
        ▼
┌───────────────────────────────────────┐
│  .cursor/ .codex/ .claude-plugin/ …   │  ← pro Harness
│  skills/ hooks/ rules/ agents/        │
│  scripts/ (catalog, doctor, consult)  │
└───────────────────────────────────────┘
        │
        ▼
   Entwickler-IDE / CLI (kein Main Process)
```

- **Entry:** `install.ps1`, `scripts/catalog.js`, `AGENTS.md`
- **Version:** 2.0.0-rc.1 (Hermes Operator Story)
- **Sprachen:** Shell, TypeScript, Python, Go, Java, Perl, Markdown

### 3.3 Architektur-Urteil

| Aspekt                 | JARVIS                          | ECC                                |
| ---------------------- | ------------------------------- | ---------------------------------- |
| **Kohäsion**           | Monolith mit klaren IPC-Grenzen | Modularer Content-Monorepo         |
| **Deployment-Einheit** | Eine `.exe` (Ziel)              | npm-Paket + Dateikopie             |
| **Erweiterbarkeit**    | Code + Vault-Agents             | Skill/Hook hinzufügen ohne Rebuild |
| **Vendor-Lock-in**     | Electron + Windows-Ops          | Harness-agnostisch                 |

---

## 4. Agent- & Harness-Vergleich

### 4.1 JARVIS Prime Harness

| Merkmal    | Implementierung                                 |
| ---------- | ----------------------------------------------- |
| Agent Loop | `electron/harness/agent-loop.ts`, Swarm Router  |
| Tools      | `electron/harness/tools/executor.ts`, Katalog   |
| Governance | `risk-gate.ts`, `hitl-hub.ts`, `gate-memory.ts` |
| Eval       | `benchmark-cases.ts`, G01–G14, weekly-report    |
| Memory     | `search-index.ts`, `embeddings.ts`              |
| Replay     | `replay.ts` — Session-Rekonstruktion            |

**Stärke:** Laufzeit-Governance an echte Tools gebunden (MT5, Shell, Browser).  
**Schwäche:** Weniger Community-Skills als ECC; Harness ist an JARVIS-Prozess gebunden.

### 4.2 ECC Harness-Schicht

| Merkmal       | Implementierung                                     |
| ------------- | --------------------------------------------------- |
| Skills        | ~790 unter `skills/*/SKILL.md`                      |
| Verification  | `verification-loop`, `skill-comply` (Python Grader) |
| Learning      | `continuous-learning-v2`, `strategic-compact`       |
| Orchestration | `plan-orchestrate`, tmux-worktree-orchestrator      |
| Token         | `token-budget-advisor`                              |
| TDD           | `tdd-workflow` — ausführlich dokumentiert           |

**Stärke:** Bewährte Patterns, breite Sprach-/Framework-Abdeckung, npm-Release.  
**Schwäche:** Keine garantierte Runtime — abhängig vom Host-Harness des Users.

### 4.3 Hermes (gemeinsames Thema)

Beide Repos referenzieren **Hermes** — JARVIS integriert `hermes-agent.ts` als Subprozess mit Workspace-Tools; ECC v2.0 dokumentiert Hermes Setup (`docs/HERMES-SETUP.md`) als Operator-Story über die Skill-Schicht.

---

## 5. UI/UX-Vergleich

### 5.1 JARVIS

- **Design System:** Obsidian-HUD (`styles.css`, Orbitron/JetBrains, oklch-Palette)
- **Navigation:** 13 Sidebar-Routes (`src/components/shell.tsx`)
- **Voice Mode:** `VoiceModeStage.tsx` — Mic-Level, Chat-Strip, Self-Test
- **Trading:** ZeusEdge v2 — COCKPIT/CHART/INTEL, Lightweight Charts, Drag-Drop Widgets
- **Workflows:** DAG-Builder, Live Runner, Cell Editor
- **Onboarding:** `Setup.tsx` Wizard

**UX-Tiefe:** Hoch für einen Single-Operator — alles in einer chromefreien Shell.  
**Schwächen:** Kein Mobile; Setup-Wizard noch nicht vollständig optional; Dev-Server-Umgebung empfindlich (siehe Launch-Fix).

### 5.2 ECC

- **UI:** Keine — Interaktion über Cursor/Codex/Claude Code/OpenCode
- **Operator UX:** CLI (`scripts/doctor.js`, `consult.js`), Dashboard-Skills
- **Demos:** `ui-demo` Skill, Remotion-Video-Skills

**Urteil:** JARVIS ist hier klar überlegen für ** visuelle Operations**; ECC für **IDE-native Entwickler**.

---

## 6. Sicherheit & Governance

| Kontrolle           | JARVIS                         | ECC                           |
| ------------------- | ------------------------------ | ----------------------------- |
| **Secret Storage**  | safeStorage, scan-secrets.mjs  | Dokumentiert, supply-chain CI |
| **CSP**             | Strikt, WASM scoped (`csp.ts`) | Harness-abhängig              |
| **Shell Exec**      | Advanced Mode + allowlist      | safety-guard Skill            |
| **Destructive Ops** | HITL when armed                | release-approval-gate tests   |
| **Trading Orders**  | G14 @ 100, MT5 token           | —                             |
| **Supply Chain**    | Husky pre-commit               | `scan-supply-chain-iocs.js`   |
| **AgentShield**     | —                              | npm `ecc-agentshield`         |

**JARVIS Vorteil:** Durchsetzung zur Laufzeit im Main Process.  
**ECC Vorteil:** Breitere Security-Dokumentation und Community-Audit-Tooling.

---

## 7. Integrationen & Ökosystem

### JARVIS

- **Composio:** Live-Katalog, OAuth, execute (gated)
- **MT5:** Python-Bridge, Token-Rotation
- **Browser:** browser-use Sidecar
- **LLM:** Anthropic, Gemini, Ollama, OpenAI, Qwen, GitHub Models — Flex Router
- **Social:** X/IG Post IPC (OAuth im Admin)

### ECC

- **MCP:** `.mcp.json`, `mcp-configs/`
- **Multi-Harness:** Cursor, Codex, Gemini, Zed, Copilot, OpenCode
- **GitHub App:** ecc-tools Marketplace
- **Skills:** x-api, postgres-patterns, redis-patterns, videodb, …

**Urteil:** ECC hat **breitere Dev-Integrationsfläche**; JARVIS hat **tiefere Ops-Integrationen** (Trading, Voice, Desktop).

---

## 8. Lücken — wo JARVIS hinter ECC zurückliegt

1. **Skill-Bibliothek:** ~790 vs. indexierte Vault-Skills — ECC gewinnt an Breite und Pflege.
2. **Cross-Harness:** JARVIS ist Electron-only; ECC läuft überall.
3. **Install/DX:** Kein One-Liner wie `install.sh`; Launcher musste Production-Pfad nutzen.
4. **i18n:** ECC 12 Sprachen; JARVIS überwiegend EN UI, DE Voice.
5. **Community / Stars:** ECC-Ecosystem (182K+ Stars laut README) vs. privates Ops-Projekt.
6. **Supply-Chain CI:** ECC script-tests für Release-Gates; JARVIS schlanker.
7. **Continuous Learning:** ECC v2 observer-loop; JARVIS Harness-Memory noch JSON/Embedding-Ebene.
8. **AgentShield-Äquivalent:** Kein dediziertes npm Security-Produkt.

---

## 9. Vorteile — wo JARVIS vor ECC liegt

1. **Unified Desktop Ops:** Eine App für Bridge, Trading, Voice, Admin, Evals.
2. **MT5 / ZeusEdge / Prop Maxing:** Einzigartig für Trading-Operator.
3. **Voice Pipeline:** End-to-end STT → Hermes → TTS mit UI-Feedback.
4. **Runtime HITL:** Modal + Telegram ohne manuelle Hook-Konfiguration.
5. **Deterministische Safety Bench:** G08/G11/G14 messbar @ 100.
6. **Hermes Router Gateway:** Omnichannel Inbound mit Reply-Router.
7. **Employee Scaffolds:** E-Mail, Invoice, Calendar, Shop (IPC vorhanden).
8. **Paper Trading Caps:** Harte €-Limits in `paper-trading.ts`.
9. **Workflow DAG + Cron:** `node-cron` Scheduler im Main Process.
10. **Production Electron Path:** Keychain, CSP, Single-Instance-Lock.

---

## 10. Scorecard (gewichtet, Skala 0–10)

| Kategorie             | Gewicht | JARVIS  | ECC     | Kommentar                                                               |
| --------------------- | ------- | ------- | ------- | ----------------------------------------------------------------------- |
| Operator UI/UX        | 15%     | **9**   | 2       | ECC hat keine App                                                       |
| Agent/Harness Runtime | 15%     | 7       | **9**   | ECC Skills + Breite                                                     |
| Voice & Multimodal    | 10%     | **8**   | 1       | JARVIS produktiv                                                        |
| Trading/Finance       | 10%     | **9**   | 0       | JARVIS Alleinsteller                                                    |
| Security/Governance   | 15%     | **8**   | **8**   | Runtime vs. Breadth                                                     |
| Integrations          | 10%     | 7       | **9**   | Composio vs. MCP-Masse                                                  |
| Testing/CI            | 10%     | 6       | **9**   | ECC 138 Tests                                                           |
| DX/Distribution       | 10%     | 5       | **9**   | npm + install.sh                                                        |
| Production Readiness  | 5%      | 6       | 7       | Beide rc/ dev-heavy                                                     |
| **Gewichtet gesamt**  | 100%    | **7.4** | **6.8** | Für **Operator-Desktop**; ECC gewinnt für **Dev-Harness** (~8.5 vs 4.0) |

_Methodik: Scores basieren auf Code-Sichtung, Testdatei-Zählung, README/Capability-Report — keine Benchmark-Laufzeit._

---

## 11. Empfehlungen — Was JARVIS von ECC übernehmen sollte

### P0 — Sofort (hoher ROI, geringer Scope)

| #   | Maßnahme                                              | ECC-Quelle                     | JARVIS-Ziel                             |
| --- | ----------------------------------------------------- | ------------------------------ | --------------------------------------- |
| 1   | **verification-loop** Skill in Harness-Eval einbinden | `skills/verification-loop/`    | `electron/harness/eval/`                |
| 2   | **token-budget-advisor** Heuristiken                  | `skills/token-budget-advisor/` | `electron/harness/eval/token-budget.ts` |
| 3   | **doctor**-ähnlicher CLI-Selfcheck                    | `scripts/doctor.js`            | Erweiterung `jarvis:system-selftest`    |
| 4   | **strategic-compact** für Context-Compression         | `skills/strategic-compact/`    | `electron/ai/router.ts`                 |

### P1 — Mittelfristig

| #   | Maßnahme                            | ECC-Quelle                       | JARVIS-Ziel                         |
| --- | ----------------------------------- | -------------------------------- | ----------------------------------- |
| 5   | **continuous-learning-v2** Observer | `skills/continuous-learning-v2/` | `userData/harness/` Delta-Snapshots |
| 6   | **skill-comply** Grader             | Python fixtures                  | Golden-Automation Tests             |
| 7   | **security-review** Checkliste      | `skills/security-review/`        | Pre-commit + Harness Phase          |
| 8   | **plan-orchestrate** für Swarm      | `skills/plan-orchestrate/`       | `electron/harness/swarm/`           |

### P2 — Strategisch

| #   | Maßnahme                                      | Notiz                                                   |
| --- | --------------------------------------------- | ------------------------------------------------------- |
| 9   | ECC Skill-Subset kurieren (~50 Ops-relevante) | In JARVIS Vault spiegeln, nicht 790 blind kopieren      |
| 10  | AgentShield-Scan optional                     | Vor Composio-Execute                                    |
| 11  | install.ps1 Pattern                           | Für NSIS-Postinstall Hooks                              |
| 12  | Cross-Harness Export                          | JARVIS Harness-Prompts als `.cursor/rules` exportierbar |

### Nicht übernehmen (bewusst)

- **Kein Verzicht auf Electron-Shell** — ECC ersetzt keine Desktop-Ops.
- **Kein 1:1 Skill-Import** — Token-Bloat; kuratiert bleiben.
- **Trading/MT5** — ECC bietet nichts Vergleichbares; dort führen bleiben.

---

## 12. Anhang — Messgrößen (24.08.2026)

| Signal                               | JARVIS            | ECC                   |
| ------------------------------------ | ----------------- | --------------------- |
| Testmodule (TS/TSX, ohne `.compare`) | ~46               | ~138 (JS/Py)          |
| Skills (SKILL.md)                    | Vault-indexiert   | ~790                  |
| Electron Main (LOC main.ts)          | ~2500             | —                     |
| package.json name                    | jarvis-ops-os     | ecc-universal         |
| Clone-Größe                          | —                 | ~2876 Dateien         |
| Playwright e2e                       | `e2e/app.spec.ts` | —                     |
| Benchmark Safety                     | G08/G11/G14 @ 100 | skill-comply fixtures |

---

## 13. Schlusswort

**JARVIS** ist das richtige Produkt, wenn der Operator eine **Windows-native Kommandozentrale** mit Trading, Voice und durchgesetzter HITL will. **ECC** ist das richtige Produkt, wenn der Operator **überall in IDEs** dieselbe Agent-Qualität mit maximaler Skill-Bibliothek will.

Die kluge Roadmap für Zac: **JARVIS Shell behalten**, ECC als **Pattern- und Skill-Lieferant** nutzen — nicht als Konkurrent, sondern als Upstream-Bibliothek. Der heutige Launch-Fix (Production-Launcher + Harness-IPC-Deduplizierung) schließt die kritische Lücke zwischen „Code vorhanden“ und „App sichtbar“.

---

_Erstellt: Session Fix + Vergleich, 24.08.2026 · Kein Commit in diesem Schritt._
