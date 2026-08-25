// @ts-nocheck
import type { ClassifiedEmail, EmailCategory, EmailDraft, EmployeeResult } from './types';

const CATEGORY_RULES: { category: EmailCategory; patterns: RegExp[] }[] = [
  { category: 'invoice', patterns: [/\brechnung\b/i, /\binvoice\b/i, /\bzahlung\b/i, /\bpayment due\b/i] },
  { category: 'urgent', patterns: [/\bdringend\b/i, /\burgent\b/i, /\basap\b/i, /\bsofort\b/i] },
  { category: 'support', patterns: [/\bsupport\b/i, /\bticket\b/i, /\bhelp\b/i, /\bproblem\b/i] },
  { category: 'newsletter', patterns: [/\bnewsletter\b/i, /\bunsubscribe\b/i, /\babmelden\b/i] },
];

/** Rule-based classifier — no LLM required for scaffold; upgrade path is Hermes classify task. */
export function classifyEmail(input: {
  from: string;
  subject: string;
  body: string;
  id?: string;
  receivedAt?: string;
}): EmployeeResult<{ email: ClassifiedEmail }> {
  const text = `${input.subject}\n${input.body}`.trim();
  if (!text) return { ok: false, reason: 'Leerer E-Mail-Inhalt' };

  let best: EmailCategory = 'other';
  let hits = 0;
  for (const rule of CATEGORY_RULES) {
    const n = rule.patterns.filter((p) => p.test(text) || p.test(input.from)).length;
    if (n > hits) {
      hits = n;
      best = rule.category;
    }
  }

  const confidence = hits > 0 ? Math.min(0.95, 0.55 + hits * 0.15) : 0.35;

  return {
    ok: true,
    email: {
      id: input.id ?? `mail_${Date.now()}`,
      from: input.from,
      subject: input.subject,
      snippet: text.slice(0, 160),
      category: best,
      confidence,
      receivedAt: input.receivedAt ?? new Date().toISOString(),
    },
  };
}

export function draftReply(input: {
  original: ClassifiedEmail;
  operatorHint?: string;
}): EmployeeResult<{ draft: EmailDraft }> {
  const hint = input.operatorHint?.trim();
  const body = hint
    ? hint
    : input.original.category === 'invoice'
      ? 'Vielen Dank für die Rechnung. Ich prüfe die Angaben und melde mich.'
      : 'Danke für Ihre Nachricht — ich kümmere mich darum und melde mich zeitnah.';

  return {
    ok: true,
    draft: {
      to: input.original.from,
      subject: input.original.subject.startsWith('Re:')
        ? input.original.subject
        : `Re: ${input.original.subject}`,
      body,
      replyToId: input.original.id,
      requiresHitl: true,
    },
  };
}

/** IMAP scaffold — returns config status; live fetch requires operator IMAP credentials. */
export function imapStatus(creds: {
  host?: string;
  user?: string;
  password?: string;
}): EmployeeResult<{ configured: boolean; host?: string }> {
  const configured = Boolean(creds.host && creds.user && creds.password);
  if (!configured) {
    return {
      ok: false,
      reason: 'IMAP nicht konfiguriert — host, user und password in Setup hinterlegen.',
    };
  }
  return { ok: true, configured: true, host: creds.host };
}
