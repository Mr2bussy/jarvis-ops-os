export type Division = 'META' | 'CONTENT' | 'FINANCE' | 'INFRA' | 'LEGAL'
                     | 'HEALTH' | 'FITNESS' | 'MIND' | 'SOCIAL' | 'LIFESTYLE';
export type CellStatus = 'live' | 'warn' | 'queue' | 'idle';

export interface Team {
  id: string; name: string; div: Division; role: string;
  agents: number; lead: string; status: CellStatus;
  pct: number; kpi: string;
}

export const TEAMS: Team[] = [
  // ── META · ORCHESTRATION ────────────────────────────────────────────────
  { id: 'ARC-OPT', name: 'JARVIS · Self-Optimizer',   div: 'META',    role: 'self-improver',            agents: 12, lead: 'ATLAS-Δ',   status: 'live',  pct: 0.71, kpi: '+18% / wk' },
  { id: 'ARC-SCT', name: 'Premium Scout Cell',        div: 'META',    role: 'tools+data hunter',        agents:  9, lead: 'ARGOS-Σ',   status: 'live',  pct: 0.62, kpi: '184 hits' },
  { id: 'ARC-FRG', name: 'Forge · Build Cell α',      div: 'META',    role: 'spawns sub-agents',        agents:  7, lead: 'VULC-α',    status: 'live',  pct: 0.44, kpi: '2 builds' },
  { id: 'ARC-FR2', name: 'Forge · Build Cell β',      div: 'META',    role: 'spawns sub-agents',        agents:  7, lead: 'VULC-β',    status: 'queue', pct: 0.08, kpi: 'queued' },
  { id: 'ARC-FR3', name: 'Forge · Build Cell γ',      div: 'META',    role: 'spawns sub-agents',        agents:  6, lead: 'VULC-γ',    status: 'queue', pct: 0.00, kpi: '—' },
  { id: 'ARC-FR4', name: 'Forge · Build Cell δ',      div: 'META',    role: 'spawns sub-agents',        agents:  6, lead: 'VULC-δ',    status: 'idle',  pct: 0.00, kpi: '—' },
  // ── CONTENT · DISTRIBUTION ──────────────────────────────────────────────
  { id: 'CNT-YT',  name: 'YouTube · Mgr + Lead',      div: 'CONTENT', role: 'video ops',                agents: 14, lead: 'ORION',     status: 'live',  pct: 0.83, kpi: '12 vids/wk' },
  { id: 'CNT-X',   name: 'X · Mgr + Lead',            div: 'CONTENT', role: 'post + reply',             agents: 11, lead: 'HERMES',    status: 'live',  pct: 0.91, kpi: '428 posts' },
  { id: 'CNT-IG',  name: 'Instagram · Mgr + Lead',    div: 'CONTENT', role: 'reel ops',                 agents: 10, lead: 'SELENE',    status: 'live',  pct: 0.66, kpi: '84 reels' },
  { id: 'CNT-TW',  name: 'Twitch · Mgr + Lead',       div: 'CONTENT', role: 'stream ops',               agents:  8, lead: 'VOLT',      status: 'warn',  pct: 0.39, kpi: 'stream live' },
  { id: 'CNT-NWS', name: 'Newspaper Cell',            div: 'CONTENT', role: 'long-form + ed.',          agents:  6, lead: 'GUTNBRG',   status: 'live',  pct: 0.74, kpi: '3 features' },
  { id: 'CNT-HUB', name: 'Creator Hub · Orchestrator',div: 'CONTENT', role: 'x-channel sched.',         agents:  5, lead: 'FORUM',     status: 'live',  pct: 0.58, kpi: 'x-post sync' },
  // ── FINANCE · TRADING ───────────────────────────────────────────────────
  { id: 'FIN-TRD', name: 'Trading Floor',             div: 'FINANCE', role: 'discretion + algo',        agents: 18, lead: 'MIDAS',     status: 'live',  pct: 0.88, kpi: '+ 2.4% day' },
  { id: 'FIN-BOT', name: 'Trading-Bot Maintainer',    div: 'FINANCE', role: 'strat. tuning',            agents:  4, lead: 'QUANT',     status: 'live',  pct: 0.72, kpi: 'v0.41.7' },
  // ── INFRA · ENGINEERING ─────────────────────────────────────────────────
  { id: 'INF-SC',  name: 'Supercompute · Cluster',    div: 'INFRA',   role: 'GPU pool · A100×64',       agents:  3, lead: 'OMEGA',     status: 'live',  pct: 0.79, kpi: '62 % util.' },
  { id: 'INF-WS',  name: 'Webscraper Swarm',          div: 'INFRA',   role: 'data ingest',              agents: 22, lead: 'MANTID',    status: 'live',  pct: 0.54, kpi: '1.2M docs' },
  { id: 'INF-FS',  name: 'Fullstack · Dev Cell',      div: 'INFRA',   role: 'ship code',                agents:  9, lead: 'FORGE',     status: 'live',  pct: 0.48, kpi: 'PR #2204' },
  { id: 'INF-WEB', name: 'Website Build Cell',        div: 'INFRA',   role: 'landing + cms',            agents:  6, lead: 'MASON',     status: 'queue', pct: 0.05, kpi: 'queued' },
  { id: 'INF-HCK', name: 'Red-Team · All Grades',     div: 'INFRA',   role: 'intrusion sim.',           agents: 13, lead: 'GHOST',     status: 'warn',  pct: 0.31, kpi: 'exposure scan' },
  { id: 'INF-GEO', name: 'Geo-Routing · IP Layer',    div: 'INFRA',   role: 'exit-node mgmt.',          agents:  4, lead: 'PERIM',     status: 'live',  pct: 0.66, kpi: 'DE → TR' },
  // ── LEGAL · COMPLIANCE ──────────────────────────────────────────────────
  { id: 'LGL-LAW', name: 'Counsel Mesh · 28 jurisd.', div: 'LEGAL',   role: 'lawyers / country',        agents: 28, lead: 'CODEX',     status: 'live',  pct: 0.69, kpi: '12 advisories' },
  { id: 'LGL-TAX', name: 'Tax Mesh · 28 jurisd.',     div: 'LEGAL',   role: 'tax / country',            agents: 28, lead: 'LEDGER',    status: 'live',  pct: 0.55, kpi: 'Q3 prep' },
  // ── HEALTH · MEDICAL ELITE ──────────────────────────────────────────────
  { id: 'HLT-CMO', name: 'Chief Medical Officer Cell',div: 'HEALTH',  role: 'full-body diagnostics',    agents:  8, lead: 'DR-PRIME',  status: 'live',  pct: 0.82, kpi: 'vitals nominal' },
  { id: 'HLT-NTR', name: 'Nutrition Intelligence',    div: 'HEALTH',  role: 'macro + micro tracking',   agents:  6, lead: 'GLYCO',     status: 'live',  pct: 0.74, kpi: 'deficit -320 kcal' },
  { id: 'HLT-BIO', name: 'Biomarker Monitor',         div: 'HEALTH',  role: 'bloodwork AI analysis',    agents:  4, lead: 'VEIN-X',    status: 'live',  pct: 0.68, kpi: 'HRV 71 ms' },
  { id: 'HLT-SLP', name: 'Sleep Architecture Cell',   div: 'HEALTH',  role: 'circadian + recovery',     agents:  3, lead: 'DELTA-Ω',   status: 'live',  pct: 0.91, kpi: 'REM 22 % ↑' },
  // ── FITNESS · ATHLETIC PERFORMANCE ─────────────────────────────────────
  { id: 'FIT-TRN', name: 'Athletic Performance Cell', div: 'FITNESS', role: 'strength + conditioning',  agents:  7, lead: 'HERCULES',  status: 'live',  pct: 0.88, kpi: 'PR streak +12%' },
  { id: 'FIT-MOV', name: 'Movement Analysis Cell',    div: 'FITNESS', role: 'biomechanics + form',      agents:  5, lead: 'KINESIS',   status: 'live',  pct: 0.66, kpi: 'form score 94' },
  { id: 'FIT-REC', name: 'Recovery Protocol Cell',    div: 'FITNESS', role: 'cryo + contrast + HRV',   agents:  4, lead: 'CRYO-X',    status: 'warn',  pct: 0.43, kpi: 'DOMS index: 2.1' },
  { id: 'FIT-END', name: 'Endurance Engine',          div: 'FITNESS', role: 'VO2max + zone training',   agents:  4, lead: 'AEROX',     status: 'live',  pct: 0.57, kpi: 'VO2max 54.2' },
  // ── MIND · COGNITION ────────────────────────────────────────────────────
  { id: 'MND-PSY', name: 'Performance Psychology',    div: 'MIND',    role: 'elite sport psych.',       agents:  6, lead: 'SYGMA',     status: 'live',  pct: 0.87, kpi: 'focus score 94%' },
  { id: 'MND-LRN', name: 'Accelerated Learning Cell', div: 'MIND',    role: 'speed reading + retention',agents:  8, lead: 'MNEMO',     status: 'live',  pct: 0.79, kpi: '3h deep study' },
  { id: 'MND-MDT', name: 'Mindfulness Sentinel',      div: 'MIND',    role: 'HRV coherence + breath',   agents:  3, lead: 'ZEN-Ω',     status: 'live',  pct: 0.72, kpi: 'coher. 0.92' },
  { id: 'MND-STR', name: 'Stress Architecture Cell',  div: 'MIND',    role: 'cortisol + threat model',  agents:  4, lead: 'ADRN-Δ',    status: 'warn',  pct: 0.38, kpi: 'stress 3.1 / 10' },
  // ── SOCIAL · RELATIONS ──────────────────────────────────────────────────
  { id: 'SOC-NET', name: 'Network Intelligence Cell', div: 'SOCIAL',  role: 'elite contact mapping',    agents:  9, lead: 'NEXUS',     status: 'live',  pct: 0.76, kpi: '12 key contacts' },
  { id: 'SOC-REL', name: 'Relationship Architect',    div: 'SOCIAL',  role: 'bond depth + investment',  agents:  5, lead: 'VENUS',     status: 'live',  pct: 0.68, kpi: 'depth score 8.4' },
  { id: 'SOC-COM', name: 'Communication Coach Cell',  div: 'SOCIAL',  role: 'tone + framing + NVC',     agents:  4, lead: 'LOGOS',     status: 'live',  pct: 0.83, kpi: 'impact 91/100' },
  { id: 'SOC-INF', name: 'Influence & Status Cell',   div: 'SOCIAL',  role: 'positioning + leverage',   agents:  6, lead: 'ALPHA-Σ',   status: 'live',  pct: 0.71, kpi: 'reach × 2.8' },
  // ── LIFESTYLE · OPTIMIZATION ────────────────────────────────────────────
  { id: 'LIF-STY', name: 'Style & Identity Cell',     div: 'LIFESTYLE',role: 'image + wardrobe curation',agents: 5, lead: 'AESTH',     status: 'live',  pct: 0.64, kpi: 'wardrobe audit' },
  { id: 'LIF-ENV', name: 'Environment Optimizer',     div: 'LIFESTYLE',role: 'home + office design',     agents: 4, lead: 'HAVOC',     status: 'queue', pct: 0.12, kpi: 'office rework' },
  { id: 'LIF-RIT', name: 'Ritual & Routine Cell',     div: 'LIFESTYLE',role: 'morning + evening protocol',agents:6, lead: 'RHYTHM',    status: 'live',  pct: 0.88, kpi: '21-day streak' },
  { id: 'LIF-TRV', name: 'Travel & Logistics Cell',   div: 'LIFESTYLE',role: 'routes + hotels + visa',   agents: 5, lead: 'NOMAD',     status: 'idle',  pct: 0.00, kpi: 'next trip: Jun' },
];

export const DIVISIONS: Record<Division, { color: 'cyan' | 'violet' | 'amber' | 'jade'; label: string }> = {
  META:      { color: 'violet', label: 'META · ORCHESTRATION' },
  CONTENT:   { color: 'cyan',   label: 'CONTENT · DISTRIBUTION' },
  FINANCE:   { color: 'amber',  label: 'FINANCE · TRADING' },
  INFRA:     { color: 'cyan',   label: 'INFRA · ENGINEERING' },
  LEGAL:     { color: 'jade',   label: 'LEGAL · COMPLIANCE' },
  HEALTH:    { color: 'jade',   label: 'HEALTH · MEDICAL ELITE' },
  FITNESS:   { color: 'cyan',   label: 'FITNESS · PERFORMANCE' },
  MIND:      { color: 'violet', label: 'MIND · COGNITION' },
  SOCIAL:    { color: 'amber',  label: 'SOCIAL · RELATIONS' },
  LIFESTYLE: { color: 'cyan',   label: 'LIFESTYLE · OPTIMIZATION' },
};

export type DirectiveStepStatus = 'done' | 'active' | 'queue';
export interface DirectiveStep { i: number; label: string; team: string; status: DirectiveStepStatus; pct: number; dur: string; }

export const DIRECTIVE = {
  code: 'MO-Δ7 · 2204',
  title: 'DEPLOY · Q3 OPERATING ENVELOPE',
  brief: 'Capability acquisition + content saturation + capital deployment. 17 cells · 5 divisions · 14 ms tick.',
  steps: [
    { i: 1, label: 'RECON',       team: 'ARC-SCT', status: 'done',   pct: 1.00, dur: '00:14:08' },
    { i: 2, label: 'BUILD-OUT',   team: 'ARC-FRG', status: 'done',   pct: 1.00, dur: '00:42:11' },
    { i: 3, label: 'INFRA',       team: 'INF-SC',  status: 'active', pct: 0.62, dur: '00:08:22' },
    { i: 4, label: 'CONTENT',     team: 'CNT-HUB', status: 'active', pct: 0.41, dur: '00:11:03' },
    { i: 5, label: 'CAPITAL',     team: 'FIN-TRD', status: 'active', pct: 0.28, dur: '00:03:48' },
    { i: 6, label: 'LEGAL CLEAR', team: 'LGL-LAW', status: 'queue',  pct: 0.00, dur: '—' },
    { i: 7, label: 'DEPLOY',      team: 'INF-WEB', status: 'queue',  pct: 0.00, dur: '—' },
    { i: 8, label: 'OPTIMIZE',    team: 'ARC-OPT', status: 'queue',  pct: 0.00, dur: '—' },
  ] as DirectiveStep[],
};

export const TRANSCRIPT = [
  { t: '14:38:02', who: 'OPERATOR', text: 'Jarvis. Run the full Q3 envelope.' },
  { t: '14:38:04', who: 'JARVIS',   text: 'Acknowledged. Spinning 17 cells across 5 divisions. Scout cell already returning premium tooling — patching the trader bot loadout now.' },
  { t: '14:38:21', who: 'OPERATOR', text: 'Prioritize the trading floor. Saturate content after.' },
  { t: '14:38:23', who: 'JARVIS',   text: 'Capital first. Forge-α is staging the strat-tuner; counsel mesh is preparing the cross-border filings.' },
  { t: '14:39:07', who: 'JARVIS',   text: 'Geo-routing engaged for the procurement lane — exit node DE→TR for the music-API subscription you flagged.' },
  { t: '14:39:44', who: 'OPERATOR', text: 'Status of the red team?' },
  { t: '14:39:46', who: 'JARVIS',   text: "Probing perimeter — one warn flag. I'm holding it on tertiary until counsel signs the scope letter." },
];

export const TICKER = [
  'JARVIS · OPERATIONS BRIDGE',
  'Σ 17 CELLS LIVE',
  'GPU POOL · A100×64 · 62% UTIL.',
  'TRADING FLOOR · +2.4% DAY',
  'SCOUT · 184 PREMIUM HITS · 24h',
  'WEBSCRAPER · 1.2 M DOCS INGESTED',
  'COUNSEL MESH · 28 JURISDICTIONS',
  'TAX MESH · Q3 PREP · 55%',
  'RED-TEAM · 1 WARN · CONTAINED',
  'FORGE · 2 BUILDS QUEUED',
];
