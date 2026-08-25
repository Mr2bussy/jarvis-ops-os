// @ts-nocheck
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { isDryRun, dryRunBlock } from './dry-run';
import { initFeatureFlags, setFeatureFlag, resetFeatureFlags } from './flags';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('dry-run', () => {
  const dir = path.join(os.tmpdir(), `jarvis-flags-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(dir, { recursive: true });
    initFeatureFlags(dir);
    resetFeatureFlags();
    delete process.env.JARVIS_DRY_RUN;
  });

  afterEach(() => {
    delete process.env.JARVIS_DRY_RUN;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('env JARVIS_DRY_RUN enables simulation', () => {
    process.env.JARVIS_DRY_RUN = '1';
    expect(isDryRun()).toBe(true);
    expect(dryRunBlock('mt5:order').blocked).toBe(true);
  });

  it('feature flag enables simulation', () => {
    setFeatureFlag('simulation.dryRun', true);
    expect(isDryRun()).toBe(true);
  });

  it('off by default', () => {
    expect(isDryRun()).toBe(false);
    expect(dryRunBlock('x').blocked).toBe(false);
  });
});
