import { Composio } from '@composio/core';
import { getDecryptedKey } from '../config/store';

/**
 * Composio integration — live toolkit catalog + action execution across ~485 apps.
 *
 * The secret lives in the main process (safeStorage), never the renderer. The
 * catalog is fetched LIVE from Composio's API and grouped into the operator's five
 * categories by the pure heuristic below — nothing is hard-coded/faked. Exact
 * per-category counts therefore reflect the live catalog + this grouping, not any
 * marketing figure.
 */

export type ComposioCategory =
  | 'Productivity'
  | 'Business'
  | 'Google Suite'
  | 'Messaging'
  | 'Social Media'
  | 'Other';

export const COMPOSIO_CATEGORIES: ComposioCategory[] = [
  'Productivity',
  'Business',
  'Google Suite',
  'Messaging',
  'Social Media',
  'Other',
];

export interface CatalogApp {
  slug: string;
  name: string;
  categories: string[];
}

// First-match-wins keyword heuristic. Order matters: branded "google*" must win over
// the generic messaging/productivity needles, and specific social platforms before
// the broad messaging bucket.
const CATEGORY_KEYWORDS: { category: ComposioCategory; needles: string[] }[] = [
  { category: 'Google Suite', needles: ['google', 'gmail', 'gsuite', 'g-suite'] },
  {
    category: 'Social Media',
    needles: [
      'twitter',
      'instagram',
      'facebook',
      'linkedin',
      'tiktok',
      'youtube',
      'reddit',
      'mastodon',
      'pinterest',
      'threads',
      'social',
    ],
  },
  {
    category: 'Messaging',
    needles: [
      'slack',
      'discord',
      'telegram',
      'whatsapp',
      'teams',
      'twilio',
      'signal',
      'messenger',
      'intercom',
      'chat',
      'sms',
    ],
  },
  {
    category: 'Business',
    needles: [
      'hubspot',
      'salesforce',
      'stripe',
      'quickbooks',
      'zoho',
      'shopify',
      'zendesk',
      'pipedrive',
      'freshdesk',
      'xero',
      'sap',
      'crm',
      'invoice',
      'payment',
      'billing',
      'accounting',
      'sales',
      'marketing',
    ],
  },
  {
    category: 'Productivity',
    needles: [
      'notion',
      'trello',
      'asana',
      'jira',
      'clickup',
      'todoist',
      'linear',
      'monday',
      'airtable',
      'evernote',
      'calendly',
      'calendar',
      'task',
      'note',
      'doc',
      'project',
      'productivity',
      'spreadsheet',
    ],
  },
];

/** Pure: bucket one app into a single category (best-effort heuristic). */
export function categorizeApp(app: CatalogApp): ComposioCategory {
  const hay = `${app.slug} ${app.name} ${app.categories.join(' ')}`.toLowerCase();
  for (const { category, needles } of CATEGORY_KEYWORDS) {
    if (needles.some((n) => hay.includes(n))) return category;
  }
  return 'Other';
}

/** Pure: group a catalog into the five categories (+ Other). */
export function groupIntoCategories(apps: CatalogApp[]): Record<ComposioCategory, CatalogApp[]> {
  const out = Object.fromEntries(COMPOSIO_CATEGORIES.map((c) => [c, [] as CatalogApp[]])) as Record<
    ComposioCategory,
    CatalogApp[]
  >;
  for (const app of apps) out[categorizeApp(app)].push(app);
  return out;
}

// ── Live SDK (requires COMPOSIO_API_KEY) ───────────────────────────────────────
let _client: Composio | null = null;

export function hasComposio(): boolean {
  return Boolean(getDecryptedKey('COMPOSIO_API_KEY'));
}

export function resetComposioClient(): void {
  _client = null;
}

function getClient(): Composio {
  const apiKey = getDecryptedKey('COMPOSIO_API_KEY');
  if (!apiKey) throw new Error('COMPOSIO_API_KEY not set. Add it in Admin > Models.');
  if (!_client) _client = new Composio({ apiKey });
  return _client;
}

/** Fetch the live toolkit catalog and normalise to CatalogApp. */
export async function listCatalog(): Promise<CatalogApp[]> {
  const res = (await getClient().toolkits.get({})) as any;
  const items: any[] = res?.items ?? (Array.isArray(res) ? res : []);
  return items.map((t) => ({
    slug: String(t?.slug ?? t?.key ?? ''),
    name: String(t?.name ?? t?.slug ?? ''),
    categories: extractCategoryNames(t),
  }));
}

function extractCategoryNames(t: any): string[] {
  const raw = t?.meta?.categories ?? t?.categories;
  if (!Array.isArray(raw)) return [];
  return raw.map((c: any) => String(c?.name ?? c?.slug ?? c)).filter(Boolean);
}

/** Execute a Composio tool/action for a connected account. */
export async function executeAction(
  slug: string,
  body: { arguments?: Record<string, unknown>; userId?: string; connectedAccountId?: string },
): Promise<unknown> {
  return getClient().tools.execute(slug, body as any);
}

/** List the operator's connected accounts (OAuth links). */
export async function listConnections(): Promise<unknown> {
  return getClient().connectedAccounts.list();
}
