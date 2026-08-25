// @ts-nocheck
import { getFeatureFlag } from '../config/flags';
import { BaseEmployee, validateEmployeeResult } from './base';
import { draftShopRefund, draftSocialPost, listProductsShell } from './shop';
import type { EmployeeResult, EmployeeTask } from './types';

export class ShopEmployee extends BaseEmployee {
  readonly id = 'shop';
  readonly label = 'Shop Agent';

  schedule(): string | null {
    return getFeatureFlag('shop.enabled') ? '0 9 * * 1-5' : null;
  }

  async runTask(task: EmployeeTask): Promise<EmployeeResult<Record<string, unknown>>> {
    if (!getFeatureFlag('invoice.liveMode') && task.kind === 'refund') {
      return { ok: false, reason: 'Live-Modus deaktiviert — invoice.liveMode in flags.json aktivieren' };
    }
    switch (task.kind) {
      case 'refund': {
        const r = draftShopRefund({
          orderId: String(task.payload.orderId ?? ''),
          amount: Number(task.payload.amount),
          reason: String(task.payload.reason ?? ''),
        });
        if (!validateEmployeeResult(r, ['action']))
          return { ok: false, reason: 'Erstattungsentwurf unvollständig' };
        return { ok: true, action: r.ok ? r.action : undefined };
      }
      case 'social': {
        const r = draftSocialPost({
          productName: String(task.payload.productName ?? ''),
          hook: String(task.payload.hook ?? ''),
          channel: task.payload.channel as 'instagram' | 'x' | 'tiktok',
        });
        if (!validateEmployeeResult(r, ['action']))
          return { ok: false, reason: 'Social-Entwurf unvollständig' };
        return { ok: true, action: r.ok ? r.action : undefined };
      }
      case 'list-products': {
        const r = listProductsShell(Boolean(task.payload.composioConfigured));
        if (!validateEmployeeResult(r, ['action']))
          return { ok: false, reason: 'Produktliste unvollständig' };
        return { ok: true, action: r.ok ? r.action : undefined };
      }
      default:
        return { ok: false, reason: `Unbekannte Shop-Aufgabe: ${task.kind}` };
    }
  }
}
