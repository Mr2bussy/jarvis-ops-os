// @ts-nocheck
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RiskClass } from '../types';

export interface GateFingerprint {
  tool: string;
  riskClass: RiskClass;
  /** Stable hash of normalized arguments — not the raw secret-bearing payload. */
  argsKey: string;
}

export interface GateMemoryEntry {
  fingerprint: GateFingerprint;
  approvals: number;
  lastApprovedAt: string;
  autoGreen: boolean;
}

const DEFAULT_AUTO_GREEN_AFTER = 3;

/** Normalize tool args into a stable key for learning — strips volatile fields. */
export function normalizeArgsKey(args: Record<string, unknown>): string {
  const stable: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k === 'timestamp' || k === 'id' || k === 'sessionId') continue;
    stable[k] = typeof v === 'string' ? v.slice(0, 200) : v;
  }
  return JSON.stringify(stable);
}

export function makeFingerprint(
  tool: string,
  riskClass: RiskClass,
  args: Record<string, unknown>,
): GateFingerprint {
  return { tool, riskClass, argsKey: normalizeArgsKey(args) };
}

/**
 * Learns operator approval patterns. After N identical-class approvals the gate
 * auto-greens that fingerprint — never for `destructive` or `trading` mutations.
 */
export class GateMemoryStore {
  private entries = new Map<string, GateMemoryEntry>();
  private readonly path: string;
  private readonly autoGreenAfter: number;

  constructor(baseDir: string, autoGreenAfter = DEFAULT_AUTO_GREEN_AFTER) {
    fs.mkdirSync(baseDir, { recursive: true });
    this.path = path.join(baseDir, 'gate-memory.json');
    this.autoGreenAfter = autoGreenAfter;
    this.load();
  }

  private key(fp: GateFingerprint): string {
    return `${fp.tool}|${fp.riskClass}|${fp.argsKey}`;
  }

  private load(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.path, 'utf8')) as GateMemoryEntry[];
      for (const e of raw) this.entries.set(this.key(e.fingerprint), e);
    } catch {
      this.entries.clear();
    }
  }

  private persist(): void {
    fs.writeFileSync(this.path, JSON.stringify([...this.entries.values()], null, 2), 'utf8');
  }

  /** Destructive and trading mutations never auto-green — always require HITL. */
  private canAutoGreen(riskClass: RiskClass): boolean {
    return riskClass !== 'destructive' && riskClass !== 'trading';
  }

  isAutoGreen(fp: GateFingerprint): boolean {
    if (!this.canAutoGreen(fp.riskClass)) return false;
    const e = this.entries.get(this.key(fp));
    return e?.autoGreen === true;
  }

  recordApproval(fp: GateFingerprint): GateMemoryEntry {
    const k = this.key(fp);
    const prev = this.entries.get(k);
    const approvals = (prev?.approvals ?? 0) + 1;
    const autoGreen = this.canAutoGreen(fp.riskClass) && approvals >= this.autoGreenAfter;
    const entry: GateMemoryEntry = {
      fingerprint: fp,
      approvals,
      lastApprovedAt: new Date().toISOString(),
      autoGreen,
    };
    this.entries.set(k, entry);
    this.persist();
    return entry;
  }

  list(): GateMemoryEntry[] {
    return [...this.entries.values()];
  }
}
