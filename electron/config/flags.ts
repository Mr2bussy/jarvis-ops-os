/**
 * Feature flags — persisted in userData/flags.json with sensible defaults.
 */
// @ts-nocheck

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FeatureFlags {
  'email.enabled': boolean;
  'invoice.enabled': boolean;
  'invoice.liveMode': boolean;
  'calendar.enabled': boolean;
  'shop.enabled': boolean;
  'voice.metrics': boolean;
  'hermes.warmPool': boolean;
  'harness.auditTrail': boolean;
  'global.killSwitch': boolean;
  'simulation.dryRun': boolean;
  'voice.whisperTurbo': boolean;
  'voice.piperTts': boolean;
  'trading.econCalendar': boolean;
  'trading.ccxtPaper': boolean;
}

const DEFAULTS: FeatureFlags = {
  'email.enabled': true,
  'invoice.enabled': true,
  'invoice.liveMode': false,
  'calendar.enabled': true,
  'shop.enabled': true,
  'voice.metrics': true,
  'hermes.warmPool': true,
  'harness.auditTrail': true,
  'global.killSwitch': false,
  'simulation.dryRun': false,
  'voice.whisperTurbo': false,
  'voice.piperTts': false,
  'trading.econCalendar': true,
  'trading.ccxtPaper': true,
};

let flagsPath = '';
let cache: FeatureFlags | null = null;

export function initFeatureFlags(userDataDir: string): void {
  flagsPath = path.join(userDataDir, 'flags.json');
  cache = null;
}

function loadFlags(): FeatureFlags {
  if (cache) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(flagsPath, 'utf8')) as Partial<FeatureFlags>;
    cache = { ...DEFAULTS, ...raw };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function getFeatureFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  if (!flagsPath) return DEFAULTS[key];
  return loadFlags()[key];
}

export function setFeatureFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
  const next = { ...loadFlags(), [key]: value };
  cache = next;
  fs.mkdirSync(path.dirname(flagsPath), { recursive: true });
  fs.writeFileSync(flagsPath, JSON.stringify(next, null, 2), 'utf8');
}

export function getAllFeatureFlags(): FeatureFlags {
  return flagsPath ? loadFlags() : { ...DEFAULTS };
}

export function resetFeatureFlags(): FeatureFlags {
  cache = { ...DEFAULTS };
  if (flagsPath) fs.writeFileSync(flagsPath, JSON.stringify(cache, null, 2), 'utf8');
  return cache;
}
