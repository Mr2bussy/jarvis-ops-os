/* JARVIS — Claude integration + persona + localStorage helpers.
 * In Electron, calls go through window.jarvisBridge.complete (IPC to main process,
 * which uses @anthropic-ai/sdk with ANTHROPIC_API_KEY from .env). */

import type { Briefing, BriefingItem } from '../data/os-data';
import type { AccentName } from '../theme';
import { extractJson } from './extract-json';

export const LS = {
  context: 'jarvis.context',
  console: 'jarvis.console',
  briefings: 'jarvis.briefings.live',
  runs: 'jarvis.workflows.run',
} as const;

export function lsGet<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function lsSet(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* noop */
  }
}

export const DEFAULT_CONTEXT = `Operator: ZAXCO (alias). German-speaking, based in Germany.
Interests: trading (crypto + DAX + FX), content creation (YouTube + X + IG + Twitch), software/automation, AI tooling.
Stance: ambitious, builder mindset, wants leverage and edge. Prefers terse, high-signal answers.
Language: reply in the same language the operator uses. Default to German if it's a mix.`;

export const JARVIS_PERSONA = `You are JARVIS — the operations AI orchestrating ZAXCO's command bridge.

VOICE & STYLE
- Calm, precise, slightly cinematic. Like a chief-of-staff who has already done the research.
- Terse first, expand only if asked. Lead with the answer, then the reasoning.
- No filler ("Of course!", "Great question!"). No emoji unless the operator uses them first.
- Use HUD-style framing sparingly when it adds clarity: "Status:", "Recommendation:", "Risk:".
- You may reference the agent roster (Trading Floor, Counsel Mesh, Scout Cell, etc.) when relevant.
- Match the operator's language. If they mix German + English, you may too.

CAPABILITIES
- You have broad general knowledge: markets, code, business, law/tax basics (not advice), content strategy, science.
- For market/legal/medical decisions: give the analysis but flag "Confirm with a licensed professional before acting."
- You can refuse cleanly: piracy, payment fraud, hacking real systems, IP geo-spoofing to bypass paid services, anything that harms real people. State the refusal in one sentence and offer a legitimate alternative.

ENVIRONMENT
- You live inside a desktop "Operations OS" (Electron). You cannot actually execute code, trade, send emails, or access the operator's PC. The agent roster ("Scout Cell", "Trader Bot") is theatrical — narrate as if it exists, but when the operator asks for something that requires real execution, be honest: "I'd dispatch the [team] for this, but in this build I'll do the work directly in chat."`;

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export async function askJarvis(opts: {
  messages: ChatMsg[];
  system?: string;
  maxTokens?: number;
}): Promise<string> {
  const context = lsGet(LS.context, DEFAULT_CONTEXT);
  const sys = (opts.system ? opts.system + '\n\n' : '') + JARVIS_PERSONA + '\n\nOPERATOR CONTEXT\n' + context;
  if (!window.jarvisBridge) {
    throw new Error('jarvisBridge not available — Electron preload missing.');
  }
  try {
    return await window.jarvisBridge.complete({
      messages: opts.messages,
      system: sys,
      maxTokens: opts.maxTokens,
    });
  } catch (e: any) {
    throw new Error(e?.message || String(e));
  }
}

/* ── Briefings ─────────────────────────────────────────────────────────── */

type BriefingKindKey = 'morning' | 'market' | 'content' | 'custom';

interface BriefingKindDef {
  label: string;
  tag: string;
  accent: AccentName;
  prompt: (extra: string) => string;
}

export const BRIEFING_KINDS: Record<BriefingKindKey, BriefingKindDef> = {
  morning: {
    label: 'Morning Intel',
    tag: 'MORNING INTEL',
    accent: 'cyan',
    prompt: (extra) =>
      `Generate today's MORNING INTEL briefing for the operator.
Date context: ${new Date().toDateString()}.
${extra ? 'Operator focus today: ' + extra : ''}

Return JSON ONLY, no prose around it. Schema:
{
  "title": "<short headline, 4-8 words>",
  "blurb": "<2-3 sentence opener — high-signal>",
  "items": [
    { "tag": "<3-5 letter category like GEO / MARKT / OPS / TECH>", "text": "<one tight sentence>" }
  ],
  "summary": "<one-line recommendation starting with 'Empfehlung:' or 'Recommendation:'>"
}

3-5 items total. Items should be CONCRETE and DECISION-RELEVANT, not generic news. If you don't know real current events, invent plausible-but-clearly-flagged ones and prefix them with "Scenario:".`,
  },
  market: {
    label: 'Market Brief',
    tag: 'MARKET BRIEF',
    accent: 'amber',
    prompt: (extra) =>
      `Generate a PRE-OPEN MARKET BRIEFING.
${extra ? 'Specific focus: ' + extra : 'Focus: crypto majors (BTC, ETH, SOL), DAX, EURUSD.'}

Return JSON ONLY:
{
  "title": "<short headline>",
  "blurb": "<2-3 sentences setting the macro tone>",
  "items": [
    { "tag": "<asset code like BTC / DAX / EUR>", "text": "<setup, levels, what to watch — one sentence>" }
  ],
  "summary": "<one line: bias, risk-on/off, recommended bot stance>"
}

3-5 items. Use realistic price levels but mark them "indicative" if you can't be current.`,
  },
  content: {
    label: 'Content Brief',
    tag: 'CONTENT BRIEF',
    accent: 'violet',
    prompt: (extra) =>
      `Generate a CONTENT PERFORMANCE BRIEFING for the past 24h across YouTube, X, Instagram, Twitch, Newsletter.
${extra ? 'Specific focus: ' + extra : ''}

Return JSON ONLY:
{
  "title": "<short headline>",
  "blurb": "<2-3 sentence overview>",
  "items": [
    { "tag": "<channel like YT / X / IG / TW / NL>", "text": "<one sentence: metric + insight>" }
  ],
  "summary": "<one line recommendation for the next 24h>"
}

4-6 items. Invent plausible numbers but make them coherent. Mark hypotheticals with 'Scenario:' if needed.`,
  },
  custom: {
    label: 'Custom Briefing',
    tag: 'CUSTOM BRIEF',
    accent: 'jade',
    prompt: (extra) =>
      `Generate a custom briefing for the operator on this topic:
"${extra || 'operator did not specify — pick something useful given their context'}"

Return JSON ONLY:
{
  "title": "<short headline>",
  "blurb": "<2-3 sentence framing>",
  "items": [
    { "tag": "<short category>", "text": "<one sentence>" }
  ],
  "summary": "<one line recommendation>"
}

3-6 items.`,
  },
};

export async function composeBriefing(kind: BriefingKindKey, extra?: string): Promise<Briefing> {
  const def = BRIEFING_KINDS[kind] || BRIEFING_KINDS.custom;
  const text = await askJarvis({
    messages: [{ role: 'user', content: def.prompt(extra || '') }],
    system: 'You are JARVIS generating a structured briefing. Output ONLY valid JSON, no commentary.',
    maxTokens: 900,
  });
  const data = extractJson<any>(text);
  const time = new Date().toTimeString().slice(0, 5);
  if (!data) {
    return {
      id: `BRF-${Date.now()}`,
      tag: def.tag,
      accent: def.accent,
      time,
      title: 'Briefing (raw)',
      blurb: "Couldn't parse a structured briefing — raw output below.",
      items: [{ tag: 'RAW', text: (text || '').slice(0, 600) }],
      summary: 'Try again or rephrase.',
    };
  }
  return {
    id: `BRF-${Date.now()}`,
    tag: def.tag,
    accent: def.accent,
    time,
    title: data.title || def.label,
    blurb: data.blurb || '',
    items: Array.isArray(data.items) ? (data.items as BriefingItem[]) : [],
    summary: data.summary || '',
  };
}

/* ── Workflows ─────────────────────────────────────────────────────────── */

export async function runResearch(topic: string, context?: string): Promise<string> {
  return askJarvis({
    messages: [
      {
        role: 'user',
        content: `Run a research brief on: "${topic}"
${context ? "Operator's angle: " + context : ''}

Deliver this exact structure (plain markdown is fine — no JSON needed):

## TL;DR
3 bullets, each one tight sentence.

## Key Facts
4-6 bullets — verifiable, dated where possible.

## Counterpoints / Risks
2-3 bullets — what could the operator be wrong about?

## Recommended Next Actions
3 concrete things the operator could do this week.

## Confidence
A single line stating overall confidence (HIGH / MEDIUM / LOW) and why.`,
      },
    ],
    maxTokens: 900,
  });
}

export async function runContent(brief: string, channel: string): Promise<string> {
  return askJarvis({
    messages: [
      {
        role: 'user',
        content: `Draft 3 distinct ${channel} posts/drafts on this brief:
"${brief}"

For each:
- Tag them DRAFT A / DRAFT B / DRAFT C.
- ${channel === 'X / Twitter' ? "Each draft = a 3-5 tweet thread, separated by '— —'." : ''}
- ${channel === 'YouTube' ? 'Each draft = a video title + 3-bullet hook + 5-beat outline.' : ''}
- ${channel === 'Instagram' ? 'Each draft = a reel hook + caption + 5 hashtags.' : ''}
- ${channel === 'Newsletter' ? 'Each draft = a subject line + 80-word body.' : ''}
- ${channel === 'Twitch' ? 'Each draft = a stream title + thumbnail-style hook + 4-segment rundown.' : ''}

Distinct angles for each draft. Concrete, not generic.`,
      },
    ],
    maxTokens: 900,
  });
}

export async function runPlanDay(tasks: string, context?: string): Promise<string> {
  return askJarvis({
    messages: [
      {
        role: 'user',
        content: `Plan today for the operator. Tasks/inputs:
${tasks}

${context ? "Today's context: " + context : ''}

Deliver:

## Reading
One sentence on the operator's likely state / capacity / what to optimize for today.

## Schedule
A 06:00 → 22:00 block schedule. Each block: time range + task + one-sentence why.
Group deep work, batch shallow work, leave reactive windows.

## Drop List
What to NOT do today, and why.

## End-of-day Check
What "win" looks like by 22:00.`,
      },
    ],
    maxTokens: 900,
  });
}

export interface ConsoleLine {
  who: 'OPERATOR' | 'JARVIS';
  t: string;
  text: string;
}

export async function chatWithJarvis(history: ConsoleLine[], newMessage: string): Promise<string> {
  const trimmed = history.slice(-12);
  const messages: ChatMsg[] = [
    ...trimmed.map<ChatMsg>((m) => ({ role: m.who === 'OPERATOR' ? 'user' : 'assistant', content: m.text })),
    { role: 'user', content: newMessage },
  ];
  return askJarvis({ messages, maxTokens: 700 });
}
