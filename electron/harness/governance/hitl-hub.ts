// @ts-nocheck
import type { PendingApproval } from '../types';
import type { JarvisPrimeHarness } from '../service';
import type { HermesRouterGateway } from '../../gateway/hermes-router';
import { getDecryptedKey } from '../../config/store';

export interface HitlHubDeps {
  harness: () => JarvisPrimeHarness | null;
  router: () => HermesRouterGateway | null;
  pushActivity?: (who: string, action: string, target: string) => void;
  /** Auto-deny after timeout (default 120s). Set 0 to disable. */
  timeoutMs?: number;
}

/**
 * Unified HITL nerve — one queue for in-app modal and Telegram /ok /deny commands.
 */
export class HitlHub {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly deps: HitlHubDeps) {}

  /** Called when harness creates a pending approval — notify all channels. */
  async notify(entry: PendingApproval): Promise<void> {
    this.deps.pushActivity?.('HITL-HUB', 'WAIT', entry.id);
    this.armTimeout(entry);
    const router = this.deps.router();
    if (!router) return;
    const token = getDecryptedKey('TELEGRAM_BOT_TOKEN');
    const chat = getDecryptedKey('TELEGRAM_CHAT_ID') || getDecryptedKey('TELEGRAM_CHANNEL');
    if (!token || !chat) return;

    const tool = String((entry.payload.tool as string | undefined) ?? 'action');
    const risk = String((entry.payload.riskClass as string | undefined) ?? 'unknown');
    const text = [
      '⚠️ JARVIS — Freigabe nötig',
      '',
      entry.reason.slice(0, 400),
      '',
      `Tool: ${tool} · Risiko: ${risk}`,
      `ID: ${entry.id}`,
      '',
      'Antworten mit:',
      `/ok ${entry.id.slice(-8)} — genehmigen`,
      `/deny ${entry.id.slice(-8)} — ablehnen`,
    ].join('\n');

    await router.deliver('telegram', text);
  }

  /**
   * Parse Telegram-style approval commands. Returns reply text if handled, null otherwise.
   * Accepts full id or last 8 chars (what we show in notifications).
   */
  tryResolveFromMessage(text: string): string | null {
    const trimmed = text.trim();
    const m = trimmed.match(/^\/(ok|deny|approve|reject)\s+(\S+)/i);
    if (!m) return null;

    const approved = m[1].toLowerCase() === 'ok' || m[1].toLowerCase() === 'approve';
    const idSuffix = m[2];
    const harness = this.deps.harness();
    if (!harness) return 'Harness nicht initialisiert.';

    const pending = harness.listPendingHitl();
    const match = pending.find((p) => p.id === idSuffix || p.id.endsWith(idSuffix));
    if (!match) return `Keine offene Freigabe für „${idSuffix}".`;

    const resolved = harness.resolveHitl(match.id, approved);
    if (!resolved) return 'Freigabe bereits erledigt oder unbekannt.';

    this.clearTimeout(match.id);
    this.deps.pushActivity?.('HITL-HUB', approved ? 'OK' : 'DENY', match.id);
    return approved
      ? `✅ Genehmigt: ${match.reason.slice(0, 120)}`
      : `❌ Abgelehnt: ${match.reason.slice(0, 120)}`;
  }

  private armTimeout(entry: PendingApproval): void {
    const ms = this.deps.timeoutMs ?? 120_000;
    if (ms <= 0) return;
    this.clearTimeout(entry.id);
    const timer = setTimeout(() => void this.escalateTimeout(entry.id), ms);
    this.timers.set(entry.id, timer);
  }

  private clearTimeout(id: string): void {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
  }

  /** Auto-deny on timeout and notify operator via Telegram. */
  private async escalateTimeout(id: string): Promise<void> {
    this.timers.delete(id);
    const harness = this.deps.harness();
    if (!harness) return;
    const pending = harness.listPendingHitl().find((p) => p.id === id);
    if (!pending) return;
    harness.resolveHitl(id, false);
    this.deps.pushActivity?.('HITL-HUB', 'TIMEOUT', id);
    const router = this.deps.router();
    if (!router) return;
    await router.deliver(
      'telegram',
      `⏱ Freigabe abgelaufen — automatisch abgelehnt.\nID: ${id.slice(-8)}\n${pending.reason.slice(0, 200)}`,
    );
  }

  dispose(): void {
    for (const id of this.timers.keys()) this.clearTimeout(id);
  }
}

let hubSingleton: HitlHub | null = null;

export function setHitlHub(h: HitlHub | null): void {
  hubSingleton = h;
}

export function getHitlHub(): HitlHub | null {
  return hubSingleton;
}
