import { describe, expect, it } from 'vitest';
import { planSwarm } from './router';

describe('swarm router', () => {
  it('defaults to solo for simple fix', () => {
    expect(planSwarm('fix the typo in readme').mode).toBe('solo');
  });

  it('parallel when explicitly requested', () => {
    expect(planSwarm('run these in parallel: lint and test').mode).toBe('parallel');
    expect(planSwarm('run these in parallel: lint and test').subagents.length).toBe(3);
  });

  it('sequential for pipeline language', () => {
    expect(planSwarm('first audit then refactor the module').mode).toBe('sequential');
  });
});
