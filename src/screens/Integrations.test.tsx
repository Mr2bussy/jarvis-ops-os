// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import IntegrationsScreen from './Integrations';

afterEach(() => {
  cleanup();
  delete (window as any).jarvisBridge;
});

describe('IntegrationsScreen', () => {
  it('renders the connect panel + reference category counts when no key is configured', async () => {
    (window as any).jarvisBridge = { composio: { has: vi.fn(async () => false), catalog: vi.fn() } };
    render(<IntegrationsScreen />);

    // Category tiles render immediately with the published reference counts.
    expect(screen.getByText('PRODUCTIVITY')).toBeTruthy();
    expect(screen.getByText('131')).toBeTruthy(); // Productivity reference count

    // Once the async has() check resolves false, the connect panel appears.
    await waitFor(() => expect(screen.getByText('CONNECT COMPOSIO')).toBeTruthy());
  });

  it('loads + renders the live catalog when connected', async () => {
    const apps = [
      { slug: 'gmail', name: 'Gmail', categories: [] },
      { slug: 'slack', name: 'Slack', categories: [] },
    ];
    (window as any).jarvisBridge = {
      composio: {
        has: vi.fn(async () => true),
        catalog: vi.fn(async () => ({
          apps,
          byCategory: {
            'Google Suite': [apps[0]],
            Messaging: [apps[1]],
            Productivity: [],
            Business: [],
            'Social Media': [],
            Other: [],
          },
        })),
      },
    };
    render(<IntegrationsScreen />);

    // Live app chips appear after the catalog resolves.
    await waitFor(() => expect(screen.getByText('Gmail')).toBeTruthy());
    expect(screen.getByText('Slack')).toBeTruthy();
  });
});
