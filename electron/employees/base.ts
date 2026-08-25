// @ts-nocheck
import { emitEmployeeEvent } from '../event-bus';
import type { Employee, EmployeeHealth, EmployeeResult, EmployeeState, EmployeeTask } from './types';

/** Validates task result before marking done — anti-early-victory for employees. */
export function validateEmployeeResult(
  result: EmployeeResult<Record<string, unknown>>,
  requiredKeys: string[] = [],
): boolean {
  if (!result.ok) return false;
  for (const k of requiredKeys) {
    if (!(k in result) && !(k in (result as Record<string, unknown>))) return false;
  }
  return true;
}

export abstract class BaseEmployee implements Employee {
  abstract readonly id: string;
  abstract readonly label: string;

  protected state: EmployeeState = 'idle';
  protected lastRunAt?: string;
  protected lastError?: string;
  protected tasksProcessed = 0;

  schedule(): string | null {
    return null;
  }

  abstract runTask(task: EmployeeTask): Promise<EmployeeResult<Record<string, unknown>>>;

  async execute(task: EmployeeTask): Promise<EmployeeResult<Record<string, unknown>>> {
    if (this.state === 'paused') {
      return { ok: false, reason: `${this.label} ist pausiert (Kill-Switch)` };
    }
    this.transition('working');
    emitEmployeeEvent({ employeeId: this.id, kind: 'task-start', taskId: task.id, state: this.state });
    try {
      const result = await this.runTask(task);
      if (result.ok) {
        this.tasksProcessed++;
        this.transition('done');
        emitEmployeeEvent({ employeeId: this.id, kind: 'task-done', taskId: task.id, state: this.state });
        this.transition('idle');
      } else {
        this.lastError = result.reason;
        this.transition('failed');
        emitEmployeeEvent({
          employeeId: this.id,
          kind: 'task-failed',
          taskId: task.id,
          state: this.state,
          detail: result.reason,
        });
        this.transition('idle');
      }
      this.lastRunAt = new Date().toISOString();
      return result;
    } catch (err: unknown) {
      const reason = String((err as Error)?.message ?? err);
      this.lastError = reason;
      this.transition('failed');
      emitEmployeeEvent({
        employeeId: this.id,
        kind: 'task-failed',
        taskId: task.id,
        state: this.state,
        detail: reason,
      });
      this.transition('idle');
      return { ok: false, reason };
    }
  }

  healthCheck(): EmployeeHealth {
    return {
      state: this.state,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
      tasksProcessed: this.tasksProcessed,
    };
  }

  setState(next: EmployeeState): void {
    this.transition(next);
  }

  pause(): void {
    this.transition('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.transition('idle');
  }

  protected transition(next: EmployeeState): void {
    this.state = next;
    emitEmployeeEvent({ employeeId: this.id, kind: 'state-change', state: next });
  }
}
