import * as fs from 'node:fs';
import * as path from 'node:path';
import { isPathInRoots } from '../../security/paths';
import type { ToolCall, ToolContext, ToolResult } from '../types';

export interface ToolExecutorDeps {
  allowedRoots: string[];
  mt5Call?: (
    endpoint: string,
    method?: 'GET' | 'POST',
    body?: unknown,
  ) => Promise<{ ok: boolean; data?: unknown; err?: string }>;
  runVerify?: (checkId: string) => Promise<{ ok: boolean; detail: string }>;
}

function resolveAllowed(targetPath: string, workspaceRoot: string, allowedRoots: string[]): string | null {
  const candidates = [path.resolve(workspaceRoot, targetPath), path.resolve(targetPath)];
  for (const c of candidates) {
    if (isPathInRoots(c, allowedRoots)) return c;
  }
  return null;
}

export async function executeHarnessTool(
  call: ToolCall,
  ctx: ToolContext,
  deps: ToolExecutorDeps,
): Promise<ToolResult> {
  const fail = (err: string): ToolResult => ({
    toolCallId: call.id,
    ok: false,
    output: '',
    error: err,
  });

  switch (call.name) {
    case 'read_file': {
      const rel = String(call.arguments.path ?? '');
      const resolved = resolveAllowed(rel, ctx.workspaceRoot, deps.allowedRoots);
      if (!resolved) return fail('Access denied: path outside allowed directories');
      if (!fs.existsSync(resolved)) return fail('File not found');
      const content = fs.readFileSync(resolved, 'utf8');
      return { toolCallId: call.id, ok: true, output: content.slice(0, 100_000) };
    }

    case 'write_file': {
      const rel = String(call.arguments.path ?? '');
      const content = String(call.arguments.content ?? '');
      const resolved = resolveAllowed(rel, ctx.workspaceRoot, deps.allowedRoots);
      if (!resolved) return fail('Access denied: path outside allowed directories');
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, content, 'utf8');
      return { toolCallId: call.id, ok: true, output: `Wrote ${resolved}` };
    }

    case 'verify_check': {
      const checkId = String(call.arguments.id ?? 'default');
      const verifier = deps.runVerify ?? ctx.verify.bind(ctx);
      const v = await verifier(checkId);
      return {
        toolCallId: call.id,
        ok: v.ok,
        output: v.detail,
        error: v.ok ? undefined : v.detail,
      };
    }

    case 'mt5_call': {
      if (!deps.mt5Call) return fail('MT5 bridge not configured');
      const endpoint = String(call.arguments.endpoint ?? 'status');
      const method = (call.arguments.method as 'GET' | 'POST' | undefined) ?? 'GET';
      const body = call.arguments.body;
      const r = await deps.mt5Call(endpoint, method, body);
      if (!r.ok) return fail(r.err ?? 'MT5 call failed');
      return { toolCallId: call.id, ok: true, output: JSON.stringify(r.data ?? {}) };
    }

    case 'shell_exec':
      return fail('shell_exec disabled in harness — use Advanced Mode console separately');

    case 'browser_task': {
      // Catalog advertises the tool; wiring lands via browser bridge deps.
      // Until configured, refuse honestly so the agent does not invent success.
      return fail('browser_task not configured — browser bridge unavailable');
    }

    case 'web_search': {
      return fail('web_search not configured — search provider unavailable');
    }

    default:
      return fail(`Unknown tool: ${call.name}`);
  }
}
