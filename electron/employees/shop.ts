// @ts-nocheck
import type { EmployeeResult, ShopAction } from './types';

export function draftShopRefund(input: {
  orderId: string;
  amount: number;
  reason: string;
}): EmployeeResult<{ action: ShopAction }> {
  if (!input.orderId.trim()) return { ok: false, reason: 'orderId fehlt' };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: 'Ungültiger Erstattungsbetrag' };
  }
  return {
    ok: true,
    action: {
      kind: 'draft_refund',
      platform: 'shopify',
      summary: `Erstattung ${input.amount.toFixed(2)} für Order ${input.orderId}`,
      payload: { orderId: input.orderId, amount: input.amount, reason: input.reason },
      requiresHitl: true,
    },
  };
}

export function draftSocialPost(input: {
  productName: string;
  hook: string;
  channel: 'instagram' | 'x' | 'tiktok';
}): EmployeeResult<{ action: ShopAction }> {
  if (!input.productName.trim()) return { ok: false, reason: 'Produktname fehlt' };
  return {
    ok: true,
    action: {
      kind: 'draft_social',
      platform: 'composio',
      summary: `${input.channel}-Entwurf für ${input.productName}`,
      payload: {
        channel: input.channel,
        productName: input.productName,
        hook: input.hook,
        caption: `${input.hook}\n\n${input.productName} — Link in Bio.`,
      },
      requiresHitl: true,
    },
  };
}

export function listProductsShell(composioConfigured: boolean): EmployeeResult<{ action: ShopAction }> {
  if (!composioConfigured) {
    return { ok: false, reason: 'Composio nicht konfiguriert — API-Key in Setup hinterlegen' };
  }
  return {
    ok: true,
    action: {
      kind: 'list_products',
      platform: 'composio',
      summary: 'Shopify-Produktliste abrufen (Composio)',
      payload: { tool: 'SHOPIFY_LIST_PRODUCTS' },
      requiresHitl: true,
    },
  };
}
