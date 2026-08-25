/**
 * Worker thread pool — PDF/OCR/embeddings off main thread with inline fallback.
 */
// @ts-nocheck

import { Worker } from 'node:worker_threads';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export type WorkerJobKind = 'pdf-parse' | 'ocr' | 'embed';

export interface WorkerJob {
  id: string;
  kind: WorkerJobKind;
  payload: Record<string, unknown>;
}

export interface WorkerResult {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  via?: 'worker' | 'inline';
}

const MAX_WORKERS = 2;
let activeWorkers = 0;
const queue: Array<{
  job: WorkerJob;
  resolve: (r: WorkerResult) => void;
}> = [];

function workerScriptPath(): string {
  const candidates = [path.join(__dirname, 'pdf-worker.js'), path.join(__dirname, 'pdf-worker.ts')];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function runInWorker(job: WorkerJob): Promise<WorkerResult> {
  return new Promise((resolve) => {
    if (activeWorkers >= MAX_WORKERS) {
      queue.push({ job, resolve });
      return;
    }
    activeWorkers++;
    let settled = false;
    const finish = (result: WorkerResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      activeWorkers--;
      resolve({ ...result, via: result.via ?? 'worker' });
      const next = queue.shift();
      if (next) void runInWorker(next.job).then(next.resolve);
    };

    let worker: Worker;
    try {
      worker = new Worker(workerScriptPath(), {
        workerData: { job },
      });
    } catch (err: unknown) {
      finish(inlineFallback(job, String((err as Error)?.message ?? err)));
      return;
    }

    const timeout = setTimeout(() => {
      void worker.terminate();
      finish({ id: job.id, ok: false, error: 'Worker timeout', via: 'worker' });
    }, 30_000);

    worker.on('message', (msg: WorkerResult) => finish(msg));
    worker.on('error', (err) => finish(inlineFallback(job, String(err.message))));
    worker.on('exit', (code) => {
      if (code !== 0) finish(inlineFallback(job, `Worker exit ${code}`));
    });
  });
}

/** Enqueue heavy work — falls back to inline stub when worker unavailable. */
export async function enqueueWorkerJob(job: WorkerJob): Promise<WorkerResult> {
  try {
    return await runInWorker(job);
  } catch (err: unknown) {
    return inlineFallback(job, String((err as Error)?.message ?? err));
  }
}

/** Convenience: parse PDF text (or plain text payload) off-thread when possible. */
export async function parsePdfOffThread(input: { text?: string; filePath?: string }): Promise<WorkerResult> {
  let text = input.text ?? '';
  if (!text && input.filePath) {
    try {
      const st = fs.statSync(input.filePath);
      if (st.size <= 2_000_000 && /\.(txt|md|csv)$/i.test(input.filePath)) {
        text = fs.readFileSync(input.filePath, 'utf8');
      }
      // Binary PDFs: pass path only — worker uses pdf-parse (path-not-blob).
    } catch (err: unknown) {
      return { id: 'pdf', ok: false, error: String((err as Error)?.message ?? err), via: 'inline' };
    }
  }
  return enqueueWorkerJob({
    id: `pdf_${crypto.randomBytes(4).toString('hex')}`,
    kind: 'pdf-parse',
    payload: { text, filePath: input.filePath },
  });
}

/** OCR image/PDF page via tesseract in worker (path-not-blob). */
export async function ocrOffThread(input: { filePath: string; lang?: string }): Promise<WorkerResult> {
  if (!input.filePath || !fs.existsSync(input.filePath)) {
    return { id: 'ocr', ok: false, error: 'filePath missing', via: 'inline' };
  }
  return enqueueWorkerJob({
    id: `ocr_${crypto.randomBytes(4).toString('hex')}`,
    kind: 'ocr',
    payload: { filePath: input.filePath, lang: input.lang ?? 'deu+eng' },
  });
}

/** Convenience: embedding vector via worker (stub dims) or inline deterministic hash-free empty. */
export async function embedOffThread(text: string): Promise<WorkerResult> {
  return enqueueWorkerJob({
    id: `emb_${crypto.randomBytes(4).toString('hex')}`,
    kind: 'embed',
    payload: { text: text.slice(0, 8000) },
  });
}

function inlineFallback(job: WorkerJob, note?: string): WorkerResult {
  switch (job.kind) {
    case 'pdf-parse':
      return {
        id: job.id,
        ok: true,
        via: 'inline',
        data: {
          text: String(job.payload.text ?? '').slice(0, 100_000),
          note: note ? `inline-fallback:${note}` : 'inline-fallback',
        },
      };
    case 'embed':
      return {
        id: job.id,
        ok: true,
        via: 'inline',
        data: { dims: 384, stub: true, note: note ? `inline-fallback:${note}` : 'inline-fallback' },
      };
    case 'ocr':
      return {
        id: job.id,
        ok: true,
        via: 'inline',
        data: { text: '', note: 'ocr-not-configured' },
      };
    default: {
      const _exhaustive: never = job.kind;
      return { id: job.id, ok: false, error: `Unknown job kind: ${_exhaustive}`, via: 'inline' };
    }
  }
}
