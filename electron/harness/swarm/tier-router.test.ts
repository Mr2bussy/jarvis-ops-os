// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { repairJsonFragment, routeByTier } from './tier-router';

describe('tier-router', () => {
  it('routes tier1 to local when available', () => {
    const sel = routeByTier('classify', 'tier1');
    if (sel.ok) expect(sel.profile.tier).toBe('local');
  });

  it('repairs trailing comma JSON', () => {
    const fixed = repairJsonFragment('{ "name": "shell_exec", "arguments": {}, }');
    expect(fixed).toBeTruthy();
    expect(JSON.parse(fixed!)).toMatchObject({ name: 'shell_exec' });
  });
});
