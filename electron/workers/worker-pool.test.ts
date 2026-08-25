/**
 * Worker pool tests + inline fallback guarantees.
 */
// @ts-nocheck

import { describe, it, expect } from 'vitest';
import { enqueueWorkerJob } from './worker-pool';

describe('worker-pool', () => {
  it('returns inline fallback for pdf-parse when worker script missing', async () => {
    const r = await enqueueWorkerJob({
      id: 'j1',
      kind: 'pdf-parse',
      payload: { text: 'Hello PDF' },
    });
    expect(r.id).toBe('j1');
    expect(r.ok).toBe(true);
    expect(r.data).toBeTruthy();
  });

  it('returns embed stub via pool', async () => {
    const r = await enqueueWorkerJob({
      id: 'j2',
      kind: 'embed',
      payload: { text: 'semantic' },
    });
    expect(r.ok).toBe(true);
  });
});
