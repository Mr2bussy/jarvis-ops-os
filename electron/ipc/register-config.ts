// @ts-nocheck
import type { IpcMain } from 'electron';
import { validate, ConfigSetKey } from '../security/ipc';
import {
  deleteConfigKey,
  getAdvancedMode,
  getDecryptedKey,
  hasConfigKey,
  setAdvancedMode,
  setConfigKey,
} from '../config/store';
import { resetComposioClient } from '../integrations/composio';
import { fetchAndClassifyInbox, imapCredsFromStore } from '../employees/imap-sync';

async function maybeSyncImapAfterKey(name: string): Promise<void> {
  if (!/^IMAP_(HOST|USER|PASSWORD|PORT)$/.test(name)) return;
  const creds = imapCredsFromStore(getDecryptedKey);
  if (!creds.host || !creds.user || !creds.password) return;
  void fetchAndClassifyInbox(creds, 8).catch(() => {
    /* non-fatal — operator sees status via employee IPC */
  });
}

export type ConfigIpcDeps = {
  /** Clears cached Anthropic client after key rotation. */
  resetAnthropicClient: () => void;
};

/** Safe Storage + Advanced Mode IPC — extracted from main.ts (D6). */
export function registerConfigIpc(ipcMain: IpcMain, deps: ConfigIpcDeps): void {
  ipcMain.handle('config:getAdvancedMode', () => getAdvancedMode());
  ipcMain.handle('config:setAdvancedMode', (_e, on: unknown) => {
    setAdvancedMode(Boolean(on));
    return getAdvancedMode();
  });

  ipcMain.handle('config:setKey', async (_evt, raw: unknown) => {
    const { name, value } = validate(ConfigSetKey, raw);
    setConfigKey(name, value);
    if (name === 'ANTHROPIC_API_KEY') {
      process.env.ANTHROPIC_API_KEY = value;
      deps.resetAnthropicClient();
    }
    if (name === 'COMPOSIO_API_KEY') resetComposioClient();
    if (name === 'GEMINI_API_KEY') process.env.GEMINI_API_KEY = value;
    if (name === 'GITHUB_TOKEN') process.env.GITHUB_TOKEN = value;
    if (name === 'DASHSCOPE_API_KEY') process.env.DASHSCOPE_API_KEY = value;
    if (name === 'JARVIS_MODEL') process.env.JARVIS_MODEL = value;
    if (name === 'COMPOSIO_API_KEY') resetComposioClient();
    void maybeSyncImapAfterKey(name);
    return true;
  });
  ipcMain.handle('config:getKey', async (_evt, name: string) => getDecryptedKey(name));
  ipcMain.handle('config:hasKey', async (_evt, name: string) => hasConfigKey(name));
  ipcMain.handle('config:deleteKey', async (_evt, name: string) => {
    deleteConfigKey(name);
    return true;
  });
  ipcMain.handle('config:getMt5', async () => ({
    host: getDecryptedKey('MT5_HOST') || 'localhost',
    port: parseInt(getDecryptedKey('MT5_PORT') || '1234', 10),
  }));
  ipcMain.handle('config:setMt5', async (_evt, payload: { host: string; port: number }) => {
    setConfigKey('MT5_HOST', String(payload?.host ?? 'localhost'));
    setConfigKey('MT5_PORT', String(payload?.port ?? 1234));
    return true;
  });
  ipcMain.handle('config:reload-keys', () => {
    for (const name of [
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'GEMINI_MODEL',
      'GEMINI_STT_MODEL',
      'GITHUB_TOKEN',
      'DASHSCOPE_API_KEY',
      'JARVIS_MODEL',
      'JARVIS_AGENTS_PATH',
      'OLLAMA_HOST',
      'OLLAMA_BASE_URL',
      'OLLAMA_MODEL',
      'OLLAMA_STT_MODEL',
    ]) {
      const v = getDecryptedKey(name);
      if (v) process.env[name] = v;
    }
    deps.resetAnthropicClient();
    return true;
  });
}
