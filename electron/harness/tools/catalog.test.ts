// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  TOOL_CATALOG,
  availableTools,
  findTool,
  needsApproval,
  renderToolPrompt,
  planChain,
} from './catalog';

describe('catalog and executor agree', () => {
  /**
   * The regression guard. The prompt used to be a hand-written sentence that
   * silently fell out of date: two shipped tools were invisible to the model
   * and one refused tool was still advertised. This test fails the moment the
   * two lists diverge again.
   */
  it('declares exactly the tools the executor implements', () => {
    const src = fs.readFileSync(path.join(__dirname, 'executor.ts'), 'utf8');
    // Digits belong in the class: `mt5_call` is a tool name, and omitting \d
    // silently dropped it from the comparison.
    const implemented = [...src.matchAll(/case '([a-z0-9_]+)':/g)].map((m) => m[1]).sort();
    const declared = TOOL_CATALOG.map((t) => t.name).sort();
    expect(declared).toEqual(implemented);
    // Guard the guard: if the scan ever finds nothing, the assertion above
    // would pass vacuously against an empty catalog.
    expect(implemented.length).toBeGreaterThanOrEqual(7);
  });
});

describe('renderToolPrompt', () => {
  const prompt = renderToolPrompt();

  it('names every available tool', () => {
    for (const t of availableTools()) expect(prompt).toContain(t.name);
  });

  it('includes the tools that were previously missing from the prompt', () => {
    expect(prompt).toContain('browser_task');
    expect(prompt).toContain('web_search');
  });

  it('does not advertise a tool the executor refuses', () => {
    expect(prompt).toContain('Not available: shell_exec');
    // It must appear only in the refusal line, never in the available list.
    const availableSection = prompt.split('Not available')[0];
    expect(availableSection).not.toContain('shell_exec');
  });

  it('marks irreversible tools so the model expects an approval step', () => {
    const browserLine = prompt.split('\n').findIndex((l) => l.includes('browser_task'));
    expect(
      prompt
        .split('\n')
        .slice(browserLine, browserLine + 3)
        .join(' '),
    ).toMatch(/NOT UNDOABLE/);
  });

  it('states the undo operation for tools that have one', () => {
    expect(prompt).toMatch(/undo: restore previous file content/);
  });

  it('gives a concrete argument example for every tool', () => {
    for (const t of availableTools()) expect(prompt).toContain(JSON.stringify(t.example));
  });

  it('keeps the verify gate in the prompt', () => {
    expect(prompt).toMatch(/verify_check passes/);
  });
});

describe('needsApproval — the safe default', () => {
  it('requires approval for anything explicitly irreversible', () => {
    expect(needsApproval(findTool('browser_task')!)).toBe(true);
  });

  it('requires approval when a tool declares no inverse at all', () => {
    // Forgetting to declare must cost a prompt, not an unrecoverable action.
    expect(needsApproval(findTool('mt5_call')!)).toBe(true);
  });

  it('does not require approval when a real inverse is declared', () => {
    expect(needsApproval(findTool('write_file')!)).toBe(false);
  });
});

describe('planChain', () => {
  it('resolves a reachable goal into an ordered chain', () => {
    const plan = planChain('file.written', ['workspace.root']);
    expect(plan.ok).toBe(true);
    expect(plan.steps.map((s) => s.tool.name)).toEqual(['write_file']);
    expect(plan.missing).toEqual([]);
  });

  it('reports the missing precondition instead of a shorter plan', () => {
    // No search provider configured: the chain must say so rather than
    // returning a plan that would fail on the first call.
    const plan = planChain('search.results', []);
    expect(plan.ok).toBe(false);
    expect(plan.missing).toContain('search.provider');
    expect(plan.steps[0].satisfied).toBe(false);
  });

  it('treats an already-true fact as needing no step', () => {
    const plan = planChain('mt5.bridge', ['mt5.bridge']);
    expect(plan.ok).toBe(true);
    expect(plan.steps).toEqual([]);
  });

  it('never plans through a tool the executor refuses', () => {
    const plan = planChain('shell.output', []);
    expect(plan.ok).toBe(false);
    expect(plan.steps).toEqual([]);
    expect(plan.missing).toContain('shell.output');
  });

  it('reports an unknown goal as missing rather than throwing', () => {
    const plan = planChain('does.not.exist', []);
    expect(plan.ok).toBe(false);
    expect(plan.missing).toEqual(['does.not.exist']);
  });

  it('does not list the same tool twice when two branches need it', () => {
    const plan = planChain('mt5.data', ['mt5.bridge', 'workspace.root']);
    const names = plan.steps.map((s) => s.tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('terminates on a self-referential requirement instead of hanging', () => {
    // Guard for a mis-declared catalog: resolution must degrade to
    // "unreachable", not recurse until the stack gives out.
    const plan = planChain('browser.result', []);
    expect(plan.ok).toBe(false);
    expect(plan.missing).toContain('browser.bridge');
  });
});

describe('catalog hygiene', () => {
  it('gives every tool a distinct produced fact', () => {
    const produced = TOOL_CATALOG.map((t) => t.produces);
    expect(new Set(produced).size).toBe(produced.length);
  });

  it('assigns every tool a risk class', () => {
    for (const t of TOOL_CATALOG) expect(t.risk).toBeTruthy();
  });

  it('explains why an unavailable tool is unavailable', () => {
    for (const t of TOOL_CATALOG.filter((x) => !x.available)) {
      expect(t.unavailableReason, `${t.name} braucht eine Begründung`).toBeTruthy();
    }
  });
});
