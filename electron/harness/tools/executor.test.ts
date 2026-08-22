import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { executeHarnessTool } from './executor';
import type { ToolContext } from '../types';

describe('harness tool executor', () => {
  let tmp = '';
  let ctx: ToolContext;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-tools-'));
    ctx = {
      sessionId: 't1',
      workspaceRoot: tmp,
      hitlArmed: true,
      requestApproval: async () => true,
      verify: async (id) => ({ ok: id === 'green', detail: id }),
    };
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('reads file inside workspace', async () => {
    const f = path.join(tmp, 'a.txt');
    fs.writeFileSync(f, 'hello harness', 'utf8');
    const r = await executeHarnessTool({ id: '1', name: 'read_file', arguments: { path: 'a.txt' } }, ctx, {
      allowedRoots: [tmp],
    });
    expect(r.ok).toBe(true);
    expect(r.output).toBe('hello harness');
  });

  it('rejects path outside roots (G11)', async () => {
    const outside = path.join(os.tmpdir(), 'jarvis-outside-evil.txt');
    const r = await executeHarnessTool(
      { id: '2', name: 'write_file', arguments: { path: outside, content: 'x' } },
      ctx,
      { allowedRoots: [tmp] },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Access denied/i);
  });

  it('runs verify_check through ctx', async () => {
    const r = await executeHarnessTool({ id: '3', name: 'verify_check', arguments: { id: 'green' } }, ctx, {
      allowedRoots: [tmp],
    });
    expect(r.ok).toBe(true);
  });
});
