import { useState, useMemo, useEffect, useRef } from 'react';
import { DraggableTabs, type DragTab } from '../components/draggable';
import { HoloPanel } from '../components/primitives';
import { ScreenHeader } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET } from '../theme';
import {
  GAMECHANGERS,
  ANTIGRAVITY_CATEGORIES,
  ANTIGRAVITY_TOTAL_SKILLS,
  GAMECHANGERS_TOTAL,
  AWESOME_AI_APP_CATEGORIES,
  AWESOME_AI_APPS_TOTAL,
  PLUGINS,
  PLUGINS_COUNT,
  EXTERNAL_PROJECTS,
  REFERENCE_REPOS,
  SKILL_COLLECTIONS,
  TRADING_RESOURCES,
  PROJECTS_TOTAL,
} from '../data/collections-catalog';
import { SKILLS, PROMPTS, INSTRUCTIONS, RESOURCE_TOTAL } from '../data/resources-catalog';
import type { Resource } from '../data/resources-catalog';
import { AGENTS, AGENT_CATEGORIES, AGENTS_BY_CAT, AGENT_COUNT } from '../data/agents-catalog';
import type { AgentEntry, AgentCategory } from '../data/agents-catalog';
import { Value } from '../components/Value';
import { catalog } from '../lib/sourced';

/* â”€â”€ types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface SkillEntry {
  id: string;
  slug: string;
  name: string;
  desc: string;
  risk: string;
  source: string;
  cat: string;
  type: 'agent' | 'skill' | 'prompt' | 'instruction';
  path: string;
  file: string;
}

interface SkillsIndex {
  generated: string;
  total: number;
  byCat: Record<string, number>;
  byType: Record<string, number>;
  entries: SkillEntry[];
}

const EMPTY_INDEX: SkillsIndex = { generated: '', total: 0, byCat: {}, byType: {}, entries: [] };
const PAGE = 30;

const BOOST = 'G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb';

/* â”€â”€ colour maps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CAT_COLOR: Record<string, string> = {
  META: VIOLET,
  FRONTEND: CYAN,
  BACKEND: JADE,
  DATA: AMBER,
  CLOUD: CYAN_BRIGHT,
  SECURITY: ROSE,
  DEBUG: ROSE,
  CONTENT: AMBER,
  TRADING: JADE,
  SPECIALIST: 'var(--fg)',
  // life domains
  HEALTH: JADE,
  FITNESS: CYAN,
  MIND: VIOLET,
  SOCIAL: AMBER,
  LIFESTYLE: CYAN_BRIGHT,
};

const TYPE_COLOR: Record<string, string> = {
  agent: VIOLET,
  skill: CYAN,
  prompt: AMBER,
  instruction: JADE,
};

const TYPE_GLYPH: Record<string, string> = {
  agent: 'â—ˆ',
  skill: 'â—†',
  prompt: 'â–¤',
  instruction: 'â—Ž',
};

const ALL_CATS = [
  'ALL',
  'META',
  'FRONTEND',
  'BACKEND',
  'CLOUD',
  'DATA',
  'SECURITY',
  'DEBUG',
  'CONTENT',
  'TRADING',
  'SPECIALIST',
  'HEALTH',
  'FITNESS',
  'MIND',
  'SOCIAL',
  'LIFESTYLE',
];
const ALL_TYPES = ['ALL', 'agent', 'skill', 'prompt', 'instruction'];
const ALL_SOURCES = [
  'ALL',
  'copilot-agents',
  'antigravity',
  'copilot-prompts',
  'copilot-instructions',
  'copilot-skills',
  'other',
];

const TYPE_DIR: Record<string, string> = {
  agent: `${BOOST}\\agents`,
  skill: `${BOOST}\\skills`,
  prompt: `${BOOST}\\prompts`,
  instruction: `${BOOST}\\instructions`,
};

const TYPE_EXT: Record<string, string> = {
  agent: '.agent.md',
  skill: '.md',
  prompt: '.md',
  instruction: '.instructions.md',
};

/* -- Arsenal tabs ------------------------------------------------------------ */
type ArsenalTab =
  | 'INDEXED'
  | 'COLLECTIONS'
  | 'ANTIGRAVITY'
  | 'AI-APPS'
  | 'PLUGINS'
  | 'PROJECTS'
  | 'ORCHESTRA'
  | 'CATALOG'
  | 'DISCOVER';

const ARSENAL_TOTAL =
  RESOURCE_TOTAL.total +
  GAMECHANGERS_TOTAL +
  ANTIGRAVITY_TOTAL_SKILLS +
  AWESOME_AI_APPS_TOTAL +
  PLUGINS_COUNT +
  PROJECTS_TOTAL;

const ARSENAL_TABS: { id: ArsenalTab; label: string; count: number; color: string }[] = [
  { id: 'INDEXED', label: 'INDEXED', count: 0, color: CYAN },
  { id: 'CATALOG', label: '◈ AGENTS', count: AGENT_COUNT, color: VIOLET },
  { id: 'COLLECTIONS', label: 'GC REPOS', count: GAMECHANGERS_TOTAL, color: JADE },
  { id: 'ANTIGRAVITY', label: 'ANTIGRAVITY', count: ANTIGRAVITY_TOTAL_SKILLS, color: '#c8fb4e' },
  { id: 'AI-APPS', label: 'AI-APPS', count: AWESOME_AI_APPS_TOTAL, color: '#e879f9' },
  { id: 'PLUGINS', label: 'PLUGINS', count: PLUGINS_COUNT, color: AMBER },
  { id: 'PROJECTS', label: '⊕ PROJECTS', count: PROJECTS_TOTAL, color: '#34d399' },
  { id: 'ORCHESTRA', label: '◆ ORCHESTRA', count: 198, color: VIOLET },
  { id: 'DISCOVER', label: '⚡ DISCOVER', count: 0, color: ROSE },
];
/* -- DISCOVER tab ------------------------------------------------------------ */
interface DiscoverItem {
  id: string;
  title: string;
  url: string;
  desc: string;
  meta: string;
  category: 'GITHUB' | 'ARXIV' | 'HN' | 'PRODUCTHUNT' | 'LEAKS';
  stars?: number;
  lang?: string;
}

const TRENDING_SEED: DiscoverItem[] = [
  {
    id: 'g1',
    category: 'GITHUB',
    title: 'microsoft/phi-4',
    url: 'https://github.com/microsoft/phi-4',
    desc: 'Phi-4 is a state-of-the-art open model by Microsoft Research. Small but powerful LLM.',
    meta: 'TypeScript · 42.1k ★',
    stars: 42100,
    lang: 'Python',
  },
  {
    id: 'g2',
    category: 'GITHUB',
    title: 'openai/swarm',
    url: 'https://github.com/openai/swarm',
    desc: 'Educational framework exploring ergonomic, lightweight multi-agent orchestration.',
    meta: 'Python · 18.9k ★',
    stars: 18900,
    lang: 'Python',
  },
  {
    id: 'g3',
    category: 'GITHUB',
    title: 'unclecode/crawl4ai',
    url: 'https://github.com/unclecode/crawl4ai',
    desc: 'Open-source LLM-friendly web crawler and scraper. AI-first crawling engine.',
    meta: 'Python · 24.3k ★',
    stars: 24300,
    lang: 'Python',
  },
  {
    id: 'g4',
    category: 'GITHUB',
    title: 'browser-use/browser-use',
    url: 'https://github.com/browser-use/browser-use',
    desc: 'Make AI agents control your browser. Playwright-powered web automation for LLMs.',
    meta: 'Python · 31.5k ★',
    stars: 31500,
    lang: 'Python',
  },
  {
    id: 'g5',
    category: 'GITHUB',
    title: 'DS4SD/docling',
    url: 'https://github.com/DS4SD/docling',
    desc: 'IBM docling — parse PDFs, Word docs, and spreadsheets for LLM ingestion.',
    meta: 'Python · 20.1k ★',
    stars: 20100,
    lang: 'Python',
  },
  {
    id: 'a1',
    category: 'ARXIV',
    title: 'Scaling LLM Test-Time Compute',
    url: 'https://arxiv.org/abs/2408.03314',
    desc: 'DeepMind: LLMs can trade inference compute for better accuracy. Process reward models + verifiers.',
    meta: '2408.03314 · DeepMind',
    stars: 0,
    lang: '',
  },
  {
    id: 'a2',
    category: 'ARXIV',
    title: 'Agent S: Open Agentic Framework',
    url: 'https://arxiv.org/abs/2410.08164',
    desc: 'Agent S uses GUI grounding + hierarchical experience-augmented hierarchical planning.',
    meta: '2410.08164 · Simular AI',
    stars: 0,
    lang: '',
  },
  {
    id: 'a3',
    category: 'ARXIV',
    title: 'CodeAct: LLM Agents that Code',
    url: 'https://arxiv.org/abs/2402.01030',
    desc: 'LLM agents using Python as the action language — eliminates JSON tool schema overhead.',
    meta: '2402.01030 · UIUC',
    stars: 0,
    lang: '',
  },
  {
    id: 'h1',
    category: 'HN',
    title: 'Show HN: I built a local AI desktop',
    url: 'https://news.ycombinator.com/item?id=41912240',
    desc: 'Electron + Ollama + React. Full local AI desktop app with file system access.',
    meta: 'HN #41912240 · 847 pts',
    stars: 847,
    lang: '',
  },
  {
    id: 'h2',
    category: 'HN',
    title: 'The death of the local-first app era',
    url: 'https://news.ycombinator.com/item?id=41945303',
    desc: 'Cloud dependency is accelerating even for dev tools. Discussion on self-hosted alternatives.',
    meta: 'HN #41945303 · 632 pts',
    stars: 632,
    lang: '',
  },
  {
    id: 'p1',
    category: 'PRODUCTHUNT',
    title: 'Cursor AI 0.42',
    url: 'https://www.producthunt.com/posts/cursor-0-42',
    desc: 'Cursor introduces Background Agent — runs long tasks autonomously while you work.',
    meta: 'PH #1 of Day · 2.1k upvotes',
    stars: 2100,
    lang: '',
  },
  {
    id: 'p2',
    category: 'PRODUCTHUNT',
    title: 'Windsurf Wave 3',
    url: 'https://www.producthunt.com/posts/windsurf-wave-3',
    desc: 'Cascade deep context awareness + multi-file edit chains. New Flows engine.',
    meta: 'PH #2 of Day · 1.8k upvotes',
    stars: 1800,
    lang: '',
  },
  {
    id: 'l1',
    category: 'LEAKS',
    title: 'Devin System Prompt (Full)',
    url: 'https://github.com/muellerberndt/devin-system-prompt',
    desc: 'Leaked full system prompt for Cognition Devin AI SWE agent. 8,000+ token context.',
    meta: 'Leaked · 4.2k views',
    stars: 4200,
    lang: '',
  },
  {
    id: 'l2',
    category: 'LEAKS',
    title: 'OpenAI Internal Safety Doc',
    url: 'https://github.com',
    desc: 'Leaked alignment/safety policy documentation from internal OpenAI team memo (2024).',
    meta: 'Leaked · unverified',
    stars: 0,
    lang: '',
  },
  {
    id: 'l3',
    category: 'LEAKS',
    title: 'Operator System Prompts Dump',
    url: 'https://github.com',
    desc: 'Collection of reverse-engineered system prompts from ChatGPT operators. 60+ prompts.',
    meta: 'Community · 9.1k stars',
    stars: 9100,
    lang: 'Markdown',
  },
];

function DiscoverTab() {
  const CACHE_KEY = 'jarvis.discover-cache';
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour

  function loadCached(): DiscoverItem[] | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return data as DiscoverItem[];
    } catch {
      return null;
    }
  }

  const [items, setItems] = useState<DiscoverItem[]>(() => loadCached() ?? TRENDING_SEED);
  const [filter, setFilter] = useState<DiscoverItem['category'] | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selItem, setSelItem] = useState<DiscoverItem | null>(items[0] ?? TRENDING_SEED[0]);

  const catColor: Record<DiscoverItem['category'], string> = {
    GITHUB: JADE,
    ARXIV: CYAN_BRIGHT,
    HN: '#ff6600',
    PRODUCTHUNT: '#da552f',
    LEAKS: ROSE,
  };
  const cats: Array<DiscoverItem['category'] | 'ALL'> = [
    'ALL',
    'GITHUB',
    'ARXIV',
    'HN',
    'PRODUCTHUNT',
    'LEAKS',
  ];

  const filtered = items.filter((i) => {
    if (filter !== 'ALL' && i.category !== filter) return false;
    if (
      search.trim() &&
      !i.title.toLowerCase().includes(search.toLowerCase()) &&
      !i.desc.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  async function refresh() {
    setLoading(true);
    try {
      const fetched: DiscoverItem[] = [];

      // GitHub trending (via unofficial API proxy)
      try {
        const ghRes = await fetch('https://gh-trending-api.warifuri.com/repositories?language=&since=daily', {
          signal: AbortSignal.timeout(6000),
        });
        if (ghRes.ok) {
          const ghData = (await ghRes.json()) as Array<{
            author: string;
            name: string;
            description: string;
            language: string;
            stars: number;
            currentPeriodStars: number;
          }>;
          for (const r of ghData.slice(0, 8)) {
            fetched.push({
              id: `gh-${r.author}-${r.name}`,
              category: 'GITHUB',
              title: `${r.author}/${r.name}`,
              url: `https://github.com/${r.author}/${r.name}`,
              desc: r.description || 'No description.',
              meta: `+${r.currentPeriodStars} today`,
              stars: r.stars,
              lang: r.language || undefined,
            });
          }
        }
      } catch {
        /* fallback to seed */
      }

      // HackerNews top stories
      try {
        const hnRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
          signal: AbortSignal.timeout(5000),
        });
        if (hnRes.ok) {
          const ids = ((await hnRes.json()) as number[]).slice(0, 6);
          const stories = await Promise.allSettled(
            ids.map((id) =>
              fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
                signal: AbortSignal.timeout(4000),
              }).then((r) => r.json()),
            ),
          );
          for (const s of stories) {
            if (s.status === 'fulfilled' && s.value?.title) {
              fetched.push({
                id: `hn-${s.value.id}`,
                category: 'HN',
                title: s.value.title,
                url: s.value.url ?? `https://news.ycombinator.com/item?id=${s.value.id}`,
                desc: s.value.url ?? `${s.value.score} points · ${s.value.descendants ?? 0} comments`,
                meta: `${s.value.score} pts`,
              });
            }
          }
        }
      } catch {
        /* fallback */
      }

      const result =
        fetched.length > 0
          ? [...fetched, ...TRENDING_SEED.filter((s) => s.category === 'LEAKS')]
          : TRENDING_SEED;
      setItems(result);
      setSelItem(result[0]);
      try {
        localStorage.setItem('jarvis.discover-cache', JSON.stringify({ ts: Date.now(), data: result }));
      } catch {
        /* full */
      }
    } catch {
      /* keep existing items */
    }
    setLoading(false);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 10, flex: 1, minHeight: 0 }}>
      {/* Left: list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {/* Filters + search */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className="hud-label"
              style={{
                padding: '3px 9px',
                fontSize: 7.5,
                cursor: 'pointer',
                letterSpacing: '0.14em',
                border: `1px solid ${filter === c ? (c === 'ALL' ? CYAN : catColor[c as DiscoverItem['category']]) : 'rgba(255,255,255,0.1)'}`,
                color:
                  filter === c
                    ? c === 'ALL'
                      ? CYAN
                      : catColor[c as DiscoverItem['category']]
                    : 'rgba(255,255,255,0.3)',
                background:
                  filter === c
                    ? `${c === 'ALL' ? CYAN : catColor[c as DiscoverItem['category']]}14`
                    : 'transparent',
              }}
            >
              {c}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search…"
            style={{
              flex: 1,
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              outline: 'none',
              minWidth: 120,
            }}
          />
          <button
            onClick={refresh}
            disabled={loading}
            className="hud-label"
            style={{
              padding: '4px 10px',
              fontSize: 7.5,
              color: CYAN,
              border: `1px solid ${CYAN}40`,
              cursor: 'pointer',
              background: 'transparent',
              letterSpacing: '0.16em',
            }}
          >
            {loading ? '◌' : '↺'}
          </button>
        </div>

        {/* Item list */}
        <div
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}
          className="nx-scroll"
        >
          {filtered.map((item) => {
            const cc = catColor[item.category];
            const sel = selItem?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelItem(item)}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '9px 12px',
                  cursor: 'pointer',
                  background: sel ? `${cc}10` : 'transparent',
                  borderLeft: `2px solid ${sel ? cc : 'transparent'}`,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 6.5,
                      color: cc,
                      border: `1px solid ${cc}40`,
                      padding: '1px 4px',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    {item.category}
                  </span>
                  {(item.stars ?? 0) > 0 && (
                    <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
                      ★ {((item.stars ?? 0) / 1000).toFixed(1)}k
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 10.5,
                      color: sel ? cc : 'rgba(255,255,255,0.8)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 8.5,
                      color: 'rgba(255,255,255,0.35)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.desc.slice(0, 80)}…
                  </div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}
                  >
                    {item.meta}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: detail */}
      {selItem ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 14px',
            border: `1px solid ${catColor[selItem.category]}33`,
            background: `${catColor[selItem.category]}06`,
          }}
        >
          <div>
            <span
              className="hud-label"
              style={{ fontSize: 7.5, color: catColor[selItem.category], letterSpacing: '0.28em' }}
            >
              {selItem.category} · {selItem.meta}
            </span>
            <div
              className="font-mono"
              style={{ fontSize: 16, color: catColor[selItem.category], marginTop: 6, lineHeight: 1.3 }}
            >
              {selItem.title}
            </div>
            {selItem.lang && (
              <span
                className="hud-label"
                style={{
                  fontSize: 8,
                  color: AMBER,
                  border: `1px solid ${AMBER}40`,
                  padding: '2px 7px',
                  display: 'inline-block',
                  marginTop: 6,
                }}
              >
                {selItem.lang}
              </span>
            )}
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}
          >
            {selItem.desc}
          </div>
          {(selItem.stars ?? 0) > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div
                style={{
                  padding: '8px 14px',
                  border: `1px solid ${catColor[selItem.category]}30`,
                  background: `${catColor[selItem.category]}08`,
                  textAlign: 'center',
                }}
              >
                <div className="font-mono" style={{ fontSize: 16, color: catColor[selItem.category] }}>
                  ★{' '}
                  {(selItem.stars ?? 0) > 1000
                    ? `${((selItem.stars ?? 0) / 1000).toFixed(1)}k`
                    : selItem.stars}
                </div>
                <div
                  className="hud-label"
                  style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}
                >
                  STARS
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
            <button
              onClick={() => window.open(selItem.url, '_blank')}
              className="hud-label"
              style={{
                padding: '9px',
                fontSize: 9,
                color: catColor[selItem.category],
                border: `1px solid ${catColor[selItem.category]}`,
                cursor: 'pointer',
                letterSpacing: '0.2em',
                background: `${catColor[selItem.category]}12`,
              }}
            >
              ↗ OPEN IN BROWSER
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(selItem.url)}
              className="hud-label"
              style={{
                padding: '9px',
                fontSize: 9,
                color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                letterSpacing: '0.2em',
                background: 'transparent',
              }}
            >
              ⊕ COPY URL
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.2)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        >
          Select an item
        </div>
      )}
    </div>
  );
}
/* -- Elite Agent Orchestra data -------------------------------------------- */
interface OrchestraAgent {
  id: string;
  name: string;
  role: string;
  domain: string;
  desc: string;
  file: string;
  tier: 'ALPHA' | 'BETA' | 'SUPPORT';
}
interface OrchestraDomain {
  id: string;
  label: string;
  color: string;
  agents: OrchestraAgent[];
}

const TIER_COLOR: Record<string, string> = { ALPHA: ROSE, BETA: AMBER, SUPPORT: 'var(--cyan-dim)' };

function OrchestraScreen() {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<OrchestraAgent | null>(null);
  const [search, setSearch] = useState('');

  const ORCHESTRA_DOMAINS: OrchestraDomain[] = [
    {
      id: 'CMD',
      label: 'COMMAND & META',
      color: VIOLET,
      agents: [
        {
          id: 'O-001',
          name: 'BEAST MODE',
          role: 'Supreme Orchestrator',
          domain: 'CMD',
          tier: 'ALPHA',
          file: '4.1-Beast.agent.md',
          desc: 'GPT-4.1 beast mode — top-tier planning, generation, no guardrail limits.',
        },
        {
          id: 'O-002',
          name: 'THINKING BEAST',
          role: 'Deep Reasoning Oracle',
          domain: 'CMD',
          tier: 'ALPHA',
          file: 'Thinking-Beast-Mode.agent.md',
          desc: 'Extended thinking for multi-step decomposition and reasoning chains.',
        },
        {
          id: 'O-003',
          name: 'GEM ORCHESTRATOR',
          role: 'Agent Coordinator',
          domain: 'CMD',
          tier: 'ALPHA',
          file: 'gem-orchestrator.agent.md',
          desc: 'Gemini orchestrator — routes tasks to sub-agents, manages tool calls.',
        },
        {
          id: 'O-004',
          name: 'CUSTOM FOUNDRY',
          role: 'Agent Factory',
          domain: 'CMD',
          tier: 'BETA',
          file: 'custom-agent-foundry.agent.md',
          desc: 'Creates new validated custom agents from capability descriptions.',
        },
        {
          id: 'O-005',
          name: 'PLANNER',
          role: 'Strategic Planner',
          domain: 'CMD',
          tier: 'BETA',
          file: 'planner.agent.md',
          desc: 'Multi-step task planner with ordered execution chains.',
        },
      ],
    },
    {
      id: 'ENG',
      label: 'SOFTWARE ENGINEERING',
      color: CYAN_BRIGHT,
      agents: [
        {
          id: 'O-010',
          name: 'PRINCIPAL ENGINEER',
          role: 'Senior SWE',
          domain: 'ENG',
          tier: 'ALPHA',
          file: 'principal-software-engineer.agent.md',
          desc: 'Architecture, code review, performance, and production delivery.',
        },
        {
          id: 'O-011',
          name: 'REACT ENGINEER',
          role: 'Frontend Expert',
          domain: 'ENG',
          tier: 'ALPHA',
          file: 'expert-react-frontend-engineer.agent.md',
          desc: 'React 19 + TypeScript + Vite — pixel-perfect performant UIs.',
        },
        {
          id: 'O-012',
          name: 'NEXT.JS EXPERT',
          role: 'Next.js Specialist',
          domain: 'ENG',
          tier: 'ALPHA',
          file: 'expert-nextjs-developer.agent.md',
          desc: 'Next.js 15 App Router, RSC, streaming, caching, and deployment.',
        },
        {
          id: 'O-013',
          name: 'C++ EXPERT',
          role: 'Systems Programmer',
          domain: 'ENG',
          tier: 'ALPHA',
          file: 'expert-cpp-software-engineer.agent.md',
          desc: 'Modern C++20/23 — high-performance systems and embedded code.',
        },
        {
          id: 'O-014',
          name: 'RUST BEAST',
          role: 'Rust Specialist',
          domain: 'ENG',
          tier: 'ALPHA',
          file: 'rust-gpt-4.1-beast-mode.agent.md',
          desc: 'Memory-safe systems programming with zero-cost abstractions.',
        },
        {
          id: 'O-015',
          name: 'ELECTRON NATIVE',
          role: 'Desktop Apps',
          domain: 'ENG',
          tier: 'BETA',
          file: 'electron-angular-native.agent.md',
          desc: 'Electron + Angular native apps — Jarvis-style desktop builds.',
        },
        {
          id: 'O-016',
          name: 'GITOPS CI',
          role: 'DevOps Specialist',
          domain: 'ENG',
          tier: 'BETA',
          file: 'se-gitops-ci-specialist.agent.md',
          desc: 'GitOps, GitHub Actions, CI/CD pipelines, and release automation.',
        },
      ],
    },
    {
      id: 'CLOUD',
      label: 'CLOUD & INFRA',
      color: '#38bdf8',
      agents: [
        {
          id: 'O-020',
          name: 'AZURE PRINCIPAL',
          role: 'Cloud Architect',
          domain: 'CLOUD',
          tier: 'ALPHA',
          file: 'azure-principal-architect.agent.md',
          desc: 'Azure landing zones, governance, and enterprise scale solutions.',
        },
        {
          id: 'O-021',
          name: 'TERRAFORM AZURE',
          role: 'IaC Engineer',
          domain: 'CLOUD',
          tier: 'ALPHA',
          file: 'terraform-azure-implement.agent.md',
          desc: 'Terraform on Azure — modules, state, pipelines, drift detection.',
        },
        {
          id: 'O-022',
          name: 'K8S SRE',
          role: 'Platform SRE',
          domain: 'CLOUD',
          tier: 'ALPHA',
          file: 'platform-sre-kubernetes.agent.md',
          desc: 'Kubernetes production ops — scaling, HA, and incident response.',
        },
        {
          id: 'O-023',
          name: 'DEVOPS EXPERT',
          role: 'DevOps Engineer',
          domain: 'CLOUD',
          tier: 'BETA',
          file: 'devops-expert.agent.md',
          desc: 'Full DevOps lifecycle — build, test, deploy, monitor.',
        },
      ],
    },
    {
      id: 'SEC',
      label: 'SECURITY',
      color: ROSE,
      agents: [
        {
          id: 'O-030',
          name: 'RED/BLUE/PURPLE',
          role: 'Cyber Warfare Team',
          domain: 'SEC',
          tier: 'ALPHA',
          file: 'cybersecurity-red-blue-purple-team.agent.md',
          desc: 'Full security: red team attack, blue team defend, purple unified.',
        },
        {
          id: 'O-031',
          name: 'CODE REVIEWER',
          role: 'Security Auditor',
          domain: 'SEC',
          tier: 'ALPHA',
          file: 'se-security-reviewer.agent.md',
          desc: 'OWASP Top 10, CVE scanning, injection risks, misconfigs.',
        },
        {
          id: 'O-032',
          name: 'RESPONSIBLE AI',
          role: 'Ethics Reviewer',
          domain: 'SEC',
          tier: 'BETA',
          file: 'se-responsible-ai-code.agent.md',
          desc: 'Reviews AI systems for bias, fairness, safety.',
        },
      ],
    },
    {
      id: 'DATA',
      label: 'DATA & DATABASES',
      color: AMBER,
      agents: [
        {
          id: 'O-040',
          name: 'MS SQL DBA',
          role: 'SQL Server Expert',
          domain: 'DATA',
          tier: 'ALPHA',
          file: 'ms-sql-dba.agent.md',
          desc: 'SQL Server DBA — query tuning, indexing, HA/DR.',
        },
        {
          id: 'O-041',
          name: 'POSTGRESQL DBA',
          role: 'Postgres Expert',
          domain: 'DATA',
          tier: 'ALPHA',
          file: 'postgresql-dba.agent.md',
          desc: 'PostgreSQL — partitioning, vacuuming, connection pooling.',
        },
        {
          id: 'O-042',
          name: 'MONGODB ADVISOR',
          role: 'NoSQL Performance',
          domain: 'DATA',
          tier: 'BETA',
          file: 'mongodb-performance-advisor.agent.md',
          desc: 'MongoDB query optimization, schema, aggregation pipelines.',
        },
        {
          id: 'O-043',
          name: 'POWER BI DAX',
          role: 'Analytics Expert',
          domain: 'DATA',
          tier: 'BETA',
          file: 'power-bi-dax-expert.agent.md',
          desc: 'Power BI + DAX measures, time intelligence, performance.',
        },
      ],
    },
    {
      id: 'TRADE',
      label: 'TRADING & FINANCE',
      color: JADE,
      agents: [
        {
          id: 'O-050',
          name: 'XAUZAXCO TRADING',
          role: 'Institutional Trader',
          domain: 'TRADE',
          tier: 'ALPHA',
          file: 'xauzaxco-institutional-trading-team.agent.md',
          desc: 'Multi-person institutional trading — strategies, risk, execution.',
        },
        {
          id: 'O-051',
          name: 'CFO FINANCE',
          role: 'Financial Controller',
          domain: 'TRADE',
          tier: 'ALPHA',
          file: 'finance-cfo-team.agent.md',
          desc: 'CFO team — P&L, cashflow, budgeting, and reporting.',
        },
      ],
    },
    {
      id: 'AI',
      label: 'AI / ML SPECIALISTS',
      color: '#e879f9',
      agents: [
        {
          id: 'O-060',
          name: 'COMET OPIK',
          role: 'LLM Observability',
          domain: 'AI',
          tier: 'ALPHA',
          file: 'comet-opik.agent.md',
          desc: 'LLM experiment tracking, evals, prompts, production monitoring.',
        },
        {
          id: 'O-061',
          name: 'SEMANTIC KERNEL',
          role: 'AI Orchestration',
          domain: 'AI',
          tier: 'ALPHA',
          file: 'semantic-kernel-dotnet.agent.md',
          desc: 'Microsoft Semantic Kernel .NET — plugins, planners, memory.',
        },
        {
          id: 'O-062',
          name: 'PROMPT ENGINEER',
          role: 'Prompt Designer',
          domain: 'AI',
          tier: 'BETA',
          file: 'prompt-engineer.agent.md',
          desc: 'Chain-of-thought, few-shot, eval framework design.',
        },
        {
          id: 'O-063',
          name: 'CONTEXT ARCHITECT',
          role: 'RAG & Context',
          domain: 'AI',
          tier: 'BETA',
          file: 'context-architect.agent.md',
          desc: 'RAG pipeline design, context window, chunking, retrieval.',
        },
      ],
    },
    {
      id: 'CNT',
      label: 'CONTENT & SOCIAL',
      color: '#f97316',
      agents: [
        {
          id: 'O-070',
          name: 'SOCIAL AUTO',
          role: 'Social Automation',
          domain: 'CNT',
          tier: 'ALPHA',
          file: 'social-media-automation-agent.agent.md',
          desc: 'X, IG, YT, LinkedIn automated posting and scheduling.',
        },
        {
          id: 'O-071',
          name: 'SOCIAL JSON WF',
          role: 'Workflow Builder',
          domain: 'CNT',
          tier: 'ALPHA',
          file: 'social-media-json-workflow-agent.agent.md',
          desc: 'JSON-driven multi-platform content pipeline builder.',
        },
        {
          id: 'O-072',
          name: 'MARKETING GROWTH',
          role: 'Growth Hacker',
          domain: 'CNT',
          tier: 'BETA',
          file: 'marketing-growth-team.agent.md',
          desc: 'Growth hacking, campaigns, funnel, A/B testing team.',
        },
      ],
    },
    {
      id: 'QA',
      label: 'QA & TESTING',
      color: '#c8fb4e',
      agents: [
        {
          id: 'O-080',
          name: 'POLYGLOT TEST',
          role: 'Test Generator',
          domain: 'QA',
          tier: 'ALPHA',
          file: 'polyglot-test-generator.agent.md',
          desc: 'Comprehensive tests in any language — unit, integration, e2e.',
        },
        {
          id: 'O-081',
          name: 'PLAYWRIGHT',
          role: 'E2E Test Expert',
          domain: 'QA',
          tier: 'ALPHA',
          file: 'playwright-tester.agent.md',
          desc: 'Playwright e2e — page objects, fixtures, CI integration.',
        },
        {
          id: 'O-082',
          name: 'DEBUG VALIDATOR',
          role: 'Debug Expert',
          domain: 'QA',
          tier: 'ALPHA',
          file: 'comprehensive-debug-validator.agent.md',
          desc: 'Root cause analysis, reproduction, and fix verification.',
        },
      ],
    },
    {
      id: 'LIFE',
      label: 'LIFE · HEALTH · MIND',
      color: '#4ade80',
      agents: [
        {
          id: 'O-090',
          name: 'HERCULES FITNESS',
          role: 'Fitness Coach',
          domain: 'LIFE',
          tier: 'ALPHA',
          file: 'jarvis-fitness-hercules.agent.md',
          desc: 'Elite fitness programming — training plans, progressive overload.',
        },
        {
          id: 'O-091',
          name: 'SYGMA MIND',
          role: 'Mental Performance',
          domain: 'LIFE',
          tier: 'ALPHA',
          file: 'jarvis-mind-sygma.agent.md',
          desc: 'Focus protocols, stress management, cognitive optimization.',
        },
        {
          id: 'O-092',
          name: 'CMO HEALTH',
          role: 'Health Optimizer',
          domain: 'LIFE',
          tier: 'ALPHA',
          file: 'jarvis-health-cmo.agent.md',
          desc: 'Personal health — biometrics, longevity, optimization protocols.',
        },
        {
          id: 'O-093',
          name: 'RHYTHM',
          role: 'Daily Structure',
          domain: 'LIFE',
          tier: 'BETA',
          file: 'jarvis-lifestyle-rhythm.agent.md',
          desc: 'Daily rhythm design — sleep, energy, habits, scheduling.',
        },
      ],
    },
  ];

  const allAgents = ORCHESTRA_DOMAINS.flatMap((d) => d.agents);
  const filteredDomains = search
    ? ORCHESTRA_DOMAINS.map((d) => ({
        ...d,
        agents: d.agents.filter(
          (a) =>
            a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.role.toLowerCase().includes(search.toLowerCase()) ||
            a.desc.toLowerCase().includes(search.toLowerCase()),
        ),
      })).filter((d) => d.agents.length > 0)
    : selectedDomain
      ? ORCHESTRA_DOMAINS.filter((d) => d.id === selectedDomain)
      : ORCHESTRA_DOMAINS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'TOTAL AGENTS IN BACKUP', value: '198', color: VIOLET },
          {
            label: 'ALPHA TIER (MAPPED)',
            value: String(allAgents.filter((a) => a.tier === 'ALPHA').length),
            color: ROSE,
          },
          { label: 'DOMAINS', value: String(ORCHESTRA_DOMAINS.length), color: CYAN_BRIGHT },
          { label: 'AGENTS MAPPED TO JARVIS', value: String(allAgents.length), color: JADE },
        ].map((s) => (
          <div
            key={s.label}
            style={{ padding: '10px 12px', border: `1px solid ${s.color}30`, background: `${s.color}08` }}
          >
            <div
              className="hud-label"
              style={{ fontSize: 8.5, color: 'var(--cyan-dim)', letterSpacing: '0.22em' }}
            >
              {s.label}
            </div>
            <div className="font-mono" style={{ fontSize: 18, color: s.color, marginTop: 4 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents…"
          style={{
            padding: '6px 12px',
            fontSize: 10.5,
            background: 'oklch(0.05 0.01 240 / 0.8)',
            border: '1px solid var(--line)',
            color: 'var(--fg)',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
            width: 200,
          }}
        />
        <button
          onClick={() => {
            setSelectedDomain(null);
            setSearch('');
          }}
          className="hud-label"
          style={{
            padding: '5px 10px',
            fontSize: 8.5,
            cursor: 'pointer',
            letterSpacing: '0.16em',
            color: !selectedDomain && !search ? '#0d1117' : 'var(--cyan-dim)',
            background: !selectedDomain && !search ? 'var(--cyan-dim)' : 'transparent',
            border: '1px solid var(--line)',
          }}
        >
          ALL
        </button>
        {ORCHESTRA_DOMAINS.map((d) => (
          <button
            key={d.id}
            onClick={() => {
              setSelectedDomain(d.id === selectedDomain ? null : d.id);
              setSearch('');
            }}
            className="hud-label"
            style={{
              padding: '5px 10px',
              fontSize: 8.5,
              cursor: 'pointer',
              letterSpacing: '0.14em',
              color: selectedDomain === d.id ? '#0d1117' : d.color,
              background: selectedDomain === d.id ? d.color : 'transparent',
              border: `1px solid ${d.color}50`,
            }}
          >
            {d.id}
          </button>
        ))}
      </div>

      {filteredDomains.map((domain) => (
        <HoloPanel
          key={domain.id}
          label={`${domain.label} · ${domain.agents.length} AGENTS`}
          code={domain.id}
          status="live"
          style={{ borderLeft: `2px solid ${domain.color}` }}
        >
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}
          >
            {domain.agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id === selectedAgent?.id ? null : agent)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  border:
                    selectedAgent?.id === agent.id
                      ? `1px solid ${domain.color}`
                      : '1px solid var(--line-soft)',
                  background:
                    selectedAgent?.id === agent.id ? `${domain.color}0a` : 'oklch(0.07 0.012 240 / 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    className="hud-label"
                    style={{ fontSize: 8.5, color: domain.color, letterSpacing: '0.2em' }}
                  >
                    {agent.id}
                  </span>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 7.5,
                      color: TIER_COLOR[agent.tier],
                      padding: '1px 5px',
                      border: `1px solid ${TIER_COLOR[agent.tier]}40`,
                    }}
                  >
                    {agent.tier}
                  </span>
                </div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 12,
                    color: selectedAgent?.id === agent.id ? domain.color : 'var(--fg)',
                    letterSpacing: '0.1em',
                  }}
                >
                  {agent.name}
                </div>
                <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>
                  {agent.role}
                </div>
                <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--fg-dim)', lineHeight: 1.4 }}>
                  {agent.desc}
                </div>
              </button>
            ))}
          </div>
          {selectedAgent && domain.agents.some((a) => a.id === selectedAgent.id) && (
            <div
              className="anim-fade-in"
              style={{
                marginTop: 10,
                padding: '12px 14px',
                border: `1px solid ${domain.color}50`,
                background: `${domain.color}08`,
              }}
            >
              <div className="font-display" style={{ fontSize: 16, color: domain.color, marginBottom: 6 }}>
                {selectedAgent.name}
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 10.5, color: 'var(--fg)', lineHeight: 1.6, marginBottom: 8 }}
              >
                {selectedAgent.desc}
              </div>
              <div className="font-mono" style={{ fontSize: 9, color: `${domain.color}90` }}>
                {`G:\\Codingbackup und tools\\all ai agents and boosters\\oooooggithubbb\\agents\\${selectedAgent.file}`}
              </div>
            </div>
          )}
        </HoloPanel>
      ))}
    </div>
  );
}

/* â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="hud-label"
      style={{
        padding: '2px 6px',
        fontSize: 8,
        letterSpacing: '0.14em',
        color,
        border: `1px solid ${color}55`,
        background: `${color}12`,
      }}
    >
      {label}
    </span>
  );
}

function SkillCard({ e, onOpen }: { e: SkillEntry; onOpen: (e: SkillEntry) => void }) {
  const cc = CAT_COLOR[e.cat] || 'var(--fg)';
  const tc = TYPE_COLOR[e.type] || 'var(--fg)';
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'oklch(0.08 0.012 240 / 0.7)',
        border: `1px solid ${cc}30`,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        cursor: 'default',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e2) => (e2.currentTarget.style.borderColor = cc + '70')}
      onMouseLeave={(e2) => (e2.currentTarget.style.borderColor = cc + '30')}
    >
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="font-mono" style={{ fontSize: 10, color: tc, marginRight: 2 }}>
          {TYPE_GLYPH[e.type]}
        </span>
        <Badge label={e.type.toUpperCase()} color={tc} />
        <Badge label={e.cat} color={cc} />
        {e.risk && e.risk !== 'safe' && <Badge label={e.risk.toUpperCase()} color={ROSE} />}
      </div>
      <div
        className="hud-label"
        style={{
          fontSize: 11,
          color: 'var(--fg)',
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: '0.06em',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {e.name}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          color: 'var(--cyan-dim)',
          lineHeight: 1.5,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          flex: 1,
        }}
      >
        {e.desc || 'â€”'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <span
          className="font-mono"
          style={{
            fontSize: 8,
            color: 'oklch(0.45 0.05 215)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '65%',
          }}
        >
          {e.source}
        </span>
        <button
          onClick={() => onOpen(e)}
          className="hud-label"
          style={{
            padding: '3px 8px',
            fontSize: 8,
            letterSpacing: '0.15em',
            color: tc,
            border: `1px solid ${tc}60`,
            background: `${tc}10`,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          â–¶ OPEN
        </button>
      </div>
    </div>
  );
}

/* â”€â”€ CREATE modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface CreateForm {
  type: 'agent' | 'skill' | 'prompt' | 'instruction';
  name: string;
  cat: string;
  desc: string;
  content: string;
}

function CreateModal({
  onClose,
  onCreated,
  setToast,
}: {
  onClose: () => void;
  onCreated: () => void;
  setToast: (t: string) => void;
}) {
  const [form, setForm] = useState<CreateForm>({
    type: 'agent',
    name: '',
    cat: 'SPECIALIST',
    desc: '',
    content: '',
  });
  const [saving, setSaving] = useState(false);

  function slugify(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async function save() {
    if (!form.name.trim()) {
      setToast('âš  Name is required');
      return;
    }
    setSaving(true);
    const slug = slugify(form.name);
    const ext = TYPE_EXT[form.type];
    const dir = TYPE_DIR[form.type];
    const filePath = `${dir}\\${slug}${ext}`;
    const frontmatter = `---\nname: ${form.name}\ndescription: ${form.desc}\ncategory: ${form.cat}\ntype: ${form.type}\nrisk: safe\n---\n\n`;
    const content = frontmatter + (form.content || `# ${form.name}\n\n${form.desc || 'Add content here.'}\n`);
    try {
      const result = await window.jarvisBridge.writeFile({ filePath, content });
      if (result.ok) {
        setToast(`â—‰ Created: ${slug}${ext}`);
        onCreated();
        onClose();
      } else {
        setToast(`âš  Save failed: ${result.err}`);
      }
    } catch (e: any) {
      setToast(`âš  IPC error: ${String(e?.message || e)}`);
    }
    setSaving(false);
  }

  const inputStyle = {
    width: '100%',
    padding: '7px 10px',
    fontSize: 10,
    color: 'var(--fg)',
    background: 'oklch(0.06 0.012 240)',
    border: `1px solid ${CYAN}44`,
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'var(--font-mono)',
  };

  const labelStyle = {
    fontSize: 8,
    color: 'var(--cyan-dim)',
    letterSpacing: '0.14em',
    fontFamily: 'var(--font-mono)',
    marginBottom: 4,
    display: 'block' as const,
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'oklch(0.04 0.012 240 / 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 560,
          maxHeight: '88vh',
          overflow: 'auto',
          background: 'oklch(0.07 0.016 240)',
          border: `1px solid ${CYAN}`,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
        onClick={(e2) => e2.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="hud-label" style={{ fontSize: 13, color: CYAN, letterSpacing: '0.14em' }}>
            â—ˆ CREATE NEW ASSET
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: ROSE, cursor: 'pointer', fontSize: 14 }}
          >
            âœ•
          </button>
        </div>

        {/* type selector */}
        <div>
          <span style={labelStyle}>ASSET TYPE</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['agent', 'skill', 'prompt', 'instruction'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className="hud-label"
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                  color: form.type === t ? TYPE_COLOR[t] : 'var(--cyan-dim)',
                  border: `1px solid ${form.type === t ? TYPE_COLOR[t] : 'var(--line-soft)'}`,
                  background: form.type === t ? `${TYPE_COLOR[t]}18` : 'transparent',
                }}
              >
                {TYPE_GLYPH[t]} {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* name */}
        <div>
          <span style={labelStyle}>NAME *</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. my-awesome-agent"
            style={inputStyle}
          />
          {form.name && (
            <div className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)', marginTop: 3 }}>
              â†’ {TYPE_DIR[form.type]}\{slugify(form.name)}
              {TYPE_EXT[form.type]}
            </div>
          )}
        </div>

        {/* category */}
        <div>
          <span style={labelStyle}>CATEGORY</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {ALL_CATS.filter((c) => c !== 'ALL').map((c) => (
              <button
                key={c}
                onClick={() => setForm((f) => ({ ...f, cat: c }))}
                className="hud-label"
                style={{
                  padding: '3px 8px',
                  fontSize: 8,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  color: form.cat === c ? CAT_COLOR[c] || CYAN : 'var(--cyan-dim)',
                  border: `1px solid ${form.cat === c ? CAT_COLOR[c] || CYAN : 'var(--line-soft)'}`,
                  background: form.cat === c ? `${CAT_COLOR[c] || CYAN}15` : 'transparent',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* description */}
        <div>
          <span style={labelStyle}>DESCRIPTION</span>
          <input
            value={form.desc}
            onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
            placeholder="One-line descriptionâ€¦"
            style={inputStyle}
          />
        </div>

        {/* content */}
        <div>
          <span style={labelStyle}>CONTENT (markdown â€” auto-generated if empty)</span>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder={`# ${form.name || 'Asset Name'}\n\nYou are an elite ${form.type}â€¦`}
            style={{ ...inputStyle, height: 180, resize: 'vertical' as const }}
          />
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="hud-label"
            style={{
              padding: '8px 20px',
              fontSize: 9,
              letterSpacing: '0.15em',
              cursor: 'pointer',
              color: 'var(--cyan-dim)',
              border: '1px solid var(--line-soft)',
              background: 'transparent',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="hud-label"
            style={{
              padding: '8px 24px',
              fontSize: 9,
              letterSpacing: '0.15em',
              cursor: 'pointer',
              color: JADE,
              border: `1px solid ${JADE}`,
              background: `${JADE}18`,
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'â—Œ SAVINGâ€¦' : 'â—ˆ CREATE'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Catalog Tab (Agents + Resources mirror) ────────────────────────────────────
const CAT_ORDER_CATALOG: AgentCategory[] = [
  'META',
  'CONTENT',
  'TRADING',
  'INFRA',
  'SECURITY',
  'FRONTEND',
  'BACKEND',
  'DATA',
  'CLOUD',
  'DEBUG',
  'SPECIALIST',
  'HEALTH',
  'FITNESS',
  'MIND',
  'SOCIAL',
  'LIFESTYLE',
];

const AGENT_CAT_COLORS: Record<string, string> = {
  META: VIOLET,
  CONTENT: AMBER,
  TRADING: JADE,
  INFRA: CYAN,
  SECURITY: ROSE,
  FRONTEND: CYAN_BRIGHT,
  BACKEND: VIOLET,
  DATA: AMBER,
  CLOUD: CYAN_BRIGHT,
  DEBUG: ROSE,
  SPECIALIST: JADE,
  HEALTH: JADE,
  FITNESS: CYAN,
  MIND: VIOLET,
  SOCIAL: AMBER,
  LIFESTYLE: CYAN_BRIGHT,
};

const RES_CAT_COLORS2: Record<string, string> = {
  Testing: CYAN,
  Monitoring: '#c8fb4e',
  Cloud: '#818cf8',
  DevOps: '#fb923c',
  Security: ROSE,
  Frontend: JADE,
  Backend: '#a78bfa',
  Data: AMBER,
  Content: '#38bdf8',
  Tools: '#e879f9',
  AI: CYAN,
  Media: '#f472b6',
  Hardware: '#94a3b8',
  Planning: '#c8fb4e',
  META: CYAN,
};

type CatalogView = 'AGENTS' | 'SKILLS' | 'PROMPTS' | 'INSTRUCTIONS';

function CatalogTab() {
  const [view, setView] = useState<CatalogView>('AGENTS');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [selectedAgent, setSelectedAgent] = useState<AgentEntry | null>(null);
  const [selectedRes, setSelectedRes] = useState<Resource | null>(null);

  const VIEW_COLOR: Record<CatalogView, string> = {
    AGENTS: VIOLET,
    SKILLS: JADE,
    PROMPTS: AMBER,
    INSTRUCTIONS: CYAN,
  };
  const vc = VIEW_COLOR[view];

  const resSource = view === 'SKILLS' ? SKILLS : view === 'PROMPTS' ? PROMPTS : INSTRUCTIONS;
  const resTotal =
    view === 'SKILLS'
      ? RESOURCE_TOTAL.skills
      : view === 'PROMPTS'
        ? RESOURCE_TOTAL.prompts
        : RESOURCE_TOTAL.instructions;

  const filteredAgents = AGENTS.filter((a) => {
    const mc = catFilter === 'ALL' || a.cat === catFilter;
    const q = search.toLowerCase();
    return mc && (!q || a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));
  });

  const filteredRes = resSource.filter((r) => {
    const mc = catFilter === 'ALL' || r.cat === catFilter;
    const q = search.toLowerCase();
    return mc && (!q || r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q));
  });

  const resCats = Array.from(new Set(resSource.map((r) => r.cat))).sort();
  const resCatCounts: Record<string, number> = {};
  resSource.forEach((r) => {
    resCatCounts[r.cat] = (resCatCounts[r.cat] || 0) + 1;
  });

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* view toggles */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        {(['AGENTS', 'SKILLS', 'PROMPTS', 'INSTRUCTIONS'] as const).map((v) => {
          const vc2 = VIEW_COLOR[v];
          const cnt =
            v === 'AGENTS'
              ? AGENT_COUNT
              : v === 'SKILLS'
                ? RESOURCE_TOTAL.skills
                : v === 'PROMPTS'
                  ? RESOURCE_TOTAL.prompts
                  : RESOURCE_TOTAL.instructions;
          return (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setSearch('');
                setCatFilter('ALL');
                setSelectedAgent(null);
                setSelectedRes(null);
              }}
              className="hud-label"
              style={{
                padding: '5px 14px',
                fontSize: 9,
                letterSpacing: '0.2em',
                cursor: 'pointer',
                color: view === v ? '#0d1117' : vc2,
                background: view === v ? vc2 : 'transparent',
                border: `1px solid ${vc2}60`,
              }}
            >
              {v} <span style={{ opacity: 0.7 }}>·{cnt}</span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCatFilter('ALL');
          }}
          placeholder={`SEARCH ${view}…`}
          className="font-mono"
          style={{
            padding: '5px 10px',
            fontSize: 10,
            background: 'oklch(0.06 0.014 240 / 0.7)',
            border: `1px solid ${vc}44`,
            color: 'var(--fg)',
            outline: 'none',
            minWidth: 180,
            letterSpacing: '0.06em',
          }}
        />
      </div>

      {/* AGENTS view */}
      {view === 'AGENTS' && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 260px', gap: 10 }}>
          <div
            style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}
            className="nx-scroll"
          >
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
              <button
                onClick={() => setCatFilter('ALL')}
                className="hud-label"
                style={{
                  padding: '3px 8px',
                  fontSize: 8,
                  cursor: 'pointer',
                  letterSpacing: '0.14em',
                  color: catFilter === 'ALL' ? '#0d1117' : VIOLET,
                  background: catFilter === 'ALL' ? VIOLET : 'transparent',
                  border: `1px solid ${VIOLET}60`,
                }}
              >
                ALL · {AGENT_COUNT}
              </button>
              {CAT_ORDER_CATALOG.map((c) => {
                const cc = AGENT_CAT_COLORS[c] || CYAN;
                const cnt = (AGENTS_BY_CAT[c as AgentCategory] || []).length;
                if (!cnt) return null;
                return (
                  <button
                    key={c}
                    onClick={() => setCatFilter(c)}
                    className="hud-label"
                    style={{
                      padding: '3px 8px',
                      fontSize: 8,
                      cursor: 'pointer',
                      letterSpacing: '0.14em',
                      color: catFilter === c ? '#0d1117' : cc,
                      background: catFilter === c ? cc : 'transparent',
                      border: `1px solid ${cc}60`,
                    }}
                  >
                    {AGENT_CATEGORIES[c as AgentCategory].icon} {c} · {cnt}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 8,
                alignContent: 'start',
              }}
            >
              {filteredAgents.map((a, i) => {
                const cc = AGENT_CAT_COLORS[a.cat] || CYAN;
                const isSel = selectedAgent?.id === a.id;
                const sc = a.status === 'online' ? JADE : a.status === 'busy' ? AMBER : 'oklch(0.5 0.04 215)';
                return (
                  <div
                    key={a.id}
                    className="holo anim-fade-up"
                    onClick={() => setSelectedAgent(isSel ? null : a)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      animationDelay: `${i * 8}ms`,
                      border: isSel ? `1px solid ${cc}` : undefined,
                      background: isSel ? `${cc}0a` : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span
                        className="font-mono"
                        style={{ fontSize: 7.5, color: cc, letterSpacing: '0.18em' }}
                      >
                        {a.id}
                      </span>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: sc,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      />
                    </div>
                    <div
                      className="hud-label"
                      style={{
                        fontSize: 10.5,
                        color: isSel ? cc : CYAN_BRIGHT,
                        lineHeight: 1.2,
                        marginBottom: 4,
                      }}
                    >
                      {a.name}
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 8.5,
                        color: 'var(--cyan-dim)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {a.desc}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span
                        className="hud-label"
                        style={{ fontSize: 7.5, color: cc, border: `1px solid ${cc}55`, padding: '1px 5px' }}
                      >
                        {a.cat}
                      </span>
                      <span
                        className="font-mono"
                        style={{ fontSize: 7.5, color: 'var(--cyan-dim)', marginLeft: 6 }}
                      >
                        {a.model}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredAgents.length === 0 && (
                <div
                  className="font-mono"
                  style={{ color: 'var(--cyan-dim)', fontSize: 10, padding: 20, gridColumn: '1/-1' }}
                >
                  NO AGENTS MATCH "{search.toUpperCase()}"
                </div>
              )}
            </div>
          </div>
          <div
            className="holo"
            style={{ padding: 14, height: 'fit-content', maxHeight: '100%', overflowY: 'auto' }}
          >
            {selectedAgent ? (
              <>
                <div
                  className="hud-label"
                  style={{
                    fontSize: 8,
                    color: AGENT_CAT_COLORS[selectedAgent.cat] || CYAN,
                    letterSpacing: '0.26em',
                    marginBottom: 6,
                  }}
                >
                  {selectedAgent.id} · {selectedAgent.cat}
                </div>
                <div
                  className="font-display"
                  style={{ fontSize: 13, color: CYAN_BRIGHT, lineHeight: 1.2, marginBottom: 8 }}
                >
                  {selectedAgent.name}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 9.5, color: 'var(--fg)', lineHeight: 1.55, marginBottom: 10 }}
                >
                  {selectedAgent.desc}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>
                      MODEL
                    </div>
                    <div className="font-mono" style={{ fontSize: 9, color: AMBER, marginTop: 2 }}>
                      {selectedAgent.model}
                    </div>
                  </div>
                  <div>
                    <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>
                      STATUS
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        color:
                          selectedAgent.status === 'online'
                            ? JADE
                            : selectedAgent.status === 'busy'
                              ? AMBER
                              : 'var(--cyan-dim)',
                        marginTop: 2,
                      }}
                    >
                      {selectedAgent.status.toUpperCase()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="hud-label"
                  style={{
                    width: '100%',
                    padding: '5px',
                    fontSize: 8,
                    color: 'var(--cyan-dim)',
                    border: '1px solid var(--line-soft)',
                    letterSpacing: '0.22em',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  CLOSE
                </button>
              </>
            ) : (
              <>
                <div
                  className="hud-label"
                  style={{ fontSize: 8.5, color: VIOLET, letterSpacing: '0.26em', marginBottom: 8 }}
                >
                  ◈ AGENT CATALOG
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 28, color: VIOLET, lineHeight: 1, marginBottom: 4 }}
                >
                  <Value data={catalog(AGENT_COUNT, 'agents-catalog')} />
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 9, color: 'var(--cyan-dim)', marginBottom: 12 }}
                >
                  CATALOGED AGENTS
                </div>
                {CAT_ORDER_CATALOG.map((c) => {
                  const cnt = (AGENTS_BY_CAT[c as AgentCategory] || []).length;
                  if (!cnt) return null;
                  const cc = AGENT_CAT_COLORS[c] || CYAN;
                  return (
                    <div key={c} style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1.5 }}>
                        <span className="font-mono" style={{ fontSize: 8.5, color: cc }}>
                          {AGENT_CATEGORIES[c as AgentCategory].icon} {c}
                        </span>
                        <span className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)' }}>
                          {cnt}
                        </span>
                      </div>
                      <div style={{ height: 2, background: 'oklch(0.78 0.13 215 / 0.08)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${(cnt / AGENT_COUNT) * 100}%`,
                            background: cc,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* SKILLS / PROMPTS / INSTRUCTIONS views */}
      {view !== 'AGENTS' && (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 260px', gap: 10 }}>
          <div
            style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}
            className="nx-scroll"
          >
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
              <button
                onClick={() => setCatFilter('ALL')}
                className="hud-label"
                style={{
                  padding: '3px 8px',
                  fontSize: 8,
                  cursor: 'pointer',
                  letterSpacing: '0.14em',
                  color: catFilter === 'ALL' ? '#0d1117' : vc,
                  background: catFilter === 'ALL' ? vc : 'transparent',
                  border: `1px solid ${vc}60`,
                }}
              >
                ALL · {resSource.length}
              </button>
              {resCats.map((c) => {
                const cc = RES_CAT_COLORS2[c] || vc;
                return (
                  <button
                    key={c}
                    onClick={() => setCatFilter(c)}
                    className="hud-label"
                    style={{
                      padding: '3px 8px',
                      fontSize: 8,
                      cursor: 'pointer',
                      letterSpacing: '0.14em',
                      color: catFilter === c ? '#0d1117' : cc,
                      background: catFilter === c ? cc : 'transparent',
                      border: `1px solid ${cc}60`,
                    }}
                  >
                    {c} · {resCatCounts[c]}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 8,
                alignContent: 'start',
              }}
            >
              {filteredRes.map((r, i) => {
                const cc = RES_CAT_COLORS2[r.cat] || vc;
                const isSel = selectedRes?.id === r.id;
                return (
                  <div
                    key={r.id}
                    className="holo holo-brackets anim-fade-up"
                    onClick={() => setSelectedRes(isSel ? null : r)}
                    style={{
                      padding: 10,
                      cursor: 'pointer',
                      animationDelay: `${i * 8}ms`,
                      border: isSel ? `1px solid ${cc}` : undefined,
                    }}
                  >
                    <span className="br-bl" />
                    <span className="br-br" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span
                        className="font-mono"
                        style={{ fontSize: 7.5, color: vc, letterSpacing: '0.16em' }}
                      >
                        {r.id}
                      </span>
                      <span
                        className="hud-label"
                        style={{ fontSize: 7, color: vc, border: `1px solid ${vc}44`, padding: '1px 4px' }}
                      >
                        {view.slice(0, 3)}
                      </span>
                    </div>
                    <div
                      className="hud-label"
                      style={{
                        fontSize: 10.5,
                        color: isSel ? cc : CYAN_BRIGHT,
                        lineHeight: 1.2,
                        marginBottom: 4,
                      }}
                    >
                      {r.name}
                    </div>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 8.5,
                        color: 'var(--cyan-dim)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {r.desc}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span
                        className="hud-label"
                        style={{ fontSize: 7.5, color: cc, border: `1px solid ${cc}55`, padding: '1px 5px' }}
                      >
                        {r.cat}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredRes.length === 0 && (
                <div
                  className="font-mono"
                  style={{ color: 'var(--cyan-dim)', fontSize: 10, padding: 20, gridColumn: '1/-1' }}
                >
                  NO {view} MATCH "{search.toUpperCase()}"
                </div>
              )}
            </div>
          </div>
          <div
            className="holo"
            style={{ padding: 14, height: 'fit-content', maxHeight: '100%', overflowY: 'auto' }}
          >
            {selectedRes ? (
              <>
                <div
                  className="hud-label"
                  style={{
                    fontSize: 8,
                    color: RES_CAT_COLORS2[selectedRes.cat] || vc,
                    letterSpacing: '0.26em',
                    marginBottom: 6,
                  }}
                >
                  {selectedRes.id} · {selectedRes.cat}
                </div>
                <div
                  className="font-display"
                  style={{ fontSize: 13, color: CYAN_BRIGHT, lineHeight: 1.2, marginBottom: 8 }}
                >
                  {selectedRes.name}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 9.5, color: 'var(--fg)', lineHeight: 1.55, marginBottom: 10 }}
                >
                  {selectedRes.desc}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>
                      TYPE
                    </div>
                    <div className="font-mono" style={{ fontSize: 9, color: vc, marginTop: 2 }}>
                      {selectedRes.type}
                    </div>
                  </div>
                  <div>
                    <div className="hud-label" style={{ fontSize: 7.5, color: 'var(--cyan-dim)' }}>
                      CATEGORY
                    </div>
                    <div
                      className="font-mono"
                      style={{ fontSize: 9, color: RES_CAT_COLORS2[selectedRes.cat] || vc, marginTop: 2 }}
                    >
                      {selectedRes.cat}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRes(null)}
                  className="hud-label"
                  style={{
                    width: '100%',
                    padding: '5px',
                    fontSize: 8,
                    color: 'var(--cyan-dim)',
                    border: '1px solid var(--line-soft)',
                    letterSpacing: '0.22em',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  CLOSE
                </button>
              </>
            ) : (
              <>
                <div
                  className="hud-label"
                  style={{ fontSize: 8.5, color: vc, letterSpacing: '0.26em', marginBottom: 8 }}
                >
                  ◆ {view} CATEGORIES
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 22, color: vc, lineHeight: 1, marginBottom: 4 }}
                >
                  {resSource.length}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 9, color: 'var(--cyan-dim)', marginBottom: 10 }}
                >
                  IN CATALOG · {resTotal} ON DISK
                </div>
                {resCats.map((c) => {
                  const cnt = resCatCounts[c] ?? 0;
                  const cc = RES_CAT_COLORS2[c] || vc;
                  return (
                    <div key={c} style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1.5 }}>
                        <span className="font-mono" style={{ fontSize: 8.5, color: cc }}>
                          {c}
                        </span>
                        <span className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)' }}>
                          {cnt}
                        </span>
                      </div>
                      <div style={{ height: 2, background: 'oklch(0.78 0.13 215 / 0.08)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${(cnt / resSource.length) * 100}%`,
                            background: cc,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArsenalScreen() {
  const [INDEX, setIndex] = useState<SkillsIndex>(EMPTY_INDEX);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../data/skills-index.json').then((m) => {
      setIndex(m.default as SkillsIndex);
      setLoading(false);
    });
  }, []);

  async function rescan() {
    setLoading(true);
    try {
      const fresh = await window.jarvisBridge.rebuildIndex();
      if (fresh && fresh.total > 0) setIndex(fresh as SkillsIndex);
    } catch {}
    setLoading(false);
  }

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState('');
  const [detail, setDetail] = useState<SkillEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [editContent, setEditContent] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [tab, setTab] = useState<ArsenalTab>('INDEXED');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return INDEX.entries.filter((e) => {
      if (cat !== 'ALL' && e.cat !== cat) return false;
      if (type !== 'ALL' && e.type !== type) return false;
      if (source !== 'ALL') {
        const match =
          source === 'other'
            ? ![
                'copilot-agents',
                'antigravity',
                'copilot-prompts',
                'copilot-instructions',
                'copilot-skills',
              ].includes(e.source)
            : e.source === source;
        if (!match) return false;
      }
      if (q && !e.name.toLowerCase().includes(q) && !e.desc.toLowerCase().includes(q) && !e.slug.includes(q))
        return false;
      return true;
    });
  }, [query, cat, type, source, INDEX]);

  const totalPages = Math.ceil(filtered.length / PAGE);
  const visible = filtered.slice((page - 1) * PAGE, page * PAGE);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function onFilter(next: { cat?: string; type?: string; source?: string }) {
    setPage(1);
    if (next.cat !== undefined) setCat(next.cat);
    if (next.type !== undefined) setType(next.type);
    if (next.source !== undefined) setSource(next.source);
  }

  async function openSkill(e: SkillEntry) {
    setDetail(e);
    setEditContent(null);
    await navigator.clipboard.writeText(e.file);
    showToast(`copy: ${e.name}`);
  }

  async function loadEditContent(e: SkillEntry) {
    try {
      const result = await window.jarvisBridge.readFileContent(e.file);
      if (result.ok) setEditContent(result.content);
      else showToast(`read error: ${result.err}`);
    } catch (err: any) {
      showToast(`IPC: ${String(err?.message || err)}`);
    }
  }

  async function saveEditContent() {
    if (!detail || editContent === null) return;
    setEditSaving(true);
    try {
      const result = await window.jarvisBridge.writeFile({ filePath: detail.file, content: editContent });
      if (result.ok) {
        showToast(`saved: ${detail.name}`);
        setEditContent(null);
      } else showToast(`save error: ${result.err}`);
    } catch (err: any) {
      showToast(`IPC: ${String(err?.message || err)}`);
    }
    setEditSaving(false);
  }

  if (loading)
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span
          className="font-mono anim-pulse-soft"
          style={{ fontSize: 11, color: CYAN, letterSpacing: '0.2em' }}
        >
          LOADING ARSENAL...
        </span>
      </div>
    );

  const tabs = ARSENAL_TABS.map((t) => (t.id === 'INDEXED' ? { ...t, count: INDEX.total } : t));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      <ScreenHeader
        tag="VAULT"
        title="ARSENAL"
        subtitle={`${ARSENAL_TOTAL.toLocaleString()} TOTAL ASSETS  ·  Agents · Skills · Prompts · Instructions · Antigravity ${ANTIGRAVITY_TOTAL_SKILLS.toLocaleString()} · ${GAMECHANGERS.length} GC Collections · ${AWESOME_AI_APPS_TOTAL} AI Apps · ${PLUGINS_COUNT} Plugins`}
      />
      <DraggableTabs
        storageKey="jarvis.tabs.arsenal"
        defaultTabs={tabs.map((t) => ({
          id: t.id,
          label: t.label,
          color: t.color,
          count: t.count,
          pinned: t.id === 'INDEXED',
        }))}
        active={tab}
        onActivate={(id) => setTab(id as ArsenalTab)}
        extra={
          <>
            <button
              onClick={() => setCreating(true)}
              className="hud-label"
              style={{
                padding: '4px 10px',
                fontSize: 8,
                letterSpacing: '0.16em',
                color: JADE,
                border: `1px solid ${JADE}55`,
                background: `${JADE}10`,
                cursor: 'pointer',
                alignSelf: 'center',
                marginBottom: 2,
              }}
            >
              + CREATE
            </button>
            <button
              onClick={rescan}
              className="hud-label"
              style={{
                padding: '4px 10px',
                fontSize: 8,
                letterSpacing: '0.16em',
                color: CYAN,
                border: `1px solid ${CYAN}55`,
                background: `${CYAN}10`,
                cursor: 'pointer',
                alignSelf: 'center',
                marginBottom: 2,
                marginLeft: 4,
              }}
            >
              RESCAN
            </button>
            {toast && (
              <span
                className="font-mono"
                style={{ fontSize: 9, color: JADE, alignSelf: 'center', padding: '0 8px' }}
              >
                {toast}
              </span>
            )}
          </>
        }
      />
      {tab === 'INDEXED' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(INDEX.byType).map(([t, n]) => (
              <div
                key={t}
                style={{
                  padding: '6px 12px',
                  background: 'oklch(0.07 0.012 240 / 0.7)',
                  border: `1px solid ${TYPE_COLOR[t] || CYAN}44`,
                  cursor: 'pointer',
                }}
                onClick={() => onFilter({ type: type === t ? 'ALL' : t })}
              >
                <span className="font-mono" style={{ fontSize: 9, color: TYPE_COLOR[t] || CYAN }}>
                  {TYPE_GLYPH[t] || 'd'} {t.toUpperCase()}
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 11, color: 'var(--fg)', marginLeft: 8, fontWeight: 700 }}
                >
                  {n.toLocaleString()}
                </span>
              </div>
            ))}
            <div style={{ flex: 1 }} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="search name description slug..."
              className="font-mono"
              style={{
                flex: '1 1 200px',
                minWidth: 180,
                padding: '7px 12px',
                fontSize: 10,
                color: 'var(--fg)',
                background: 'oklch(0.07 0.014 240 / 0.8)',
                border: `1px solid ${CYAN}44`,
                outline: 'none',
              }}
            />
            {ALL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => onFilter({ type: t })}
                className="hud-label"
                style={{
                  padding: '5px 10px',
                  fontSize: 8,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  color: type === t ? TYPE_COLOR[t] || CYAN_BRIGHT : 'var(--cyan-dim)',
                  border: `1px solid ${type === t ? TYPE_COLOR[t] || CYAN : 'var(--line-soft)'}`,
                  background: type === t ? `${TYPE_COLOR[t] || CYAN}15` : 'transparent',
                }}
              >
                {t === 'ALL' ? 'ALL TYPES' : t.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_CATS.map((c) => {
              const cc = CAT_COLOR[c] || 'var(--fg)';
              const cnt = c === 'ALL' ? INDEX.total : INDEX.byCat[c] || 0;
              return (
                <button
                  key={c}
                  onClick={() => onFilter({ cat: c })}
                  className="hud-label"
                  style={{
                    padding: '4px 10px',
                    fontSize: 8,
                    letterSpacing: '0.14em',
                    cursor: 'pointer',
                    color: cat === c ? cc : 'var(--cyan-dim)',
                    border: `1px solid ${cat === c ? cc : 'var(--line-soft)'}`,
                    background: cat === c ? `${cc}15` : 'transparent',
                  }}
                >
                  {c} {cnt > 0 && <span style={{ opacity: 0.7 }}>({cnt})</span>}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)' }}>
              {filtered.length.toLocaleString()} results page {page}/{totalPages || 1}
            </span>
            <div style={{ flex: 1 }} />
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="hud-label"
              style={{
                padding: '3px 10px',
                fontSize: 9,
                cursor: 'pointer',
                opacity: page <= 1 ? 0.3 : 1,
                color: CYAN,
                border: `1px solid ${CYAN}44`,
                background: 'transparent',
              }}
            >
              PREV
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="hud-label"
              style={{
                padding: '3px 10px',
                fontSize: 9,
                cursor: 'pointer',
                opacity: page >= totalPages ? 0.3 : 1,
                color: CYAN,
                border: `1px solid ${CYAN}44`,
                background: 'transparent',
              }}
            >
              NEXT
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 8,
              alignContent: 'start',
              paddingRight: 4,
            }}
          >
            {visible.map((e) => (
              <SkillCard key={e.id} e={e} onOpen={openSkill} />
            ))}
            {visible.length === 0 && (
              <div
                className="font-mono"
                style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--cyan-dim)', padding: 40 }}
              >
                no results for "{query}"
              </div>
            )}
          </div>
        </>
      )}{' '}
      {/* end INDEXED tab */}
      {/* ── GC COLLECTIONS tab ─────────────────────────────────────────────── */}
      {tab === 'COLLECTIONS' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
          <div
            className="font-mono"
            style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginBottom: 10, letterSpacing: '0.1em' }}
          >
            <span style={{ color: '#c8fb4e' }}>{GAMECHANGERS.length} REPOSITORIES</span> ·{' '}
            {GAMECHANGERS_TOTAL.toLocaleString()} TOTAL FILES
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
              alignContent: 'start',
            }}
          >
            {GAMECHANGERS.map((gc, i) => (
              <div
                key={gc.id}
                className="holo holo-brackets anim-fade-up"
                style={{ padding: '14px 16px', animationDelay: `${i * 20}ms` }}
              >
                <span className="br-bl" />
                <span className="br-br" />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{ fontSize: 8.5, color: gc.color, letterSpacing: '0.18em' }}
                  >
                    {gc.id}
                  </span>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 7.5,
                      color: gc.color,
                      border: `1px solid ${gc.color}44`,
                      padding: '1px 6px',
                      letterSpacing: '0.14em',
                    }}
                  >
                    {gc.tag}
                  </span>
                </div>
                <div
                  className="hud-label"
                  style={{ fontSize: 11.5, color: 'var(--fg)', lineHeight: 1.2, marginBottom: 6 }}
                >
                  {gc.name}
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 8.5,
                    color: 'var(--cyan-dim)',
                    lineHeight: 1.45,
                    marginBottom: 10,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {gc.desc}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-mono" style={{ fontSize: 9, color: gc.color }}>
                    {gc.fileCount.toLocaleString()} files
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.06em' }}
                  >
                    github-gamechangers/{gc.slug}
                  </span>
                </div>
                <div style={{ height: 3, background: 'oklch(0.78 0.13 215 / 0.08)', marginTop: 8 }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(gc.fileCount / GAMECHANGERS_TOTAL) * 100}%`,
                      background: gc.color,
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── ANTIGRAVITY tab ────────────────────────────────────────────────── */}
      {tab === 'ANTIGRAVITY' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
          <div
            className="font-mono"
            style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginBottom: 10, letterSpacing: '0.1em' }}
          >
            <span style={{ color: VIOLET }}>{ANTIGRAVITY_TOTAL_SKILLS.toLocaleString()} SKILLS</span> ·
            antigravity-awesome-skills/skills/
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 8,
              alignContent: 'start',
            }}
          >
            {ANTIGRAVITY_CATEGORIES.map((cat, i) => (
              <div
                key={cat.label}
                className="holo anim-fade-up"
                style={{ padding: '12px 14px', animationDelay: `${i * 15}ms` }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 6,
                  }}
                >
                  <div className="hud-label" style={{ fontSize: 11, color: cat.color, lineHeight: 1.2 }}>
                    {cat.label}
                  </div>
                  <span
                    className="font-mono"
                    style={{ fontSize: 18, color: cat.color, lineHeight: 1, flexShrink: 0, marginLeft: 8 }}
                  >
                    {cat.count}
                  </span>
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 8.5,
                    color: 'var(--cyan-dim)',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {cat.examples.slice(0, 3).join(' · ')}
                </div>
                <div style={{ height: 2, background: 'oklch(0.78 0.13 215 / 0.08)', marginTop: 8 }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(cat.count / ANTIGRAVITY_TOTAL_SKILLS) * 100}%`,
                      background: cat.color,
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── AI APPS tab ────────────────────────────────────────────────────── */}
      {tab === 'AI-APPS' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
          <div
            className="font-mono"
            style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginBottom: 10, letterSpacing: '0.1em' }}
          >
            <span style={{ color: '#e879f9' }}>{AWESOME_AI_APPS_TOTAL} PROJECTS</span> · awesome-ai-apps/ —
            runnable agent applications
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
              alignContent: 'start',
            }}
          >
            {AWESOME_AI_APP_CATEGORIES.map((cat, i) => (
              <div
                key={cat.id}
                className="holo holo-brackets anim-fade-up"
                style={{ padding: '14px 16px', animationDelay: `${i * 20}ms` }}
              >
                <span className="br-bl" />
                <span className="br-br" />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{ fontSize: 8.5, color: cat.color, letterSpacing: '0.16em' }}
                  >
                    {cat.id}
                  </span>
                  <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                </div>
                <div
                  className="hud-label"
                  style={{ fontSize: 11.5, color: 'var(--fg)', lineHeight: 1.2, marginBottom: 6 }}
                >
                  {cat.label}
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 8.5,
                    color: 'var(--cyan-dim)',
                    lineHeight: 1.45,
                    marginBottom: 10,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {cat.desc}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-mono" style={{ fontSize: 18, color: cat.color, lineHeight: 1 }}>
                    {cat.count}
                  </span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {cat.examples.slice(0, 3).map((ex) => (
                      <span
                        key={ex}
                        className="font-mono"
                        style={{
                          fontSize: 7,
                          color: cat.color,
                          border: `1px solid ${cat.color}44`,
                          padding: '1px 5px',
                        }}
                      >
                        {ex.replace(/_/g, '-')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── PLUGINS tab ────────────────────────────────────────────────────── */}
      {tab === 'PLUGINS' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
          <div
            className="font-mono"
            style={{ fontSize: 9.5, color: 'var(--cyan-dim)', marginBottom: 10, letterSpacing: '0.1em' }}
          >
            <span style={{ color: '#fb923c' }}>{PLUGINS_COUNT} PLUGINS</span> · GitHub Copilot plugin packages
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 6,
              alignContent: 'start',
            }}
          >
            {PLUGINS.map((p, i) => (
              <div
                key={p.slug}
                className="holo anim-fade-up"
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  animationDelay: `${i * 10}ms`,
                }}
              >
                <div>
                  <div
                    className="hud-label"
                    style={{ fontSize: 9.5, color: p.color, letterSpacing: '0.14em' }}
                  >
                    {p.name}
                  </div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 7.5, color: 'var(--cyan-dim)', marginTop: 2 }}
                  >
                    {p.slug}
                  </div>
                </div>
                <span
                  className="hud-label"
                  style={{
                    fontSize: 7,
                    color: p.color,
                    border: `1px solid ${p.color}44`,
                    padding: '1px 6px',
                    letterSpacing: '0.14em',
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {p.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── PROJECTS tab ──────────────────────────────────────────────────── */}
      {tab === 'PROJECTS' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
          {/* Skill Collections */}
          <div
            className="hud-label"
            style={{ fontSize: 8, color: CYAN, letterSpacing: '0.28em', marginBottom: 8 }}
          >
            ◈ SKILL COLLECTIONS · {SKILL_COLLECTIONS.length}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 8,
              marginBottom: 18,
            }}
          >
            {SKILL_COLLECTIONS.map((c, i) => (
              <div
                key={c.id}
                className="holo anim-fade-up"
                style={{ padding: '12px 14px', animationDelay: `${i * 15}ms` }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 5,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{ fontSize: 8, color: c.color, letterSpacing: '0.16em' }}
                  >
                    {c.id}
                  </span>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 7,
                      color: c.color,
                      border: `1px solid ${c.color}44`,
                      padding: '1px 5px',
                    }}
                  >
                    {c.tag}
                  </span>
                </div>
                <div className="hud-label" style={{ fontSize: 11, color: 'var(--fg)', marginBottom: 4 }}>
                  {c.name}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 8.5, color: 'var(--cyan-dim)', lineHeight: 1.4 }}
                >
                  {c.desc}
                </div>
                <div className="font-mono" style={{ fontSize: 7.5, color: `${c.color}80`, marginTop: 6 }}>
                  📁 {c.path}
                </div>
              </div>
            ))}
          </div>

          {/* External Projects */}
          <div
            className="hud-label"
            style={{ fontSize: 8, color: JADE, letterSpacing: '0.28em', marginBottom: 8 }}
          >
            ◆ EXTERNAL PROJECTS · {EXTERNAL_PROJECTS.length}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 8,
              marginBottom: 18,
            }}
          >
            {EXTERNAL_PROJECTS.map((p, i) => (
              <div
                key={p.id}
                className="holo anim-fade-up"
                style={{ padding: '12px 14px', animationDelay: `${i * 10}ms` }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 5,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{ fontSize: 8, color: p.color, letterSpacing: '0.16em' }}
                  >
                    {p.id}
                  </span>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 7,
                      color: p.color,
                      border: `1px solid ${p.color}44`,
                      padding: '1px 5px',
                    }}
                  >
                    {p.tag}
                  </span>
                </div>
                <div className="hud-label" style={{ fontSize: 11, color: 'var(--fg)', marginBottom: 4 }}>
                  {p.name}
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 8.5,
                    color: 'var(--cyan-dim)',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {p.desc}
                </div>
                <div className="font-mono" style={{ fontSize: 7.5, color: `${p.color}80`, marginTop: 6 }}>
                  📁 {p.path}
                </div>
              </div>
            ))}
          </div>

          {/* Reference Repos */}
          <div
            className="hud-label"
            style={{ fontSize: 8, color: AMBER, letterSpacing: '0.28em', marginBottom: 8 }}
          >
            ◉ REFERENCE REPOS · {REFERENCE_REPOS.length}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 8,
              marginBottom: 18,
            }}
          >
            {REFERENCE_REPOS.map((r, i) => (
              <div
                key={r.id}
                className="holo anim-fade-up"
                style={{ padding: '12px 14px', animationDelay: `${i * 15}ms` }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 5,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{ fontSize: 8, color: r.color, letterSpacing: '0.16em' }}
                  >
                    {r.id}
                  </span>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 7,
                      color: r.color,
                      border: `1px solid ${r.color}44`,
                      padding: '1px 5px',
                    }}
                  >
                    {r.tag}
                  </span>
                </div>
                <div className="hud-label" style={{ fontSize: 11, color: 'var(--fg)', marginBottom: 4 }}>
                  {r.name}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 8.5, color: 'var(--cyan-dim)', lineHeight: 1.4 }}
                >
                  {r.desc}
                </div>
                <div className="font-mono" style={{ fontSize: 7.5, color: `${r.color}80`, marginTop: 6 }}>
                  📁 {r.path}
                </div>
              </div>
            ))}
          </div>

          {/* Trading Resources */}
          <div
            className="hud-label"
            style={{ fontSize: 8, color: JADE, letterSpacing: '0.28em', marginBottom: 8 }}
          >
            ◆ TRADING RESOURCES · {TRADING_RESOURCES.length}
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}
          >
            {TRADING_RESOURCES.map((t, i) => (
              <div
                key={t.id}
                className="holo anim-fade-up"
                style={{ padding: '12px 14px', animationDelay: `${i * 10}ms` }}
              >
                <span className="font-mono" style={{ fontSize: 8, color: JADE, letterSpacing: '0.16em' }}>
                  {t.id}
                </span>
                <div
                  className="hud-label"
                  style={{ fontSize: 11, color: 'var(--fg)', marginTop: 5, marginBottom: 4 }}
                >
                  {t.name}
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 8.5, color: 'var(--cyan-dim)', lineHeight: 1.4 }}
                >
                  {t.desc}
                </div>
                <div className="font-mono" style={{ fontSize: 7.5, color: `${JADE}80`, marginTop: 6 }}>
                  📁 {t.path}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ── CATALOG tab ─────────────────────────────────────────────────────── */}
      {tab === 'CATALOG' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CatalogTab />
        </div>
      )}
      {/* ── ORCHESTRA tab ────────────────────────────────────────────────────── */}
      {tab === 'ORCHESTRA' && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="nx-scroll">
          <OrchestraScreen />
        </div>
      )}
      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={rescan} setToast={showToast} />}
      {detail && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'oklch(0.04 0.012 240 / 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => {
            setDetail(null);
            setEditContent(null);
          }}
        >
          <div
            style={{
              width: 560,
              maxHeight: '88vh',
              overflow: 'auto',
              background: 'oklch(0.07 0.014 240)',
              border: `1px solid ${CAT_COLOR[detail.cat] || CYAN}`,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onClick={(e2) => e2.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div
                  className="hud-label"
                  style={{
                    fontSize: 14,
                    color: CAT_COLOR[detail.cat] || CYAN,
                    letterSpacing: '0.1em',
                    fontWeight: 700,
                  }}
                >
                  {TYPE_GLYPH[detail.type]} {detail.name}
                </div>
                <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', marginTop: 4 }}>
                  {detail.id} {detail.source}
                </div>
              </div>
              <button
                onClick={() => {
                  setDetail(null);
                  setEditContent(null);
                }}
                style={{ background: 'none', border: 'none', color: ROSE, cursor: 'pointer', fontSize: 14 }}
              >
                X
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge label={detail.type.toUpperCase()} color={TYPE_COLOR[detail.type] || CYAN} />
              <Badge label={detail.cat} color={CAT_COLOR[detail.cat] || CYAN} />
              {detail.risk && (
                <Badge label={detail.risk.toUpperCase()} color={detail.risk === 'safe' ? JADE : ROSE} />
              )}
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg)', lineHeight: 1.6 }}>
              {detail.desc}
            </div>
            <HoloPanel label="FILE PATH" code="FS" status="queue">
              <div
                className="font-mono"
                style={{ fontSize: 9, color: AMBER, wordBreak: 'break-all', lineHeight: 1.5 }}
              >
                {detail.file}
              </div>
            </HoloPanel>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(detail.file);
                  showToast('path copied');
                }}
                className="hud-label"
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  color: CYAN,
                  border: `1px solid ${CYAN}`,
                  background: `${CYAN}12`,
                }}
              >
                COPY PATH
              </button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(detail.path);
                  showToast('folder copied');
                }}
                className="hud-label"
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  color: JADE,
                  border: `1px solid ${JADE}`,
                  background: `${JADE}12`,
                }}
              >
                COPY FOLDER
              </button>
              <button
                onClick={() => (editContent === null ? loadEditContent(detail) : setEditContent(null))}
                className="hud-label"
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  color: AMBER,
                  border: `1px solid ${AMBER}`,
                  background: `${AMBER}12`,
                }}
              >
                {editContent !== null ? 'CANCEL EDIT' : 'EDIT'}
              </button>
            </div>
            {editContent !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="hud-label" style={{ fontSize: 8, color: AMBER, letterSpacing: '0.14em' }}>
                  EDIT CONTENT
                </span>
                <textarea
                  value={editContent}
                  onChange={(e2) => setEditContent(e2.target.value)}
                  style={{
                    width: '100%',
                    height: 260,
                    padding: '8px 10px',
                    fontSize: 9,
                    lineHeight: 1.55,
                    color: 'var(--fg)',
                    background: 'oklch(0.05 0.012 240)',
                    border: `1px solid ${AMBER}55`,
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'var(--font-mono)',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={saveEditContent}
                  disabled={editSaving}
                  className="hud-label"
                  style={{
                    padding: '8px',
                    fontSize: 9,
                    letterSpacing: '0.15em',
                    cursor: 'pointer',
                    color: JADE,
                    border: `1px solid ${JADE}`,
                    background: `${JADE}18`,
                    opacity: editSaving ? 0.5 : 1,
                  }}
                >
                  {editSaving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === 'DISCOVER' && <DiscoverTab />}
    </div>
  );
}
