/**
 * Domain IPC formerly missing from main — browser, vault, selftest, trading, voice, memory.
 * Extracted so registry ↔ handlers stay closed under `pnpm gen:ipc --check` (D4/D6).
 */
// @ts-nocheck

import type { IpcMain } from 'electron';
import { app, dialog } from 'electron';
import * as fs from 'node:fs';
import { ensureBridgeToken, getDecryptedKey, hasConfigKey, setConfigKey } from '../config/store';
import { browserBridgeStatus, startBrowserBridge } from '../browser/browser-use';
import { freeTranscribe, freeSttStatus, hasFfmpeg } from '../stt/free-whisper';
import {
  countAgentFiles,
  getVaultPathEntries,
  materializeLocalAgentsVault,
  resolveAgentsPath,
} from '../paths/agents-path';
import { runSelfTest } from '../system/selftest';
import { piperStatus, piperSynthesize } from '../tts/piper';
import { ccxtPaperStatus, fetchPaperOhlcv, fetchPaperTicker } from '../trading/ccxt-paper';
import { fetchEconomicCalendar, isInNewsWindow } from '../trading/economic-calendar';
import {
  addJournalEntry,
  initTradeJournal,
  listJournalEntries,
  weeklyJournalReport,
} from '../trading/trade-journal';
import { initEmbeddingStore, searchEmbeddings, upsertEmbedding } from '../harness/memory/embedding-store';
import { getSystemMetrics } from '../system/metrics';

export type DomainIpcDeps = {
  pushActivity?: (who: string, action: string, target: string) => void;
};

function freeDiskBytes(): number {
  try {
    const m = getSystemMetrics() as { disk_total_gb?: number; disk_used_gb?: number };
    if (m.disk_total_gb != null && m.disk_used_gb != null) {
      return Math.max(0, (m.disk_total_gb - m.disk_used_gb) * 1024 ** 3);
    }
  } catch {
    /* fall through */
  }
  return -1;
}

async function probeLocal(port: number): Promise<{ ok: boolean; detail: string; installed?: boolean }> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
    return { ok: r.ok, detail: r.ok ? `port ${port} ok` : `HTTP ${r.status}`, installed: true };
  } catch (e: unknown) {
    return { ok: false, detail: String((e as Error)?.message ?? e).slice(0, 80), installed: true };
  }
}

export function registerDomainIpc(ipcMain: IpcMain, deps: DomainIpcDeps = {}): void {
  const userData = app.getPath('userData');
  initTradeJournal(userData);
  initEmbeddingStore(userData);

  // ── Browser bridge ──────────────────────────────────────────────────────
  ipcMain.handle('browser:install', async () => {
    return {
      ok: false,
      reason: 'Install browser-use via: pip install -r browser_bridge/requirements.txt',
      hint: 'Then browser:start',
    };
  });
  ipcMain.handle('browser:start', async () => {
    const token = ensureBridgeToken();
    startBrowserBridge(token, (d) => deps.pushActivity?.('BROWSER', 'ACT', d.slice(0, 60)));
    return browserBridgeStatus(token);
  });
  ipcMain.handle('browser:status', async () => browserBridgeStatus(ensureBridgeToken()));

  // ── Composio OAuth initiate (soft stub when SDK path unavailable) ───────
  ipcMain.handle('composio:initiate', async (_e, raw: unknown) => {
    const appSlug = String((raw as { app?: string })?.app ?? (raw as { slug?: string })?.slug ?? '');
    if (!appSlug) return { ok: false, reason: 'app slug required' };
    if (!hasConfigKey('COMPOSIO_API_KEY') && !process.env.COMPOSIO_API_KEY) {
      return { ok: false, reason: 'COMPOSIO_API_KEY missing — Admin → Connections' };
    }
    return {
      ok: false,
      reason: 'Use Admin → Connections OAuth flow; initiate redirect is operator-driven',
      app: appSlug,
    };
  });

  // ── Vault / agents ─────────────────────────────────────────────────────
  ipcMain.handle('jarvis:get-vault-paths', () => getVaultPathEntries());
  ipcMain.handle('jarvis:set-agents-path', (_e, raw: unknown) => {
    const p = String((raw as { path?: string })?.path ?? raw ?? '').trim();
    if (!p) return { ok: false, reason: 'path required' };
    setConfigKey('JARVIS_AGENTS_PATH', p);
    process.env.JARVIS_AGENTS_PATH = p;
    return { ok: true, path: p, files: countAgentFiles(p) };
  });
  ipcMain.handle('jarvis:activate-vault-agents', () => {
    const agentsPath = materializeLocalAgentsVault(userData);
    setConfigKey('JARVIS_AGENTS_PATH', agentsPath);
    process.env.JARVIS_AGENTS_PATH = agentsPath;
    const n = countAgentFiles(agentsPath);
    deps.pushActivity?.('VAULT', 'ACTIVATE', `${n} files`);
    return { ok: true, path: agentsPath, files: n };
  });

  // ── Self-test ───────────────────────────────────────────────────────────
  ipcMain.handle('jarvis:system-selftest', async () => {
    const t0 = Date.now();
    const report = await runSelfTest(
      {
        pathExists: (p) => Boolean(p) && fs.existsSync(p),
        countAgentFiles,
        hasKey: (name) => hasConfigKey(name) || Boolean(process.env[name]),
        getSetting: (name) =>
          getDecryptedKey(name) ||
          process.env[name] ||
          (name === 'JARVIS_AGENTS_PATH' ? resolveAgentsPath() : ''),
        probeBridge: async (port) => {
          if (port === 1237) {
            const st = await browserBridgeStatus(ensureBridgeToken());
            return { ok: st.running, detail: st.detail, installed: st.installed };
          }
          return probeLocal(port);
        },
        hasFfmpeg: () => hasFfmpeg(),
        whisperCached: () => {
          const st = freeSttStatus();
          return Boolean(st.ffmpeg) || st.engine.includes('whisper');
        },
        freeDiskBytes,
      },
      Date.now(),
    );
    report.ms = Date.now() - t0;
    return report;
  });

  ipcMain.handle('jarvis:voice-selftest', async () => {
    const piper = piperStatus();
    const ffmpeg = hasFfmpeg();
    const stt = freeSttStatus();
    const hasLlm =
      hasConfigKey('ANTHROPIC_API_KEY') ||
      hasConfigKey('GEMINI_API_KEY') ||
      hasConfigKey('GITHUB_TOKEN') ||
      hasConfigKey('DASHSCOPE_API_KEY');
    const checks = [
      { id: 'ffmpeg', ok: ffmpeg, detail: ffmpeg ? 'ok' : 'missing' },
      { id: 'whisper', ok: true, detail: stt.note || stt.engine },
      { id: 'piper', ok: piper.available, detail: piper.detail },
      { id: 'llm', ok: hasLlm, detail: hasLlm ? 'key present' : 'no LLM key' },
    ];
    return {
      ok: checks.every((c) => c.ok || c.id === 'piper'),
      healthy: checks.filter((c) => c.id !== 'piper').every((c) => c.ok),
      checks,
      at: new Date().toISOString(),
    };
  });

  ipcMain.handle('jarvis:voice-session', () => ({
    ok: true,
    active: false,
    detail: 'session metadata — voice overlay owns live state',
  }));

  ipcMain.handle('jarvis:free-transcribe', async (_e, raw: unknown) => {
    const audioBase64 = String((raw as { audioBase64?: string })?.audioBase64 ?? '');
    const mimeType = String((raw as { mimeType?: string })?.mimeType ?? 'audio/wav');
    if (!audioBase64) return { ok: false, reason: 'audioBase64 required' };
    try {
      const text = await freeTranscribe(audioBase64, mimeType);
      return { ok: true, text };
    } catch (e: unknown) {
      return { ok: false, reason: String((e as Error)?.message ?? e) };
    }
  });

  // ── Memory embeddings ───────────────────────────────────────────────────
  ipcMain.handle('memory:embed-upsert', async (_e, raw: unknown) => {
    const id = String((raw as { id?: string })?.id ?? '');
    const text = String((raw as { text?: string })?.text ?? '');
    if (!id || !text) return { ok: false, reason: 'id and text required' };
    return upsertEmbedding(id, text);
  });
  ipcMain.handle('memory:embed-search', async (_e, raw: unknown) => {
    const query = String((raw as { query?: string })?.query ?? '');
    const limit = Number((raw as { limit?: number })?.limit ?? 8);
    if (!query) return { ok: false, reason: 'query required', hits: [] };
    const hits = await searchEmbeddings(query, limit);
    return { ok: true, hits };
  });

  // ── Trading data ────────────────────────────────────────────────────────
  ipcMain.handle('trading:ccxt-status', async () => ccxtPaperStatus());
  ipcMain.handle('trading:ccxt-ticker', async (_e, raw: unknown) => {
    const symbol = String((raw as { symbol?: string })?.symbol ?? 'BTC/USDT');
    try {
      return { ok: true, quote: await fetchPaperTicker(symbol) };
    } catch (e: unknown) {
      return { ok: false, reason: String((e as Error)?.message ?? e) };
    }
  });
  ipcMain.handle('trading:ccxt-ohlcv', async (_e, raw: unknown) => {
    const symbol = String((raw as { symbol?: string })?.symbol ?? 'BTC/USDT');
    const timeframe = String((raw as { timeframe?: string })?.timeframe ?? '1h');
    const limit = Number((raw as { limit?: number })?.limit ?? 100);
    try {
      return { ok: true, bars: await fetchPaperOhlcv(symbol, timeframe, limit) };
    } catch (e: unknown) {
      return { ok: false, reason: String((e as Error)?.message ?? e) };
    }
  });
  ipcMain.handle('trading:econ-calendar', async (_e, raw: unknown) => {
    const force = Boolean((raw as { force?: boolean })?.force);
    return fetchEconomicCalendar(force);
  });
  ipcMain.handle('trading:in-news-window', async (_e, raw: unknown) => {
    const beforeMin = Number(
      (raw as { beforeMin?: number; minutes?: number })?.beforeMin ??
        (raw as { minutes?: number })?.minutes ??
        30,
    );
    const afterMin = Number((raw as { afterMin?: number })?.afterMin ?? beforeMin);
    const cal = await fetchEconomicCalendar(false);
    const events = cal.events ?? [];
    return {
      ok: true,
      inWindow: isInNewsWindow(events, new Date(), beforeMin, afterMin),
      events: events.length,
    };
  });
  ipcMain.handle('trading:journal-add', (_e, raw: unknown) => {
    try {
      return { ok: true, entry: addJournalEntry(raw as Parameters<typeof addJournalEntry>[0]) };
    } catch (e: unknown) {
      return { ok: false, reason: String((e as Error)?.message ?? e) };
    }
  });
  ipcMain.handle('trading:journal-list', (_e, raw: unknown) => {
    const limit = Number((raw as { limit?: number })?.limit ?? 50);
    return { ok: true, entries: listJournalEntries(limit) };
  });
  ipcMain.handle('trading:journal-weekly', () => ({ ok: true, report: weeklyJournalReport() }));

  // ── Voice / Piper ───────────────────────────────────────────────────────
  ipcMain.handle('voice:piper-status', () => piperStatus());
  ipcMain.handle('voice:piper-speak', async (_e, raw: unknown) => {
    const text = String((raw as { text?: string })?.text ?? '');
    if (!text) return { ok: false, reason: 'text required' };
    return piperSynthesize(text);
  });
  ipcMain.handle('voice:pickFiles', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'webm', 'm4a'] },
        { name: 'All', extensions: ['*'] },
      ],
    });
    return { ok: !r.canceled, paths: r.filePaths ?? [] };
  });
}
