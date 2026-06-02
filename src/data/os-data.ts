import type { AccentName } from '../theme';

export interface BriefingItem { tag: string; text: string; }
export interface Briefing {
  id: string; tag: string; time: string; title: string;
  accent: AccentName; blurb: string; items: BriefingItem[]; summary: string;
}

// Briefings are generated live by JARVIS AI — no seed data here.
export const BRIEFINGS: Briefing[] = [];

export interface WorkflowNode { id: string; x: number; y: number; label: string; team: string; }
export type WorkflowEdge = [string, string];
export interface Workflow {
  id: string; name: string; trigger: string; runs: number; owner: string;
  status: 'active' | 'warn' | 'queue';
  desc: string; nodes: WorkflowNode[]; edges: WorkflowEdge[];
}

export const WORKFLOWS: Workflow[] = [
  { id: 'WF-001', name: 'Morning Boot', trigger: '06:00 daily', runs: 412, owner: 'ARC-OPT', status: 'active',
    desc: 'Briefing-Generierung · Markt-Scan · Content-Performance-Pull · Inbox-Triage · Energie-Optimierung.',
    nodes: [
      { id: 'n1', x: 80,  y: 60, label: 'Trigger · 06:00',         team: 'ARC-OPT' },
      { id: 'n2', x: 280, y: 30, label: 'Scout · Premium Hits',     team: 'ARC-SCT' },
      { id: 'n3', x: 280, y: 90, label: 'Trading · Pre-Open',       team: 'FIN-BOT' },
      { id: 'n4', x: 280, y: 150,label: 'Content · Performance',    team: 'CNT-HUB' },
      { id: 'n5', x: 540, y: 60, label: 'Compose · Briefing',       team: 'ARC-FRG' },
      { id: 'n6', x: 540, y: 140,label: 'Risk Overlay',             team: 'FIN-TRD' },
      { id: 'n7', x: 760, y: 100,label: 'Deliver · Bridge + Voice', team: 'ARC-OPT' },
    ],
    edges: [['n1','n2'],['n1','n3'],['n1','n4'],['n2','n5'],['n4','n5'],['n3','n6'],['n5','n7'],['n6','n7']],
  },
  { id: 'WF-002', name: 'Content Saturation · 24h', trigger: 'Event · Video published', runs: 84, owner: 'CNT-HUB', status: 'active',
    desc: 'Nach jedem Video-Publish: X-Thread auto-compose, IG-Reel-Cut, Twitch-Clip, Newsletter-Snippet, Cross-Channel-Schedule.',
    nodes: [
      { id: 'n1', x: 80,  y: 100, label: 'Event · YT Publish',      team: 'CNT-YT' },
      { id: 'n2', x: 280, y: 30,  label: 'X · Thread Compose',      team: 'CNT-X' },
      { id: 'n3', x: 280, y: 90,  label: 'IG · Reel Cut',           team: 'CNT-IG' },
      { id: 'n4', x: 280, y: 150, label: 'Twitch · Clip Spotlight', team: 'CNT-TW' },
      { id: 'n5', x: 280, y: 210, label: 'News · Snippet',          team: 'CNT-NWS' },
      { id: 'n6', x: 540, y: 120, label: 'Schedule · Cross-Post',   team: 'CNT-HUB' },
      { id: 'n7', x: 760, y: 120, label: 'Monitor · 24h Window',    team: 'ARC-OPT' },
    ],
    edges: [['n1','n2'],['n1','n3'],['n1','n4'],['n1','n5'],['n2','n6'],['n3','n6'],['n4','n6'],['n5','n6'],['n6','n7']],
  },
  { id: 'WF-003', name: 'Trading · Risk-Adjusted Cycle', trigger: 'Tick · 14ms', runs: 184321, owner: 'FIN-BOT', status: 'active',
    desc: 'Multi-strat orchestration mit Risk-Cap, Drawdown-Stop, Funding-Watch, Sentiment-Overlay. Bot v0.41.7.',
    nodes: [
      { id: 'n1', x: 80,  y: 100, label: 'Tick · 14ms',        team: 'FIN-BOT' },
      { id: 'n2', x: 260, y: 40,  label: 'Strat · Mean-Rev',   team: 'FIN-TRD' },
      { id: 'n3', x: 260, y: 100, label: 'Strat · Momentum',   team: 'FIN-TRD' },
      { id: 'n4', x: 260, y: 160, label: 'Strat · Funding-Arb',team: 'FIN-TRD' },
      { id: 'n5', x: 480, y: 100, label: 'Risk · VaR + DD',    team: 'ARC-OPT' },
      { id: 'n6', x: 680, y: 100, label: 'Exec · Order Router',team: 'FIN-BOT' },
    ],
    edges: [['n1','n2'],['n1','n3'],['n1','n4'],['n2','n5'],['n3','n5'],['n4','n5'],['n5','n6']],
  },
  { id: 'WF-004', name: 'Capability Scout', trigger: '06:00 + on-demand', runs: 184, owner: 'ARC-SCT', status: 'active',
    desc: 'Scannt 2400+ tools/APIs/datasets, bewertet sie nach Edge-Potential, schlägt Beschaffung & Integration vor.',
    nodes: [
      { id: 'n1', x: 80,  y: 100, label: 'Trigger',                team: 'ARC-SCT' },
      { id: 'n2', x: 240, y: 60,  label: 'Web · Scraper Swarm',    team: 'INF-WS' },
      { id: 'n3', x: 240, y: 140, label: 'Index · Premium Sources',team: 'INF-WS' },
      { id: 'n4', x: 440, y: 100, label: 'Score · Edge Potential', team: 'ARC-OPT' },
      { id: 'n5', x: 620, y: 60,  label: 'Procure · Counsel Path', team: 'LGL-LAW' },
      { id: 'n6', x: 620, y: 140, label: 'Stage · Sandbox',        team: 'INF-FS' },
      { id: 'n7', x: 820, y: 100, label: 'Promote · Production',   team: 'ARC-FRG' },
    ],
    edges: [['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']],
  },
  { id: 'WF-005', name: 'Inbox & Calendar Triage', trigger: '30s polling', runs: 99102, owner: 'ARC-OPT', status: 'active',
    desc: 'Klassifiziert Mails, Slack, Calls. Auto-Reply für Standard-Fälle, Eskalation für High-Stakes, Calendar-Defrag.',
    nodes: [
      { id: 'n1', x: 80,  y: 100, label: 'Poll · Inbox',          team: 'ARC-OPT' },
      { id: 'n2', x: 260, y: 60,  label: 'Classify · Intent',     team: 'ARC-OPT' },
      { id: 'n3', x: 260, y: 140, label: 'Defrag · Calendar',     team: 'ARC-OPT' },
      { id: 'n4', x: 480, y: 60,  label: 'Auto-Reply · Standard', team: 'ARC-OPT' },
      { id: 'n5', x: 480, y: 140, label: 'Escalate · High-Stakes',team: 'ARC-OPT' },
    ],
    edges: [['n1','n2'],['n1','n3'],['n2','n4'],['n2','n5']],
  },
  { id: 'WF-006', name: 'Cross-Region Procurement', trigger: 'Manual + scheduled', runs: 14, owner: 'INF-GEO', status: 'warn',
    desc: 'Beschaffung mit Geo-Routing-Layer für Region-spezifische Tarife. Counsel-Review-Gate vor jeder Aktion.',
    nodes: [
      { id: 'n1', x: 80,  y: 100, label: 'Initiate',                 team: 'OPERATOR' },
      { id: 'n2', x: 260, y: 60,  label: 'Counsel · Review',         team: 'LGL-LAW' },
      { id: 'n3', x: 260, y: 140, label: 'Tax · Impact',             team: 'LGL-TAX' },
      { id: 'n4', x: 480, y: 100, label: 'Geo · Exit Node',          team: 'INF-GEO' },
      { id: 'n5', x: 680, y: 100, label: 'Procure · Payment Rail',   team: 'ARC-OPT' },
    ],
    edges: [['n1','n2'],['n1','n3'],['n2','n4'],['n3','n4'],['n4','n5']],
  },
  { id: 'WF-007', name: 'Codebase Ship Cycle', trigger: 'PR opened', runs: 2204, owner: 'INF-FS', status: 'active',
    desc: 'PR-Review · CI · staging-deploy · monitoring · rollback-bereit. Vollautomatisch bis Merge — du musst nur ✓ klicken.',
    nodes: [
      { id: 'n1', x: 80,  y: 100, label: 'PR opened',          team: 'INF-FS' },
      { id: 'n2', x: 240, y: 40,  label: 'Review · Auto',      team: 'INF-FS' },
      { id: 'n3', x: 240, y: 100, label: 'CI · Test',          team: 'INF-FS' },
      { id: 'n4', x: 240, y: 160, label: 'Security · Scan',    team: 'INF-HCK' },
      { id: 'n5', x: 460, y: 100, label: 'Deploy · Staging',   team: 'INF-WEB' },
      { id: 'n6', x: 660, y: 60,  label: 'Monitor · 30m',      team: 'ARC-OPT' },
      { id: 'n7', x: 660, y: 160, label: 'Rollback · Armed',   team: 'INF-FS' },
      { id: 'n8', x: 860, y: 100, label: 'Promote · Prod',     team: 'OPERATOR' },
    ],
    edges: [['n1','n2'],['n1','n3'],['n1','n4'],['n2','n5'],['n3','n5'],['n4','n5'],['n5','n6'],['n5','n7'],['n6','n8']],
  },
  { id: 'WF-008', name: 'Self-Optimization · Weekly', trigger: 'Sun 02:00', runs: 28, owner: 'ARC-OPT', status: 'queue',
    desc: 'JARVIS analysiert eigene Performance, identifiziert Bottlenecks, schreibt Patches, testet, rollt aus. Selbstverbesserung.',
    nodes: [
      { id: 'n1', x: 80,  y: 100, label: 'Trigger · Sun 02:00', team: 'ARC-OPT' },
      { id: 'n2', x: 260, y: 100, label: 'Self · Trace + Profile',team: 'ARC-OPT' },
      { id: 'n3', x: 460, y: 60,  label: 'Identify · Bottleneck',team: 'ARC-OPT' },
      { id: 'n4', x: 460, y: 140, label: 'Generate · Patch',     team: 'ARC-FRG' },
      { id: 'n5', x: 660, y: 100, label: 'Sandbox · Test',       team: 'INF-FS' },
      { id: 'n6', x: 860, y: 100, label: 'Promote · Self',       team: 'ARC-OPT' },
    ],
    edges: [['n1','n2'],['n2','n3'],['n2','n4'],['n3','n5'],['n4','n5'],['n5','n6']],
  },
];

export const POSITIONS = [
  { sym: 'BTC-USD',  side: 'LONG',  size: '1.84',  entry: '61,420', mark: '62,890', pnl: '+2,704', pct: '+2.39%', up: true,  bot: 'Momentum-α' },
  { sym: 'ETH-USD',  side: 'LONG',  size: '24.2',  entry: '3,842',  mark: '3,901',  pnl: '+1,428', pct: '+1.54%', up: true,  bot: 'Mean-Rev-β' },
  { sym: 'DAX-FUT',  side: 'SHORT', size: '2',     entry: '18,420', mark: '18,341', pnl: '+1,975', pct: '+0.43%', up: true,  bot: 'Discretion' },
  { sym: 'EURUSD',   side: 'LONG',  size: '200k',  entry: '1.0884', mark: '1.0902', pnl: '+360',   pct: '+0.17%', up: true,  bot: 'Wedge-γ' },
  { sym: 'NVDA',     side: 'LONG',  size: '18',    entry: '1,180',  mark: '1,164',  pnl: '-288',   pct: '-1.36%', up: false, bot: 'Discretion' },
  { sym: 'SOL-USD',  side: 'LONG',  size: '184',   entry: '168',    mark: '171.4',  pnl: '+625',   pct: '+2.02%', up: true,  bot: 'Funding-δ' },
];

export const TRADE_LOG: [string, string, string, string, string][] = [
  ['14:38:24', 'ENTRY',  'BTC-USD', 'LONG 0.42 @ 62,840',     'Momentum-α'],
  ['14:37:11', 'EXIT',   'ARKB',    'FLAT @ 71.20 · +1.8%',   'Mean-Rev-β'],
  ['14:35:08', 'ENTRY',  'ETH-USD', 'LONG 8.0 @ 3,888',       'Mean-Rev-β'],
  ['14:33:47', 'ADJUST', 'DAX-FUT', 'STOP → 18,388',          'Discretion'],
  ['14:31:02', 'ENTRY',  'EURUSD',  'LONG 200k @ 1.0884',     'Wedge-γ'],
  ['14:28:50', 'EXIT',   'BTC-USD', 'FLAT @ 62,780 · +0.8%',  'Funding-δ'],
];

export const CHANNELS: { id: string; name: string; lead: string; subs: string; today: string; trend: string; color: AccentName; live: boolean; accent: string; }[] = [
  { id: 'yt', name: 'YouTube',           lead: 'ORION',   subs: '1.84M', today: '184k v',     trend: '+12%', color: 'rose',   live: false, accent: 'long-form authority' },
  { id: 'x',  name: 'X / Twitter',       lead: 'HERMES',  subs: '428k',  today: '2.4M imp',   trend: '+34%', color: 'cyan',   live: true,  accent: 'real-time reply hub' },
  { id: 'ig', name: 'Instagram',         lead: 'SELENE',  subs: '612k',  today: '84 reels',   trend: '+6%',  color: 'violet', live: false, accent: 'visual brand' },
  { id: 'tw', name: 'Twitch',            lead: 'VOLT',    subs: '92k',   today: 'live · 4.2k',trend: '+18%', color: 'amber',  live: true,  accent: 'live discourse' },
  { id: 'nl', name: 'Newsletter / News', lead: 'GUTNBRG', subs: '184k',  today: '3 features', trend: '+4%',  color: 'jade',   live: false, accent: 'deep dives' },
];

// Console starts empty — chat history is live and not seeded.
export const CONSOLE_LOG: { who: string; t: string; text: string }[] = [];


export const SYS_METRICS = {
  gpu_pool: { name: 'A100 ×64', util: 0.62, power_kw: 31, temp_c: 58, nodes_live: 60, nodes_total: 64 },
  cpu_pool: { util: 0.48, threads_live: 184, threads_total: 256 },
  storage:  { used_tb: 184, total_tb: 512 },
  network:  { ingress_gbps: 14.2, egress_gbps: 8.4, latency_ms: 14 },
  power:    { reactor_pct: 0.927, draw_kw: 4.82, thermal_c: 42.6, eff_pct: 96.4 },
  scraper:  { docs_24h: 1240000, sources: 2400, hit_rate: 0.084 },
};

export const QUICK_ACTIONS = [
  { id: 'qa1', label: 'Run Workflow',         sub: 'Pick a workflow to launch', icon: '▶' },
  { id: 'qa2', label: 'Compose Briefing',     sub: 'Generate on-demand digest', icon: '✎' },
  { id: 'qa3', label: 'Open Trading Floor',   sub: 'Positions, P&L, bots',      icon: '$' },
  { id: 'qa4', label: 'Talk to JARVIS',       sub: 'Open voice channel',        icon: '◉' },
  { id: 'qa5', label: 'Scout · Premium Tool', sub: 'Find an edge',              icon: '⌖' },
  { id: 'qa6', label: 'Self-Optimize',        sub: 'Run weekly tuning now',     icon: '⊕' },
];
