import type { PendingApproval } from '../types';

export class HitlQueue {
  private pending = new Map<string, PendingApproval>();

  create(reason: string, payload: Record<string, unknown>): PendingApproval {
    const id = `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry: PendingApproval = {
      id,
      createdAt: new Date().toISOString(),
      reason,
      payload,
      resolved: false,
    };
    this.pending.set(id, entry);
    return entry;
  }

  resolve(id: string, approved: boolean): PendingApproval | null {
    const entry = this.pending.get(id);
    if (!entry || entry.resolved) return null;
    entry.resolved = true;
    entry.approved = approved;
    return entry;
  }

  get(id: string): PendingApproval | undefined {
    return this.pending.get(id);
  }

  listPending(): PendingApproval[] {
    return [...this.pending.values()].filter((p) => !p.resolved);
  }

  clearResolved(): void {
    for (const [id, p] of this.pending) {
      if (p.resolved) this.pending.delete(id);
    }
  }

  /** Poll until operator resolves, timeout, or entry missing. */
  async waitForResolution(id: string, timeoutMs: number, pollMs = 300): Promise<boolean | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const entry = this.pending.get(id);
      if (!entry) return null;
      if (entry.resolved) return entry.approved === true;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return null;
  }
}
