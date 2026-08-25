/**
 * IMAP inbox fetch + rule-based classify — live path when imapflow + creds present.
 */
// @ts-nocheck

import { classifyEmail } from './email';
import type { ClassifiedEmail, EmployeeResult } from './types';
import { getLogger } from '../logging/logger';

const log = getLogger('imap-sync');

export interface ImapCreds {
  host: string;
  port?: number;
  user: string;
  password: string;
  secure?: boolean;
}

async function loadImapflow(): Promise<{
  ImapFlow: new (opts: Record<string, unknown>) => {
    connect: () => Promise<void>;
    mailboxOpen: (box: string) => Promise<{ exists?: number }>;
    fetch: (
      range: string,
      opts: { envelope?: boolean; source?: boolean },
    ) => AsyncIterable<Record<string, unknown>>;
    logout: () => Promise<void>;
  };
} | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('imapflow') as {
      ImapFlow: new (opts: Record<string, unknown>) => {
        connect: () => Promise<void>;
        mailboxOpen: (box: string) => Promise<{ exists?: number }>;
        fetch: (
          range: string,
          opts: { envelope?: boolean; source?: boolean },
        ) => AsyncIterable<Record<string, unknown>>;
        logout: () => Promise<void>;
      };
    };
  } catch {
    return null;
  }
}

function envelopeText(env: Record<string, unknown> | undefined): {
  from: string;
  subject: string;
  body: string;
  receivedAt?: string;
} {
  const fromArr = env?.from as { address?: string; name?: string }[] | undefined;
  const from = fromArr?.[0]
    ? `${fromArr[0].name ? `${fromArr[0].name} ` : ''}<${fromArr[0].address ?? 'unknown'}>`
    : 'unknown';
  const subject = String(env?.subject ?? '');
  const date = env?.date instanceof Date ? env.date.toISOString() : undefined;
  return { from, subject, body: subject, receivedAt: date };
}

/** Fetch recent INBOX messages and classify each (rule-based). */
export async function fetchAndClassifyInbox(
  creds: Partial<ImapCreds>,
  limit = 10,
): Promise<
  EmployeeResult<{
    configured: boolean;
    messages: ClassifiedEmail[];
    imapflow: boolean;
    detail?: string;
  }>
> {
  if (!creds.host || !creds.user || !creds.password) {
    return {
      ok: false,
      reason: 'IMAP nicht konfiguriert — host, user, password in Admin → Connections',
    };
  }

  const mod = await loadImapflow();
  if (!mod) {
    return {
      ok: false,
      reason: 'imapflow nicht verfügbar — pnpm install (imapflow ist dependency)',
    };
  }

  const imap = new mod.ImapFlow({
    host: creds.host,
    port: creds.port ?? 993,
    secure: creds.secure !== false,
    auth: { user: creds.user, pass: creds.password },
    logger: false,
  });

  const classified: ClassifiedEmail[] = [];
  try {
    await imap.connect();
    const box = await imap.mailboxOpen('INBOX');
    const total = Number(box?.exists ?? 0);
    if (total === 0) {
      await imap.logout();
      return { ok: true, configured: true, messages: [], imapflow: true, detail: 'INBOX leer' };
    }
    const start = Math.max(1, total - limit + 1);
    const range = `${start}:${total}`;
    for await (const msg of imap.fetch(range, { envelope: true })) {
      const uid = String(msg.uid ?? classified.length);
      const env = msg.envelope as Record<string, unknown> | undefined;
      const parsed = envelopeText(env);
      const r = classifyEmail({
        id: `imap-${uid}`,
        from: parsed.from,
        subject: parsed.subject,
        body: parsed.body,
        receivedAt: parsed.receivedAt,
      });
      if (r.ok && r.email) classified.push(r.email);
    }
    await imap.logout();
    log.info({ count: classified.length, host: creds.host }, 'IMAP fetch+classify ok');
    return {
      ok: true,
      configured: true,
      messages: classified,
      imapflow: true,
      detail: `${classified.length} Nachricht(en) klassifiziert`,
    };
  } catch (err: unknown) {
    try {
      await imap.logout();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      reason: String((err as Error)?.message ?? err).slice(0, 200),
    };
  }
}

export function imapCredsFromStore(getKey: (name: string) => string): Partial<ImapCreds> {
  return {
    host: getKey('IMAP_HOST') || undefined,
    user: getKey('IMAP_USER') || undefined,
    password: getKey('IMAP_PASSWORD') || undefined,
    port: parseInt(getKey('IMAP_PORT') || '993', 10) || 993,
  };
}
