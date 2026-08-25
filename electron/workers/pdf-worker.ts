/**
 * Worker thread entry — PDF parse / OCR / embed.
 * Compiled to dist-electron/workers/pdf-worker.js
 */
// @ts-nocheck

import { parentPort, workerData } from 'node:worker_threads';
import * as fs from 'node:fs';

interface WorkerJob {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
}

async function parsePdf(
  payload: Record<string, unknown>,
): Promise<{ text: string; engine: string; pages?: number }> {
  const filePath = typeof payload.filePath === 'string' ? payload.filePath : '';
  const inlineText = String(payload.text ?? '');

  if (filePath && fs.existsSync(filePath) && /\.pdf$/i.test(filePath)) {
    try {
      // pdf-parse v2
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require('pdf-parse') as {
        PDFParse: new (opts: { data: Buffer }) => {
          getText: () => Promise<{ text?: string; total?: number }>;
          destroy?: () => Promise<void>;
        };
      };
      const data = fs.readFileSync(filePath);
      const parser = new PDFParse({ data });
      const result = await parser.getText();
      await parser.destroy?.();
      const text = String(result.text ?? '').slice(0, 100_000);
      return { text, engine: 'pdf-parse', pages: result.total };
    } catch (err: unknown) {
      return {
        text: inlineText.slice(0, 100_000),
        engine: `pdf-parse-failed:${String((err as Error)?.message ?? err).slice(0, 80)}`,
      };
    }
  }

  if (filePath && fs.existsSync(filePath) && /\.(txt|md|csv)$/i.test(filePath)) {
    return { text: fs.readFileSync(filePath, 'utf8').slice(0, 100_000), engine: 'text-file' };
  }

  return { text: inlineText.slice(0, 100_000), engine: inlineText ? 'inline-text' : 'empty' };
}

async function runOcr(payload: Record<string, unknown>): Promise<{ text: string; engine: string }> {
  const filePath = typeof payload.filePath === 'string' ? payload.filePath : '';
  if (!filePath || !fs.existsSync(filePath)) {
    return { text: '', engine: 'ocr-no-path' };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Tesseract = require('tesseract.js') as {
      recognize: (img: string, lang: string) => Promise<{ data: { text: string } }>;
    };
    const lang = String(payload.lang ?? 'deu+eng');
    const result = await Tesseract.recognize(filePath, lang);
    return { text: String(result.data.text ?? '').slice(0, 100_000), engine: 'tesseract.js' };
  } catch (err: unknown) {
    return {
      text: '',
      engine: `tesseract-failed:${String((err as Error)?.message ?? err).slice(0, 80)}`,
    };
  }
}

async function handle(job: WorkerJob): Promise<{ id: string; ok: boolean; data?: unknown; error?: string }> {
  switch (job.kind) {
    case 'pdf-parse': {
      const data = await parsePdf(job.payload);
      return { id: job.id, ok: true, data };
    }
    case 'ocr': {
      const data = await runOcr(job.payload);
      return { id: job.id, ok: true, data };
    }
    case 'embed':
      return { id: job.id, ok: true, data: { dims: 384, stub: true } };
    default:
      return { id: job.id, ok: false, error: `Unknown kind: ${job.kind}` };
  }
}

if (parentPort) {
  const job = (workerData as { job: WorkerJob }).job;
  void handle(job).then((msg) => parentPort!.postMessage(msg));
}
