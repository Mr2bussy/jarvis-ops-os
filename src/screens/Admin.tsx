// @ts-nocheck
import { useState } from 'react';
import { DraggableTabs, type DragTab } from '../components/draggable';
import { ScreenHeader } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET } from '../theme';
import { ModelsTab } from './admin/ModelsTab';
import { ConnectorsTab } from './admin/ConnectorsTab';
import { LLM_MODELS, CONNECTORS, type AdminTab } from './admin/admin-data';

/* ── Paths tab ──────────────────────────────────────────────────────────────── */
function PathsTab() {
  const paths = [
    {
      label: 'VAULT ROOT',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb',
      color: CYAN,
    },
    {
      label: 'AGENTS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\agents',
      color: VIOLET,
    },
    {
      label: 'SKILLS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\skills',
      color: JADE,
    },
    {
      label: 'PROMPTS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\prompts',
      color: AMBER,
    },
    {
      label: 'INSTRUCTIONS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\instructions',
      color: '#38bdf8',
    },
    {
      label: 'ANTIGRAVITY',
      value:
        'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\antigravity-awesome-skills\\skills',
      color: VIOLET,
    },
    {
      label: 'GC COLLECTIONS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\github-gamechangers',
      color: '#c8fb4e',
    },
    {
      label: 'AI APPS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\awesome-ai-apps',
      color: '#e879f9',
    },
    {
      label: 'PLUGINS',
      value: 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\plugins',
      color: '#fb923c',
    },
    { label: 'SKILLS INDEX', value: 'G:\\jarvis-ops-os\\src\\data\\skills-index.json', color: CYAN },
    { label: 'MT5 BRIDGE', value: 'G:\\jarvis-ops-os\\mt5_bridge\\bridge.py', color: JADE },
    { label: 'APP ROOT', value: 'G:\\jarvis-ops-os', color: 'var(--cyan-dim)' },
  ];

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
      <div
        className="font-mono"
        style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginBottom: 12, letterSpacing: '0.1em' }}
      >
        <span style={{ color: CYAN_BRIGHT }}>CONFIGURED PATHS</span> · Click to copy
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {paths.map((p) => (
          <div
            key={p.label}
            className="holo"
            style={{
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
            onClick={() => navigator.clipboard.writeText(p.value)}
          >
            <div>
              <div
                className="hud-label"
                style={{ fontSize: 8, color: p.color, letterSpacing: '0.22em', marginBottom: 3 }}
              >
                {p.label}
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 9.5, color: 'var(--fg)', wordBreak: 'break-all' }}
              >
                {p.value}
              </div>
            </div>
            <span
              className="hud-label"
              style={{
                fontSize: 7,
                color: 'var(--cyan-dim)',
                flexShrink: 0,
                border: '1px solid var(--line-soft)',
                padding: '2px 6px',
              }}
            >
              COPY
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Admin Tools Tab ─────────────────────────────────────────────────────────── */
interface AdminTool {
  id: string;
  label: string;
  desc: string;
  category: string;
  icon: string;
}

const ADMIN_TOOL_LIST: AdminTool[] = [
  {
    id: 'backup',
    label: 'Backup Manager',
    desc: 'Trigger and schedule automated backups of config, workspace, and agent files',
    category: 'DATA',
    icon: '◎',
  },
  {
    id: 'log-viewer',
    label: 'Log Viewer',
    desc: 'Tail, filter, and search real-time application logs and Electron process output',
    category: 'DEBUG',
    icon: '◈',
  },
  {
    id: 'error-tracker',
    label: 'Error Tracker',
    desc: 'View recent uncaught exceptions, stack traces, and IPC errors across the app',
    category: 'DEBUG',
    icon: '⚠',
  },
  {
    id: 'health-check',
    label: 'Health Dashboard',
    desc: 'Ping all connected services: Claude API, MT5 bridge, ZeusBot, local models',
    category: 'MONITOR',
    icon: '◉',
  },
  {
    id: 'perf-profiler',
    label: 'Performance Profiler',
    desc: 'Measure startup time, IPC latency, render cycles, and memory allocation',
    category: 'PERF',
    icon: '◆',
  },
  {
    id: 'cache-mgr',
    label: 'Cache Manager',
    desc: 'Inspect and flush app caches: response cache, agent index, workflow state',
    category: 'DATA',
    icon: '◫',
  },
  {
    id: 'feature-flags',
    label: 'Feature Flags',
    desc: 'Enable/disable experimental features, beta modules, and dev overrides',
    category: 'CONFIG',
    icon: '◬',
  },
  {
    id: 'webhook-tester',
    label: 'Webhook Tester',
    desc: 'Send test POST/GET webhooks to external endpoints with custom payloads',
    category: 'NETWORK',
    icon: '⬡',
  },
  {
    id: 'env-inspector',
    label: 'Env Inspector',
    desc: 'View all active environment variables, .env file values, and injected config',
    category: 'CONFIG',
    icon: '▣',
  },
  {
    id: 'api-keys',
    label: 'API Key Audit',
    desc: 'Verify all stored API keys: expiry, permissions, last-used, vault integrity',
    category: 'SECURITY',
    icon: '◇',
  },
  {
    id: 'rate-limiter',
    label: 'Rate Limiter',
    desc: 'Configure per-model API call limits, burst caps, and cooldown windows',
    category: 'CONFIG',
    icon: '▤',
  },
  {
    id: 'session-mgr',
    label: 'Session Manager',
    desc: 'Inspect active sessions, localStorage state, and clear stale session data',
    category: 'DATA',
    icon: '▦',
  },
  {
    id: 'audit-log',
    label: 'Audit Log',
    desc: 'Full audit trail: UI actions, IPC calls, file writes, API requests with actors',
    category: 'SECURITY',
    icon: '◎',
  },
  {
    id: 'db-browser',
    label: 'DB Browser',
    desc: 'Browse electron userData JSON stores, agent registry, and workflow definitions',
    category: 'DATA',
    icon: '◈',
  },
  {
    id: 'ssl-check',
    label: 'SSL Cert Inspector',
    desc: 'Validate TLS certificates of connected API endpoints and MT5 bridge',
    category: 'SECURITY',
    icon: '◉',
  },
  {
    id: 'dns-lookup',
    label: 'DNS Lookup Tool',
    desc: 'Resolve hostnames, check MX/TXT records, and diagnose connectivity issues',
    category: 'NETWORK',
    icon: '⬡',
  },
  {
    id: 'metrics-dash',
    label: 'Metrics Dashboard',
    desc: 'App-level metrics: messages sent, tokens used, uptime, active agents, latency',
    category: 'MONITOR',
    icon: '◆',
  },
  {
    id: 'alerts',
    label: 'System Alerts',
    desc: 'Configure threshold-based alerts: CPU, memory, API errors, bridge disconnects',
    category: 'MONITOR',
    icon: '⚡',
  },
  {
    id: 'file-upload',
    label: 'File Upload Manager',
    desc: 'Upload agent files, prompts, and config directly to the local JARVIS vault',
    category: 'DATA',
    icon: '↑',
  },
  {
    id: 'task-runner',
    label: 'Task Runner',
    desc: 'Queue and run background tasks: index rebuild, backup, agent sync, updates',
    category: 'PERF',
    icon: '▶',
  },
];

const ATOOL_CAT_COLOR: Record<string, string> = {
  DATA: CYAN_BRIGHT,
  DEBUG: ROSE,
  MONITOR: JADE,
  PERF: AMBER,
  CONFIG: VIOLET,
  NETWORK: '#4fc3f7',
  SECURITY: '#fb923c',
};

function AdminToolsTab() {
  const [filter, setFilter] = useState<string>('ALL');
  const [sel, setSel] = useState<AdminTool | null>(ADMIN_TOOL_LIST[0]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const cats = ['ALL', ...Array.from(new Set(ADMIN_TOOL_LIST.map((t) => t.category)))];
  const shown = filter === 'ALL' ? ADMIN_TOOL_LIST : ADMIN_TOOL_LIST.filter((t) => t.category === filter);

  async function runTool(tool: AdminTool) {
    if (busy) return;
    setBusy(tool.id);
    const ts = new Date().toLocaleTimeString();
    setLog((p) => [...p.slice(-49), `[${ts}] ${tool.label} — started`]);
    // Tool-specific actions
    try {
      if (tool.id === 'health-check') {
        const hasKey = await (window as any).jarvisBridge.hasKey();
        setLog((p) => [...p, `  Claude API key: ${hasKey ? '✓ OK' : '✗ Not configured'}`]);
        const hasG = await (window as any).jarvisBridge.hasGemini();
        setLog((p) => [...p, `  Gemini key: ${hasG ? '✓ OK' : '✗ Not configured'}`]);
        setLog((p) => [...p, `  MT5 bridge: checking…`]);
        try {
          const r = await (window as any).jarvisBridge.mt5({
            host: 'localhost',
            port: 1234,
            endpoint: 'account',
          });
          setLog((p) => [...p, `  MT5 bridge: ${r.ok ? '✓ CONNECTED' : '✗ ' + r.err}`]);
        } catch {
          setLog((p) => [...p, '  MT5 bridge: ✗ not reachable']);
        }
      } else if (tool.id === 'env-inspector') {
        setLog((p) => [
          ...p,
          `  APP_DATA: ${(window as any).electron?.process?.env?.APPDATA || 'n/a'}`,
          '  (env vars available via main process)',
        ]);
      } else if (tool.id === 'session-mgr') {
        const keys = Object.keys(localStorage);
        setLog((p) => [
          ...p,
          `  localStorage keys (${keys.length}):`,
          ...keys.map((k) => `    ${k}: ${String(localStorage.getItem(k) || '').slice(0, 60)}`),
        ]);
      } else if (tool.id === 'metrics-dash') {
        setLog((p) => [
          ...p,
          `  Console messages: ${JSON.parse(localStorage.getItem('jarvis.console') || '[]').length}`,
          `  Workflows: ${JSON.parse(localStorage.getItem('jarvis.workflows.edits') || '{}') ? 'loaded' : 'none'}`,
          `  Directives: ${JSON.parse(localStorage.getItem('jarvis.directives') || '[]').length} active`,
        ]);
      } else if (tool.id === 'cache-mgr') {
        const before = Object.keys(localStorage).filter((k) => k.startsWith('jarvis.')).length;
        setLog((p) => [
          ...p,
          `  ${before} jarvis.* keys in cache`,
          '  Use "Clear Cache" to flush non-critical data',
        ]);
      } else if (tool.id === 'audit-log') {
        setLog((p) => [
          ...p,
          `  Audit trail not yet persisted. IPC handlers: ~40`,
          `  API calls: tracked in activityRing (main process)`,
        ]);
      } else if (tool.id === 'api-keys') {
        const keys = [
          'ANTHROPIC_API_KEY',
          'OPENAI_API_KEY',
          'GEMINI_API_KEY',
          'GITHUB_TOKEN',
          'DASHSCOPE_API_KEY',
        ];
        for (const k of keys) {
          const has = await (window as any).jarvisBridge.config.hasKey(k);
          setLog((p) => [...p, `  ${k}: ${has ? '✓ stored' : '✗ not set'}`]);
        }
      } else {
        setLog((p) => [...p, `  ${tool.desc}`, `  [UI ready — backend integration pending for this tool]`]);
      }
      setLog((p) => [...p, `✓ ${tool.label} — complete`]);
    } catch (e: any) {
      setLog((p) => [...p, `✗ Error: ${e?.message || e}`]);
    }
    setBusy(null);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 10, flex: 1, minHeight: 0 }}>
      {/* Left: tool grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {/* Category filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
          {cats.map((c) => {
            const cc = c === 'ALL' ? CYAN : (ATOOL_CAT_COLOR[c] ?? CYAN);
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className="hud-label"
                style={{
                  padding: '3px 9px',
                  fontSize: 7.5,
                  cursor: 'pointer',
                  letterSpacing: '0.14em',
                  border: `1px solid ${filter === c ? cc : 'rgba(255,255,255,0.1)'}`,
                  color: filter === c ? cc : 'rgba(255,255,255,0.3)',
                  background: filter === c ? `${cc}14` : 'transparent',
                }}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <DraggableGrid
          storageKey="jarvis.grid.admintools"
          items={shown}
          columns={2}
          gap={8}
          renderItem={(tool) => {
            const cc = ATOOL_CAT_COLOR[tool.category] ?? CYAN;
            const isSel = sel?.id === tool.id;
            const isRunning = busy === tool.id;
            return (
              <button
                onClick={() => {
                  setSel(tool);
                  runTool(tool);
                }}
                disabled={!!busy}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: `1px solid ${isSel ? cc : cc + '33'}`,
                  background: isRunning ? `${cc}18` : isSel ? `${cc}10` : `${cc}05`,
                  cursor: busy ? 'wait' : 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'all 0.15s',
                  opacity: busy && !isRunning ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, color: cc, lineHeight: 1 }}>{tool.icon}</span>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 6.5,
                      color: cc,
                      border: `1px solid ${cc}40`,
                      padding: '1px 3px',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {tool.category}
                  </span>
                </div>
                <div className="hud-label" style={{ fontSize: 9.5, color: cc, letterSpacing: '0.14em' }}>
                  {isRunning ? '◌ Running…' : tool.label}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}
                >
                  {tool.desc.slice(0, 60)}…
                </div>
              </button>
            );
          }}
        />
      </div>

      {/* Right: detail + log */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {sel && (
          <div
            style={{
              padding: '12px 14px',
              border: `1px solid ${ATOOL_CAT_COLOR[sel.category] ?? CYAN}33`,
              background: `${ATOOL_CAT_COLOR[sel.category] ?? CYAN}06`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 18, color: ATOOL_CAT_COLOR[sel.category] ?? CYAN }}>{sel.icon}</span>
            <div
              className="hud-label"
              style={{
                fontSize: 12,
                color: ATOOL_CAT_COLOR[sel.category] ?? CYAN,
                marginTop: 4,
                letterSpacing: '0.14em',
              }}
            >
              {sel.label}
            </div>
            <span
              className="hud-label"
              style={{
                fontSize: 7,
                color: 'rgba(255,255,255,0.35)',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '1px 5px',
                letterSpacing: '0.12em',
              }}
            >
              {sel.category}
            </span>
            <div
              className="font-mono"
              style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 8, lineHeight: 1.6 }}
            >
              {sel.desc}
            </div>
            <button
              onClick={() => sel && runTool(sel)}
              disabled={!!busy}
              className="hud-label"
              style={{
                marginTop: 10,
                width: '100%',
                padding: '8px',
                fontSize: 9,
                color: JADE,
                border: `1px solid ${JADE}`,
                cursor: 'pointer',
                letterSpacing: '0.2em',
                background: `${JADE}12`,
              }}
            >
              {busy === sel.id ? '◌ RUNNING…' : '▶ RUN TOOL'}
            </button>
          </div>
        )}

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(0,0,0,0.3)',
            minHeight: 0,
          }}
        >
          <div
            className="hud-label"
            style={{
              fontSize: 7.5,
              color: 'rgba(255,255,255,0.3)',
              padding: '6px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              letterSpacing: '0.18em',
            }}
          >
            ◎ ACTIVITY LOG
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '6px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
            className="nx-scroll"
          >
            {log.length === 0 ? (
              <div
                className="font-mono"
                style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', paddingTop: 12, textAlign: 'center' }}
              >
                Click any tool to run
              </div>
            ) : (
              log.map((l, i) => (
                <div
                  key={i}
                  className="font-mono"
                  style={{
                    fontSize: 8.5,
                    color: l.startsWith('✓')
                      ? JADE
                      : l.startsWith('✗')
                        ? ROSE
                        : l.startsWith('  ')
                          ? 'rgba(255,255,255,0.55)'
                          : CYAN_BRIGHT,
                    lineHeight: 1.5,
                  }}
                >
                  {l}
                </div>
              ))
            )}
          </div>
          {log.length > 0 && (
            <button
              onClick={() => setLog([])}
              className="hud-label"
              style={{
                padding: '4px',
                fontSize: 7.5,
                color: 'rgba(255,255,255,0.25)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                background: 'transparent',
                letterSpacing: '0.18em',
              }}
            >
              CLEAR LOG
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Social & Search Keys Tab ───────────────────────────────────────────────────── */
const SOCIAL_KEY_LIST = [
  {
    name: 'X_API_KEY',
    label: 'API Key',
    group: 'X / Twitter',
    url: 'https://developer.twitter.com/en/portal/dashboard',
    desc: 'Consumer Key (API v2)',
  },
  {
    name: 'X_API_SECRET',
    label: 'API Secret',
    group: 'X / Twitter',
    url: 'https://developer.twitter.com/en/portal/dashboard',
    desc: 'Consumer Secret (API v2)',
  },
  {
    name: 'X_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'X / Twitter',
    url: 'https://developer.twitter.com/en/portal/dashboard',
    desc: 'Per-account OAuth token',
  },
  {
    name: 'X_ACCESS_SECRET',
    label: 'Access Secret',
    group: 'X / Twitter',
    url: 'https://developer.twitter.com/en/portal/dashboard',
    desc: 'Per-account OAuth token secret',
  },
  {
    name: 'IG_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'Instagram',
    url: 'https://developers.facebook.com/apps/',
    desc: 'Graph API long-lived token',
  },
  {
    name: 'IG_USER_ID',
    label: 'User ID',
    group: 'Instagram',
    url: 'https://developers.facebook.com/apps/',
    desc: 'Business Account numeric ID',
  },
  {
    name: 'THREADS_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'Threads',
    url: 'https://developers.facebook.com/docs/threads',
    desc: 'Threads API long-lived token',
  },
  {
    name: 'YT_API_KEY',
    label: 'API Key',
    group: 'YouTube',
    url: 'https://console.cloud.google.com/apis/credentials',
    desc: 'YouTube Data API v3 server key',
  },
  {
    name: 'YT_CLIENT_ID',
    label: 'OAuth Client ID',
    group: 'YouTube',
    url: 'https://console.cloud.google.com/apis/credentials',
    desc: 'Google Cloud OAuth 2.0 Client ID',
  },
  {
    name: 'YT_CLIENT_SECRET',
    label: 'OAuth Secret',
    group: 'YouTube',
    url: 'https://console.cloud.google.com/apis/credentials',
    desc: 'Google Cloud OAuth 2.0 Client Secret',
  },
  {
    name: 'YT_REFRESH_TOKEN',
    label: 'Refresh Token',
    group: 'YouTube',
    url: 'https://console.cloud.google.com/apis/credentials',
    desc: 'Long-lived refresh token for uploads',
  },
  {
    name: 'TT_CLIENT_KEY',
    label: 'Client Key',
    group: 'TikTok',
    url: 'https://developers.tiktok.com/',
    desc: 'TikTok for Business App Client Key',
  },
  {
    name: 'TT_CLIENT_SECRET',
    label: 'Client Secret',
    group: 'TikTok',
    url: 'https://developers.tiktok.com/',
    desc: 'TikTok for Business App Client Secret',
  },
  {
    name: 'TT_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'TikTok',
    url: 'https://developers.tiktok.com/',
    desc: 'Content Posting API token',
  },
  {
    name: 'LI_ACCESS_TOKEN',
    label: 'Access Token',
    group: 'LinkedIn',
    url: 'https://www.linkedin.com/developers/apps',
    desc: 'Marketing API OAuth 2.0 token',
  },
  {
    name: 'LI_ORG_ID',
    label: 'Org ID',
    group: 'LinkedIn',
    url: 'https://www.linkedin.com/developers/apps',
    desc: 'Company page urn:li:organization:{id}',
  },
  {
    name: 'FB_ACCESS_TOKEN',
    label: 'Page Token',
    group: 'Facebook',
    url: 'https://developers.facebook.com/apps/',
    desc: 'Meta Graph API long-lived page token',
  },
  {
    name: 'FB_PAGE_ID',
    label: 'Page ID',
    group: 'Facebook',
    url: 'https://developers.facebook.com/apps/',
    desc: 'Numeric Facebook Page ID',
  },
  {
    name: 'TELEGRAM_BOT_TOKEN',
    label: 'Bot Token',
    group: 'Telegram',
    url: 'https://t.me/BotFather',
    desc: 'BotFather token 123456:ABC-...',
  },
  {
    name: 'TELEGRAM_CHANNEL',
    label: 'Channel',
    group: 'Telegram',
    url: 'https://t.me/BotFather',
    desc: 'Username or numeric ID (-100...)',
  },
  {
    name: 'DISCORD_BOT_TOKEN',
    label: 'Bot Token',
    group: 'Discord',
    url: 'https://discord.com/developers/applications',
    desc: 'Developer Portal Bot token',
  },
  {
    name: 'DISCORD_CHANNEL_ID',
    label: 'Channel ID',
    group: 'Discord',
    url: 'https://discord.com/developers/applications',
    desc: 'Target text channel snowflake ID',
  },
  {
    name: 'SLACK_WEBHOOK_URL',
    label: 'Webhook URL',
    group: 'Slack',
    url: 'https://api.slack.com/messaging/webhooks',
    desc: 'Incoming webhook for Hermes Router outbound',
  },
  {
    name: 'REDDIT_CLIENT_ID',
    label: 'Client ID',
    group: 'Reddit',
    url: 'https://www.reddit.com/prefs/apps',
    desc: 'Personal use script app',
  },
  {
    name: 'REDDIT_CLIENT_SECRET',
    label: 'Client Secret',
    group: 'Reddit',
    url: 'https://www.reddit.com/prefs/apps',
    desc: 'Reddit app client secret',
  },
  {
    name: 'REDDIT_REFRESH_TOKEN',
    label: 'Refresh Token',
    group: 'Reddit',
    url: 'https://www.reddit.com/prefs/apps',
    desc: 'OAuth refresh token for posting',
  },
  {
    name: 'TWITCH_CLIENT_ID',
    label: 'Client ID',
    group: 'Twitch',
    url: 'https://dev.twitch.tv/console/apps',
    desc: 'Twitch Developer Console Client ID',
  },
  {
    name: 'TWITCH_CLIENT_SECRET',
    label: 'Client Secret',
    group: 'Twitch',
    url: 'https://dev.twitch.tv/console/apps',
    desc: 'Twitch Developer Console Client Secret',
  },
  {
    name: 'TWITCH_CHANNEL',
    label: 'Channel Name',
    group: 'Twitch',
    url: 'https://dev.twitch.tv/console/apps',
    desc: 'Channel login name (lowercase)',
  },
  {
    name: 'BRAVE_API_KEY',
    label: 'API Key',
    group: 'Brave Search',
    url: 'https://api.search.brave.com/app/keys',
    desc: 'Free 2k req/month search API key',
  },
];
// group meta: url + icon per group
const SOCIAL_GROUP_META: Record<string, { url: string; icon: string; color: string }> = {
  'X / Twitter': { url: 'https://twitter.com/i/oauth2/authorize', icon: '𝕏', color: '#e2e8f0' },
  Instagram: { url: 'https://api.instagram.com/oauth/authorize', icon: '◎', color: '#f472b6' },
  Threads: { url: 'https://www.threads.net/oauth/authorize', icon: '@', color: '#a78bfa' },
  YouTube: { url: 'https://accounts.google.com/o/oauth2/auth', icon: '▶', color: '#f87171' },
  TikTok: { url: 'https://www.tiktok.com/auth/authorize/', icon: '♪', color: '#fb7185' },
  LinkedIn: { url: 'https://www.linkedin.com/oauth/v2/authorization', icon: 'in', color: '#38bdf8' },
  Facebook: { url: 'https://www.facebook.com/dialog/oauth', icon: 'f', color: '#60a5fa' },
  Telegram: { url: 'https://t.me/BotFather', icon: '✈', color: '#22d3ee' },
  Discord: { url: 'https://discord.com/oauth2/authorize', icon: '⬡', color: '#818cf8' },
  Slack: { url: 'https://api.slack.com/messaging/webhooks', icon: '#', color: '#4ade80' },
  Reddit: { url: 'https://www.reddit.com/api/v1/authorize', icon: '◉', color: '#fb923c' },
  Twitch: { url: 'https://id.twitch.tv/oauth2/authorize', icon: '▌', color: '#a855f7' },
  'Brave Search': { url: 'https://api.search.brave.com/app/keys', icon: '🔍', color: '#fb923c' },
};
function openUrl(url: string) {
  window.jarvisBridge.shell?.openExternal?.(url) ?? window.open(url, '_blank');
}
function SocialTab() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const filled: Record<string, boolean> = {};
    let pending = SOCIAL_KEY_LIST.length;
    SOCIAL_KEY_LIST.forEach((k) => {
      window.jarvisBridge.config
        .getKey(k.name)
        .then((v) => {
          if (v) {
            setVals((prev) => ({ ...prev, [k.name]: v }));
            filled[k.name] = true;
          }
          if (--pending === 0) {
            // mark a group connected if ALL its keys have values
            const grpMap: Record<string, string[]> = {};
            SOCIAL_KEY_LIST.forEach((x) => {
              (grpMap[x.group] = grpMap[x.group] || []).push(x.name);
            });
            const conn: Record<string, boolean> = {};
            Object.entries(grpMap).forEach(([g, names]) => {
              conn[g] = names.every((n) => !!filled[n]);
            });
            setConnected(conn);
          }
        })
        .catch(() => {
          if (--pending === 0) {
          }
        });
    });
  }, []);
  async function save(name: string, group: string) {
    const val = (vals[name] || '').trim();
    if (val) {
      await window.jarvisBridge.config.setKey(name, val);
    } else {
      await window.jarvisBridge.config.deleteKey(name);
    }
    setSaved((prev) => ({ ...prev, [name]: true }));
    setTimeout(() => setSaved((prev) => ({ ...prev, [name]: false })), 2000);
    // recheck group connectivity
    const grpKeys = SOCIAL_KEY_LIST.filter((k) => k.group === group);
    const allFilled = await Promise.all(grpKeys.map((k) => window.jarvisBridge.config.getKey(k.name)));
    setConnected((prev) => ({ ...prev, [group]: allFilled.every((v) => !!v) }));
  }
  const groups = SOCIAL_KEY_LIST.reduce<Record<string, typeof SOCIAL_KEY_LIST>>((acc, k) => {
    (acc[k.group] = acc[k.group] || []).push(k);
    return acc;
  }, {});
  return (
    <div className="nx-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 2 }}>
      {Object.entries(groups).map(([grp, keys]) => {
        const meta = SOCIAL_GROUP_META[grp] || { url: '#', icon: '?', color: AMBER };
        const isConn = connected[grp];
        return (
          <div key={grp} style={{ marginBottom: 5 }}>
            {/* Group header row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 2px 3px',
                borderBottom: `1px solid ${meta.color}44`,
                marginBottom: 1,
              }}
            >
              <span style={{ fontSize: 11, width: 18, textAlign: 'center', color: meta.color }}>
                {meta.icon}
              </span>
              <span
                className="hud-label"
                style={{ flex: 1, fontSize: 7.5, color: meta.color, letterSpacing: '0.28em' }}
              >
                {grp.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: 7,
                  color: isConn ? JADE : 'var(--cyan-dim)',
                  marginRight: 4,
                  letterSpacing: '0.15em',
                }}
              >
                {isConn ? '● CONNECTED' : '○ NOT SET'}
              </span>
              <button
                onClick={() => openUrl(meta.url)}
                className="hud-label"
                style={{
                  fontSize: 7.5,
                  padding: '2px 8px',
                  color: meta.color,
                  border: `1px solid ${meta.color}66`,
                  background: `${meta.color}11`,
                  cursor: 'pointer',
                  letterSpacing: '0.18em',
                  whiteSpace: 'nowrap',
                }}
              >
                AUTHORIZE ↗
              </button>
            </div>
            {/* Key rows */}
            {keys.map((k) => (
              <div
                key={k.name}
                title={k.desc}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 52px',
                  gap: 3,
                  alignItems: 'center',
                  height: 24,
                  paddingLeft: 24,
                  borderBottom: '1px solid var(--line-soft)',
                }}
              >
                <div
                  className="font-mono"
                  style={{
                    fontSize: 8.5,
                    color: vals[k.name] ? JADE : 'var(--cyan-dim)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {vals[k.name] ? '✓ ' : ''}
                  {k.label}
                </div>
                <input
                  type="password"
                  value={vals[k.name] || ''}
                  onChange={(e) => setVals((prev) => ({ ...prev, [k.name]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && save(k.name, grp)}
                  placeholder="paste key…"
                  className="font-mono"
                  style={{
                    height: 18,
                    padding: '0 6px',
                    fontSize: 10,
                    color: 'var(--fg)',
                    background: 'oklch(0.07 0.014 240 / 0.7)',
                    border: `1px solid ${vals[k.name] ? JADE + '55' : 'var(--line)'}`,
                    outline: 'none',
                    width: '100%',
                  }}
                />
                <button
                  onClick={() => save(k.name, grp)}
                  className="hud-label"
                  style={{
                    height: 18,
                    fontSize: 7,
                    color: saved[k.name] ? JADE : AMBER,
                    border: `1px solid ${saved[k.name] ? JADE : AMBER}55`,
                    background: 'transparent',
                    cursor: 'pointer',
                    letterSpacing: '0.1em',
                  }}
                >
                  {saved[k.name] ? '✓' : 'SAVE'}
                </button>
              </div>
            ))}
          </div>
        );
      })}
      <div
        className="font-mono"
        style={{ fontSize: 8, color: 'var(--cyan-dim)', padding: '6px 2px', opacity: 0.5 }}
      >
        AES-256 safeStorage · hover rows for details · Enter to save · click DEV PORTAL to open credentials
        page
      </div>
    </div>
  );
}

/* ── Main Admin Screen ───────────────────────────────────────────────────────── */
const ADMIN_DEFAULT_TABS: DragTab[] = [
  {
    id: 'MODELS',
    label: 'LLM LIBRARY',
    color: '#e879f9',
    count: `${LLM_MODELS.length} models`,
    pinned: true,
  },
  { id: 'CONNECTORS', label: 'CONNECTORS', color: JADE, count: `${CONNECTORS.length} endpoints` },
  { id: 'PATHS', label: 'VAULT PATHS', color: CYAN, count: '12 paths' },
  { id: 'TOOLS', label: '⚙ ADMIN TOOLS', color: AMBER, count: `${ADMIN_TOOL_LIST.length} tools` },
  { id: 'SOCIAL', label: '📡 SOCIAL KEYS', color: ROSE, count: `${SOCIAL_KEY_LIST.length} keys` },
];

export default function AdminScreen({ onResetSetup }: { onResetSetup?: () => void }) {
  const [tab, setTab] = useState<AdminTab>('MODELS');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* header */}
      <ScreenHeader
        tag="SYS"
        title="ADMIN PANEL"
        subtitle="LLM Library · Connector Configuration · Vault Paths"
        right={
          onResetSetup && (
            <button
              onClick={() => {
                localStorage.removeItem('jarvis.setupDone');
                onResetSetup();
              }}
              className="hud-label"
              style={{
                fontSize: 8.5,
                padding: '4px 12px',
                cursor: 'pointer',
                color: 'var(--cyan-dim)',
                border: '1px solid var(--line-soft)',
                background: 'transparent',
                letterSpacing: '0.18em',
              }}
            >
              RE-RUN SETUP
            </button>
          )
        }
      />

      <DraggableTabs
        storageKey="jarvis.tabs.admin"
        defaultTabs={ADMIN_DEFAULT_TABS}
        active={tab}
        onActivate={(id) => setTab(id as AdminTab)}
      />

      {/* content */}
      {tab === 'MODELS' && <ModelsTab />}
      {tab === 'CONNECTORS' && <ConnectorsTab />}
      {tab === 'PATHS' && <PathsTab />}
      {tab === 'TOOLS' && <AdminToolsTab />}
      {tab === 'SOCIAL' && <SocialTab />}
    </div>
  );
}
