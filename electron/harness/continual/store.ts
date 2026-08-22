import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ContinualHarnessState, HarnessMemory, HarnessSkillMeta, RefineRecord } from '../types';

const STATE_FILE = 'continual-state.json';

function emptyState(): ContinualHarnessState {
  return {
    version: 1,
    supplementalPrompts: [],
    memories: [],
    skillDescriptions: [],
    subagentSpecs: [],
    refineHistory: [],
    updatedAt: new Date().toISOString(),
  };
}

export class ContinualHarnessStore {
  private state: ContinualHarnessState;
  private readonly dir: string;

  constructor(harnessDir: string) {
    this.dir = harnessDir;
    fs.mkdirSync(this.dir, { recursive: true });
    this.state = this.load();
  }

  private statePath(): string {
    return path.join(this.dir, STATE_FILE);
  }

  private load(): ContinualHarnessState {
    try {
      const raw = fs.readFileSync(this.statePath(), 'utf8');
      return { ...emptyState(), ...JSON.parse(raw) } as ContinualHarnessState;
    } catch {
      return emptyState();
    }
  }

  private persist(): void {
    this.state.updatedAt = new Date().toISOString();
    fs.writeFileSync(this.statePath(), JSON.stringify(this.state, null, 2), 'utf8');
  }

  getState(): Readonly<ContinualHarnessState> {
    return this.state;
  }

  buildSystemSupplement(): string {
    const parts: string[] = [];
    for (const p of this.state.supplementalPrompts) parts.push(p);
    for (const m of this.state.memories.slice(-12)) {
      parts.push(`[memory:${m.id}] ${m.text}`);
    }
    for (const s of this.state.skillDescriptions.slice(-8)) {
      parts.push(`[skill:${s.name}] ${s.description} (when: ${s.trigger})`);
    }
    return parts.join('\n');
  }

  applyRefine(input: {
    summary: string;
    addMemory?: Omit<HarnessMemory, 'id' | 'createdAt' | 'useCount'>;
    addSkill?: Omit<HarnessSkillMeta, 'id' | 'createdAt'>;
    addPrompt?: string;
    snapshotId: string;
  }): RefineRecord {
    const record: RefineRecord = {
      id: `ref_${Date.now()}`,
      at: new Date().toISOString(),
      summary: input.summary,
      delta: {},
      snapshotId: input.snapshotId,
    };

    if (input.addPrompt?.trim()) {
      this.state.supplementalPrompts.push(input.addPrompt.trim());
      record.delta.supplementalPrompts = [input.addPrompt.trim()];
    }

    if (input.addMemory) {
      const mem: HarnessMemory = {
        id: `mem_${Date.now()}`,
        createdAt: new Date().toISOString(),
        useCount: 0,
        ...input.addMemory,
      };
      this.state.memories.push(mem);
      record.delta.memories = [mem];
    }

    if (input.addSkill) {
      const skill: HarnessSkillMeta = {
        id: `sk_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...input.addSkill,
      };
      this.state.skillDescriptions.push(skill);
      record.delta.skillDescriptions = [skill];
    }

    this.state.refineHistory.push(record);
    if (this.state.refineHistory.length > 100) {
      this.state.refineHistory = this.state.refineHistory.slice(-100);
    }

    this.persist();
    return record;
  }

  bumpMemoryUse(id: string): void {
    const m = this.state.memories.find((x) => x.id === id);
    if (m) {
      m.useCount += 1;
      this.persist();
    }
  }
}
