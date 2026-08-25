// @ts-nocheck
import { getDecryptedKey } from '../config/store';
import { executeAction, hasComposio, listConnectionsParsed } from '../integrations/composio';
import {
  COMMERCE_CONFIG_KEYS,
  DEFAULT_SHOPIFY_SLUGS,
  parseOrdersFromComposioResult,
  parseProductsFromComposioResult,
  type CommerceOrder,
  type CommerceProduct,
} from './composio-map';

export interface CommerceSyncResult {
  ok: boolean;
  reason?: string;
  composioOk: boolean;
  shopifyConnected: boolean;
  products: CommerceProduct[];
  orders: CommerceOrder[];
  slugs: { products?: string; orders?: string; health?: string };
  rawBytes?: number;
}

function slugFor(key: keyof typeof COMMERCE_CONFIG_KEYS, fallback: string): string {
  return getDecryptedKey(COMMERCE_CONFIG_KEYS[key])?.trim() || fallback;
}

async function shopifyActive(): Promise<boolean> {
  if (!hasComposio()) return false;
  const rows = await listConnectionsParsed();
  return rows.some((r) => /shopify/i.test(r.toolkit) && /active/i.test(r.status));
}

async function runTool(slug: string): Promise<{ ok: boolean; data?: unknown; err?: string }> {
  try {
    const res = await executeAction(slug, { arguments: { limit: 25 } });
    if (res && typeof res === 'object' && 'ok' in res && (res as { ok?: boolean }).ok === false) {
      return { ok: false, err: String((res as { err?: unknown }).err ?? 'Composio tool failed') };
    }
    return { ok: true, data: res };
  } catch (err: unknown) {
    return { ok: false, err: String((err as Error)?.message ?? err) };
  }
}

/** Sync catalog + orders when Composio + Shopify OAuth are live and slugs resolve. */
export async function syncShopifyCommerce(): Promise<CommerceSyncResult> {
  const composioOk = hasComposio();
  const shopifyConnected = composioOk ? await shopifyActive() : false;
  const productsSlug = slugFor('productsSlug', DEFAULT_SHOPIFY_SLUGS.products);
  const ordersSlug = slugFor('ordersSlug', DEFAULT_SHOPIFY_SLUGS.orders);
  const healthSlug = slugFor('healthSlug', DEFAULT_SHOPIFY_SLUGS.health);

  if (!composioOk) {
    return {
      ok: false,
      reason: 'COMPOSIO_API_KEY fehlt — Admin → Connections',
      composioOk: false,
      shopifyConnected: false,
      products: [],
      orders: [],
      slugs: { products: productsSlug, orders: ordersSlug, health: healthSlug },
    };
  }

  if (!shopifyConnected) {
    return {
      ok: false,
      reason: 'Shopify nicht verbunden — Admin → Connections · Shopify OAuth',
      composioOk: true,
      shopifyConnected: false,
      products: [],
      orders: [],
      slugs: { products: productsSlug, orders: ordersSlug, health: healthSlug },
    };
  }

  const [prodRes, orderRes] = await Promise.all([runTool(productsSlug), runTool(ordersSlug)]);
  const products = prodRes.ok ? parseProductsFromComposioResult(prodRes.data) : [];
  const orders = orderRes.ok ? parseOrdersFromComposioResult(orderRes.data) : [];

  const rawBytes = JSON.stringify({ prodRes, orderRes }).length;
  const anyData = products.length > 0 || orders.length > 0;

  if (!anyData && !prodRes.ok && !orderRes.ok) {
    return {
      ok: false,
      reason: `Tool-Slugs prüfen (${productsSlug}, ${ordersSlug}): ${prodRes.err ?? orderRes.err ?? 'keine Daten'}`,
      composioOk: true,
      shopifyConnected: true,
      products: [],
      orders: [],
      slugs: { products: productsSlug, orders: ordersSlug, health: healthSlug },
      rawBytes,
    };
  }

  return {
    ok: true,
    composioOk: true,
    shopifyConnected: true,
    products,
    orders,
    slugs: { products: productsSlug, orders: ordersSlug, health: healthSlug },
    rawBytes,
    reason: anyData
      ? undefined
      : 'Connector ok — Slugs lieferten leere Arrays (Health-Tool testen oder Slugs anpassen)',
  };
}
