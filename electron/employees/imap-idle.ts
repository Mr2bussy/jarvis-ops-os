/**
 * IMAP IDLE scaffold — optional live listen via imapflow when installed + configured.
 * When disabled or missing deps, returns a stable status object and never throws into the UI.
 */
// @ts-nocheck

import { getFeatureFlag } from '../config/flags';
import { getLogger } from '../logging/logger';

export interface ImapIdleCreds {
  host: string;
  port?: number;
  user: string;
  password: string;
  secure?: boolean;
}

export type ImapIdleState = 'disabled' | 'idle' | 'listening' | 'error' | 'unavailable';

export interface ImapIdleStatus {
  state: ImapIdleState;
  host?: string;
  detail: string;
  /** Alias for main.ts pushActivity */
  lastError?: string;
  lastEventAt?: string;
  messagesSinceStart?: number;
}

type MailHandler = (msg: { uid: number; subject?: string; from?: string }) => void;

const log = getLogger('imap-idle');

let status: ImapIdleStatus = {
  state: 'disabled',
  detail: 'IMAP IDLE nicht gestartet',
};
let client: { logout: () => Promise<void>; close?: () => void } | null = null;
let mailHandler: MailHandler | null = null;
let messagesSinceStart = 0;

export function getImapIdleStatus(): ImapIdleStatus {
  return {
    ...status,
    messagesSinceStart,
    lastError: status.state === 'error' || status.state === 'unavailable' ? status.detail : undefined,
  };
}

export function onImapMail(handler: MailHandler | null): void {
  mailHandler = handler;
}

/** Dynamic import so missing imapflow does not crash the Electron main process. */
async function tryLoadImapflow(): Promise<{
  ImapFlow: new (opts: Record<string, unknown>) => {
    connect: () => Promise<void>;
    mailboxOpen: (box: string) => Promise<unknown>;
    idle: () => Promise<void>;
    logout: () => Promise<void>;
    on: (ev: string, cb: (...args: unknown[]) => void) => void;
  };
} | null> {
  try {
    // Optional peer dependency — not required for core JARVIS.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('imapflow') as {
      ImapFlow: new (opts: Record<string, unknown>) => {
        connect: () => Promise<void>;
        mailboxOpen: (box: string) => Promise<unknown>;
        idle: () => Promise<void>;
        logout: () => Promise<void>;
        on: (ev: string, cb: (...args: unknown[]) => void) => void;
      };
    };
    return mod;
  } catch {
    return null;
  }
}

export async function startImapIdle(creds: Partial<ImapIdleCreds>): Promise<ImapIdleStatus> {
  if (!getFeatureFlag('email.enabled')) {
    status = { state: 'disabled', detail: 'Feature-Flag email.enabled=false' };
    return getImapIdleStatus();
  }

  if (!creds.host || !creds.user || !creds.password) {
    status = {
      state: 'disabled',
      detail: 'IMAP Credentials fehlen (host/user/password)',
    };
    return getImapIdleStatus();
  }

  const mod = await tryLoadImapflow();
  if (!mod) {
    status = {
      state: 'unavailable',
      host: creds.host,
      detail: 'imapflow nicht installiert — IDLE-Scaffold aktiv. Optional: pnpm add imapflow',
    };
    log.info({ host: creds.host }, 'IMAP IDLE scaffold (no imapflow)');
    return getImapIdleStatus();
  }

  await stopImapIdle();
  messagesSinceStart = 0;

  try {
    const imap = new mod.ImapFlow({
      host: creds.host,
      port: creds.port ?? 993,
      secure: creds.secure !== false,
      auth: { user: creds.user, pass: creds.password },
      logger: false,
    });
    client = imap;
    await imap.connect();
    await imap.mailboxOpen('INBOX');
    imap.on('exists', (...args: unknown[]) => {
      const count = Number(args[0] ?? 0);
      messagesSinceStart += 1;
      status = {
        state: 'listening',
        host: creds.host,
        detail: `INBOX exists=${count}`,
        lastEventAt: new Date().toISOString(),
        messagesSinceStart,
      };
      mailHandler?.({ uid: count, subject: undefined, from: undefined });
    });
    status = {
      state: 'listening',
      host: creds.host,
      detail: 'IMAP IDLE verbunden',
      lastEventAt: new Date().toISOString(),
      messagesSinceStart,
    };
    // Fire-and-forget IDLE loop — errors update status, never throw to callers.
    void (async () => {
      try {
        while (client === imap) {
          await imap.idle();
        }
      } catch (err: unknown) {
        status = {
          state: 'error',
          host: creds.host,
          detail: String((err as Error)?.message ?? err).slice(0, 200),
        };
        log.warn({ err }, 'IMAP IDLE loop ended');
      }
    })();
    return getImapIdleStatus();
  } catch (err: unknown) {
    client = null;
    status = {
      state: 'error',
      host: creds.host,
      detail: String((err as Error)?.message ?? err).slice(0, 200),
    };
    return getImapIdleStatus();
  }
}

export async function stopImapIdle(): Promise<ImapIdleStatus> {
  const c = client;
  client = null;
  if (c) {
    try {
      await c.logout();
    } catch {
      try {
        c.close?.();
      } catch {
        /* ignore */
      }
    }
  }
  status = { state: 'idle', detail: 'IMAP IDLE gestoppt' };
  return getImapIdleStatus();
}
