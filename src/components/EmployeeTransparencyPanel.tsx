// @ts-nocheck
import { useEffect, useState } from 'react';
import { getJarvisBridge } from '../lib/bridge';
import { ErrorBudgetWidget } from './ErrorBudgetWidget';

interface EmployeeHealthRow {
  id: string;
  label: string;
  health: {
    state: string;
    lastRunAt?: string;
    lastError?: string;
    tasksProcessed: number;
  };
}

interface AuditRow {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export function EmployeeTransparencyPanel() {
  const [employees, setEmployees] = useState<EmployeeHealthRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [killSwitch, setKillSwitch] = useState<{ global: boolean; employees: string[] } | null>(null);

  useEffect(() => {
    const bridge = getJarvisBridge() as {
      production?: {
        employeeHealth?: () => Promise<EmployeeHealthRow[]>;
        auditTrail?: (n?: number) => Promise<AuditRow[]>;
        killSwitch?: () => Promise<{ global: boolean; employees: string[] }>;
      };
    };
    if (!bridge?.production) return;
    void bridge.production
      .employeeHealth?.()
      .then(setEmployees)
      .catch(() => {});
    void bridge.production
      .auditTrail?.(20)
      .then(setAudit)
      .catch(() => {});
    void bridge.production
      .killSwitch?.()
      .then(setKillSwitch)
      .catch(() => {});
    const t = setInterval(() => {
      void bridge.production?.employeeHealth?.().then(setEmployees);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.06em' }}>
      <div style={{ marginBottom: 12 }}>
        <ErrorBudgetWidget />
      </div>
      <div style={{ marginBottom: 12, color: 'var(--cyan-dim)' }}>
        TRANSPARENZ — Employee-Status
        {killSwitch?.global ? (
          <span style={{ color: 'var(--rose)', marginLeft: 8 }}>KILL-SWITCH AKTIV</span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
        {employees.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 8px',
              border: '1px solid var(--line-soft)',
            }}
          >
            <span>{e.label}</span>
            <span style={{ color: e.health.state === 'idle' ? 'var(--jade)' : 'var(--amber)' }}>
              {e.health.state} · {e.health.tasksProcessed} Tasks
            </span>
          </div>
        ))}
        {employees.length === 0 ? (
          <div style={{ color: 'var(--cyan-dim)' }}>Keine Employee-Daten — Bridge prüfen</div>
        ) : null}
      </div>
      <div style={{ color: 'var(--cyan-dim)', marginBottom: 6 }}>Letzte 20 Aktionen (Audit)</div>
      <div style={{ maxHeight: 200, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {audit.map((a, i) => (
          <div key={`${a.at}-${i}`} style={{ color: 'var(--fg-dim)', fontSize: 9 }}>
            {a.at.slice(11, 19)} · {a.actor} · {a.action}: {a.detail.slice(0, 60)}
          </div>
        ))}
      </div>
    </div>
  );
}
