// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { HoloPanel } from '../components/primitives';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE } from '../theme';
import { bridgeUnavailableMessage, getJarvisBridge } from '../lib/bridge';

/**
 * Setup panel for the browser-use sidecar.
 *
 * The capability has three independent prerequisites — Python on PATH, the
 * `browser-use` package, and the sidecar process itself — and any one of them
 * missing produces the same symptom: browser tasks quietly fail. This panel
 * separates them so the operator sees *which* one is missing, and offers the
 * single action that fixes it.
 *
 * Installing mutates the user's Python environment, so it is a button, never
 * something that happens on mount.
 */

type Phase = 'probing' | 'ready' | 'not-installed' | 'offline' | 'installing' | 'error';

interface BridgeState {
  running: boolean;
  installed: boolean;
  detail: string;
  port: number;
}

export function BrowserSetupPanel() {
  const [state, setState] = useState<BridgeState | null>(null);
  const [phase, setPhase] = useState<Phase>('probing');
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const probe = useCallback(async () => {
    const api = getJarvisBridge()?.browser;
    if (!api) {
      setPhase('error');
      setState({ running: false, installed: false, detail: bridgeUnavailableMessage(), port: 1237 });
      return;
    }
    setPhase('probing');
    try {
      const s = await api.status();
      setState(s);
      setPhase(s.running ? (s.installed ? 'ready' : 'not-installed') : 'offline');
    } catch (e: unknown) {
      setState({ running: false, installed: false, detail: String((e as Error)?.message ?? e), port: 1237 });
      setPhase('offline');
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  // Stream pip output so a multi-minute download is visibly progressing.
  useEffect(() => {
    const off = getJarvisBridge()?.browser?.onInstallProgress?.((line) => {
      setLog((prev) => [...prev.slice(-200), line.replace(/\r/g, '').trimEnd()].filter(Boolean));
      requestAnimationFrame(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      });
    });
    return () => off?.();
  }, []);

  async function install() {
    const api = getJarvisBridge()?.browser;
    if (!api?.install || !api.start) {
      setPhase('error');
      setLog((prev) => [...prev, bridgeUnavailableMessage()]);
      return;
    }
    setPhase('installing');
    setLog([]);
    const r = await api.install();
    if (r.ok) {
      setLog((prev) => [...prev, '── Installation abgeschlossen ──']);
      await api.start();
      // Give the sidecar a moment to bind its port before re-probing.
      setTimeout(() => void probe(), 1200);
    } else {
      setLog((prev) => [...prev, `── Fehlgeschlagen (${r.err ?? `Code ${r.code}`}) ──`]);
      setPhase('error');
    }
  }

  async function startBridge() {
    const api = getJarvisBridge()?.browser;
    if (!api?.start) {
      setPhase('error');
      setLog((prev) => [...prev, bridgeUnavailableMessage()]);
      return;
    }
    await api.start();
    setTimeout(() => void probe(), 1200);
  }

  const dot =
    phase === 'ready'
      ? JADE
      : phase === 'installing' || phase === 'probing'
        ? CYAN
        : phase === 'error'
          ? ROSE
          : AMBER;

  const headline: Record<Phase, string> = {
    probing: 'Prüfe Sidecar…',
    ready: 'Bereit',
    'not-installed': 'browser-use nicht installiert',
    offline: 'Sidecar läuft nicht',
    installing: 'Installiere browser-use…',
    error: 'Nicht verfügbar',
  };

  return (
    <HoloPanel
      label="BROWSER-AUTOMATION · BROWSER-USE"
      code="BRW-1"
      status={phase === 'ready' ? 'live' : phase === 'error' ? 'warn' : 'queue'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          className={phase === 'installing' || phase === 'probing' ? 'anim-pulse-soft' : undefined}
          style={{
            width: 7,
            height: 7,
            borderRadius: 99,
            background: dot,
            boxShadow: `0 0 8px ${dot}`,
            flexShrink: 0,
          }}
        />
        <span className="hud-label" style={{ fontSize: 9.5, color: CYAN_BRIGHT, letterSpacing: '0.18em' }}>
          {headline[phase]}
        </span>
        {state && (
          <span className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)', marginLeft: 'auto' }}>
            :{state.port}
          </span>
        )}
      </div>

      {state?.detail && (
        <div
          className="font-mono"
          style={{ fontSize: 8.5, color: 'var(--cyan-dim)', marginBottom: 10, lineHeight: 1.5 }}
        >
          // {state.detail.slice(0, 160)}
        </div>
      )}

      {/* Prerequisite breakdown — the point of the panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
        {[
          { label: 'SIDECAR-PROZESS', ok: Boolean(state?.running) },
          { label: 'PAKET browser-use', ok: Boolean(state?.installed) },
        ].map((row) => (
          <div
            key={row.label}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span
              className="hud-label"
              style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.16em' }}
            >
              {row.label}
            </span>
            <span className="font-mono" style={{ fontSize: 8.5, color: row.ok ? JADE : 'var(--cyan-dim)' }}>
              {row.ok ? '✓ vorhanden' : '○ fehlt'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {/* Stays mounted through 'installing' so the control does not vanish
            mid-run — it just goes inert while pip works. */}
        {(phase === 'not-installed' || phase === 'error' || phase === 'installing') && (
          <button
            type="button"
            onClick={install}
            disabled={phase === 'installing'}
            className="hud-label"
            style={{
              flex: 1,
              padding: '7px',
              fontSize: 8.5,
              color: phase === 'installing' ? 'var(--cyan-dim)' : CYAN_BRIGHT,
              border: `1px solid ${phase === 'installing' ? 'var(--line)' : CYAN}`,
              background: phase === 'installing' ? 'transparent' : 'oklch(0.78 0.13 215 / 0.12)',
              letterSpacing: '0.2em',
              cursor: phase === 'installing' ? 'default' : 'pointer',
            }}
          >
            {phase === 'installing' ? '⋯ Installation läuft' : '⊕ browser-use installieren'}
          </button>
        )}
        {phase === 'offline' && (
          <button
            type="button"
            onClick={startBridge}
            className="hud-label"
            style={{
              flex: 1,
              padding: '7px',
              fontSize: 8.5,
              color: CYAN_BRIGHT,
              border: `1px solid ${CYAN}`,
              background: 'oklch(0.78 0.13 215 / 0.12)',
              letterSpacing: '0.2em',
              cursor: 'pointer',
            }}
          >
            ▶ Sidecar starten
          </button>
        )}
        <button
          type="button"
          onClick={() => void probe()}
          className="hud-label"
          style={{
            padding: '7px 12px',
            fontSize: 8.5,
            color: 'var(--cyan-dim)',
            border: '1px solid var(--line)',
            background: 'transparent',
            letterSpacing: '0.2em',
            cursor: 'pointer',
          }}
        >
          ↻ PRÜFEN
        </button>
      </div>

      {log.length > 0 && (
        <div
          ref={logRef}
          className="nx-scroll font-mono"
          style={{
            marginTop: 10,
            maxHeight: 140,
            overflowY: 'auto',
            fontSize: 8,
            lineHeight: 1.5,
            color: 'var(--cyan-dim)',
            background: 'oklch(0.07 0.014 240 / 0.7)',
            border: '1px solid var(--line)',
            padding: '6px 8px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {log.join('\n')}
        </div>
      )}

      <div
        className="font-mono"
        style={{ fontSize: 8, color: 'var(--cyan-dim)', opacity: 0.6, marginTop: 8, lineHeight: 1.5 }}
      >
        // Browser-Aufgaben laufen über den Harness und passieren dort den Risk-Gate. Aufgaben, die kaufen,
        senden, löschen oder sich anmelden, gelten als unumkehrbar und brauchen Freigabe.
      </div>
    </HoloPanel>
  );
}
