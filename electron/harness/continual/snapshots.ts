import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ContinualHarnessState } from '../types';

export function snapshotState(snapshotsDir: string, state: ContinualHarnessState, label: string): string {
  fs.mkdirSync(snapshotsDir, { recursive: true });
  const id = `snap_${Date.now()}_${label.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
  const file = path.join(snapshotsDir, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
  return id;
}

export function restoreSnapshot(snapshotsDir: string, snapshotId: string): ContinualHarnessState | null {
  const file = path.join(snapshotsDir, `${snapshotId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ContinualHarnessState;
}

export function listSnapshots(snapshotsDir: string): string[] {
  if (!fs.existsSync(snapshotsDir)) return [];
  return fs
    .readdirSync(snapshotsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
    .reverse();
}
