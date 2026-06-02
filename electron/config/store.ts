import { app, safeStorage } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * OS-keychain-backed config store. API keys and the MT5 bridge token are written as
 * safeStorage-encrypted base64 (plain base64 fallback when encryption is unavailable).
 * Extracted from main.ts so the persistence/crypto logic is unit-testable without
 * booting Electron (mock `electron` in tests).
 */
export interface ConfigStore {
  [key: string]: string;
}

export function configStorePath(): string {
  return path.join(app.getPath('userData'), 'jarvis-config.json');
}

export function readConfigStore(): ConfigStore {
  try {
    return JSON.parse(fs.readFileSync(configStorePath(), 'utf8'));
  } catch {
    return {};
  }
}

export function writeConfigStore(store: ConfigStore): void {
  fs.mkdirSync(path.dirname(configStorePath()), { recursive: true });
  fs.writeFileSync(configStorePath(), JSON.stringify(store), 'utf8');
}

// Encode with the shared convention: encrypted base64 when available, else plain base64.
function encode(value: string): string {
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(value).toString('base64')
    : Buffer.from(value).toString('base64');
}

export function getDecryptedKey(name: string): string {
  const store = readConfigStore();
  if (store[name]) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(store[name], 'base64'));
      }
      return Buffer.from(store[name], 'base64').toString('utf8');
    } catch {
      /* fall through to env */
    }
  }
  return process.env[name] || '';
}

export function setConfigKey(name: string, value: string): void {
  const store = readConfigStore();
  store[name] = encode(value);
  writeConfigStore(store);
}

export function deleteConfigKey(name: string): void {
  const store = readConfigStore();
  delete store[name];
  writeConfigStore(store);
}

export function hasConfigKey(name: string): boolean {
  return Boolean(readConfigStore()[name] || process.env[name]);
}

// Stable shared secret for the local MT5 bridge. Generated once, persisted encrypted,
// so it survives restarts (and matches a bridge still alive on :1234 from last session).
export function ensureBridgeToken(): string {
  let tok = getDecryptedKey('JARVIS_BRIDGE_TOKEN');
  if (!tok) {
    tok = randomBytes(24).toString('hex');
    setConfigKey('JARVIS_BRIDGE_TOKEN', tok);
  }
  return tok;
}

// Advanced Mode gate for the raw shell. OFF by default — opt-in & audited. Not a secret,
// so stored as a plain flag (not encoded).
export function getAdvancedMode(): boolean {
  return readConfigStore()['ADVANCED_MODE'] === '1';
}
export function setAdvancedMode(on: boolean): void {
  const store = readConfigStore();
  store['ADVANCED_MODE'] = on ? '1' : '0';
  writeConfigStore(store);
}
