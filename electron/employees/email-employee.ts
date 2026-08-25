// @ts-nocheck
import { getFeatureFlag } from '../config/flags';
import { BaseEmployee, validateEmployeeResult } from './base';
import { classifyEmail, draftReply, imapStatus } from './email';
import { fetchAndClassifyInbox } from './imap-sync';
import { getImapIdleStatus, startImapIdle, stopImapIdle } from './imap-idle';
import { saveDraft, listDrafts, trashDraft, restoreDraft } from '../harness/undo-first';
import { formatFewShotBlock } from '../harness/few-shot-corrections';
import { renderPrompt } from '../prompts/loader';
import type { EmployeeResult, EmployeeTask } from './types';

export class EmailEmployee extends BaseEmployee {
  readonly id = 'email';
  readonly label = 'E-Mail Agent';

  schedule(): string | null {
    return getFeatureFlag('email.enabled') ? '*/5 * * * *' : null;
  }

  async runTask(task: EmployeeTask): Promise<EmployeeResult<Record<string, unknown>>> {
    switch (task.kind) {
      case 'classify': {
        const r = classifyEmail({
          from: String(task.payload.from ?? ''),
          subject: String(task.payload.subject ?? ''),
          body: String(task.payload.body ?? ''),
          id: task.idempotencyKey,
        });
        if (!r.ok) return r;
        if (!validateEmployeeResult(r, ['email']))
          return { ok: false, reason: 'Klassifikation unvollständig' };
        return { ok: true, email: r.email };
      }
      case 'draft-reply': {
        const original = task.payload.original as Parameters<typeof draftReply>[0]['original'];
        const r = draftReply({ original, operatorHint: String(task.payload.operatorHint ?? '') });
        if (!r.ok) return r;
        if (!validateEmployeeResult(r, ['draft'])) return { ok: false, reason: 'Entwurf unvollständig' };
        const fewShot = formatFewShotBlock(3);
        const promptHint = renderPrompt('email-draft', {
          hint: String(task.payload.operatorHint ?? ''),
          from: original.from,
          subject: original.subject,
          snippet: original.snippet ?? '',
        });
        const stored = saveDraft('email-reply', {
          draft: r.draft,
          fewShot,
          promptHint: promptHint ?? undefined,
        });
        return { ok: true, draft: r.draft, undoDraftId: stored.id, status: 'draft' };
      }
      case 'list-drafts': {
        return { ok: true, drafts: listDrafts().filter((d) => d.kind === 'email-reply') };
      }
      case 'trash-draft': {
        const id = String(task.payload.id ?? '');
        const trashed = trashDraft(id);
        if (!trashed) return { ok: false, reason: 'Draft nicht gefunden' };
        return { ok: true, draft: trashed };
      }
      case 'restore-draft': {
        const id = String(task.payload.id ?? '');
        const restored = restoreDraft(id);
        if (!restored) return { ok: false, reason: 'Trash-Eintrag nicht gefunden' };
        return { ok: true, draft: restored };
      }
      case 'imap-status': {
        const creds = task.payload as { host?: string; user?: string; password?: string };
        const r = imapStatus(creds);
        const idle = getImapIdleStatus();
        if (r.ok) return { ok: true, configured: r.configured, host: r.host, idle };
        return { ok: false, reason: `${r.reason} · idle=${idle.state}` };
      }
      case 'imap-idle-start': {
        const creds = task.payload as {
          host?: string;
          user?: string;
          password?: string;
          port?: number;
        };
        const idle = await startImapIdle(creds);
        if (idle.state === 'error') return { ok: false, reason: idle.detail };
        return { ok: true, idle };
      }
      case 'imap-idle-stop': {
        const idle = await stopImapIdle();
        return { ok: true, idle };
      }
      case 'fetch-inbox': {
        const creds = task.payload as {
          host?: string;
          user?: string;
          password?: string;
          port?: number;
        };
        const limit = Number(task.payload.limit ?? 10);
        const r = await fetchAndClassifyInbox(creds, limit);
        if (!r.ok) return r;
        return { ok: true, messages: r.messages, detail: r.detail, imapflow: r.imapflow };
      }
      default:
        return { ok: false, reason: `Unbekannte E-Mail-Aufgabe: ${task.kind}` };
    }
  }
}
