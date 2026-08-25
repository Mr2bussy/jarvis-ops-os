/**
 * Global + per-employee kill switch — Telegram /panic + IPC.
 */
// @ts-nocheck

import { getFeatureFlag, setFeatureFlag } from '../../config/flags';

const killedEmployees = new Set<string>();

export function isGlobalKilled(): boolean {
  return getFeatureFlag('global.killSwitch');
}

export function isEmployeeKilled(employeeId: string): boolean {
  return isGlobalKilled() || killedEmployees.has(employeeId);
}

export function killGlobal(reason = 'operator'): void {
  setFeatureFlag('global.killSwitch', true);
  return void reason;
}

export function resumeGlobal(): void {
  setFeatureFlag('global.killSwitch', false);
}

export function killEmployee(employeeId: string): void {
  killedEmployees.add(employeeId);
}

export function resumeEmployee(employeeId: string): void {
  killedEmployees.delete(employeeId);
}

export function listKilledEmployees(): string[] {
  return [...killedEmployees];
}

/** Parse Telegram /panic command. Returns reply text if handled. */
export function tryPanicCommand(text: string): string | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === '/panic' || trimmed === '/panic all') {
    killGlobal();
    return '🛑 GLOBAL KILL-SWITCH aktiviert — alle Employees pausiert.';
  }
  const m = trimmed.match(/^\/panic\s+(\w+)$/);
  if (m) {
    killEmployee(m[1]);
    return `🛑 Employee „${m[1]}" deaktiviert.`;
  }
  if (trimmed === '/resume' || trimmed === '/resume all') {
    resumeGlobal();
    killedEmployees.clear();
    return '✅ Kill-Switch deaktiviert — Employees wieder aktiv.';
  }
  const r = trimmed.match(/^\/resume\s+(\w+)$/);
  if (r) {
    resumeEmployee(r[1]);
    return `✅ Employee „${r[1]}" wieder aktiv.`;
  }
  return null;
}

export function killSwitchStatus(): {
  global: boolean;
  employees: string[];
} {
  return { global: isGlobalKilled(), employees: listKilledEmployees() };
}
