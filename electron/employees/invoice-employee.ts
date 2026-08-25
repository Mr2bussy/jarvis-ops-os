// @ts-nocheck
import { getFeatureFlag } from '../config/flags';
import { BaseEmployee, validateEmployeeResult } from './base';
import { extractInvoiceFromText, previewBooking } from './invoice';
import type { EmployeeResult, EmployeeTask, InvoiceExtract } from './types';

export class InvoiceEmployee extends BaseEmployee {
  readonly id = 'invoice';
  readonly label = 'Rechnungs Agent';

  schedule(): string | null {
    return getFeatureFlag('invoice.enabled') ? '0 */2 * * *' : null;
  }

  async runTask(task: EmployeeTask): Promise<EmployeeResult<Record<string, unknown>>> {
    switch (task.kind) {
      case 'extract': {
        const text = String(task.payload.text ?? '');
        const r = extractInvoiceFromText(text);
        if (!validateEmployeeResult(r, ['invoice'])) return { ok: false, reason: 'Extraktion unvollständig' };
        return { ok: true, invoice: r.ok ? r.invoice : undefined };
      }
      case 'preview-booking': {
        const invoice = task.payload.invoice as InvoiceExtract;
        const r = previewBooking(invoice);
        if (!validateEmployeeResult(r, ['preview']))
          return { ok: false, reason: 'Buchungsvorschau unvollständig' };
        return { ok: true, preview: r.ok ? r.preview : undefined };
      }
      default:
        return { ok: false, reason: `Unbekannte Rechnungs-Aufgabe: ${task.kind}` };
    }
  }
}
