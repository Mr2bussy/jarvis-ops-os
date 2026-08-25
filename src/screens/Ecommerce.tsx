// @ts-nocheck
import { useEffect, useState } from 'react';
import { HoloPanel, Stat } from '../components/primitives';
import { ScreenHeader } from '../components/shell';
import { Value } from '../components/Value';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE, VIOLET } from '../theme';
import { measured, none, type Sourced } from '../lib/sourced';
import type { ScreenProps } from './Bridge';

/**
 * E-Commerce command center — fusion patterns from Medusa (modular commerce),
 * Saleor (GraphQL headless), and Vendure (order/inventory workflows).
 *
 * Live catalog/orders require explicit Composio tool mapping. Until then the UI
 * shows honest empty states — never seed demo revenue.
 */

type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'refunded';

interface Product {
  sku: string;
  name: string;
  price: number;
  stock: number;
  channel: string;
}

interface Order {
  id: string;
  customer: string;
  total: number;
  status: OrderStatus;
  channel: string;
}

function statusColor(s: OrderStatus) {
  return s === 'fulfilled' ? JADE : s === 'paid' ? CYAN_BRIGHT : s === 'pending' ? AMBER : ROSE;
}

type ProbeState = 'loading' | 'ready' | 'offline' | 'error';

export default function EcommerceScreen({ onNav }: ScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [composioOk, setComposioOk] = useState(false);
  const [probe, setProbe] = useState<ProbeState>('loading');
  const [busy, setBusy] = useState('');
  const [syncNote, setSyncNote] = useState('Commerce-Quelle wird geprüft…');
  const [slugDraft, setSlugDraft] = useState(
    () => localStorage.getItem('jarvis.commerce.shopify.healthToolSlug')?.trim() ?? '',
  );

  useEffect(() => {
    const composio = window.jarvisBridge?.composio;
    if (!composio?.connections) {
      setComposioOk(false);
      setProbe('offline');
      setSyncNote('Electron IPC/Composio nicht verfügbar — Desktop-App starten.');
      return;
    }
    let alive = true;
    setProbe('loading');
    composio
      .connections()
      .then((res) => {
        if (!alive) return;
        const rows = res?.items ?? [];
        const ok = rows.some((r) => /shopify|stripe/i.test(r.toolkit) && /active/i.test(r.status));
        setComposioOk(ok);
        setProbe('ready');
        setSyncNote(
          ok
            ? 'Commerce-Connector aktiv. Sync ruft echte commerce:sync IPC — Tool-Slugs mappen für KPIs.'
            : 'Connect to enable: Admin → Connections (COMPOSIO_API_KEY + Shopify OAuth), dann Sync.',
        );
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setComposioOk(false);
        setProbe('error');
        setSyncNote(String((e as Error)?.message ?? e).slice(0, 180));
      });
    return () => {
      alive = false;
    };
  }, []);

  const hasLive = products.length > 0 || orders.length > 0;
  const revenue = orders.filter((o) => o.status !== 'refunded').reduce((s, o) => s + o.total, 0);
  const aov = orders.length ? revenue / orders.length : 0;
  const lowStock = products.filter((p) => p.stock < 50).length;

  const kpiSource = hasLive ? 'measured' : probe === 'loading' ? 'none' : 'none';
  const revenueSourced: Sourced<string> = hasLive
    ? measured(`$${revenue.toLocaleString()}`, 'orders-sum')
    : none('—', kpiSource);
  const ordersSourced: Sourced<string> =
    orders.length > 0 ? measured(String(orders.length), 'orders-count') : none('—', kpiSource);
  const aovSourced: Sourced<string> = hasLive
    ? measured(`$${aov.toFixed(0)}`, 'orders-aov')
    : none('—', kpiSource);
  const lowStockSourced: Sourced<string> =
    products.length > 0 ? measured(String(lowStock), 'catalog-stock') : none('—', kpiSource);

  function saveSlug() {
    const v = slugDraft.trim();
    if (v) localStorage.setItem('jarvis.commerce.shopify.healthToolSlug', v);
    else localStorage.removeItem('jarvis.commerce.shopify.healthToolSlug');
    setSyncNote(v ? `Health-Tool-Slug gespeichert: ${v}` : 'Health-Tool-Slug entfernt.');
  }

  async function syncShopify() {
    setBusy('Shopify sync…');
    try {
      const slug = localStorage.getItem('jarvis.commerce.shopify.healthToolSlug')?.trim();
      if (slug) {
        await window.jarvisBridge?.config?.setKey?.('SHOPIFY_HEALTH_TOOL_SLUG', slug);
      }
      const r = await window.jarvisBridge?.commerce?.sync?.();
      if (!r) {
        setSyncNote('Commerce IPC nicht verfügbar — Desktop-App starten.');
        return;
      }
      if (r.products?.length) setProducts(r.products as Product[]);
      if (r.orders?.length) setOrders(r.orders as Order[]);
      if (!r.ok) {
        setSyncNote(r.reason ?? 'Sync fehlgeschlagen — Connector oder Tool-Slugs prüfen.');
        return;
      }
      const slugNote = r.slugs?.products
        ? ` · Slugs: ${r.slugs.products}${r.slugs.orders ? ` / ${r.slugs.orders}` : ''}`
        : '';
      setSyncNote(
        `${r.products.length} Produkte · ${r.orders.length} Orders geladen${slugNote}${
          r.reason ? ` (${r.reason})` : ''
        }`,
      );
    } catch (e: unknown) {
      setSyncNote(String((e as Error)?.message ?? e).slice(0, 180));
    } finally {
      setBusy('');
    }
  }

  function fulfillNext() {
    if (orders.length === 0) {
      setSyncNote('Fulfillment blockiert: keine Live-Orders geladen.');
      return;
    }
    setSyncNote(
      'Fulfillment blockiert: kein Live-Order-Connector mit bestätigter Fulfillment-Action verbunden.',
    );
  }

  const chipColor = probe === 'offline' || probe === 'error' ? ROSE : composioOk ? AMBER : CYAN;
  const statusChip = (
    <span
      className="hud-label"
      role="status"
      aria-live="polite"
      style={{
        fontSize: 9,
        color: chipColor,
        border: `1px solid ${chipColor}50`,
        background: `${chipColor}10`,
        padding: '4px 10px',
        letterSpacing: '0.2em',
      }}
    >
      {probe === 'loading'
        ? '… PROBE'
        : probe === 'offline'
          ? '○ IPC OFFLINE'
          : probe === 'error'
            ? '○ PROBE ERROR'
            : composioOk
              ? products.length || orders.length
                ? '● LIVE CATALOG'
                : '● CONNECTOR · SYNC FOR DATA'
              : '○ NO COMMERCE LINK'}
    </span>
  );

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}
      role="region"
      aria-label="E-Commerce command center"
    >
      <ScreenHeader
        tag="E-COMMERCE"
        title="COMMAND CENTER"
        subtitle="Medusa modular · Saleor headless · Vendure fulfillment · no demo seed"
        right={statusChip}
      />

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}
        aria-label="Commerce KPIs"
      >
        <Stat
          label="REVENUE (MTD)"
          value={<Value data={revenueSourced} />}
          sub={hasLive ? undefined : probe === 'loading' ? 'probing…' : 'no live orders'}
        />
        <Stat label="ORDERS" value={<Value data={ordersSourced} />} />
        <Stat label="AOV" value={<Value data={aovSourced} />} />
        <Stat
          label="LOW STOCK SKUs"
          value={<Value data={lowStockSourced} />}
          sub={
            products.length ? (lowStock ? 'reorder' : 'nominal') : probe === 'loading' ? '…' : 'no catalog'
          }
        />
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12, minHeight: 0 }}>
        <HoloPanel
          label="REVENUE PULSE"
          code="EC-R"
          status={probe === 'loading' ? 'queue' : composioOk ? 'warn' : probe === 'ready' ? 'queue' : 'warn'}
          style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <div
            className="font-mono"
            role="status"
            aria-live="polite"
            style={{
              minHeight: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontSize: 10,
              color: probe === 'error' ? ROSE : 'var(--cyan-dim)',
              lineHeight: 1.55,
              border: '1px dashed var(--line-soft)',
              padding: 8,
            }}
          >
            // {syncNote}
          </div>

          <label
            htmlFor="ec-shopify-slug"
            className="hud-label"
            style={{
              fontSize: 8,
              color: 'var(--cyan-dim)',
              letterSpacing: '0.16em',
              marginTop: 10,
              display: 'block',
            }}
          >
            SHOPIFY HEALTH TOOL SLUG
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              id="ec-shopify-slug"
              value={slugDraft}
              onChange={(e) => setSlugDraft(e.target.value)}
              placeholder="SHOPIFY_…"
              aria-describedby="ec-slug-hint"
              className="font-mono"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 8px',
                fontSize: 10,
                color: 'var(--fg)',
                background: 'oklch(0.07 0.014 240 / 0.7)',
                border: `1px solid ${CYAN}44`,
                outline: 'none',
              }}
            />
            <button
              type="button"
              className="hud-label"
              onClick={saveSlug}
              aria-label="Shopify health tool slug speichern"
              style={{
                padding: '6px 10px',
                fontSize: 8,
                letterSpacing: '0.14em',
                color: CYAN_BRIGHT,
                border: `1px solid ${CYAN}55`,
                cursor: 'pointer',
                background: `${CYAN}12`,
              }}
            >
              SAVE
            </button>
          </div>
          <div
            id="ec-slug-hint"
            className="font-mono"
            style={{ fontSize: 8, color: 'var(--cyan-dim)', marginTop: 4 }}
          >
            Health-Slug lokal + safeStorage (SHOPIFY_*_TOOL_SLUG). Default: SHOPIFY_GET_PRODUCTS /
            SHOPIFY_GET_ORDERS.
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="hud-label"
              onClick={() => void syncShopify()}
              disabled={!!busy || probe === 'offline'}
              aria-label="Shopify über Composio synchronisieren"
              style={{
                padding: '6px 12px',
                fontSize: 9,
                color: composioOk ? JADE : AMBER,
                border: `1px solid ${composioOk ? JADE : AMBER}60`,
                cursor: busy || probe === 'offline' ? 'not-allowed' : 'pointer',
                letterSpacing: '0.2em',
                opacity: busy || probe === 'offline' ? 0.5 : 1,
                background: 'transparent',
              }}
            >
              {busy || (composioOk ? '◆ SYNC SHOPIFY (COMPOSIO)' : '◇ CONNECT TO ENABLE · ADMIN CONNECTIONS')}
            </button>
            <button
              type="button"
              className="hud-label"
              onClick={() => onNav('admin')}
              aria-label="Zu Admin Connections navigieren"
              style={{
                padding: '6px 12px',
                fontSize: 9,
                color: AMBER,
                border: `1px solid ${AMBER}60`,
                cursor: 'pointer',
                letterSpacing: '0.2em',
                background: 'transparent',
              }}
            >
              ◆ ADMIN CONNECTIONS
            </button>
            <button
              type="button"
              className="hud-label"
              onClick={() => onNav('integrations')}
              aria-label="Zu Integrations navigieren"
              style={{
                padding: '6px 12px',
                fontSize: 9,
                color: CYAN_BRIGHT,
                border: `1px solid ${CYAN}60`,
                cursor: 'pointer',
                letterSpacing: '0.2em',
                background: 'transparent',
              }}
            >
              ◆ COMPOSIO APPS
            </button>
          </div>
        </HoloPanel>

        <HoloPanel
          label="CATALOG · INVENTORY"
          code="EC-P"
          status={products.length ? 'live' : 'queue'}
          bodyClassName="nx-scroll"
          style={{ minHeight: 0 }}
        >
          {products.length === 0 && (
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                color: 'var(--cyan-dim)',
                lineHeight: 1.55,
                padding: '14px 0',
                textAlign: 'center',
              }}
            >
              // connect to enable — Admin → Connections · COMPOSIO_API_KEY + Shopify OAuth
              <br />
              <span style={{ opacity: 0.7 }}>Dann SYNC (commerce:sync IPC). Keine Seed-Kataloge.</span>
            </div>
          )}
          {products.map((p) => (
            <div key={p.sku} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="hud-label" style={{ fontSize: 9, color: CYAN_BRIGHT }}>
                  {p.name}
                </span>
                <span className="font-mono" style={{ fontSize: 10, color: JADE }}>
                  ${p.price}
                </span>
              </div>
              <div className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', marginTop: 3 }}>
                {p.sku} · {p.channel} · stock {p.stock}
              </div>
            </div>
          ))}
        </HoloPanel>

        <HoloPanel
          label="ORDERS · FULFILLMENT"
          code="EC-O"
          status={orders.length ? 'live' : 'queue'}
          bodyClassName="nx-scroll"
          style={{ minHeight: 0 }}
        >
          <button
            type="button"
            className="hud-label"
            onClick={fulfillNext}
            disabled={orders.length === 0}
            aria-label="Nächste Live-Order fulfillen"
            title={orders.length === 0 ? 'Keine Live-Orders' : 'Benötigt gemappte Fulfillment-Action'}
            style={{
              width: '100%',
              marginBottom: 8,
              padding: '6px',
              fontSize: 9,
              color: orders.length ? VIOLET : 'var(--cyan-dim)',
              border: `1px solid ${orders.length ? VIOLET : 'var(--line)'}60`,
              cursor: orders.length ? 'pointer' : 'not-allowed',
              letterSpacing: '0.22em',
              opacity: orders.length ? 1 : 0.55,
              background: 'transparent',
            }}
          >
            ▶ FULFILL NEXT LIVE ORDER
          </button>
          {orders.length === 0 && (
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                color: 'var(--cyan-dim)',
                lineHeight: 1.55,
                padding: '14px 0',
                textAlign: 'center',
              }}
            >
              // connect to enable — Orders erst nach erfolgreichem commerce:sync
            </div>
          )}
          {orders.map((o) => (
            <div key={o.id} style={{ padding: '7px 0', borderBottom: '1px dashed var(--line-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-mono" style={{ fontSize: 9, color: CYAN_BRIGHT }}>
                  {o.id}
                </span>
                <span
                  className="hud-label"
                  style={{
                    fontSize: 7.5,
                    color: statusColor(o.status),
                    border: `1px solid ${statusColor(o.status)}50`,
                    padding: '1px 5px',
                  }}
                >
                  {o.status.toUpperCase()}
                </span>
              </div>
              <div className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)', marginTop: 2 }}>
                {o.customer} · ${o.total} · {o.channel}
              </div>
            </div>
          ))}
        </HoloPanel>
      </div>
    </div>
  );
}
