// @ts-nocheck
import { ROSE, AMBER } from '../theme';

/**
 * Warnband when the main process served an offlineJarvisReply fallback — not a live model.
 */
export function DegradedBanner({ reason }: { reason?: string }) {
  return (
    <div
      role="alert"
      className="font-mono"
      style={{
        padding: '8px 12px',
        marginBottom: 8,
        fontSize: 10,
        lineHeight: 1.45,
        color: ROSE,
        background: 'oklch(0.66 0.20 22 / 0.12)',
        border: `1px solid ${ROSE}66`,
        letterSpacing: '0.06em',
      }}
    >
      <span
        className="hud-label"
        style={{ fontSize: 8, color: AMBER, letterSpacing: '0.28em', marginRight: 8 }}
      >
        DEGRADED
      </span>
      Kein LLM-Anbieter erreichbar — Offline-Antwort, kein Live-Modell.
      {reason ? (
        <span style={{ display: 'block', marginTop: 4, color: 'var(--fg-dim)', fontSize: 9 }}>
          {reason.slice(0, 220)}
        </span>
      ) : null}
    </div>
  );
}
