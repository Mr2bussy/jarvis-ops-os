// @ts-nocheck
import { useMemo, useState } from 'react';
import { HoloPanel } from '../components/primitives';
import { ScreenHeader } from '../components/shell';
import { CYAN, CYAN_BRIGHT, AMBER, JADE, ROSE } from '../theme';
import {
  planMirror,
  planTotals,
  dailyLossHeadroom,
  totalLossHeadroom,
  type PropAccount,
  type OriginFill,
  type MirrorPlan,
} from '../lib/prop-accounts';

/**
 * Prop Maxing — mirror the desk you trade onto every connected prop account.
 *
 * The screen exists to make one thing impossible to miss: **lot size is not
 * copied**. The plan below always shows, per account, what fraction of *that*
 * account's equity is at risk and which limit decided the size. An operator who
 * cannot see why an account got 0.34 lots instead of 1.00 will eventually
 * override it, and that override is what fails an evaluation.
 *
 * Nothing here places an order. It renders the plan; execution goes through the
 * MT5 bridge behind the harness risk gate, which asks first.
 */

const LS_KEY = 'jarvis.propAccounts';

/** Empty roster until the operator adds real accounts. No demo equity. */
function seedAccounts(): PropAccount[] {
  return [];
}

function loadAccounts(): PropAccount[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return seedAccounts();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as PropAccount[]) : seedAccounts();
  } catch {
    return seedAccounts();
  }
}

const eur = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toFixed(2)} %`;
const inputStyle = {
  padding: '6px 8px',
  fontSize: 9,
  color: 'var(--fg)',
  background: 'oklch(0.07 0.014 240 / 0.7)',
  border: `1px solid ${CYAN}55`,
  outline: 'none',
  minWidth: 0,
  letterSpacing: '0.08em',
} as const;

const EMPTY_PLAN: MirrorPlan = {
  orders: [],
  skipped: [],
  assumptions: [
    'Kein Origin-Fill geladen — Mirror-Plan bleibt leer, bis ein realer oder manuell bestätigter Fill eingetragen ist.',
  ],
};

export default function PropMaxingScreen() {
  const [accounts, setAccounts] = useState<PropAccount[]>(loadAccounts);
  const [inNews, setInNews] = useState(false);
  const [ackCopy, setAckCopy] = useState(false);
  const [fillDraft, setFillDraft] = useState({
    symbol: '',
    side: 'BUY' as OriginFill['side'],
    lots: '',
    entryPrice: '',
    stopPrice: '',
    moneyRiskPerLotAtStop: '',
    takeProfitPrice: '',
  });

  function persist(next: PropAccount[]) {
    setAccounts(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked — the plan still works from memory */
    }
  }

  function toggle(id: string) {
    persist(accounts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }

  function makeOrigin(id: string) {
    // Exactly one origin: the risk reference has to be unambiguous.
    persist(accounts.map((a) => ({ ...a, role: a.id === id ? 'origin' : 'follower' })));
  }

  const fill = useMemo<OriginFill | null>(() => {
    const symbol = fillDraft.symbol.trim().toUpperCase();
    const lots = Number(fillDraft.lots);
    const entryPrice = Number(fillDraft.entryPrice);
    const stopPrice = Number(fillDraft.stopPrice);
    const moneyRiskPerLotAtStop = Number(fillDraft.moneyRiskPerLotAtStop);
    const takeProfitPrice = fillDraft.takeProfitPrice.trim() ? Number(fillDraft.takeProfitPrice) : undefined;
    if (!symbol || !(lots > 0) || !(entryPrice > 0) || !(stopPrice > 0) || !(moneyRiskPerLotAtStop > 0))
      return null;
    return {
      symbol,
      side: fillDraft.side,
      lots,
      entryPrice,
      stopPrice,
      moneyRiskPerLotAtStop,
      takeProfitPrice: takeProfitPrice && takeProfitPrice > 0 ? takeProfitPrice : undefined,
      openedAt: new Date().toISOString(),
    };
  }, [fillDraft]);
  const plan = useMemo(
    () =>
      fill
        ? planMirror(fill, accounts, { inNewsWindow: inNews, copyTradingAcknowledged: ackCopy })
        : EMPTY_PLAN,
    [fill, accounts, inNews, ackCopy],
  );
  const totals = useMemo(() => planTotals(plan), [plan]);
  const origin = accounts.find((a) => a.role === 'origin');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <ScreenHeader
        tag="PROP MAXING"
        title={`${accounts.filter((a) => a.role === 'follower').length} FOLLOWER · ${accounts.some((a) => a.role === 'origin') ? 1 : 0} ORIGIN`}
        subtitle="Risikoabsicht spiegeln — nicht die Lotgröße"
        right={
          <span
            className="hud-label"
            style={{
              fontSize: 8.5,
              color: totals.ruleBlocked ? AMBER : JADE,
              border: `1px solid ${totals.ruleBlocked ? AMBER : JADE}55`,
              padding: '2px 7px',
              letterSpacing: '0.2em',
            }}
          >
            {totals.accounts} SPIEGELN · {totals.ruleBlocked} REGEL-STOPP
          </span>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, flex: 1, minHeight: 0 }}>
        {/* ── Accounts ──────────────────────────────────────────────── */}
        <HoloPanel
          label="KONTEN"
          code="PRP-A"
          status="live"
          bodyClassName="nx-scroll"
          bodyStyle={{ overflowY: 'auto' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {accounts.length === 0 && (
              <div
                className="font-mono"
                style={{ fontSize: 10, color: 'var(--cyan-dim)', lineHeight: 1.55, padding: '14px 0' }}
              >
                // keine Konten hinterlegt · keine Demo-Equity. Origin und Follower selbst eintragen.
              </div>
            )}
            {accounts.map((a) => {
              const dayRoom = dailyLossHeadroom(a);
              const totRoom = totalLossHeadroom(a);
              const isOrigin = a.role === 'origin';
              const col = isOrigin ? CYAN_BRIGHT : a.enabled ? 'var(--fg)' : 'var(--cyan-dim)';
              return (
                <div
                  key={a.id}
                  style={{
                    border: `1px solid ${isOrigin ? CYAN : 'var(--line)'}`,
                    borderLeft: `2px solid ${isOrigin ? CYAN : a.enabled ? JADE : 'var(--line)'}`,
                    background: isOrigin ? 'oklch(0.78 0.13 215 / 0.06)' : 'transparent',
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isOrigin && (
                      <span
                        className="hud-label"
                        style={{
                          fontSize: 7,
                          color: CYAN_BRIGHT,
                          border: `1px solid ${CYAN}`,
                          padding: '1px 4px',
                          letterSpacing: '0.16em',
                        }}
                      >
                        ORIGIN · DU HANDELST HIER
                      </span>
                    )}
                    <span className="hud-label" style={{ fontSize: 10, color: col, letterSpacing: '0.14em' }}>
                      {a.label}
                    </span>
                    <span className="font-mono" style={{ fontSize: 8.5, color: 'var(--cyan-dim)' }}>
                      {a.firm}
                    </span>
                    <span style={{ flex: 1 }} />
                    {!isOrigin && (
                      <>
                        <button
                          type="button"
                          onClick={() => makeOrigin(a.id)}
                          className="hud-label"
                          style={{
                            fontSize: 7,
                            color: 'var(--cyan-dim)',
                            border: '1px solid var(--line)',
                            padding: '1px 5px',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          ZUM ORIGIN
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(a.id)}
                          className="hud-label"
                          style={{
                            fontSize: 7,
                            color: a.enabled ? JADE : 'var(--cyan-dim)',
                            border: `1px solid ${a.enabled ? JADE : 'var(--line)'}55`,
                            padding: '1px 5px',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          {a.enabled ? 'AKTIV' : 'AUS'}
                        </button>
                      </>
                    )}
                  </div>

                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}
                  >
                    {[
                      ['KAPITAL', eur(a.equity), col],
                      ['TAGESRAUM', eur(dayRoom), dayRoom <= 0 ? ROSE : 'var(--fg)'],
                      ['GESAMTRAUM', eur(totRoom), totRoom <= 0 ? ROSE : 'var(--fg)'],
                      ['RISIKO/TRADE', pct(a.riskPerTradePct), 'var(--fg)'],
                    ].map(([k, v, c]) => (
                      <div key={k}>
                        <div
                          className="hud-label"
                          style={{ fontSize: 7, color: 'var(--cyan-dim)', letterSpacing: '0.16em' }}
                        >
                          {k}
                        </div>
                        <div
                          className="font-mono"
                          style={{ fontSize: 10.5, color: c as string, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>

                  {(a.rules.copyTradingForbidden ||
                    a.rules.newsWindowBanned ||
                    a.rules.maxLotsPerPosition < 10) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                      {a.rules.copyTradingForbidden && (
                        <span
                          className="hud-label"
                          style={{
                            fontSize: 7,
                            color: ROSE,
                            border: `1px solid ${ROSE}44`,
                            padding: '1px 5px',
                          }}
                        >
                          KOPIEREN UNTERSAGT
                        </span>
                      )}
                      {a.rules.newsWindowBanned && (
                        <span
                          className="hud-label"
                          style={{
                            fontSize: 7,
                            color: AMBER,
                            border: `1px solid ${AMBER}44`,
                            padding: '1px 5px',
                          }}
                        >
                          KEIN NEWS-FENSTER
                        </span>
                      )}
                      {a.rules.maxLotsPerPosition < 10 && (
                        <span
                          className="hud-label"
                          style={{
                            fontSize: 7,
                            color: 'var(--cyan-dim)',
                            border: '1px solid var(--line)',
                            padding: '1px 5px',
                          }}
                        >
                          MAX {a.rules.maxLotsPerPosition} LOTS
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </HoloPanel>

        {/* ── Plan ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <HoloPanel label="ORIGIN-TRADE" code="PRP-T" status={fill ? 'live' : 'queue'}>
            {fill ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="font-display glow-cyan" style={{ fontSize: 17, color: CYAN_BRIGHT }}>
                  {fill.symbol}
                </span>
                <span className="hud-label" style={{ fontSize: 9, color: JADE, letterSpacing: '0.2em' }}>
                  {fill.side}
                </span>
                <span className="font-mono" style={{ fontSize: 9.5, color: 'var(--cyan-dim)' }}>
                  {fill.entryPrice} → SL {fill.stopPrice}
                </span>
              </div>
            ) : (
              <div className="font-mono" style={{ fontSize: 9.5, color: AMBER, lineHeight: 1.5 }}>
                // Kein DEMO_FILL aktiv. Trage den Origin-Fill ein oder verbinde MT5, bevor ein Mirror-Plan
                berechnet wird.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.8fr 0.8fr', gap: 6, marginTop: 10 }}>
              <input
                value={fillDraft.symbol}
                onChange={(e) => setFillDraft((f) => ({ ...f, symbol: e.target.value }))}
                placeholder="SYMBOL"
                className="font-mono"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setFillDraft((f) => ({ ...f, side: f.side === 'BUY' ? 'SELL' : 'BUY' }))}
                className="hud-label"
                style={{ ...inputStyle, color: fillDraft.side === 'BUY' ? JADE : ROSE, cursor: 'pointer' }}
              >
                {fillDraft.side}
              </button>
              <input
                value={fillDraft.lots}
                onChange={(e) => setFillDraft((f) => ({ ...f, lots: e.target.value }))}
                placeholder="LOTS"
                inputMode="decimal"
                className="font-mono"
                style={inputStyle}
              />
              <input
                value={fillDraft.entryPrice}
                onChange={(e) => setFillDraft((f) => ({ ...f, entryPrice: e.target.value }))}
                placeholder="ENTRY"
                inputMode="decimal"
                className="font-mono"
                style={inputStyle}
              />
              <input
                value={fillDraft.stopPrice}
                onChange={(e) => setFillDraft((f) => ({ ...f, stopPrice: e.target.value }))}
                placeholder="STOP"
                inputMode="decimal"
                className="font-mono"
                style={inputStyle}
              />
              <input
                value={fillDraft.moneyRiskPerLotAtStop}
                onChange={(e) => setFillDraft((f) => ({ ...f, moneyRiskPerLotAtStop: e.target.value }))}
                placeholder="RISK/LOT"
                inputMode="decimal"
                className="font-mono"
                style={inputStyle}
              />
              <input
                value={fillDraft.takeProfitPrice}
                onChange={(e) => setFillDraft((f) => ({ ...f, takeProfitPrice: e.target.value }))}
                placeholder="TP OPTIONAL"
                inputMode="decimal"
                className="font-mono"
                style={{ ...inputStyle, gridColumn: '1 / span 3' }}
              />
            </div>
            {origin && (
              <div className="font-mono" style={{ fontSize: 9, color: 'var(--cyan-dim)', marginTop: 6 }}>
                {fill
                  ? `= ${pct((fill.lots * fill.moneyRiskPerLotAtStop) / origin.equity)} von ${eur(origin.equity)} — Risikoabsicht wird gespiegelt, nicht die Lots.`
                  : 'Warte auf Symbol, Lots, Entry, Stop und Risiko/Lot.'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[
                { on: inNews, set: setInNews, label: 'NEWS-FENSTER OFFEN', col: AMBER },
                { on: ackCopy, set: setAckCopy, label: 'KOPIEREN BESTÄTIGT', col: ROSE },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => t.set(!t.on)}
                  className="hud-label"
                  style={{
                    flex: 1,
                    fontSize: 7.5,
                    padding: '5px',
                    letterSpacing: '0.14em',
                    color: t.on ? t.col : 'var(--cyan-dim)',
                    border: `1px solid ${t.on ? t.col : 'var(--line)'}`,
                    background: t.on ? `${t.col}14` : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {t.on ? '◉' : '○'} {t.label}
                </button>
              ))}
            </div>
          </HoloPanel>

          <HoloPanel
            label="SPIEGELPLAN"
            code="PRP-P"
            status={totals.ruleBlocked ? 'warn' : 'live'}
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
            bodyClassName="nx-scroll"
            bodyStyle={{ flex: 1, overflowY: 'auto' }}
          >
            {plan.orders.map((o) => (
              <div
                key={o.accountId}
                style={{ padding: '7px 0', borderBottom: '1px dashed var(--line-soft)' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    className="hud-label"
                    style={{ fontSize: 9, color: 'var(--fg)', letterSpacing: '0.14em', flex: 1 }}
                  >
                    {o.label}
                  </span>
                  <span
                    className="font-mono glow-cyan-sm"
                    style={{ fontSize: 12, color: JADE, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {o.lots.toFixed(2)}
                  </span>
                  <span
                    className="font-mono"
                    style={{ fontSize: 9, color: 'var(--cyan-dim)', width: 52, textAlign: 'right' }}
                  >
                    {pct(o.riskPct)}
                  </span>
                </div>
                <div className="font-mono" style={{ fontSize: 8, color: 'var(--cyan-dim)', marginTop: 2 }}>
                  {o.sizing}
                </div>
              </div>
            ))}

            {plan.skipped.map((s) => (
              <div
                key={s.accountId}
                style={{ padding: '7px 0', borderBottom: '1px dashed var(--line-soft)', opacity: 0.85 }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span
                    className="hud-label"
                    style={{ fontSize: 9, color: 'var(--cyan-dim)', letterSpacing: '0.14em', flex: 1 }}
                  >
                    {s.label}
                  </span>
                  <span
                    className="hud-label"
                    style={{
                      fontSize: 7,
                      color: s.ruleBlocked ? ROSE : AMBER,
                      border: `1px solid ${s.ruleBlocked ? ROSE : AMBER}44`,
                      padding: '1px 5px',
                    }}
                  >
                    {s.ruleBlocked ? 'REGEL' : 'GRÖSSE'}
                  </span>
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 8, color: s.ruleBlocked ? ROSE : AMBER, marginTop: 2, opacity: 0.9 }}
                >
                  {s.reason}
                </div>
              </div>
            ))}

            {plan.orders.length === 0 && plan.skipped.length === 0 && (
              <div
                className="font-mono"
                style={{ fontSize: 9, color: 'var(--cyan-dim)', padding: '14px 0', textAlign: 'center' }}
              >
                // kein Follower-Konto aktiv
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 8 }}>
              {plan.assumptions.map((a, i) => (
                <div
                  key={i}
                  className="font-mono"
                  style={{ fontSize: 8, color: 'var(--cyan-dim)', lineHeight: 1.55 }}
                >
                  // {a}
                </div>
              ))}
            </div>
          </HoloPanel>
        </div>
      </div>
    </div>
  );
}
