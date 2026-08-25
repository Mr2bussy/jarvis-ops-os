/**
 * Composio tool slug defaults for Shopify commerce sync.
 * Operators override via safeStorage keys or Admin → E-Commerce slug fields.
 */
// @ts-nocheck

export const COMMERCE_CONFIG_KEYS = {
  productsSlug: 'SHOPIFY_PRODUCTS_TOOL_SLUG',
  ordersSlug: 'SHOPIFY_ORDERS_TOOL_SLUG',
  healthSlug: 'SHOPIFY_HEALTH_TOOL_SLUG',
} as const;

/** Documented Composio slugs — verify in Composio dashboard for your toolkit version. */
export const DEFAULT_SHOPIFY_SLUGS = {
  products: 'SHOPIFY_GET_PRODUCTS',
  orders: 'SHOPIFY_GET_ORDERS',
  health: 'SHOPIFY_GET_SHOP',
} as const;

export interface CommerceProduct {
  sku: string;
  name: string;
  price: number;
  stock: number;
  channel: string;
}

export interface CommerceOrder {
  id: string;
  customer: string;
  total: number;
  status: 'pending' | 'paid' | 'fulfilled' | 'refunded';
  channel: string;
}

function asArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const k of ['products', 'orders', 'items', 'data', 'result']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object' && Array.isArray((v as { items?: unknown[] }).items)) {
        return (v as { items: unknown[] }).items;
      }
    }
  }
  return [];
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v);
}

/** Best-effort normalise Composio Shopify product payloads. */
export function parseProductsFromComposioResult(raw: unknown): CommerceProduct[] {
  const rows = asArray(raw);
  const out: CommerceProduct[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const variants = Array.isArray(r.variants) ? r.variants : [];
    const v0 = (variants[0] ?? {}) as Record<string, unknown>;
    const sku = str(v0.sku ?? r.sku ?? r.id, 'SKU-?');
    const name = str(r.title ?? r.name ?? sku, sku);
    const price = num(v0.price ?? r.price ?? r.total_price);
    const stock = num(v0.inventory_quantity ?? r.inventory_quantity ?? r.stock, 0);
    out.push({ sku, name, price, stock, channel: 'shopify' });
  }
  return out;
}

/** Best-effort normalise Composio Shopify order payloads. */
export function parseOrdersFromComposioResult(raw: unknown): CommerceOrder[] {
  const rows = asArray(raw);
  const out: CommerceOrder[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = str(r.name ?? r.order_number ?? r.id, 'order-?');
    const customer = str(
      (r.customer as { email?: string } | undefined)?.email ?? r.email ?? r.customer ?? 'customer',
    );
    const total = num(r.total_price ?? r.total ?? r.amount);
    const fin = str(r.financial_status ?? r.status).toLowerCase();
    const full = str(r.fulfillment_status ?? '').toLowerCase();
    let status: CommerceOrder['status'] = 'pending';
    if (/refund/.test(fin)) status = 'refunded';
    else if (full === 'fulfilled' || full === 'complete') status = 'fulfilled';
    else if (/paid|authorized|partially_paid/.test(fin)) status = 'paid';
    out.push({ id, customer, total, status, channel: 'shopify' });
  }
  return out;
}
