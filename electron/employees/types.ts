/** Employee contract + shared types for JARVIS Ops employees. */
// @ts-nocheck

export type EmployeeResult<T> = ({ ok: true } & T) | { ok: false; reason: string };

export type EmployeeState = 'idle' | 'watching' | 'working' | 'awaiting_gate' | 'done' | 'failed' | 'paused';

export interface EmployeeTask {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface EmployeeHealth {
  state: EmployeeState;
  lastRunAt?: string;
  lastError?: string;
  tasksProcessed: number;
}

export interface Employee {
  readonly id: string;
  readonly label: string;
  /** Cron expression or null when event-driven only. */
  schedule(): string | null;
  execute(task: EmployeeTask): Promise<EmployeeResult<Record<string, unknown>>>;
  healthCheck(): EmployeeHealth;
}

export type EmailCategory = 'invoice' | 'support' | 'newsletter' | 'personal' | 'urgent' | 'other';

export interface ClassifiedEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  category: EmailCategory;
  confidence: number;
  receivedAt: string;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  replyToId?: string;
  requiresHitl: true;
}

export interface InvoiceExtract {
  vendor: string;
  amount: number;
  currency: string;
  invoiceDate: string;
  dueDate?: string;
  iban?: string;
  vatId?: string;
  rawText: string;
  plausibility: 'ok' | 'review' | 'reject';
  notes: string[];
}

export interface CalendarProposal {
  title: string;
  start: string;
  end: string;
  attendees: string[];
  conflicts: string[];
  requiresHitl: true;
}

export interface ShopAction {
  kind: 'list_products' | 'draft_refund' | 'draft_social';
  platform: 'shopify' | 'composio';
  summary: string;
  payload: Record<string, unknown>;
  requiresHitl: true;
}

export interface EmployeeActionLog {
  at: string;
  employeeId: string;
  action: string;
  detail: string;
  state: EmployeeState;
}
