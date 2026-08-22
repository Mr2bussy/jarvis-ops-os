export interface ActivityEntry {
  ts: number;
  who: string;
  action: string;
  target: string;
}

const MAX = 200;

/** Process-local activity ring for Bridge ticker and audit trail. */
export class ActivityRing {
  private entries: ActivityEntry[] = [];

  push(who: string, action: string, target: string): ActivityEntry {
    const entry: ActivityEntry = { ts: Date.now(), who, action, target };
    this.entries.push(entry);
    if (this.entries.length > MAX) this.entries.shift();
    return entry;
  }

  recent(limit = 50): ActivityEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  clear(): void {
    this.entries = [];
  }

  size(): number {
    return this.entries.length;
  }
}
