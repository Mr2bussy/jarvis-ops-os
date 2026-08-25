// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { MODEL_PROFILES, selectModel } from './model-profiles';

describe('model profiles — data honesty', () => {
  it('never prices a model without stamping when the price was taken', () => {
    for (const p of MODEL_PROFILES) {
      const priced = p.inputCostPerMTok !== null && p.outputCostPerMTok !== null;
      // Local models are zero-cost by fact, not by list price, so they carry no pricedAt.
      const isLocal = p.tier === 'local';
      if (priced && !isLocal) expect(p.pricedAt, `${p.id} is priced but undated`).toBeTruthy();
      if (!priced) expect(p.pricedAt, `${p.id} is unpriced but dated`).toBeNull();
    }
  });

  it('never half-prices a model (both rates known, or neither)', () => {
    for (const p of MODEL_PROFILES) {
      expect(
        (p.inputCostPerMTok === null) === (p.outputCostPerMTok === null),
        `${p.id} has one known and one unknown rate`,
      ).toBe(true);
    }
  });

  it('reports latency as unknown rather than guessing (nothing measured yet)', () => {
    for (const p of MODEL_PROFILES) {
      expect(p.typicalLatencyMs, `${p.id} claims an unmeasured latency`).toBeNull();
    }
  });

  it('every local model is genuinely zero-cost', () => {
    for (const p of MODEL_PROFILES.filter((m) => m.tier === 'local')) {
      expect(p.inputCostPerMTok).toBe(0);
      expect(p.outputCostPerMTok).toBe(0);
    }
  });
});

describe('selectModel — cheapest adequate wins', () => {
  it('does not spend a frontier model on a classification', () => {
    const picked = selectModel('classify');
    expect(picked.ok).toBe(true);
    expect(picked.profile?.tier).not.toBe('frontier');
    expect(picked.profile?.strengths).toContain('classify');
  });

  it('picks the cheapest model that clears a capability floor, not the strongest', () => {
    const picked = selectModel('reason', { minTier: 'balanced' });
    expect(picked.ok).toBe(true);
    // claude-sonnet-5 (3/15) beats claude-opus-5 (5/25); both can reason.
    expect(picked.profile?.id).toBe('claude-sonnet-5');
    expect(picked.reason).toContain('cheapest');
  });

  it('never prefers an unpriced model over a priced one', () => {
    const picked = selectModel('reason', { minTier: 'balanced' });
    expect(picked.profile?.inputCostPerMTok).not.toBeNull();
    // deepseek-chat is 'balanced' and can reason, but its cost is unverified.
    expect(picked.profile?.id).not.toBe('deepseek-chat');
  });

  it('explains the pick in the reason string', () => {
    const picked = selectModel('code');
    expect(picked.ok).toBe(true);
    expect(picked.reason).toContain(picked.profile?.id ?? 'MISSING');
    expect(picked.reason).toContain('code');
  });
});

describe('selectModel — constraints', () => {
  it('requireLocal only returns zero-cost models', () => {
    for (const task of ['classify', 'extract', 'summarize', 'code', 'reason', 'converse'] as const) {
      const picked = selectModel(task, { requireLocal: true });
      expect(picked.ok, `no local model for ${task}`).toBe(true);
      expect(picked.profile?.inputCostPerMTok).toBe(0);
      expect(picked.profile?.outputCostPerMTok).toBe(0);
      expect(picked.profile?.tier).toBe('local');
    }
  });

  it('a cost limit excludes the pricier models and says so', () => {
    const picked = selectModel('reason', { minTier: 'balanced', maxCostPerMTok: 20 });
    expect(picked.ok).toBe(true);
    expect(picked.profile?.id).toBe('claude-sonnet-5');
    // claude-opus-5 outputs at 25/MTok, over the 20 limit.
    const opus = picked.rejected.find((r) => r.id === 'claude-opus-5');
    expect(opus?.why).toContain('over the 20 limit');
  });

  it('treats unknown cost as unknown, not as cheap, once a limit is set', () => {
    const picked = selectModel('reason', { maxCostPerMTok: 20 });
    expect(picked.ok).toBe(true);
    const unpriced = picked.rejected.find((r) => r.id === 'deepseek-chat');
    expect(unpriced?.why).toContain('cost unknown');
    // The winner must be a model whose price we can actually verify.
    expect(picked.profile?.inputCostPerMTok).not.toBeNull();
  });

  it('treats unmeasured latency as unknown, not as fast', () => {
    const picked = selectModel('classify', { maxLatencyMs: 5000 });
    expect(picked.ok).toBe(false);
    expect(
      picked.rejected.every((r) => r.why.includes('latency unmeasured') || r.why.includes('not listed')),
    ).toBe(true);
  });

  it('minTier rejects models below the capability floor', () => {
    const picked = selectModel('summarize', { minTier: 'balanced' });
    expect(picked.ok).toBe(true);
    expect(picked.profile?.id).toBe('claude-sonnet-5');
    const haiku = picked.rejected.find((r) => r.id === 'claude-haiku-4-5');
    expect(haiku?.why).toContain("below minTier 'balanced'");
  });

  it('refuses to promote a classification to a balanced/frontier tier', () => {
    // No expensive model lists 'classify' as a strength — that is deliberate, not an
    // oversight. Demanding a balanced-tier classifier is therefore an explicit refusal.
    const picked = selectModel('classify', { minTier: 'balanced' });
    expect(picked.ok).toBe(false);
    expect(picked.reason).toContain('no model satisfies');
  });
});

describe('selectModel — explicit refusal', () => {
  it('refuses with a reason instead of silently defaulting', () => {
    const picked = selectModel('reason', { minTier: 'frontier', maxCostPerMTok: 1 });
    expect(picked.ok).toBe(false);
    expect(picked.profile).toBeNull();
    expect(picked.reason).toContain('no model satisfies');
    expect(picked.reason).toContain('refusing to fall back silently');
    expect(picked.rejected.length).toBe(MODEL_PROFILES.length);
  });

  it('names the frontier model it had to reject and why', () => {
    const picked = selectModel('reason', { minTier: 'frontier', maxCostPerMTok: 1 });
    const opus = picked.rejected.find((r) => r.id === 'claude-opus-5');
    expect(opus?.why).toContain('over the 1 limit');
  });

  it('refuses when local-only is asked for a task no local model covers', () => {
    // requireLocal + a frontier floor is unsatisfiable by construction.
    const picked = selectModel('code', { requireLocal: true, minTier: 'frontier' });
    expect(picked.ok).toBe(false);
    expect(picked.profile).toBeNull();
    expect(picked.reason).toContain('requireLocal');
  });
});
