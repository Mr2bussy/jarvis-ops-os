// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordEmployeeResult,
  recordVoiceLatency,
  getErrorBudgetSnapshot,
  resetErrorBudgetCounters,
} from './error-budget';

describe('error-budget', () => {
  beforeEach(() => resetErrorBudgetCounters());

  it('computes success rate and remaining budget', () => {
    for (let i = 0; i < 99; i++) recordEmployeeResult(true);
    recordEmployeeResult(false);
    const snap = getErrorBudgetSnapshot();
    expect(snap.requests).toBe(100);
    expect(snap.failures).toBe(1);
    expect(snap.successRate).toBe(0.99);
    expect(snap.budgetRemainingPct).toBeGreaterThanOrEqual(0);
  });

  it('tracks voice latency averages and p95 SLO', () => {
    recordVoiceLatency(1200, 180);
    recordVoiceLatency(800, 100);
    const snap = getErrorBudgetSnapshot();
    expect(snap.voice.samples).toBe(2);
    expect(snap.voice.avgTotalMs).toBe(1000);
    expect(snap.voice.avgTtfbMs).toBe(140);
    expect(snap.voiceSloBreached).toBe(false);
  });

  it('marks voice SLO breached when p95 > 3000', () => {
    recordVoiceLatency(4000);
    recordVoiceLatency(4100);
    recordVoiceLatency(4200);
    const snap = getErrorBudgetSnapshot();
    expect(snap.p95VoiceE2eMs).toBeGreaterThan(3000);
    expect(snap.voiceSloBreached).toBe(true);
    expect(snap.failUi).toBe(true);
  });

  it('flags voice SLO breach when p95 exceeds 3000ms', () => {
    for (let i = 0; i < 20; i++) recordVoiceLatency(500);
    recordVoiceLatency(5000);
    recordVoiceLatency(5100);
    const snap = getErrorBudgetSnapshot();
    expect(snap.voiceSloMs).toBe(3000);
    expect(snap.p95VoiceE2eMs).toBeGreaterThan(3000);
    expect(snap.voiceSloBreached).toBe(true);
  });
});
