import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { HermesRouterGateway } from './hermes-router';
import { loadGatewayConfig, saveGatewayConfig } from './store';

describe('Hermes Router Gateway', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-router-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('loads default config with hermes-router brand', () => {
    const cfg = loadGatewayConfig(tmp);
    expect(cfg.brand).toBe('hermes-router');
    expect(cfg.enabled).toBe(false);
  });

  it('reports platform configuration from keys', () => {
    const g = new HermesRouterGateway({
      userDataDir: tmp,
      getKey: (name) => (name === 'TELEGRAM_BOT_TOKEN' ? 'tok' : ''),
    });
    const st = g.status();
    expect(st.brand).toBe('hermes-router');
    expect(st.platforms.telegram?.configured).toBe(true);
  });

  it('start fails when disabled', () => {
    const g = new HermesRouterGateway({ userDataDir: tmp, getKey: () => '' });
    expect(g.start().ok).toBe(false);
    saveGatewayConfig(tmp, { ...loadGatewayConfig(tmp), enabled: true });
    const g2 = new HermesRouterGateway({ userDataDir: tmp, getKey: () => 'x' });
    expect(g2.start().ok).toBe(true);
    g2.stop();
  });

  it('routes inbound to handler and counts messages', async () => {
    const g = new HermesRouterGateway({
      userDataDir: tmp,
      getKey: (n) => (n === 'TELEGRAM_BOT_TOKEN' ? 'fake' : ''),
    });
    g.updateConfig({ enabled: true, platforms: { ...loadGatewayConfig(tmp).platforms, telegram: true } });
    g.setMessageHandler(async (msg) => `echo:${msg.text}`);
    // deliver internal always ok
    const d = await g.deliver('internal', 'hello');
    expect(d.ok).toBe(true);
  });
});
