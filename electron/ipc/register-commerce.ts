// @ts-nocheck
import type { IpcMain } from 'electron';
import { syncShopifyCommerce } from '../commerce/sync';

/** E-Commerce Composio sync IPC (D7/P0 wiring). */
export function registerCommerceIpc(ipcMain: IpcMain): void {
  ipcMain.handle('commerce:sync', async () => {
    try {
      return await syncShopifyCommerce();
    } catch (err: unknown) {
      return {
        ok: false,
        reason: String((err as Error)?.message ?? err),
        composioOk: false,
        shopifyConnected: false,
        products: [],
        orders: [],
        slugs: {},
      };
    }
  });
}
