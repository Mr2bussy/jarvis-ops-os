// @ts-nocheck
import type { EmployeeResult, InvoiceExtract } from './types';

/** Extract invoice fields from plain PDF text (OCR output or copy-paste). No fake numbers. */
export function extractInvoiceFromText(rawText: string): EmployeeResult<{ invoice: InvoiceExtract }> {
  const text = rawText.trim();
  if (text.length < 20) return { ok: false, reason: 'Zu wenig Text für Rechnungsextraktion' };

  const amountMatch =
    text.match(/(?:summe|total|betrag|amount)[:\s]*([0-9]+[.,][0-9]{2})\s*(EUR|€|USD|\$)?/i) ??
    text.match(/([0-9]+[.,][0-9]{2})\s*(EUR|€)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : NaN;

  const vendorMatch = text.match(/(?:rechnung von|vendor|lieferant|from)[:\s]*(.{3,60})/i);
  const vendor = vendorMatch?.[1]?.trim() ?? 'Unbekannt';

  const dateMatch =
    text.match(/(?:rechnungsdatum|invoice date|datum)[:\s]*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})/i) ??
    text.match(/([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4})/);
  const invoiceDate = dateMatch?.[1] ?? '';

  const ibanMatch = text.match(/\b([A-Z]{2}[0-9]{2}[A-Z0-9]{11,30})\b/);
  const vatMatch = text.match(/(?:ust|vat|uid)[:\s#]*([A-Z]{2}[0-9A-Z+/]{8,14})/i);

  const notes: string[] = [];
  if (!Number.isFinite(amount)) notes.push('Betrag nicht erkannt — manuelle Prüfung nötig');
  if (!invoiceDate) notes.push('Rechnungsdatum nicht erkannt');
  if (!ibanMatch) notes.push('IBAN nicht gefunden');

  const plausibility: InvoiceExtract['plausibility'] =
    Number.isFinite(amount) && invoiceDate && vendor !== 'Unbekannt'
      ? 'ok'
      : Number.isFinite(amount) || invoiceDate
        ? 'review'
        : 'reject';

  return {
    ok: true,
    invoice: {
      vendor,
      amount: Number.isFinite(amount) ? amount : 0,
      currency: amountMatch?.[2]?.replace('€', 'EUR') ?? 'EUR',
      invoiceDate,
      iban: ibanMatch?.[1],
      vatId: vatMatch?.[1],
      rawText: text.slice(0, 8000),
      plausibility,
      notes,
    },
  };
}

/** Booking preview — always gated; no API call in scaffold. */
export function previewBooking(invoice: InvoiceExtract): EmployeeResult<{ preview: string }> {
  if (invoice.plausibility === 'reject') {
    return { ok: false, reason: 'Rechnung nicht plausibel genug für Buchungsvorschau' };
  }
  const preview = [
    `Buchungsvorschau (nicht gebucht):`,
    `Lieferant: ${invoice.vendor}`,
    `Betrag: ${invoice.amount.toFixed(2)} ${invoice.currency}`,
    `Datum: ${invoice.invoiceDate || '—'}`,
    invoice.iban ? `IBAN: ${invoice.iban}` : '',
    '',
    '→ Freigabe erforderlich vor sevDesk/Lexoffice/DATEV API.',
  ]
    .filter(Boolean)
    .join('\n');
  return { ok: true, preview };
}
