/**
 * Cron job registry with nextRun persist + catch-up on start.
 */
// @ts-nocheck

import * as cron from 'node-cron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SchedulerJobMeta {
  id: string;
  expression: string;
  name: string;
  kind: 'workflow' | 'employee' | 'digest';
  payload: Record<string, unknown>;
  createdAt: number;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
}

export interface SchedulerJobHandler {
  (meta: SchedulerJobMeta): Promise<void>;
}

interface RegisteredJob {
  task: cron.ScheduledTask;
  meta: SchedulerJobMeta;
}

export class HarnessScheduler {
  private readonly jobs = new Map<string, RegisteredJob>();
  private readonly handlers = new Map<string, SchedulerJobHandler>();

  constructor(private readonly persistPath: string) {}

  registerHandler(kind: string, handler: SchedulerJobHandler): void {
    this.handlers.set(kind, handler);
  }

  add(meta: SchedulerJobMeta): void {
    if (!cron.validate(meta.expression)) {
      throw new Error(`Ungültiger Cron-Ausdruck: ${meta.expression}`);
    }
    this.remove(meta.id);
    const task = cron.schedule(meta.expression, () => void this.runJob(meta.id), { timezone: 'UTC' });
    this.jobs.set(meta.id, { task, meta: { ...meta, runCount: meta.runCount ?? 0 } });
    this.persist();
  }

  remove(id: string): void {
    const existing = this.jobs.get(id);
    if (existing) {
      existing.task.stop();
      this.jobs.delete(id);
      this.persist();
    }
  }

  list(): SchedulerJobMeta[] {
    return Array.from(this.jobs.values()).map(({ meta }) => meta);
  }

  async runJob(id: string): Promise<void> {
    const reg = this.jobs.get(id);
    if (!reg) return;
    reg.meta.lastRun = Date.now();
    reg.meta.runCount++;
    reg.meta.nextRun = estimateNextRun(reg.meta.expression);
    this.persist();
    const handler = this.handlers.get(reg.meta.kind);
    if (handler) await handler(reg.meta);
  }

  /** Catch-up: run jobs whose nextRun is in the past (within 1h window). */
  async catchUpOnStart(): Promise<number> {
    let ran = 0;
    const now = Date.now();
    for (const { meta } of this.jobs.values()) {
      if (meta.nextRun && meta.nextRun < now && now - meta.nextRun < 3_600_000) {
        await this.runJob(meta.id);
        ran++;
      }
    }
    return ran;
  }

  load(): void {
    let metas: unknown;
    try {
      metas = JSON.parse(fs.readFileSync(this.persistPath, 'utf8'));
    } catch {
      return;
    }
    if (!Array.isArray(metas)) return;
    for (const m of metas as SchedulerJobMeta[]) {
      if (m?.expression && cron.validate(m.expression)) {
        this.add({ ...m, runCount: m.runCount ?? 0 });
      }
    }
  }

  persist(): void {
    try {
      const metas = this.list();
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify(metas, null, 2), 'utf8');
    } catch {
      /* best-effort */
    }
  }

  stopAll(): void {
    for (const { task } of this.jobs.values()) task.stop();
    this.jobs.clear();
  }
}

function estimateNextRun(expression: string): number | undefined {
  try {
    const parts = expression.split(/\s+/);
    if (parts.length < 5) return undefined;
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.getTime();
  } catch {
    return undefined;
  }
}
