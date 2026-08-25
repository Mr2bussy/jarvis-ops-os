// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { classifyEmail, draftReply } from './email';
import { extractInvoiceFromText } from './invoice';

describe('email employee', () => {
  it('classifies invoice subject', () => {
    const r = classifyEmail({ from: 'billing@vendor.de', subject: 'Rechnung #123', body: 'Zahlung fällig' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.email.category).toBe('invoice');
  });

  it('drafts gated reply', () => {
    const c = classifyEmail({ from: 'a@b.de', subject: 'Hilfe', body: 'Support ticket' });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const d = draftReply({ original: c.email });
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.draft.requiresHitl).toBe(true);
  });
});

describe('invoice employee', () => {
  it('extracts amount from text', () => {
    const r = extractInvoiceFromText('Rechnung von Acme GmbH\nBetrag: 199,50 EUR\nDatum: 01.03.2026');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice.amount).toBeCloseTo(199.5);
      expect(r.invoice.plausibility).not.toBe('reject');
    }
  });
});
