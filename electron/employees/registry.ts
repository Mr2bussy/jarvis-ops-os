// @ts-nocheck
import type { Employee, EmployeeHealth, EmployeeTask } from './types';
import { EmailEmployee } from './email-employee';
import { InvoiceEmployee } from './invoice-employee';
import { CalendarEmployee } from './calendar-employee';
import { ShopEmployee } from './shop-employee';
import { isEmployeeKilled } from '../harness/governance/kill-switch';

const employees: Employee[] = [
  new EmailEmployee(),
  new InvoiceEmployee(),
  new CalendarEmployee(),
  new ShopEmployee(),
];

export function listEmployees(): Employee[] {
  return employees;
}

export function getEmployee(id: string): Employee | undefined {
  return employees.find((e) => e.id === id);
}

export async function executeEmployeeTask(
  employeeId: string,
  task: EmployeeTask,
): Promise<ReturnType<Employee['execute']>> {
  const emp = getEmployee(employeeId);
  if (!emp) return { ok: false, reason: `Mitarbeiter „${employeeId}" nicht gefunden` };
  if (isEmployeeKilled(employeeId)) {
    if ('pause' in emp && typeof (emp as { pause?: () => void }).pause === 'function') {
      (emp as { pause: () => void }).pause();
    }
    return { ok: false, reason: `${employeeId} durch Kill-Switch deaktiviert` };
  }
  return emp.execute(task);
}

export function employeeHealthSnapshot(): { id: string; label: string; health: EmployeeHealth }[] {
  return employees.map((e) => ({ id: e.id, label: e.label, health: e.healthCheck() }));
}

export function registerEmployeeCronJobs(onTick: (employeeId: string, cron: string) => void): void {
  for (const e of employees) {
    const cron = e.schedule();
    if (cron) onTick(e.id, cron);
  }
}
