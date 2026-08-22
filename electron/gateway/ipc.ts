import type { IpcMain } from 'electron';
import { z } from 'zod';
import {
  createHermesRouter,
  getHermesRouter,
  setHermesRouter,
  type HermesRouterGateway,
} from './hermes-router';
import type { GatewayConfig } from './types';
import { getDecryptedKey } from '../config/store';

const ConfigPatch = z.object({
  enabled: z.boolean().optional(),
  pollIntervalMs: z.number().int().min(1000).max(60_000).optional(),
  platforms: z
    .object({
      telegram: z.boolean().optional(),
      discord: z.boolean().optional(),
      slack: z.boolean().optional(),
      cli: z.boolean().optional(),
      internal: z.boolean().optional(),
    })
    .optional(),
});

const DeliverPayload = z.object({
  platform: z.string().min(1).max(32),
  text: z.string().min(1).max(20_000),
});

export function initHermesRouter(
  userDataDir: string,
  pushActivity: (w: string, a: string, t: string) => void,
): HermesRouterGateway {
  const existing = getHermesRouter();
  if (existing) return existing;

  const router = createHermesRouter({
    userDataDir,
    getKey: getDecryptedKey,
    onActivity: pushActivity,
  });

  const cfg = router.getConfig();
  if (cfg.enabled) router.start();

  return router;
}

export function registerGatewayIpc(ipcMain: IpcMain): void {
  ipcMain.handle('gateway:status', () => {
    const g = getHermesRouter();
    if (!g) return { ok: false, err: 'Hermes Router not initialized' };
    return { ok: true, data: g.status() };
  });

  ipcMain.handle('gateway:config-get', () => {
    const g = getHermesRouter();
    if (!g) return { ok: false, err: 'Hermes Router not initialized' };
    return { ok: true, data: g.getConfig() };
  });

  ipcMain.handle('gateway:config-set', (_e, raw: unknown) => {
    const g = getHermesRouter();
    if (!g) return { ok: false, err: 'Hermes Router not initialized' };
    try {
      const patch = ConfigPatch.parse(raw);
      const data = g.updateConfig(patch as Partial<GatewayConfig>);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, err: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('gateway:start', () => {
    const g = getHermesRouter();
    if (!g) return { ok: false, err: 'Hermes Router not initialized' };
    g.updateConfig({ enabled: true });
    return g.start();
  });

  ipcMain.handle('gateway:stop', () => {
    const g = getHermesRouter();
    if (!g) return { ok: false, err: 'Hermes Router not initialized' };
    g.stop();
    g.updateConfig({ enabled: false });
    return { ok: true };
  });

  ipcMain.handle('gateway:deliver', async (_e, raw: unknown) => {
    const g = getHermesRouter();
    if (!g) return { ok: false, err: 'Hermes Router not initialized' };
    try {
      const p = DeliverPayload.parse(raw);
      return g.deliver(p.platform, p.text);
    } catch (err: unknown) {
      return { ok: false, err: String((err as Error)?.message ?? err) };
    }
  });
}

export { getHermesRouter, setHermesRouter };
