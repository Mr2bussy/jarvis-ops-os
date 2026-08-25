// @ts-nocheck
import type { RiskClass } from '../types';

/**
 * The capability catalog — one declaration per tool, and the only place that
 * describes what the harness can do.
 *
 * ## The defect this replaces
 *
 * `agent-loop.ts` announced its tools as a hand-written sentence:
 *
 *     'Available tools: read_file, write_file, shell_exec, mt5_call, verify_check.'
 *
 * By the time it was found, `browser_task` and `web_search` were both built,
 * wired through the executor and covered by tests — and completely invisible to
 * the model, because nobody remembered to edit the sentence. `shell_exec`
 * meanwhile was still advertised after the executor started refusing it, so the
 * agent burned turns calling a tool that always failed.
 *
 * A list that must be kept in sync by hand will drift. This catalog is the
 * source, `renderToolPrompt()` derives the prompt from it, and a test asserts
 * that the catalog and the executor agree on the tool names.
 *
 * ## Why the contracts
 *
 * Each entry declares `requires` and `produces` as *facts*, not prose. That
 * turns "which tools exist" into "what can be reached from here", so a goal can
 * be resolved backward into a chain — and, more usefully, a goal that cannot be
 * reached says which precondition is missing instead of failing halfway
 * through. `reversible` names the undo operation where one exists; a tool with
 * neither `reversible` nor `irreversible` is treated as irreversible, because
 * that is the safe default rather than the convenient one.
 */

export interface ToolContract {
  name: string;
  /** One line, written for the model. */
  summary: string;
  /** Argument shape, rendered into the prompt as a literal example. */
  example: Record<string, unknown>;
  /** Facts that must hold before this can run. */
  requires: string[];
  /** The fact this establishes. */
  produces: string;
  /** Name of the operation that undoes this, or null when nothing undoes it. */
  reversible: string | null;
  /** Explicitly not undoable — money, messages, orders. */
  irreversible?: boolean;
  /** Risk class the gate assigns; kept here so the catalog documents it too. */
  risk: RiskClass;
  /** False when the executor currently refuses it — never advertised. */
  available: boolean;
  /** Why it is unavailable, shown in diagnostics rather than silently hidden. */
  unavailableReason?: string;
}

export const TOOL_CATALOG: ToolContract[] = [
  {
    name: 'read_file',
    summary: 'Read a file inside the allowed workspace roots.',
    example: { path: 'relative/path.ts' },
    requires: ['workspace.root'],
    produces: 'file.content',
    reversible: null, // reading changes nothing, so there is nothing to undo
    risk: 'read',
    available: true,
  },
  {
    name: 'write_file',
    summary: 'Write a file inside the allowed workspace roots. Creates parent directories.',
    example: { path: 'relative/path.ts', content: '…' },
    requires: ['workspace.root'],
    produces: 'file.written',
    reversible: 'restore previous file content from the run journal',
    risk: 'write',
    available: true,
  },
  {
    name: 'verify_check',
    summary: 'Run a named verification. The loop may not claim success until this passes.',
    example: { id: 'default' },
    requires: [],
    produces: 'verification',
    reversible: null,
    risk: 'read',
    available: true,
  },
  {
    name: 'mt5_call',
    summary: 'Call the local MT5 bridge. Read endpoints are free; order endpoints need approval.',
    example: { endpoint: 'positions', method: 'GET' },
    requires: ['mt5.bridge'],
    produces: 'mt5.data',
    reversible: null,
    risk: 'read',
    available: true,
  },
  {
    name: 'browser_task',
    summary: 'Drive a real browser to complete a described task. Slow; minutes, not seconds.',
    example: { task: 'Open example.com and read the pricing table', maxSteps: 12 },
    requires: ['browser.bridge'],
    produces: 'browser.result',
    // The page decides what a click does, so the inverse is unknowable here.
    reversible: null,
    irreversible: true,
    risk: 'browser',
    available: true,
  },
  {
    name: 'web_search',
    summary: 'Search the web through a configured provider. Returns titles, URLs and snippets.',
    example: { query: 'ECB rate decision schedule', maxResults: 5 },
    requires: ['search.provider'],
    produces: 'search.results',
    reversible: null,
    risk: 'read',
    available: true,
  },
  {
    name: 'shell_exec',
    summary: 'Run a shell command.',
    example: { command: 'git status' },
    requires: [],
    produces: 'shell.output',
    reversible: null,
    irreversible: true,
    risk: 'shell',
    // Refused by the executor by design — the Advanced Mode console is the
    // supervised path. Advertising it cost the agent a turn every time.
    available: false,
    unavailableReason: 'Im Harness deaktiviert — die Advanced-Mode-Konsole ist der überwachte Weg.',
  },
];

/** Tools the executor will actually run. */
export function availableTools(): ToolContract[] {
  return TOOL_CATALOG.filter((t) => t.available);
}

export function findTool(name: string): ToolContract | undefined {
  return TOOL_CATALOG.find((t) => t.name === name);
}

/**
 * Whether a tool must collect approval regardless of the risk gate's mood.
 *
 * Safe default: anything that declares neither an inverse nor `irreversible`
 * is treated as unrecoverable. Forgetting to declare should cost an approval
 * prompt, not an unrecoverable action.
 */
export function needsApproval(t: ToolContract): boolean {
  return t.irreversible === true || t.reversible === null;
}

/**
 * Render the tool section of the system prompt from the catalog.
 *
 * Every fact the model gets about tooling originates here, so the prompt cannot
 * drift from the executor.
 */
export function renderToolPrompt(): string {
  const lines: string[] = [
    'When you need to act, emit a fenced block:',
    '```tool',
    '{"name":"read_file","arguments":{"path":"relative/path.ts"}}',
    '```',
    '',
    'Available tools:',
  ];

  for (const t of availableTools()) {
    lines.push(`- ${t.name} — ${t.summary}`);
    lines.push(`  arguments: ${JSON.stringify(t.example)}`);
    if (t.irreversible) {
      lines.push('  NOT UNDOABLE: this needs operator approval before it runs.');
    } else if (t.reversible) {
      lines.push(`  undo: ${t.reversible}`);
    }
  }

  const off = TOOL_CATALOG.filter((t) => !t.available);
  if (off.length) {
    lines.push('');
    lines.push(`Not available: ${off.map((t) => t.name).join(', ')}. Do not call these.`);
  }

  lines.push('');
  lines.push('Do not claim done until verify_check passes.');
  return lines.join('\n');
}

export interface ChainStep {
  tool: ToolContract;
  /** False when one of its own requirements could not be met. */
  satisfied: boolean;
}

export interface ChainPlan {
  steps: ChainStep[];
  /** Facts nothing in the catalog produces — the honest half of the answer. */
  missing: string[];
  ok: boolean;
}

/**
 * Resolve a wanted fact backward into an ordered chain of tool calls.
 *
 * `have` is the set of facts already true — a running bridge, a configured
 * provider, an open workspace. Depth is capped so a mis-declared cycle degrades
 * into "unreachable" rather than hanging the caller.
 */
export function planChain(want: string, have: Iterable<string>): ChainPlan {
  const known = new Set(have);
  const steps: ChainStep[] = [];
  const missing: string[] = [];
  const visiting = new Set<string>();

  function resolve(fact: string, depth: number): boolean {
    if (known.has(fact)) return true;
    if (visiting.has(fact)) return false; // cycle — treat as unreachable
    if (depth > 16) return false;

    const tool = availableTools().find((t) => t.produces === fact);
    if (!tool) {
      if (!missing.includes(fact)) missing.push(fact);
      return false;
    }
    visiting.add(fact);
    let ok = true;
    for (const req of tool.requires) {
      if (!resolve(req, depth + 1)) ok = false;
    }
    visiting.delete(fact);

    if (!steps.some((s) => s.tool.name === tool.name)) {
      steps.push({ tool, satisfied: ok });
    }
    return ok;
  }

  const ok = resolve(want, 0);
  return { steps, missing, ok };
}
