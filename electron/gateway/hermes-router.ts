import type { GatewayConfig, GatewayPlatform, GatewayStatus, InboundMessage, MessageHandler } from './types';
import { isUserAllowed, loadGatewayConfig, saveGatewayConfig } from './store';
import { telegramGetUpdates, telegramSendMessage } from './adapters/telegram';
import { discordSendMessage } from './adapters/discord';
import { slackWebhookSend } from './adapters/slack';

export interface HermesRouterDeps {
  userDataDir: string;
  getKey: (name: string) => string;
  onActivity?: (who: string, action: string, target: string) => void;
}

/**
 * Hermes Router Gateway — JARVIS rebrand of the Hermes messaging gateway pattern.
 * Single process routes inbound chat → harness handler and outbound cron/harness → platforms.
 */
export class HermesRouterGateway {
  private config: GatewayConfig;
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private telegramOffset = 0;
  private messagesHandled = 0;
  private lastInbound?: GatewayStatus['lastInbound'];
  private platformErrors: Partial<Record<GatewayPlatform, string>> = {};
  private handler: MessageHandler | null = null;

  constructor(private readonly deps: HermesRouterDeps) {
    this.config = loadGatewayConfig(deps.userDataDir);
  }

  setMessageHandler(handler: MessageHandler | null): void {
    this.handler = handler;
  }

  getConfig(): GatewayConfig {
    return this.config;
  }

  updateConfig(patch: Partial<GatewayConfig>): GatewayConfig {
    this.config = {
      ...this.config,
      ...patch,
      platforms: { ...this.config.platforms, ...patch.platforms },
      allowedUserIds: { ...this.config.allowedUserIds, ...patch.allowedUserIds },
    };
    saveGatewayConfig(this.deps.userDataDir, this.config);
    return this.config;
  }

  status(): GatewayStatus {
    const tgToken = this.deps.getKey('TELEGRAM_BOT_TOKEN');
    const dcToken = this.deps.getKey('DISCORD_BOT_TOKEN');
    const dcChannel = this.deps.getKey('DISCORD_CHANNEL_ID');
    const slackHook = this.deps.getKey('SLACK_WEBHOOK_URL');

    return {
      running: this.running,
      brand: 'hermes-router',
      platforms: {
        telegram: {
          configured: Boolean(tgToken),
          active: this.running && this.config.platforms.telegram && Boolean(tgToken),
          lastError: this.platformErrors.telegram,
        },
        discord: {
          configured: Boolean(dcToken && dcChannel),
          active: this.config.platforms.discord && Boolean(dcToken && dcChannel),
          lastError: this.platformErrors.discord,
        },
        slack: {
          configured: Boolean(slackHook),
          active: this.config.platforms.slack && Boolean(slackHook),
          lastError: this.platformErrors.slack,
        },
        cli: { configured: true, active: true },
        internal: { configured: true, active: true },
      },
      lastInbound: this.lastInbound,
      messagesHandled: this.messagesHandled,
    };
  }

  start(): { ok: boolean; err?: string } {
    if (this.running) return { ok: true };
    if (!this.config.enabled)
      return { ok: false, err: 'Gateway disabled in config — enable in Hermes Router screen' };
    this.running = true;
    this.pollTimer = setInterval(() => void this.pollTelegram(), this.config.pollIntervalMs);
    void this.pollTelegram();
    this.deps.onActivity?.('HERMES-ROUTER', 'START', 'gateway');
    return { ok: true };
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.deps.onActivity?.('HERMES-ROUTER', 'STOP', 'gateway');
  }

  async deliver(platform: string, text: string): Promise<{ ok: boolean; err?: string }> {
    const p = platform.toLowerCase() as GatewayPlatform;
    if (p === 'internal' || p === 'cli') return { ok: true };

    if (p === 'telegram') {
      const token = this.deps.getKey('TELEGRAM_BOT_TOKEN');
      const chat = this.deps.getKey('TELEGRAM_CHANNEL') || this.deps.getKey('TELEGRAM_CHAT_ID');
      if (!token || !chat) return { ok: false, err: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL missing' };
      const r = await telegramSendMessage(token, chat, text);
      if (!r.ok) this.platformErrors.telegram = r.err;
      return r;
    }

    if (p === 'discord') {
      const token = this.deps.getKey('DISCORD_BOT_TOKEN');
      const channel = this.deps.getKey('DISCORD_CHANNEL_ID');
      if (!token || !channel) return { ok: false, err: 'DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID missing' };
      const r = await discordSendMessage(token, channel, text);
      if (!r.ok) this.platformErrors.discord = r.err;
      return r;
    }

    if (p === 'slack') {
      const hook = this.deps.getKey('SLACK_WEBHOOK_URL');
      if (!hook) return { ok: false, err: 'SLACK_WEBHOOK_URL missing' };
      const r = await slackWebhookSend(hook, text);
      if (!r.ok) this.platformErrors.slack = r.err;
      return r;
    }

    return { ok: false, err: `Unknown platform: ${platform}` };
  }

  private async pollTelegram(): Promise<void> {
    if (!this.running || !this.config.platforms.telegram) return;
    const token = this.deps.getKey('TELEGRAM_BOT_TOKEN');
    if (!token) return;

    const res = await telegramGetUpdates(token, this.telegramOffset);
    if (!res.ok) {
      this.platformErrors.telegram = res.err;
      return;
    }

    for (const u of res.updates) {
      this.telegramOffset = Math.max(this.telegramOffset, u.update_id + 1);
      const msg = u.message;
      if (!msg?.text || !msg.from) continue;

      const inbound: InboundMessage = {
        platform: 'telegram',
        userId: String(msg.from.id),
        chatId: String(msg.chat.id),
        text: msg.text,
        at: new Date().toISOString(),
      };

      if (!isUserAllowed(this.config, 'telegram', inbound.userId)) {
        this.deps.onActivity?.('HERMES-ROUTER', 'DENY', `telegram:${inbound.userId}`);
        continue;
      }

      this.lastInbound = {
        platform: 'telegram',
        at: inbound.at,
        preview: inbound.text.slice(0, 80),
      };
      this.deps.onActivity?.('HERMES-ROUTER', 'IN', inbound.text.slice(0, 60));

      const reply = this.handler
        ? await this.handler(inbound)
        : 'Hermes Router: no harness handler attached.';
      const sent = await telegramSendMessage(token, inbound.chatId, reply);
      if (!sent.ok) this.platformErrors.telegram = sent.err;
      else {
        this.messagesHandled += 1;
        this.deps.onActivity?.('HERMES-ROUTER', 'OUT', `telegram:${inbound.chatId}`);
      }
    }
  }
}

let singleton: HermesRouterGateway | null = null;

export function getHermesRouter(): HermesRouterGateway | null {
  return singleton;
}

export function setHermesRouter(g: HermesRouterGateway | null): void {
  singleton = g;
}

export function createHermesRouter(deps: HermesRouterDeps): HermesRouterGateway {
  const g = new HermesRouterGateway(deps);
  singleton = g;
  return g;
}
