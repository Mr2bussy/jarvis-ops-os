# Admin Connections — Keys, OAuth & ehrliche Grenzen

**Stand:** 25. August 2026 · **UI:** Admin → **Connections**  
**Operator:** Zac

---

## Wenn ich alle Keys/OAuth habe — funktioniert dann alles?

**Nein — nicht automatisch alles.** Mit vollständigen Keys und OAuth schaltest du die **echten Integrationspfade** frei (Claude/Gemini/GPT-Aufrufe, Hermes-Telegram-Deliver, Composio-Katalog + verknüpfte Accounts, Web-Suche, MT5-Ping wenn der Bridge-Prozess läuft, Vault-Agenten-Scan). Was **weiterhin fehlt oder nur Scaffold/Partial** bleibt: Google Calendar ohne echten In-App-OAuth-Loop (Token-Paste / Composio), IMAP-IDLE nur wenn `imapflow` + Feature-Flag + laufender Listener, Shopify-KPIs ohne explizites Tool-Slug-Mapping, Social-Posting oft nur Key-Presence für HUD-Badges, Piper-TTS nur nach Binary-Install + Flag, Hermes inbound/Voice-Latenz abhängig von installiertem `hermes-agent`/Warm-Pool, und im **packaged Build** greifen **keine** `.env`-Fallbacks — alles muss in safeStorage liegen. Keys = Kraftstoff; Live-Betrieb braucht zusätzlich laufende Sidecars, Feature-Flags und die noch offenen API-Verdrahtungen.

---

## UI öffnen

1. JARVIS als **Electron-Desktop-App** starten (nicht nur Vite-Browser-Tab).
2. Navigation: **Admin / Setup** (Command-Palette `Ctrl+K` → „Admin / Setup“).
3. Tab **◆ CONNECTIONS** (Standard-Tab).
4. Optional: Setup-Wizard erneut über **RE-RUN SETUP** im Admin-Header.

---

## Status-Legende

| Status         | Bedeutung                                                  |
| -------------- | ---------------------------------------------------------- |
| `missing`      | Key/OAuth fehlt                                            |
| `connected`    | gespeichert / Probe ok                                     |
| `error`        | Key da, Probe fehlgeschlagen (z. B. MT5 offline)           |
| `needs_rotate` | Secret älter als Rotate-Fenster (~90 Tage, via `__SET_AT`) |

Maturity-Badges: **LIVE** · **PARTIAL** · **SCAFFOLD** (ehrlich neben der Connection).

---

## Checkliste — alle Connections

### Brain / LLM

| ID                 | Keys                  | Auth | Maturity | Freischaltung                         |
| ------------------ | --------------------- | ---- | -------- | ------------------------------------- |
| Anthropic Claude   | `ANTHROPIC_API_KEY`   | Key  | live     | Console, Briefings, primärer Complete |
| OpenAI             | `OPENAI_API_KEY`      | Key  | live     | flex-complete Route                   |
| Gemini             | `GEMINI_API_KEY`      | Key  | live     | Voice/STT-Pfad                        |
| GitHub Models      | `GITHUB_TOKEN`        | Key  | live     | Voice-Fallback                        |
| Qwen / DashScope   | `DASHSCOPE_API_KEY`   | Key  | live     | Free-tier Route                       |
| Mistral / DeepSeek | jeweilige `*_API_KEY` | Key  | live     | Model-Picker                          |
| Ollama             | `OLLAMA_HOST` / Model | Host | live     | Offline — `ollama serve` nötig        |
| Active Model       | `JARVIS_MODEL`        | Key  | live     | Default-Model-ID                      |

### Messaging / Hermes

| ID       | Keys                                     | Maturity | Hinweis                     |
| -------- | ---------------------------------------- | -------- | --------------------------- |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL` | live     | Gateway starten             |
| Discord  | Bot + Channel                            | partial  | Deliver stärker als Inbound |
| Slack    | `SLACK_WEBHOOK_URL`                      | live     | Outbound Webhook            |

### Email

| IMAP | `IMAP_HOST/USER/PASSWORD` | **partial** | Classify/Draft; IDLE braucht imapflow + Flag |

### Calendar

| Google Calendar | `GOOGLE_CALENDAR_TOKEN` oder Composio `googlecalendar` | **scaffold** | Propose-only / HITL; kein voller OAuth-Loop |

### Trading / MT5

| MT5 Bridge | Host/Port via `config.setMt5`, optional `MT5_TOKEN` | live | `mt5_bridge/bridge.py` muss laufen |
| Bridge Token | `JARVIS_BRIDGE_TOKEN` | live | Auto — nicht manuell setzen |

### Shop / Composio

| Composio API | `COMPOSIO_API_KEY` | live | Katalog + Execute · **TEST** in Connections |
| GitHub / Shopify / Gmail OAuth | Composio initiate · **OAUTH ↗** | live/partial | Shopify: Tool-Slug in Ecommerce mappen |

### Search

| Brave / Tavily / SerpAPI | jeweilige Keys | live | Mindestens einer empfohlen |

### Voice

| Piper TTS | `PIPER_PATH`, `PIPER_MODEL` | partial | Install-Skript + Flag |
| Ollama STT | `OLLAMA_STT_MODEL` | partial | Default bleibt Xenova Whisper |

### Social / Content

| YouTube | `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID` | partial | Metrics badge; upload/post API draft-only |
| Instagram | `INSTAGRAM_TOKEN`, `INSTAGRAM_USER_ID` | partial | Graph token paste |
| TikTok | `TIKTOK_TOKEN` | scaffold | HUD only |
| X / Twitter | Bearer + **OAuth1 quartet** (`TWITTER_API_KEY/SECRET` + `ACCESS_TOKEN/SECRET`) | partial | **Live** `content:publish` wenn OAuth1 komplett |
| LinkedIn | `LINKEDIN_TOKEN`, `LINKEDIN_ORG_URN` | scaffold | Token paste |
| Twitch | `TWITCH_TOKEN` | scaffold | Content TW gate |

### Agents Vault

| Agents Path | `JARVIS_AGENTS_PATH` | live | auch Admin → Vault Paths |
| Skills Index | `JARVIS_SKILLS_INDEX` | live | Allow-list + Arsenal |

### Automation

| n8n | `N8N_WEBHOOK_URL` (+ API Key) | partial | Connectivity-Test |

---

## Was „100% live“ von Zac noch braucht (Credentials / Operator)

Die **Verdrahtung** (Admin Connections UI + TEST/OAUTH, Ecommerce `commerce:sync`, Content `content:publish`) ist fertig. Ohne Zac’s echte Secrets bleibt der Live-Pfad gated — das ist Absicht, keine Code-Lücke.

| Was Zac liefert                          | Wo eintragen                                       | Schaltet frei                                       |
| ---------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `COMPOSIO_API_KEY`                       | Connections → Composio · **TEST**                  | Katalog, OAuth initiate, Ecommerce Sync             |
| Shopify (und ggf. GitHub/Gmail) OAuth    | Connections → **OAUTH ↗** nach Composio-Key        | Linked account ACTIVE                               |
| Shopify Tool-Slugs (operator-spezifisch) | Ecommerce Health-Slug + ggf. `SHOPIFY_*_TOOL_SLUG` | Produkte/Orders gemessen                            |
| X OAuth1 quartet                         | Connections → X / Twitter                          | Live-Post via `content:publish`                     |
| YT / IG / TikTok / LI / Twitch Tokens    | Connections → Social                               | Gates öffnen; Post-APIs außer X oft noch draft-only |
| Packaged: alle Keys in safeStorage       | Admin (kein `.env`)                                | Production build                                    |

**Smoke (keine Secrets gedruckt):**

```bash
pnpm smoke:connections
# oder: node scripts/connections-smoke.mjs
# optional: --config=%APPDATA%\jarvis-ops-os\jarvis-config.json
```

Exit immer 0 + SUMMARY (`set` / `partial` / `missing`).

---

## Was Keys freischalten vs. was noch Arbeit braucht

| Bereich        | Mit Keys/OAuth         | Zusätzlich nötig                                           |
| -------------- | ---------------------- | ---------------------------------------------------------- |
| Chat / Console | LLM-Calls              | Packaged: Keys in safeStorage (kein `.env`)                |
| Voice          | STT/LLM-Routen         | ffmpeg/Whisper-Cache; Hermes-Agent für volle Voice-Session |
| Hermes Router  | Deliver/Poll-Config    | Gateway **start**; Telegram Bot live                       |
| Composio       | Katalog, OAuth-Browser | Tool-Slugs für Shop; Linked Accounts ACTIVE                |
| MT5            | Auth/Host              | Python-Bridge Prozess                                      |
| IMAP           | Creds gespeichert      | `imapflow`, IDLE-Start, Feature-Flag                       |
| Calendar       | Token vorhanden        | Live Google Insert API / OAuth-App                         |
| Social HUD     | Badge grün             | Platform APIs für Post/Metrics                             |
| Piper          | Pfade gesetzt          | Binary + `.onnx` + `voice.piperTts`                        |

---

## Sicherheit

- Speicherung: Electron **safeStorage** (AES über OS-Keychain, Fallback Base64).
- Packaged Build: `getDecryptedKey` liest **kein** `.env` mehr.
- Rotation: Connections speichert `KEY__SET_AT`; Status `needs_rotate` nach ~90 Tagen (Hinweis, keine Zwangs-Invalidierung).

Siehe auch: `docs/PRODUCTION-IMPLEMENTATION-STATUS.md`, `docs/FULL-SCOPE-GAP-AUDIT.md`, `docs/PIPER-TTS.md`.
