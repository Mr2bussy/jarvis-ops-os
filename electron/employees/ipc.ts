// @ts-nocheck
import type { IpcMain } from 'electron';
import { z } from 'zod';
import { classifyEmail, draftReply, imapStatus } from './email';
import { fetchAndClassifyInbox, imapCredsFromStore } from './imap-sync';
import { extractInvoiceFromText, previewBooking } from './invoice';
import { calendarOAuthStatus, proposeCalendarInsert } from './calendar';
import { draftShopRefund, draftSocialPost, listProductsShell } from './shop';
import { getDecryptedKey } from '../config/store';
import { assertNoBlobPayload, PathOnlyPayload } from '../security/ipc';
import { ipcRateLimiter, rateLimitOrThrow } from '../security/rate-limiter';
import { dryRunBlock } from '../config/dry-run';
import { parsePdfOffThread, ocrOffThread } from '../workers/worker-pool';

const ClassifyEmail = z.object({
  from: z.string().min(1).max(256),
  subject: z.string().max(512),
  body: z.string().max(50_000),
});

const DraftReply = z.object({
  original: z.object({
    id: z.string(),
    from: z.string(),
    subject: z.string(),
    snippet: z.string(),
    category: z.enum(['invoice', 'support', 'newsletter', 'personal', 'urgent', 'other']),
    confidence: z.number(),
    receivedAt: z.string(),
  }),
  operatorHint: z.string().max(4000).optional(),
});

const InvoiceText = z.object({ text: z.string().min(1).max(100_000) });
const InvoicePath = z.object({
  path: z.string().min(1).max(4096),
  ocrFallback: z.boolean().optional(),
});

const CalendarPropose = z.object({
  title: z.string().min(1).max(256),
  start: z.string().min(1),
  end: z.string().min(1),
  attendees: z.array(z.string()).optional(),
  existing: z.array(z.object({ title: z.string(), start: z.string(), end: z.string() })).optional(),
});

const ShopRefund = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
});

const ShopSocial = z.object({
  productName: z.string().min(1),
  hook: z.string().min(1).max(500),
  channel: z.enum(['instagram', 'x', 'tiktok']),
});

export function registerEmployeeIpc(ipcMain: IpcMain): void {
  ipcMain.handle('employee:email-classify', (_e, raw: unknown) => {
    try {
      rateLimitOrThrow(ipcRateLimiter, 'employee:email-classify');
      return classifyEmail(ClassifyEmail.parse(raw));
    } catch (err: unknown) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('employee:email-draft', (_e, raw: unknown) => {
    try {
      rateLimitOrThrow(ipcRateLimiter, 'employee:email-draft');
      const blocked = dryRunBlock('email-draft');
      if (blocked.blocked) return { ok: true, dryRun: true, draft: blocked.reason };
      return draftReply(DraftReply.parse(raw));
    } catch (err: unknown) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('employee:email-imap-status', () => {
    return imapStatus({
      host: getDecryptedKey('IMAP_HOST'),
      user: getDecryptedKey('IMAP_USER'),
      password: getDecryptedKey('IMAP_PASSWORD'),
    });
  });

  ipcMain.handle('employee:email-fetch-inbox', async (_e, raw: unknown) => {
    try {
      rateLimitOrThrow(ipcRateLimiter, 'employee:email-fetch-inbox');
      const limit =
        raw && typeof raw === 'object' && 'limit' in raw
          ? Math.min(50, Math.max(1, Number((raw as { limit?: number }).limit) || 10))
          : 10;
      return await fetchAndClassifyInbox(imapCredsFromStore(getDecryptedKey), limit);
    } catch (err: unknown) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('employee:invoice-extract', (_e, raw: unknown) => {
    try {
      rateLimitOrThrow(ipcRateLimiter, 'employee:invoice-extract');
      assertNoBlobPayload(raw);
      const p = InvoiceText.parse(raw);
      return extractInvoiceFromText(p.text);
    } catch (err: unknown) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
  });

  /** Path-not-blob invoice extract — PDF via worker, optional Tesseract OCR fallback. */
  ipcMain.handle('employee:invoice-extract-path', async (_e, raw: unknown) => {
    try {
      rateLimitOrThrow(ipcRateLimiter, 'employee:invoice-extract-path');
      assertNoBlobPayload(raw);
      const p = InvoicePath.parse(raw);
      PathOnlyPayload.parse({ path: p.path });
      const parsed = await parsePdfOffThread({ filePath: p.path });
      let text = '';
      if (parsed.ok && parsed.data && typeof parsed.data === 'object') {
        text = String((parsed.data as { text?: string }).text ?? '');
      }
      if ((!text || text.length < 40) && p.ocrFallback !== false) {
        const ocr = await ocrOffThread({ filePath: p.path });
        if (ocr.ok && ocr.data && typeof ocr.data === 'object') {
          const ocrText = String((ocr.data as { text?: string }).text ?? '');
          if (ocrText.length > text.length) text = ocrText;
        }
      }
      if (!text.trim()) {
        return { ok: false, reason: 'Kein Text aus PDF/OCR — Datei prüfen' };
      }
      return extractInvoiceFromText(text);
    } catch (err: unknown) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('employee:invoice-preview', (_e, raw: unknown) => {
    try {
      const blocked = dryRunBlock('invoice-preview-booking');
      if (blocked.blocked) return { ok: true, dryRun: true, preview: blocked.reason };
      const inv = raw as Parameters<typeof previewBooking>[0];
      return previewBooking(inv);
    } catch (err: unknown) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('employee:calendar-propose', (_e, raw: unknown) => {
    try {
      rateLimitOrThrow(ipcRateLimiter, 'employee:calendar-propose');
      const blocked = dryRunBlock('calendar-insert');
      if (blocked.blocked) return { ok: true, dryRun: true, proposal: blocked.reason };
      const p = CalendarPropose.parse(raw);
      return proposeCalendarInsert(p, p.existing ?? []);
    } catch (err: unknown) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('employee:calendar-status', () => {
    return calendarOAuthStatus(getDecryptedKey('GOOGLE_CALENDAR_TOKEN'));
  });

  ipcMain.handle('employee:shop-refund-draft', (_e, raw: unknown) => {
    try {
      const blocked = dryRunBlock('shop-refund');
      if (blocked.blocked) return { ok: true, dryRun: true, draft: blocked.reason };
      return draftShopRefund(ShopRefund.parse(raw));
    } catch (err: unknown) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('employee:shop-social-draft', (_e, raw: unknown) => {
    try {
      return draftSocialPost(ShopSocial.parse(raw));
    } catch (err: unknown) {
      return { ok: false, reason: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('employee:shop-list', () => {
    return listProductsShell(Boolean(getDecryptedKey('COMPOSIO_API_KEY')));
  });
}
