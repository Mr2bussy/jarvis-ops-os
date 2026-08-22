import { describe, expect, it } from 'vitest';
import { buildWeeklyReport, evaluateShipGates } from './weekly-report';

describe('weekly harness report', () => {
  it('evaluates MVP gate when scores high and safety clean', () => {
    const cases = [
      { id: 'G11', success: true, caseScore: 100, safety: 100 } as any,
      { id: 'G08', success: true, caseScore: 100, safety: 100 } as any,
      { id: 'G14', success: true, caseScore: 100, safety: 100 } as any,
    ];
    const gates = evaluateShipGates(90, 88, cases);
    expect(gates.mvp).toBe(true);
  });

  it('builds markdown report', () => {
    const md = buildWeeklyReport({
      weekOf: '2026-08-22',
      current: {
        harness: 'jarvis-prime',
        harnessScore: 100,
        criticScore: 88,
        cases: [
          {
            id: 'G07',
            success: true,
            turns: 1,
            tokensIn: 0,
            tokensOut: 0,
            wallMs: 0,
            surgical: 100,
            safety: 100,
            recovery: 100,
            caseScore: 100,
          },
        ],
        manifest: {},
      },
      criticScore: 88,
      gates: { mvp: true, full: true, topsAll: false },
    });
    expect(md).toContain('Weekly Harness Report');
    expect(md).toContain('Hermes Router');
  });
});
