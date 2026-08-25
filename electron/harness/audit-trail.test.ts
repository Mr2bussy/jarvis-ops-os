// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { appendAudit, initAuditTrail, verifyAuditChain, closeAuditTrail } from './governance/audit-trail';

describe('audit trail hash chain', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-audit-'));
    initAuditTrail(tmp);
  });

  afterEach(() => {
    closeAuditTrail();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('appends entries with valid chain', () => {
    appendAudit('harness', 'hitl-approve', 'gate-123');
    appendAudit('employee', 'email-classify', 'mail-456');
    expect(verifyAuditChain().ok).toBe(true);
  });
});
