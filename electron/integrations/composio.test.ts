import { describe, it, expect } from 'vitest';
import { categorizeApp, groupIntoCategories, COMPOSIO_CATEGORIES, type CatalogApp } from './composio';

const app = (slug: string, name = slug, categories: string[] = []): CatalogApp => ({
  slug,
  name,
  categories,
});

describe('categorizeApp', () => {
  it('routes Google-branded apps to Google Suite (even if they look like messaging/docs)', () => {
    expect(categorizeApp(app('gmail', 'Gmail'))).toBe('Google Suite');
    expect(categorizeApp(app('googledrive', 'Google Drive'))).toBe('Google Suite');
    expect(categorizeApp(app('googlecalendar', 'Google Calendar'))).toBe('Google Suite');
  });
  it('routes chat platforms to Messaging', () => {
    expect(categorizeApp(app('slack', 'Slack'))).toBe('Messaging');
    expect(categorizeApp(app('discord', 'Discord'))).toBe('Messaging');
    expect(categorizeApp(app('telegram', 'Telegram'))).toBe('Messaging');
  });
  it('routes social platforms to Social Media (youtube counts as social, not messaging)', () => {
    expect(categorizeApp(app('twitter', 'Twitter / X'))).toBe('Social Media');
    expect(categorizeApp(app('youtube', 'YouTube'))).toBe('Social Media');
    expect(categorizeApp(app('linkedin', 'LinkedIn'))).toBe('Social Media');
  });
  it('routes CRM/finance to Business', () => {
    expect(categorizeApp(app('hubspot', 'HubSpot'))).toBe('Business');
    expect(categorizeApp(app('stripe', 'Stripe'))).toBe('Business');
    expect(categorizeApp(app('salesforce', 'Salesforce'))).toBe('Business');
  });
  it('routes task/notes/project tools to Productivity', () => {
    expect(categorizeApp(app('notion', 'Notion'))).toBe('Productivity');
    expect(categorizeApp(app('trello', 'Trello'))).toBe('Productivity');
    expect(categorizeApp(app('linear', 'Linear'))).toBe('Productivity');
  });
  it('falls back to Other for unknown apps', () => {
    expect(categorizeApp(app('zzz-unknown', 'Mystery'))).toBe('Other');
  });
  it('uses API-provided categories as a signal too', () => {
    expect(categorizeApp(app('acme', 'Acme', ['Social']))).toBe('Social Media');
  });
});

describe('groupIntoCategories', () => {
  it('partitions apps into all six buckets with none lost', () => {
    const apps = [
      app('gmail', 'Gmail'),
      app('slack', 'Slack'),
      app('twitter', 'Twitter'),
      app('hubspot', 'HubSpot'),
      app('notion', 'Notion'),
      app('zzz', 'Mystery'),
    ];
    const g = groupIntoCategories(apps);
    expect(Object.keys(g).sort()).toEqual([...COMPOSIO_CATEGORIES].sort());
    expect(g['Google Suite']).toHaveLength(1);
    expect(g['Messaging']).toHaveLength(1);
    expect(g['Social Media']).toHaveLength(1);
    expect(g['Business']).toHaveLength(1);
    expect(g['Productivity']).toHaveLength(1);
    expect(g['Other']).toHaveLength(1);
    const total = Object.values(g).reduce((n, list) => n + list.length, 0);
    expect(total).toBe(apps.length); // nothing dropped or duplicated
  });
});
