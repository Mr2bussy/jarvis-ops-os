/**
 * Canonical Admin → Connections registry.
 * Keys match what Electron main / employees / search / gateway actually read.
 * Social content metrics use connectors.ts; Hermes outbound uses TELEGRAM_*, DISCORD_*, SLACK_*.
 */
// @ts-nocheck

export type ConnectionDomain =
  | 'brain'
  | 'messaging'
  | 'email'
  | 'calendar'
  | 'trading'
  | 'shop'
  | 'search'
  | 'voice'
  | 'social'
  | 'agents'
  | 'automation';

export type ConnectionAuth = 'key' | 'oauth' | 'path' | 'host' | 'auto';

export type ConnectionMaturity = 'live' | 'partial' | 'scaffold';

export interface ConnectionField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  /** Non-secret config (host, model name, path). */
  kind?: 'text' | 'password' | 'path';
}

export interface AdminConnection {
  id: string;
  domain: ConnectionDomain;
  label: string;
  /** Short HUD blurb */
  blurb: string;
  auth: ConnectionAuth;
  /** required = core chat/voice; recommended = major feature; optional = nicety */
  priority: 'required' | 'recommended' | 'optional';
  maturity: ConnectionMaturity;
  /** Honest label when maturity !== live */
  scaffoldNote?: string;
  /** Primary safeStorage keys — all must be present for "connected" (except host/mt5 specials) */
  keys: ConnectionField[];
  /** Alternate key names accepted by backend (any one counts as present for that slot) */
  aliases?: Record<string, string[]>;
  /** Composio toolkit slug for OAuth initiate */
  composioToolkit?: string;
  /** Open external docs / console */
  docsUrl?: string;
  /** Special probe id handled in ConnectionsPanel */
  probe?: 'mt5' | 'ollama' | 'composio' | 'imap' | 'gateway-tg' | 'piper' | 'search' | 'vault';
  rotateDays?: number;
}

export const DOMAIN_META: Record<ConnectionDomain, { label: string; color: string; order: number }> = {
  brain: { label: 'BRAIN / LLM', color: '#e879f9', order: 0 },
  messaging: { label: 'MESSAGING / HERMES', color: '#22d3ee', order: 1 },
  email: { label: 'EMAIL / IMAP', color: '#fb923c', order: 2 },
  calendar: { label: 'CALENDAR', color: '#38bdf8', order: 3 },
  trading: { label: 'TRADING / MT5', color: '#4ade80', order: 4 },
  shop: { label: 'SHOP / COMPOSIO', color: '#a78bfa', order: 5 },
  search: { label: 'SEARCH', color: '#fb923c', order: 6 },
  voice: { label: 'VOICE / STT / TTS', color: '#f472b6', order: 7 },
  social: { label: 'SOCIAL / CONTENT', color: '#60a5fa', order: 8 },
  agents: { label: 'AGENTS VAULT', color: '#c4b5fd', order: 9 },
  automation: { label: 'AUTOMATION', color: '#fbbf24', order: 10 },
};

export const ADMIN_CONNECTIONS: AdminConnection[] = [
  // ── Brain ───────────────────────────────────────────────────────────────────
  {
    id: 'anthropic',
    domain: 'brain',
    label: 'Anthropic Claude',
    blurb: 'Primary reasoning — Console, Briefings, Voice fallback',
    auth: 'key',
    priority: 'required',
    maturity: 'live',
    keys: [
      { key: 'ANTHROPIC_API_KEY', label: 'API KEY', placeholder: 'sk-ant-…', secret: true },
      { key: 'ANTHROPIC_BASE_URL', label: 'BASE URL', placeholder: 'https://api.anthropic.com (optional)' },
    ],
    docsUrl: 'https://console.anthropic.com/',
    rotateDays: 90,
  },
  {
    id: 'openai',
    domain: 'brain',
    label: 'OpenAI',
    blurb: 'Optional GPT route via flex-complete',
    auth: 'key',
    priority: 'optional',
    maturity: 'live',
    keys: [
      { key: 'OPENAI_API_KEY', label: 'API KEY', placeholder: 'sk-…', secret: true },
      { key: 'OPENAI_BASE_URL', label: 'BASE URL', placeholder: 'https://api.openai.com/v1' },
      { key: 'OPENAI_ORG_ID', label: 'ORG ID', placeholder: 'org-… (optional)' },
    ],
    docsUrl: 'https://platform.openai.com/api-keys',
    rotateDays: 90,
  },
  {
    id: 'gemini',
    domain: 'brain',
    label: 'Google Gemini',
    blurb: 'Voice STT / Gemini complete path',
    auth: 'key',
    priority: 'recommended',
    maturity: 'live',
    keys: [
      { key: 'GEMINI_API_KEY', label: 'API KEY', placeholder: 'AIza…', secret: true },
      { key: 'GOOGLE_PROJECT_ID', label: 'PROJECT ID', placeholder: 'optional' },
    ],
    docsUrl: 'https://aistudio.google.com/apikey',
    rotateDays: 90,
  },
  {
    id: 'github-models',
    domain: 'brain',
    label: 'GitHub Models',
    blurb: 'Voice fallback (~free with GitHub Pro)',
    auth: 'key',
    priority: 'recommended',
    maturity: 'live',
    keys: [{ key: 'GITHUB_TOKEN', label: 'GITHUB TOKEN', placeholder: 'ghp_… / github_pat_…', secret: true }],
    docsUrl: 'https://github.com/settings/tokens',
    rotateDays: 90,
  },
  {
    id: 'qwen',
    domain: 'brain',
    label: 'Qwen / DashScope',
    blurb: 'OpenAI-compatible free-tier route',
    auth: 'key',
    priority: 'optional',
    maturity: 'live',
    keys: [{ key: 'DASHSCOPE_API_KEY', label: 'API KEY', placeholder: 'sk-…', secret: true }],
    docsUrl: 'https://dashscope.console.aliyun.com/',
    rotateDays: 90,
  },
  {
    id: 'mistral',
    domain: 'brain',
    label: 'Mistral',
    blurb: 'Optional provider in model picker',
    auth: 'key',
    priority: 'optional',
    maturity: 'live',
    keys: [{ key: 'MISTRAL_API_KEY', label: 'API KEY', placeholder: '…', secret: true }],
    docsUrl: 'https://console.mistral.ai/',
    rotateDays: 90,
  },
  {
    id: 'deepseek',
    domain: 'brain',
    label: 'DeepSeek',
    blurb: 'Optional provider in model picker',
    auth: 'key',
    priority: 'optional',
    maturity: 'live',
    keys: [{ key: 'DEEPSEEK_API_KEY', label: 'API KEY', placeholder: '…', secret: true }],
    docsUrl: 'https://platform.deepseek.com/',
    rotateDays: 90,
  },
  {
    id: 'ollama',
    domain: 'brain',
    label: 'Ollama (Local)',
    blurb: 'Offline LLM — ollama serve must be running',
    auth: 'host',
    priority: 'optional',
    maturity: 'live',
    keys: [
      { key: 'OLLAMA_HOST', label: 'HOST', placeholder: 'http://localhost:11434' },
      { key: 'OLLAMA_BASE_URL', label: 'BASE URL', placeholder: 'alias of host (optional)' },
      { key: 'OLLAMA_MODEL', label: 'DEFAULT MODEL', placeholder: 'qwen3:latest' },
      { key: 'OLLAMA_API_KEY', label: 'API KEY', placeholder: 'only if auth enabled', secret: true },
    ],
    probe: 'ollama',
    docsUrl: 'https://ollama.com',
  },
  {
    id: 'jarvis-model',
    domain: 'brain',
    label: 'Active JARVIS Model',
    blurb: 'Default model id for complete path',
    auth: 'key',
    priority: 'recommended',
    maturity: 'live',
    keys: [{ key: 'JARVIS_MODEL', label: 'MODEL ID', placeholder: 'claude-haiku-4-5' }],
  },

  // ── Messaging ───────────────────────────────────────────────────────────────
  {
    id: 'telegram',
    domain: 'messaging',
    label: 'Telegram (Hermes)',
    blurb: 'Inbound poll + outbound deliver + HITL mirror',
    auth: 'key',
    priority: 'recommended',
    maturity: 'live',
    keys: [
      { key: 'TELEGRAM_BOT_TOKEN', label: 'BOT TOKEN', placeholder: '123456:ABC…', secret: true },
      { key: 'TELEGRAM_CHANNEL', label: 'CHANNEL / CHAT ID', placeholder: '@channel or -100…' },
    ],
    aliases: { TELEGRAM_CHANNEL: ['TELEGRAM_CHAT_ID'] },
    probe: 'gateway-tg',
    docsUrl: 'https://t.me/BotFather',
    rotateDays: 180,
  },
  {
    id: 'discord',
    domain: 'messaging',
    label: 'Discord (Hermes)',
    blurb: 'Outbound deliver when gateway running',
    auth: 'key',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote: 'Deliver path live; inbound polling thinner than Telegram',
    keys: [
      { key: 'DISCORD_BOT_TOKEN', label: 'BOT TOKEN', placeholder: '…', secret: true },
      { key: 'DISCORD_CHANNEL_ID', label: 'CHANNEL ID', placeholder: 'snowflake' },
    ],
    docsUrl: 'https://discord.com/developers/applications',
  },
  {
    id: 'slack',
    domain: 'messaging',
    label: 'Slack Webhook',
    blurb: 'Hermes outbound via incoming webhook',
    auth: 'key',
    priority: 'optional',
    maturity: 'live',
    keys: [
      {
        key: 'SLACK_WEBHOOK_URL',
        label: 'WEBHOOK URL',
        placeholder: 'https://hooks.slack.com/…',
        secret: true,
      },
    ],
    docsUrl: 'https://api.slack.com/messaging/webhooks',
  },

  // ── Email ───────────────────────────────────────────────────────────────────
  {
    id: 'imap',
    domain: 'email',
    label: 'IMAP Inbox',
    blurb: 'Employee email + optional IDLE listen',
    auth: 'key',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote:
      'Keys unlock classify/draft; live IDLE needs imapflow + feature flag — drafts stay undo-first',
    keys: [
      { key: 'IMAP_HOST', label: 'HOST', placeholder: 'imap.example.com' },
      { key: 'IMAP_USER', label: 'USER', placeholder: 'you@example.com' },
      { key: 'IMAP_PASSWORD', label: 'PASSWORD / APP-PASS', placeholder: '••••', secret: true },
    ],
    probe: 'imap',
  },

  // ── Calendar ────────────────────────────────────────────────────────────────
  {
    id: 'gcal',
    domain: 'calendar',
    label: 'Google Calendar',
    blurb: 'Propose-only insert behind HITL',
    auth: 'oauth',
    priority: 'optional',
    maturity: 'scaffold',
    scaffoldNote:
      'Token check only — no browser OAuth loop yet; paste refresh/access token or use Composio Gmail/Calendar',
    keys: [
      {
        key: 'GOOGLE_CALENDAR_TOKEN',
        label: 'OAUTH / ACCESS TOKEN',
        placeholder: 'ya29… or refresh',
        secret: true,
      },
    ],
    composioToolkit: 'googlecalendar',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
  },

  // ── Trading ─────────────────────────────────────────────────────────────────
  {
    id: 'mt5',
    domain: 'trading',
    label: 'MT5 Bridge',
    blurb: 'Local Python bridge — host/port + optional token',
    auth: 'host',
    priority: 'recommended',
    maturity: 'live',
    scaffoldNote: 'Needs mt5_bridge/bridge.py running on the trading PC',
    keys: [
      { key: 'MT5_HOST', label: 'HOST', placeholder: '127.0.0.1' },
      { key: 'MT5_PORT', label: 'PORT', placeholder: '1234' },
      { key: 'MT5_TOKEN', label: 'AUTH TOKEN', placeholder: 'optional override', secret: true },
    ],
    probe: 'mt5',
  },
  {
    id: 'bridge-token',
    domain: 'trading',
    label: 'JARVIS Bridge Token',
    blurb: 'Auto-rotated secret for MT5 / browser-use sidecars',
    auth: 'auto',
    priority: 'optional',
    maturity: 'live',
    scaffoldNote: 'Minted by Electron — do not paste unless running bridge.py standalone',
    keys: [{ key: 'JARVIS_BRIDGE_TOKEN', label: 'TOKEN (auto)', placeholder: '(managed)', secret: true }],
  },

  // ── Shop / Composio ─────────────────────────────────────────────────────────
  {
    id: 'composio',
    domain: 'shop',
    label: 'Composio API',
    blurb: 'Catalog + OAuth for 485 apps (GitHub, Shopify, Gmail…)',
    auth: 'key',
    priority: 'recommended',
    maturity: 'live',
    keys: [{ key: 'COMPOSIO_API_KEY', label: 'API KEY', placeholder: '…', secret: true }],
    probe: 'composio',
    docsUrl: 'https://app.composio.dev',
    rotateDays: 90,
  },
  {
    id: 'composio-github',
    domain: 'shop',
    label: 'GitHub (Composio OAuth)',
    blurb: 'Linked account for Integrations execute',
    auth: 'oauth',
    priority: 'optional',
    maturity: 'live',
    keys: [],
    composioToolkit: 'github',
    docsUrl: 'https://app.composio.dev',
  },
  {
    id: 'composio-shopify',
    domain: 'shop',
    label: 'Shopify (Composio OAuth)',
    blurb: 'Shop KPIs need toolkit + mapped tool slug',
    auth: 'oauth',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote: 'OAuth connects account; catalog/orders need explicit Composio tool mapping in Ecommerce',
    keys: [],
    composioToolkit: 'shopify',
  },
  {
    id: 'composio-gmail',
    domain: 'shop',
    label: 'Gmail (Composio OAuth)',
    blurb: 'Alternative to raw IMAP for Gmail actions',
    auth: 'oauth',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote: 'OAuth via Composio; employee email path still prefers IMAP keys',
    keys: [],
    composioToolkit: 'gmail',
  },

  // ── Search ──────────────────────────────────────────────────────────────────
  {
    id: 'brave',
    domain: 'search',
    label: 'Brave Search',
    blurb: 'Preferred web search provider',
    auth: 'key',
    priority: 'recommended',
    maturity: 'live',
    keys: [{ key: 'BRAVE_API_KEY', label: 'API KEY', placeholder: 'BSA…', secret: true }],
    aliases: { BRAVE_API_KEY: ['BRAVE_SEARCH_API_KEY'] },
    probe: 'search',
    docsUrl: 'https://api.search.brave.com/app/keys',
  },
  {
    id: 'tavily',
    domain: 'search',
    label: 'Tavily',
    blurb: 'Fallback search if Brave unset',
    auth: 'key',
    priority: 'optional',
    maturity: 'live',
    keys: [{ key: 'TAVILY_API_KEY', label: 'API KEY', placeholder: 'tvly-…', secret: true }],
    docsUrl: 'https://tavily.com/',
  },
  {
    id: 'serpapi',
    domain: 'search',
    label: 'SerpAPI',
    blurb: 'Third search fallback',
    auth: 'key',
    priority: 'optional',
    maturity: 'live',
    keys: [{ key: 'SERPAPI_KEY', label: 'API KEY', placeholder: '…', secret: true }],
    aliases: { SERPAPI_KEY: ['SERPAPI_API_KEY'] },
    docsUrl: 'https://serpapi.com/',
  },

  // ── Voice ───────────────────────────────────────────────────────────────────
  {
    id: 'piper',
    domain: 'voice',
    label: 'Piper TTS',
    blurb: 'Local neural TTS — SpeechSynthesis fallback if missing',
    auth: 'path',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote: 'Install via scripts/install-piper.ps1 · enable voice.piperTts flag',
    keys: [
      {
        key: 'PIPER_PATH',
        label: 'PIPER.EXE PATH',
        placeholder: '%LOCALAPPDATA%\\jarvis-piper\\…',
        kind: 'path',
      },
      { key: 'PIPER_MODEL', label: 'VOICE .ONNX', placeholder: 'de_DE-….onnx', kind: 'path' },
    ],
    probe: 'piper',
    docsUrl: undefined,
  },
  {
    id: 'ollama-stt',
    domain: 'voice',
    label: 'Ollama Whisper STT',
    blurb: 'Local STT model name when using Ollama path',
    auth: 'key',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote: 'Whisper via Ollama optional; free Xenova whisper is default',
    keys: [{ key: 'OLLAMA_STT_MODEL', label: 'STT MODEL', placeholder: 'whisper' }],
  },

  // ── Social (canonical connectors.ts keys) ───────────────────────────────────
  {
    id: 'social-yt',
    domain: 'social',
    label: 'YouTube',
    blurb: 'Content metrics probe',
    auth: 'key',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote: 'Key presence = connected in HUD; posting/upload still needs OAuth extras (YT_*)',
    keys: [
      { key: 'YOUTUBE_API_KEY', label: 'DATA API KEY', placeholder: 'AIza…', secret: true },
      { key: 'YOUTUBE_CHANNEL_ID', label: 'CHANNEL ID', placeholder: 'UC…' },
    ],
    aliases: { YOUTUBE_API_KEY: ['YT_API_KEY'] },
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  {
    id: 'social-ig',
    domain: 'social',
    label: 'Instagram',
    blurb: 'Content metrics probe',
    auth: 'key',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote: 'Graph token paste — no Meta OAuth loop in-app',
    keys: [
      { key: 'INSTAGRAM_TOKEN', label: 'ACCESS TOKEN', placeholder: '…', secret: true },
      { key: 'INSTAGRAM_USER_ID', label: 'USER ID', placeholder: '178414…' },
    ],
    aliases: { INSTAGRAM_TOKEN: ['IG_ACCESS_TOKEN'], INSTAGRAM_USER_ID: ['IG_USER_ID'] },
    docsUrl: 'https://developers.facebook.com/apps/',
  },
  {
    id: 'social-tt',
    domain: 'social',
    label: 'TikTok',
    blurb: 'Content metrics probe',
    auth: 'key',
    priority: 'optional',
    maturity: 'scaffold',
    scaffoldNote: 'Token stored for HUD; live Display API wiring thin',
    keys: [{ key: 'TIKTOK_TOKEN', label: 'ACCESS TOKEN', placeholder: '…', secret: true }],
    aliases: { TIKTOK_TOKEN: ['TT_ACCESS_TOKEN'] },
    docsUrl: 'https://developers.tiktok.com/',
  },
  {
    id: 'social-x',
    domain: 'social',
    label: 'X / Twitter',
    blurb: 'Bearer = HUD metrics; OAuth1 quartet = live content:publish',
    auth: 'key',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote:
      'Bearer alone = connected badge. Live post needs TWITTER_API_KEY + SECRET + ACCESS_TOKEN + ACCESS_SECRET',
    keys: [
      { key: 'TWITTER_BEARER_TOKEN', label: 'BEARER TOKEN', placeholder: 'AAAA…', secret: true },
      { key: 'TWITTER_API_KEY', label: 'OAUTH1 API KEY', placeholder: 'consumer key', secret: true },
      { key: 'TWITTER_API_SECRET', label: 'OAUTH1 API SECRET', placeholder: 'consumer secret', secret: true },
      { key: 'TWITTER_ACCESS_TOKEN', label: 'ACCESS TOKEN', placeholder: '…', secret: true },
      { key: 'TWITTER_ACCESS_SECRET', label: 'ACCESS SECRET', placeholder: '…', secret: true },
    ],
    aliases: { TWITTER_BEARER_TOKEN: ['X_BEARER_TOKEN'] },
    docsUrl: 'https://developer.twitter.com/en/portal/dashboard',
  },
  {
    id: 'social-li',
    domain: 'social',
    label: 'LinkedIn',
    blurb: 'Content metrics probe',
    auth: 'key',
    priority: 'optional',
    maturity: 'scaffold',
    scaffoldNote: 'Token paste only — Marketing API posting not fully wired',
    keys: [
      { key: 'LINKEDIN_TOKEN', label: 'ACCESS TOKEN', placeholder: '…', secret: true },
      { key: 'LINKEDIN_ORG_URN', label: 'ORG URN', placeholder: 'urn:li:organization:…' },
    ],
    aliases: { LINKEDIN_TOKEN: ['LI_ACCESS_TOKEN'], LINKEDIN_ORG_URN: ['LI_ORG_ID'] },
    docsUrl: 'https://www.linkedin.com/developers/apps',
  },
  {
    id: 'social-tw',
    domain: 'social',
    label: 'Twitch',
    blurb: 'Content TW platform gate (content:publish)',
    auth: 'key',
    priority: 'optional',
    maturity: 'scaffold',
    scaffoldNote: 'Key presence unlocks publish gate; live Helix post API still draft-only',
    keys: [{ key: 'TWITCH_TOKEN', label: 'ACCESS TOKEN', placeholder: '…', secret: true }],
    docsUrl: 'https://dev.twitch.tv/console',
  },

  // ── Agents vault ────────────────────────────────────────────────────────────
  {
    id: 'agents-path',
    domain: 'agents',
    label: 'Agents Vault Path',
    blurb: 'Folder with *.agent.md — also Admin → Vault Paths',
    auth: 'path',
    priority: 'recommended',
    maturity: 'live',
    keys: [{ key: 'JARVIS_AGENTS_PATH', label: 'AGENTS PATH', placeholder: 'G:\\…\\agents', kind: 'path' }],
    probe: 'vault',
  },
  {
    id: 'skills-index',
    domain: 'agents',
    label: 'Skills Index',
    blurb: 'skills-index.json path (allow-list + Arsenal)',
    auth: 'path',
    priority: 'optional',
    maturity: 'live',
    keys: [
      { key: 'JARVIS_SKILLS_INDEX', label: 'INDEX PATH', placeholder: '…\\skills-index.json', kind: 'path' },
    ],
  },

  // ── Automation ──────────────────────────────────────────────────────────────
  {
    id: 'n8n',
    domain: 'automation',
    label: 'n8n Webhook',
    blurb: 'Optional workflow webhook + API ping',
    auth: 'key',
    priority: 'optional',
    maturity: 'partial',
    scaffoldNote: 'Connectivity test only — workflows live in n8n',
    keys: [
      { key: 'N8N_WEBHOOK_URL', label: 'WEBHOOK URL', placeholder: 'http://localhost:5678/webhook/…' },
      { key: 'N8N_API_KEY', label: 'API KEY', placeholder: 'optional', secret: true },
    ],
  },
];

export function connectionsByDomain(): {
  domain: ConnectionDomain;
  meta: (typeof DOMAIN_META)[ConnectionDomain];
  items: AdminConnection[];
}[] {
  const map = new Map<ConnectionDomain, AdminConnection[]>();
  for (const c of ADMIN_CONNECTIONS) {
    const list = map.get(c.domain) ?? [];
    list.push(c);
    map.set(c.domain, list);
  }
  return [...map.entries()]
    .map(([domain, items]) => ({ domain, meta: DOMAIN_META[domain], items }))
    .sort((a, b) => a.meta.order - b.meta.order);
}

export function setAtKey(storeName: string): string {
  return `${storeName}__SET_AT`;
}
