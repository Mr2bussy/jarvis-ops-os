// @ts-nocheck
export type JarvisEventSource =
  | 'voice'
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'cron'
  | 'bridge'
  | 'harness'
  | 'employee';

export type JarvisEventKind =
  | 'inbound'
  | 'outbound'
  | 'session-start'
  | 'session-end'
  | 'error'
  | 'employee-state'
  | 'employee-task';

export interface JarvisEvent {
  at: string;
  source: JarvisEventSource;
  kind: JarvisEventKind;
  sessionId?: string;
  preview: string;
  employeeId?: string;
  taskId?: string;
  state?: string;
}

export type EmployeeEventKind = 'state-change' | 'task-start' | 'task-done' | 'task-failed';

export interface EmployeeEvent {
  employeeId: string;
  kind: EmployeeEventKind;
  taskId?: string;
  state?: string;
  detail?: string;
  at: string;
}

const handlers = new Set<(evt: JarvisEvent) => void>();
const employeeHandlers = new Set<(evt: EmployeeEvent) => void>();

export function emitJarvisEvent(evt: Omit<JarvisEvent, 'at'> & { at?: string }): void {
  const full: JarvisEvent = { at: evt.at ?? new Date().toISOString(), ...evt };
  for (const h of handlers) h(full);
}

export function emitEmployeeEvent(evt: Omit<EmployeeEvent, 'at'>): void {
  const full: EmployeeEvent = { at: new Date().toISOString(), ...evt };
  for (const h of employeeHandlers) h(full);
  emitJarvisEvent({
    source: 'employee',
    kind: 'employee-task',
    preview: `${evt.employeeId}:${evt.kind}${evt.detail ? ` — ${evt.detail.slice(0, 80)}` : ''}`,
    employeeId: evt.employeeId,
    taskId: evt.taskId,
    state: evt.state,
  });
}

export function subscribeJarvisEvents(handler: (evt: JarvisEvent) => void): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function subscribeEmployeeEvents(handler: (evt: EmployeeEvent) => void): () => void {
  employeeHandlers.add(handler);
  return () => employeeHandlers.delete(handler);
}

export function clearJarvisEventHandlers(): void {
  handlers.clear();
  employeeHandlers.clear();
}
