import type { ContinualHarnessStore } from './store';
import { snapshotState } from './snapshots';

export interface RefineInput {
  sessionSummary: string;
  evidence: string;
  lesson: string;
  skillName?: string;
  skillTrigger?: string;
}

export interface RefineOutput {
  ok: boolean;
  snapshotId: string;
  recordId?: string;
  err?: string;
}

/**
 * Prime-style /refine — evidence-backed supplemental harness updates only.
 * Never touches immutable AGENTS.md / Karpathy base rules.
 */
export function runRefine(
  store: ContinualHarnessStore,
  snapshotsDir: string,
  input: RefineInput,
): RefineOutput {
  if (!input.evidence.trim() || !input.lesson.trim()) {
    return { ok: false, snapshotId: '', err: 'refine requires evidence and lesson' };
  }

  const snapId = snapshotState(
    snapshotsDir,
    JSON.parse(JSON.stringify(store.getState())) as import('../types').ContinualHarnessState,
    'pre-refine',
  );

  const record = store.applyRefine({
    summary: input.sessionSummary.slice(0, 2000),
    snapshotId: snapId,
    addMemory: {
      text: input.lesson.slice(0, 4000),
      tags: ['refine', 'auto'],
      evidence: input.evidence.slice(0, 4000),
    },
    addSkill: input.skillName
      ? {
          name: input.skillName.slice(0, 128),
          description: input.lesson.slice(0, 2000),
          trigger: (input.skillTrigger ?? 'similar task').slice(0, 512),
          evidence: input.evidence.slice(0, 2000),
        }
      : undefined,
  });

  return { ok: true, snapshotId: snapId, recordId: record.id };
}
