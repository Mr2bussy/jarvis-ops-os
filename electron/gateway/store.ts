import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GatewayConfig, GatewayPlatform } from './types';

const DEFAULT: GatewayConfig = {
  enabled: false,
  brand: 'hermes-router',
  pollIntervalMs: 4000,
  platforms: {
    telegram: true,
    discord: true,
    slack: false,
    cli: true,
    internal: true,
  },
  allowedUserIds: {},
};

export function gatewayConfigPath(userDataDir: string): string {
  return path.join(userDataDir, 'gateway', 'config.json');
}

export function loadGatewayConfig(userDataDir: string): GatewayConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(gatewayConfigPath(userDataDir), 'utf8'));
    return { ...DEFAULT, ...raw, platforms: { ...DEFAULT.platforms, ...raw.platforms } };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveGatewayConfig(userDataDir: string, config: GatewayConfig): void {
  const p = gatewayConfigPath(userDataDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8');
}

export function isUserAllowed(config: GatewayConfig, platform: GatewayPlatform, userId: string): boolean {
  const list = config.allowedUserIds[platform];
  if (!list || list.length === 0) return true;
  return list.includes(userId);
}
