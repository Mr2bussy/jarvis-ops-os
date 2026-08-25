/**
 * Config export/import — jarvis.config.json (keys redacted).
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';
import { readConfigStore } from './store';
import { getAllFeatureFlags, type FeatureFlags } from './flags';

export interface JarvisConfigExport {
  version: 1;
  exportedAt: string;
  flags: FeatureFlags;
  keys: Record<string, 'present' | 'absent'>;
  mt5?: { host: string; port: number };
}

const REDACTED_KEYS = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'IMAP_PASSWORD',
  'TELEGRAM_BOT_TOKEN',
  'COMPOSIO_API_KEY',
  'JARVIS_BRIDGE_TOKEN',
];

export function exportConfig(getKey: (name: string) => string): JarvisConfigExport {
  const store = readConfigStore();
  const keys: Record<string, 'present' | 'absent'> = {};
  for (const k of Object.keys(store)) {
    if (REDACTED_KEYS.some((r) => k.includes(r) || k.endsWith('_KEY') || k.endsWith('_TOKEN'))) {
      keys[k] = store[k] ? 'present' : 'absent';
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    flags: getAllFeatureFlags(),
    keys,
    mt5: {
      host: getKey('MT5_HOST') || 'localhost',
      port: parseInt(getKey('MT5_PORT') || '1234', 10),
    },
  };
}

export function importConfigFlags(filePath: string): FeatureFlags {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as JarvisConfigExport;
  if (raw.version !== 1) throw new Error('Unsupported config version');
  return raw.flags;
}

export function writeConfigExport(outPath: string, data: JarvisConfigExport): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
}
