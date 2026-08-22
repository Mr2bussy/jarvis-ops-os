import type { IpcMain } from 'electron';
import { z } from 'zod';
import type { JarvisPrimeHarness } from './service';

const RunSession = z.object({
  sessionId: z.string().min(1).max(128),
  message: z.string().min(1).max(100_000),
  verifierId: z.string().max(128).optional(),
});

const RefinePayload = z.object({
  sessionId: z.string().min(1).max(128),
  evidence: z.string().min(1).max(8000),
  lesson: z.string().min(1).max(8000),
  skillName: z.string().max(128).optional(),
});

const HitlResolve = z.object({
  id: z.string().min(1).max(128),
  approved: z.boolean(),
});

const MemorySearch = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(50).optional(),
});

let harnessSingleton: JarvisPrimeHarness | null = null;

export function setHarnessInstance(h: JarvisPrimeHarness | null): void {
  harnessSingleton = h;
}

export function getHarnessInstance(): JarvisPrimeHarness | null {
  return harnessSingleton;
}

export function registerHarnessIpc(ipcMain: IpcMain): void {
  ipcMain.handle('harness:status', async () => {
    if (!harnessSingleton) return { ok: false, err: 'Harness not initialized' };
    return { ok: true, data: harnessSingleton.getStateSnapshot() };
  });

  ipcMain.handle('harness:run', async (_e, raw: unknown) => {
    if (!harnessSingleton) return { ok: false, err: 'Harness not initialized' };
    try {
      const p = RunSession.parse(raw);
      const turns = await harnessSingleton.runSession(p);
      return { ok: true, turns };
    } catch (err: unknown) {
      return { ok: false, err: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('harness:refine', async (_e, raw: unknown) => {
    if (!harnessSingleton) return { ok: false, err: 'Harness not initialized' };
    try {
      const p = RefinePayload.parse(raw);
      const out = harnessSingleton.refine(p);
      return { ok: out.ok, data: out, err: out.err };
    } catch (err: unknown) {
      return { ok: false, err: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('harness:memory-search', async (_e, raw: unknown) => {
    if (!harnessSingleton) return { ok: false, err: 'Harness not initialized' };
    try {
      const p = MemorySearch.parse(raw);
      return { ok: true, data: harnessSingleton.searchMemory(p.query, p.limit) };
    } catch (err: unknown) {
      return { ok: false, err: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('harness:hitl-pending', async () => {
    if (!harnessSingleton) return { ok: false, err: 'Harness not initialized' };
    return { ok: true, data: harnessSingleton.listPendingHitl() };
  });

  ipcMain.handle('harness:hitl-resolve', async (_e, raw: unknown) => {
    if (!harnessSingleton) return { ok: false, err: 'Harness not initialized' };
    try {
      const p = HitlResolve.parse(raw);
      const resolved = harnessSingleton.resolveHitl(p.id, p.approved);
      if (!resolved) return { ok: false, err: 'Unknown or already resolved approval' };
      return { ok: true, data: resolved };
    } catch (err: unknown) {
      return { ok: false, err: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('harness:bench-smoke', async () => {
    if (!harnessSingleton) return { ok: false, err: 'Harness not initialized' };
    const result = harnessSingleton.runAutomatedBenchSmoke();
    return { ok: true, data: result };
  });

  ipcMain.handle('harness:swarm-plan', async (_e, raw: unknown) => {
    if (!harnessSingleton) return { ok: false, err: 'Harness not initialized' };
    const message =
      typeof raw === 'object' && raw && 'message' in raw
        ? String((raw as { message: unknown }).message)
        : String(raw ?? '');
    return { ok: true, data: harnessSingleton.planSwarm(message) };
  });

  ipcMain.handle('harness:weekly-run', async (_e, raw: unknown) => {
    if (!harnessSingleton) return { ok: false, err: 'Harness not initialized' };
    const useLlm =
      typeof raw === 'object' && raw && 'useLlmCritic' in raw
        ? Boolean((raw as { useLlmCritic: unknown }).useLlmCritic)
        : false;
    try {
      const data = await harnessSingleton.runWeeklyEval(useLlm);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, err: String((err as Error)?.message ?? err) };
    }
  });
}
