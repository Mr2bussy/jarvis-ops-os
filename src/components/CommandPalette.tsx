// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';

interface Command {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
}

interface Props {
  commands: Command[];
}

export function CommandPalette({ commands }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = commands.filter((c) => !q || c.label.toLowerCase().includes(q) || c.id.includes(q));

  return (
    <div
      role="dialog"
      aria-label="Befehls-Palette"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'oklch(0.05 0.01 240 / 0.75)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: 'min(520px, 92vw)',
          background: 'oklch(0.08 0.015 240)',
          border: '1px solid var(--line)',
          boxShadow: '0 24px 48px oklch(0 0 0 / 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Befehl suchen… (Ctrl+K)"
          className="font-mono"
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: 13,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--line-soft)',
            color: 'var(--fg)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 320, overflow: 'auto' }}>
          {filtered.map((cmd) => (
            <li key={cmd.id}>
              <button
                type="button"
                className="font-mono"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--fg)',
                  cursor: 'pointer',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                }}
                onClick={() => {
                  cmd.action();
                  setOpen(false);
                  setQuery('');
                }}
              >
                {cmd.label}
                {cmd.hint ? (
                  <span style={{ color: 'var(--cyan-dim)', marginLeft: 8, fontSize: 9 }}>{cmd.hint}</span>
                ) : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="font-mono" style={{ padding: 16, fontSize: 10, color: 'var(--cyan-dim)' }}>
              Keine Treffer
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
