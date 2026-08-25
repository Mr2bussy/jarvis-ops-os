// @ts-nocheck
/**
 * Terminal grid widgets — extracted from TradingContent (D6).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { HoloPanel, Sparkline, Stat } from '../../components/primitives';
import { CYAN, CYAN_BRIGHT, AMBER, ROSE, JADE, VIOLET, colorFor } from '../../theme';
import {
  useZeusCandles,
  useZeusBook,
  useZeusCVD,
  useZeusSwaps,
  useZeusTickers,
  useZeusLiquidityMap,
  useZeusCorrelation,
  useFearGreed,
  useDeribitOptionsTrades,
  useDeribitOptionsData,
  useTreasuryYieldCurve,
  statusColor,
  statusLabel,
  type DataStatus,
} from '../../lib/trading-data';
import { WIDGET_REGISTRY, type WidgetId, type PosRow } from './ZeusBotPanel';

function rnd(lo: number, hi: number, d = 2) {
  return +(Math.random() * (hi - lo) + lo).toFixed(d);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 1 — PRICE CHART (LIVE · Binance REST klines)
   ══════════════════════════════════════════════════════════════════ */
function WPriceChart({
  connected,
  symbol = 'BTCUSD',
}: {
  connected: boolean;
  livePrice?: number;
  symbol?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tf, setTf] = useState<'1m' | '3m' | '5m' | '15m' | '1h'>('3m');
  const [ind, setInd] = useState<'EMA' | 'VWAP' | 'BB'>('EMA');
  const { candles, status, lastPrice } = useZeusCandles(
    symbol,
    tf === '1m' ? 'M1' : tf === '3m' ? 'M5' : tf === '5m' ? 'M5' : tf === '15m' ? 'M15' : 'H1',
    80,
  );
  const change24h =
    candles.length >= 2 ? ((candles[candles.length - 1].c - candles[0].o) / candles[0].o) * 100 : 0;

  useEffect(() => {
    const cv = ref.current;
    if (!cv || candles.length === 0) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width,
      H = cv.height;
    const PR = 64,
      PT = 8,
      PB = 32,
      PL = 6;
    const pW = W - PR - PL,
      pH = H - PT - PB;
    const lows = candles.map((c) => c.l),
      highs = candles.map((c) => c.h);
    const lo = Math.min(...lows),
      hi = Math.max(...highs),
      rng = hi - lo || 1;
    const toY = (v: number) => PT + (1 - (v - lo) / rng) * pH;
    const cSp = pW / candles.length,
      cW = cSp * 0.62;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04070f');
    bg.addColorStop(1, '#020408');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // grid + price axis
    for (let i = 0; i <= 5; i++) {
      const y = PT + (i / 5) * pH;
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PL, y);
      ctx.lineTo(PL + pW, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font = '8px monospace';
      ctx.fillText('$' + (hi - (i / 5) * rng).toFixed(0), PL + pW + 2, y + 3);
    }
    // time axis — show candle timestamp labels
    candles.forEach((c, i) => {
      if (i % Math.max(1, Math.floor(candles.length / 5)) !== 0) return;
      const t = new Date(c.time);
      const label =
        t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0');
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = '7px monospace';
      ctx.fillText(label, PL + i * cSp, H - 2);
    });
    // EMA
    if (ind === 'EMA') {
      [
        [9, '#00e5ffaa'],
        [21, '#ffb300aa'],
      ].forEach(([per, col]) => {
        const k = 2 / (+per + 1);
        let e = candles[0].c;
        ctx.beginPath();
        ctx.strokeStyle = col as string;
        ctx.lineWidth = 1.2;
        candles.forEach((c, i) => {
          e = c.c * k + e * (1 - k);
          const x = PL + i * cSp + cSp / 2;
          if (i === 0) ctx.moveTo(x, toY(e));
          else ctx.lineTo(x, toY(e));
        });
        ctx.stroke();
      });
    }
    // VWAP
    if (ind === 'VWAP') {
      let cumPV = 0,
        cumV = 0;
      ctx.beginPath();
      ctx.strokeStyle = '#e879f9cc';
      ctx.lineWidth = 1.5;
      candles.forEach((c, i) => {
        const typ = (c.h + c.l + c.c) / 3;
        cumPV += typ * c.v;
        cumV += c.v;
        const v = cumPV / cumV;
        const x = PL + i * cSp + cSp / 2;
        if (i === 0) ctx.moveTo(x, toY(v));
        else ctx.lineTo(x, toY(v));
      });
      ctx.stroke();
    }
    // BB
    if (ind === 'BB') {
      const closes = candles.map((c) => c.c),
        per = 20;
      const sma: number[] = [],
        upper: number[] = [],
        lower: number[] = [];
      for (let i = 0; i < closes.length; i++) {
        const sl = closes.slice(Math.max(0, i - per + 1), i + 1);
        const m = sl.reduce((a, b) => a + b, 0) / sl.length;
        const sd = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / sl.length);
        sma.push(m);
        upper.push(m + 2 * sd);
        lower.push(m - 2 * sd);
      }
      const drawLine = (arr: number[], col: string, dash: number[]) => {
        ctx.beginPath();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.setLineDash(dash);
        arr.forEach((v, i) => {
          const x = PL + i * cSp + cSp / 2;
          if (i === 0) ctx.moveTo(x, toY(v));
          else ctx.lineTo(x, toY(v));
        });
        ctx.stroke();
        ctx.setLineDash([]);
      };
      drawLine(sma, '#ffb30099', []);
      drawLine(upper, '#00e5ff66', [2, 2]);
      drawLine(lower, '#00e5ff66', [2, 2]);
    }
    // candles
    candles.forEach((c, i) => {
      const x = PL + i * cSp,
        up = c.c >= c.o,
        col = up ? '#00d084' : '#ff1a6b';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + cW / 2, toY(c.h));
      ctx.lineTo(x + cW / 2, toY(c.l));
      ctx.stroke();
      ctx.fillStyle = up ? col + 'bb' : col + 'ee';
      ctx.fillRect(x, toY(Math.max(c.o, c.c)), cW, Math.max(1, Math.abs(toY(c.o) - toY(c.c))));
    });
    // volume bars
    const maxV = Math.max(...candles.map((c) => c.v), 1);
    candles.forEach((c, i) => {
      const up = c.c >= c.o;
      ctx.fillStyle = (up ? '#00d084' : '#ff1a6b') + '44';
      ctx.fillRect(PL + i * cSp, H - PB - (c.v / maxV) * 22, cSp - 1, (c.v / maxV) * 22);
    });
    // price tag
    const last = candles[candles.length - 1].c,
      ly = toY(last);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#ff1a6b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PL, ly);
    ctx.lineTo(PL + pW, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff1a6b';
    ctx.fillRect(PL + pW, ly - 8, PR - 1, 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8.5px monospace';
    ctx.fillText('$' + last.toFixed(1), PL + pW + 2, ly + 4);
    if (!connected) {
      ctx.fillStyle = 'rgba(0,208,132,0.08)';
      ctx.fillRect(PL + 3, H - PB - 13, 82, 11);
      ctx.fillStyle = '#00d08488';
      ctx.font = '7.5px monospace';
      ctx.fillText('LIVE·BINANCE', PL + 5, H - PB - 3);
    }
  }, [candles, ind]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#04070f',
        border: '1px solid #ff1a6b30',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 7px',
          borderBottom: '1px solid #ff1a6b20',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#ff1a6b', letterSpacing: '0.22em' }}>
          {symbol.replace(/([A-Z]{2,5})(USD)$/, '$1/$2')}
        </span>
        <span className="font-display" style={{ fontSize: 14, color: '#fff', letterSpacing: '-0.02em' }}>
          $
          {lastPrice > 0
            ? lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '...'}
        </span>
        <span className="font-mono" style={{ fontSize: 8, color: change24h >= 0 ? '#00d084' : '#ff1a6b' }}>
          {change24h >= 0 ? '+' : ''}
          {change24h.toFixed(2)}%
        </span>
        <span className="font-mono" style={{ fontSize: 7, marginLeft: 4, color: statusColor(status) }}>
          {statusLabel(status)}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {(['1m', '3m', '5m', '15m', '1h'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className="hud-label"
              style={{
                padding: '1px 4px',
                fontSize: 7,
                border: `1px solid ${tf === t ? '#ff1a6b' : 'rgba(255,255,255,0.08)'}`,
                background: tf === t ? '#ff1a6b14' : 'transparent',
                color: tf === t ? '#ff1a6b' : 'rgba(255,255,255,0.35)',
                cursor: 'pointer',
                letterSpacing: '0.08em',
              }}
            >
              {t}
            </button>
          ))}
          {(['EMA', 'VWAP', 'BB'] as const).map((i) => (
            <button
              key={i}
              onClick={() => setInd(i)}
              className="hud-label"
              style={{
                padding: '1px 4px',
                fontSize: 7,
                border: `1px solid ${ind === i ? '#00e5ff' : 'rgba(255,255,255,0.08)'}`,
                background: ind === i ? '#00e5ff14' : 'transparent',
                color: ind === i ? '#00e5ff' : 'rgba(255,255,255,0.35)',
                cursor: 'pointer',
                letterSpacing: '0.08em',
              }}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: 9, color: '#00e5ff' }}>
            FETCHING LIVE DATA...
          </span>
        </div>
      )}
      {status !== 'loading' && (
        <canvas ref={ref} width={640} height={220} style={{ width: '100%', flex: 1, display: 'block' }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 2 — ORDER BOOK L2
   ══════════════════════════════════════════════════════════════════ */
function WOrderBook({ symbol = 'BTCUSD' }: { symbol?: string } = {}) {
  const { book, status } = useZeusBook(symbol, 14);
  if (!book)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#04090e',
          border: '1px solid #00d08432',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="font-mono" style={{ fontSize: 9, color: statusColor(status) }}>
          {statusLabel(status)}
        </span>
      </div>
    );
  const askCum: number[] = [],
    bidCum: number[] = [];
  let ca = 0,
    cb = 0;
  book.asks.forEach((a) => {
    ca += a.s;
    askCum.push(ca);
  });
  book.bids.forEach((b) => {
    cb += b.s;
    bidCum.push(cb);
  });
  const maxCum = Math.max(ca, cb);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#04090e',
        border: '1px solid #00d08432',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #00d08420',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#00d084', letterSpacing: '0.22em' }}>
          ORDER BOOK · {symbol.replace(/([A-Z]{2,5})(USD)$/, '$1/$2')}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 8, color: '#00d084' }}>
            BID {book.bidImbalance}%
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: '#ff1a6b' }}>
            ASK {100 - book.bidImbalance}%
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: '#ffb300' }}>
            SPR {book.spread}
          </span>
          <span className="font-mono" style={{ fontSize: 7, color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['PRICE', 'SIZE'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em' }}
          >
            {h}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
          {book.asks.map((a, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                padding: '2px 7px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(askCum[i] / maxCum) * 100}%`,
                  background: '#ff1a6b14',
                }}
              />
              <span className="font-mono" style={{ fontSize: 9, color: '#ff1a6b', zIndex: 1 }}>
                {a.p.toFixed(1)}
              </span>
              <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', zIndex: 1 }}>
                {a.s.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            padding: '3px 7px',
            background: 'rgba(255,255,255,0.04)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <span className="font-mono" style={{ fontSize: 9, color: '#ffb300' }}>
            MID ${book.midPrice.toFixed(1)} · SPREAD {book.spread}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
          {book.bids.map((b, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                padding: '2px 7px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(bidCum[i] / maxCum) * 100}%`,
                  background: '#00d08414',
                }}
              />
              <span className="font-mono" style={{ fontSize: 9, color: '#00d084', zIndex: 1 }}>
                {b.p.toFixed(1)}
              </span>
              <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', zIndex: 1 }}>
                {b.s.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 3 — CVD · DELTA FLOW
   ══════════════════════════════════════════════════════════════════ */
function WCVD({ symbol = 'BTCUSD' }: { symbol?: string } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { points: rows, status } = useZeusCVD(symbol, 300);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || rows.length === 0) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width,
      H = cv.height;
    const cvds = rows.map((r) => r.cvd),
      lo = Math.min(...cvds),
      hi = Math.max(...cvds),
      rng = hi - lo || 1;
    const toY = (v: number) => 8 + (1 - (v - lo) / rng) * (H - 44);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#04080c';
    ctx.fillRect(0, 0, W, H);
    // zero line
    const zY = toY(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, zY);
    ctx.lineTo(W, zY);
    ctx.stroke();
    ctx.setLineDash([]);
    const bw = W / rows.length;
    const maxD = Math.max(...rows.map((r) => Math.abs(r.delta)), 0.001);
    rows.forEach((r, i) => {
      const bh = (Math.abs(r.delta) / maxD) * 22;
      ctx.fillStyle = (r.delta > 0 ? '#00d084' : '#ff1a6b') + '88';
      ctx.fillRect(i * bw, H - 32 - bh, bw - 0.5, bh);
    });
    ctx.beginPath();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    rows.forEach((r, i) => {
      const x = i * bw + bw / 2;
      if (i === 0) ctx.moveTo(x, toY(r.cvd));
      else ctx.lineTo(x, toY(r.cvd));
    });
    ctx.stroke();
    const last = rows[rows.length - 1];
    ctx.fillStyle = last.cvd >= 0 ? '#00d084' : '#ff1a6b';
    ctx.font = 'bold 9px monospace';
    ctx.fillText((last.cvd >= 0 ? '+' : '') + last.cvd.toFixed(2), 6, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '7.5px monospace';
    ctx.fillText('CVD BTC', 6, 28);
  }, [rows]);
  const last = rows.length > 0 ? rows[rows.length - 1] : null;
  const buyCount = rows.filter((r) => r.delta > 0).length;
  const buyPct = rows.length > 0 ? ((buyCount / rows.length) * 100).toFixed(0) : '0';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#04080c',
        border: '1px solid #00e5ff30',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '3px 7px',
          borderBottom: '1px solid #00e5ff18',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#00e5ff', letterSpacing: '0.22em' }}>
          CVD · CUMULATIVE DELTA
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 8, color: '#00d084' }}>
            BUY {buyPct}%
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: '#ff1a6b' }}>
            SELL {100 - +buyPct}%
          </span>
          {last && (
            <span
              className="font-mono"
              style={{ fontSize: 8, color: last.delta > 0 ? '#00d084' : '#ff1a6b' }}
            >
              Δ{last.delta >= 0 ? '+' : ''}
              {last.delta.toFixed(2)}
            </span>
          )}
          {last && (
            <span className="font-mono" style={{ fontSize: 8, color: last.cvd >= 0 ? '#00d084' : '#ff1a6b' }}>
              Σ{last.cvd >= 0 ? '+' : ''}
              {last.cvd.toFixed(2)}
            </span>
          )}
          <span className="font-mono" style={{ fontSize: 7, color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
        </div>
      </div>
      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: 9, color: '#00e5ff' }}>
            COMPUTING CVD...
          </span>
        </div>
      )}
      {status !== 'loading' && (
        <canvas ref={ref} width={480} height={160} style={{ width: '100%', flex: 1, display: 'block' }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 4 — GAMMA EXPOSURE (GEX)
   ══════════════════════════════════════════════════════════════════ */
function WGammaExposure() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { gexStrikes: strikes, spotPrice: spot, status } = useDeribitOptionsData('BTC');
  useEffect(() => {
    const cv = ref.current;
    if (!cv || strikes.length === 0) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width,
      H = cv.height,
      PAD = 8,
      LH = 18,
      pH = H - PAD * 2 - LH;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060a0f';
    ctx.fillRect(0, 0, W, H);
    const maxA = Math.max(...strikes.map((s) => Math.abs(s.g)));
    const bw = (W - PAD * 2) / strikes.length,
      zy = PAD + pH / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(PAD, zy);
    ctx.lineTo(W - PAD, zy);
    ctx.stroke();
    ctx.setLineDash([]);
    strikes.forEach((st, i) => {
      const x = PAD + i * bw,
        bh = (Math.abs(st.g) / maxA) * (pH / 2 - 4);
      if (st.atm) {
        ctx.strokeStyle = '#ffb30055';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x + bw / 2, PAD);
        ctx.lineTo(x + bw / 2, H - LH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const col = st.g > 0 ? '#00d084bb' : '#ff1a6bbb';
      ctx.fillStyle = col;
      if (st.g > 0) ctx.fillRect(x + 1, zy - bh, bw - 2, bh);
      else ctx.fillRect(x + 1, zy, bw - 2, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.font = '6px monospace';
      ctx.fillText((st.s / 1000).toFixed(0) + 'K', x + 1, H - 2);
    });
    const net = strikes.reduce((s, x) => s + x.g, 0);
    ctx.fillStyle = '#ffb300';
    ctx.font = '8px monospace';
    ctx.fillText('NET GEX ' + (net >= 0 ? '+' : '' + (net / 1000).toFixed(1) + 'K'), 6, 14);
    ctx.fillStyle = net > 0 ? '#00d084' : '#ff1a6b';
    ctx.fillText(net > 0 ? 'DEALER LONG γ' : 'DEALER SHORT γ', 6, 24);
  });
  const net = strikes.reduce((s, x) => s + x.g, 0);
  const flipStrike = strikes.find((s) => s.g * strikes[strikes.indexOf(s) + 1]?.g < 0);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#060a0f',
        border: '1px solid #ffb30030',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #ffb30018',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#ffb300', letterSpacing: '0.22em' }}>
          GAMMA EXPOSURE · DEALER NET
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 8, color: '#ffb300' }}>
            GEX {net >= 0 ? '+' : ''}
            {(net / 1000).toFixed(1)}B
          </span>
          {flipStrike && (
            <span className="font-mono" style={{ fontSize: 8, color: '#e879f9' }}>
              FLIP ${flipStrike.s.toLocaleString()}
            </span>
          )}
          <span className="font-mono" style={{ fontSize: 8, color: net > 0 ? '#00d084' : '#ff1a6b' }}>
            {net > 0 ? 'PIN ↑' : 'MAGNET ↓'}
          </span>
          <span className="font-mono" style={{ fontSize: 7, color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
        </div>
      </div>
      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: 9, color: '#ffb300' }}>
            FETCHING GEX DATA...
          </span>
        </div>
      )}
      {status !== 'loading' && (
        <canvas ref={ref} width={480} height={160} style={{ width: '100%', flex: 1, display: 'block' }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 5 — OPTIONS UNUSUAL FLOW
   ══════════════════════════════════════════════════════════════════ */
function WOptionsFlow() {
  const { rows, status } = useDeribitOptionsTrades('BTC', 20);
  const scoreCol = (s: number) =>
    s >= 90 ? '#ff1a6b' : s >= 80 ? '#ffb300' : s >= 70 ? '#00e5ff' : '#00d084';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#080412',
        border: '1px solid #e879f930',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #e879f918',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#e879f9', letterSpacing: '0.22em' }}>
          OPTIONS UNUSUAL FLOW · DERIBIT LIVE
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
            SWEEP = aggressive · BLOCK = negotiated
          </span>
          <span className="font-mono" style={{ fontSize: 7, color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '46px 34px 34px 38px 44px 46px 36px 28px 28px',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['TIME', 'SYM', 'TYPE', 'EXP', 'STK', 'PREM', 'SIDE', 'IV', 'SCR'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}
          >
            {h}
          </span>
        ))}
      </div>
      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: 9, color: '#e879f9' }}>
            FETCHING OPTIONS FLOW...
          </span>
        </div>
      )}
      {status !== 'loading' && (
        <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '46px 34px 34px 38px 44px 46px 36px 28px 28px',
                padding: '2.5px 7px',
                borderBottom: '1px dashed rgba(255,255,255,0.04)',
                alignItems: 'center',
                background: i === 0 ? 'rgba(232,121,249,0.05)' : 'transparent',
              }}
            >
              <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                {r.t}
              </span>
              <span className="font-mono" style={{ fontSize: 9.5, color: '#00e5ff', fontWeight: 600 }}>
                {r.sym}
              </span>
              <span
                className="hud-label"
                style={{
                  fontSize: 7.5,
                  color: r.type === 'CALL' ? '#00d084' : '#ff1a6b',
                  letterSpacing: '0.08em',
                }}
              >
                {r.type}
              </span>
              <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>
                {r.exp}
              </span>
              <span className="font-mono" style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.7)' }}>
                {r.str}
              </span>
              <span className="font-mono" style={{ fontSize: 9, color: '#e879f9', fontWeight: 600 }}>
                {r.prem}
              </span>
              <span
                className="hud-label"
                style={{
                  fontSize: 7.5,
                  color: r.side === 'SWEEP' ? '#ff1a6b' : '#ffb300',
                  letterSpacing: '0.06em',
                }}
              >
                {r.side}
              </span>
              <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                {r.iv}
              </span>
              <span className="font-mono" style={{ fontSize: 9, color: scoreCol(r.score), fontWeight: 700 }}>
                {r.score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 6 — DARK POOL PRINTS
   ══════════════════════════════════════════════════════════════════ */
function WDarkPool() {
  const [rows] = useState(() => [
    {
      t: '14:27:18',
      sym: 'SPY',
      px: 550.42,
      sz: 485000,
      val: '$266.7M',
      venue: 'FINRA ATS',
      litPct: 12,
      bull: true,
    },
    {
      t: '14:24:05',
      sym: 'AAPL',
      px: 188.9,
      sz: 920000,
      val: '$173.8M',
      venue: 'IEX',
      litPct: 8,
      bull: true,
    },
    {
      t: '14:20:33',
      sym: 'TSLA',
      px: 174.2,
      sz: 640000,
      val: '$111.5M',
      venue: 'BATS ATS',
      litPct: 5,
      bull: false,
    },
    {
      t: '14:18:11',
      sym: 'QQQ',
      px: 471.85,
      sz: 230000,
      val: '$108.5M',
      venue: 'FINRA ATS',
      litPct: 18,
      bull: false,
    },
    {
      t: '14:15:44',
      sym: 'MSFT',
      px: 414.3,
      sz: 260000,
      val: '$107.7M',
      venue: 'IEX',
      litPct: 22,
      bull: true,
    },
    {
      t: '14:12:02',
      sym: 'NVDA',
      px: 1025.0,
      sz: 95000,
      val: '$97.4M',
      venue: 'BATS ATS',
      litPct: 7,
      bull: true,
    },
    {
      t: '14:09:50',
      sym: 'BTC',
      px: 78050,
      sz: 1240,
      val: '$96.8M',
      venue: 'COINBASE',
      litPct: 0,
      bull: true,
    },
    {
      t: '14:06:22',
      sym: 'GLD',
      px: 222.8,
      sz: 420000,
      val: '$93.6M',
      venue: 'FINRA ATS',
      litPct: 15,
      bull: true,
    },
  ]);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#060b05',
        border: '1px solid #c8fb4e28',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #c8fb4e14',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#c8fb4e', letterSpacing: '0.22em' }}>
          DARK POOL PRINTS · ATS BLOCK TRADES
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
            LIT% = exchange-routed portion
          </span>
          <span className="font-mono" style={{ fontSize: 7.5, color: '#ffb300' }}>
            ◎ SIM
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '46px 36px 58px 58px 60px 1fr 28px',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['TIME', 'SYM', 'PRICE', 'SIZE', 'VALUE', 'VENUE', 'LIT'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}
          >
            {h}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '46px 36px 58px 58px 60px 1fr 28px',
              padding: '2.5px 7px',
              borderBottom: '1px dashed rgba(255,255,255,0.04)',
              alignItems: 'center',
              background: i === 0 ? 'rgba(200,251,78,0.04)' : 'transparent',
            }}
          >
            <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
              {r.t}
            </span>
            <span className="font-mono" style={{ fontSize: 9.5, color: '#00e5ff', fontWeight: 600 }}>
              {r.sym}
            </span>
            <span className="font-mono" style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.7)' }}>
              ${r.px.toLocaleString()}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
              {(r.sz / 1000).toFixed(0)}K
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: '#c8fb4e', fontWeight: 600 }}>
              {r.val}
            </span>
            <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
              {r.venue}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 8, color: r.litPct < 10 ? '#ff1a6b' : 'rgba(255,255,255,0.4)' }}
            >
              {r.litPct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 7 — FUNDING RATES MULTI-EXCHANGE
   ══════════════════════════════════════════════════════════════════ */
function WFundingRates() {
  const { rows, status } = useZeusSwaps();
  const maxAnn = rows.length > 0 ? Math.max(...rows.map((r) => Math.abs(r.annRate)), 0.001) : 1;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#07030f',
        border: '1px solid #e879f928',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #e879f914',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#e879f9', letterSpacing: '0.22em' }}>
          FUNDING RATES · PERP · 8H
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.3)' }}>
            +rate = longs pay shorts
          </span>
          <span className="font-mono" style={{ fontSize: 7, color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '52px 80px 60px 60px 60px',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['EXCH', 'SYMBOL', '8H RATE', 'ANNLSD', 'NEXT FUND'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}
          >
            {h}
          </span>
        ))}
      </div>
      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: 9, color: '#e879f9' }}>
            FETCHING FUNDING DATA...
          </span>
        </div>
      )}
      {status !== 'loading' && (
        <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
          {rows.map((r, i) => (
            <div key={i} style={{ padding: '2px 7px', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '52px 80px 60px 60px 60px',
                  alignItems: 'center',
                }}
              >
                <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>
                  {r.exchange}
                </span>
                <span className="font-mono" style={{ fontSize: 9, color: '#e879f9' }}>
                  {r.symbol}
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: r.rate > 0 ? '#00d084' : '#ff1a6b', fontWeight: 600 }}
                >
                  {r.rate > 0 ? '+' : ''}
                  {r.rate.toFixed(4)}%
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 8.5, color: r.annRate > 0 ? '#00d08499' : '#ff1a6b99' }}
                >
                  {r.annRate > 0 ? '+' : ''}
                  {r.annRate.toFixed(1)}%
                </span>
                <span className="font-mono" style={{ fontSize: 7.5, color: '#ffb300' }}>
                  {r.nextTime}
                </span>
              </div>
              <div
                style={{
                  height: 2,
                  marginTop: 1,
                  background: 'rgba(255,255,255,0.05)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${(Math.abs(r.annRate) / maxAnn) * 100}%`,
                    background: r.annRate > 0 ? '#00d08466' : '#ff1a6b66',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 8 — CORRELATION MATRIX
   ══════════════════════════════════════════════════════════════════ */
function WCorrelation() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { assets, matrix: mat, status } = useZeusCorrelation();
  useEffect(() => {
    const cv = ref.current;
    if (!cv || mat.length === 0) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width,
      H = cv.height,
      n = assets.length;
    const lw = 32,
      cell = (W - lw) / (n + 0.5),
      cellH = (H - lw) / (n + 0.5);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#050813';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = mat[i][j];
        const t = (v + 1) / 2;
        const r = Math.round(t < 0.5 ? t * 2 * 180 : 180 + (t * 2 - 1) * 75);
        const g = Math.round(t < 0.5 ? t * 2 * 180 : 255);
        const b = Math.round(t < 0.5 ? 255 - t * 2 * 220 : 100 - (t * 2 - 1) * 80);
        ctx.fillStyle = `rgba(${r},${g},${b},0.82)`;
        ctx.fillRect(lw + j * cell + 1, lw + i * cellH + 1, cell - 2, cellH - 2);
        ctx.fillStyle = Math.abs(v) > 0.5 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
        ctx.font = '7px monospace';
        ctx.fillText(v.toFixed(2), lw + j * cell + 3, lw + i * cellH + cellH * 0.65);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '7.5px monospace';
      ctx.fillText(assets[i], 1, lw + i * cellH + cellH * 0.65);
      ctx.fillText(assets[i], lw + i * cell + 2, lw - 4);
    }
  });
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#050813',
        border: '1px solid #00e5ff28',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #00e5ff14',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#00e5ff', letterSpacing: '0.22em' }}>
          CRYPTO CORRELATION MATRIX · 30d ROLLING
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
            GREEN = pos · RED = neg
          </span>
          <span className="font-mono" style={{ fontSize: 7, color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
        </div>
      </div>
      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: 9, color: '#00e5ff' }}>
            COMPUTING CORRELATIONS...
          </span>
        </div>
      )}
      {status !== 'loading' && (
        <canvas ref={ref} width={480} height={180} style={{ width: '100%', flex: 1, display: 'block' }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 9 — YIELD CURVE
   ══════════════════════════════════════════════════════════════════ */
function WYieldCurve() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { current: ylds, previous: prev, tenors, status } = useTreasuryYieldCurve();
  useEffect(() => {
    const cv = ref.current;
    if (!cv || ylds.length === 0) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width,
      H = cv.height,
      PT = 14,
      PB = 22,
      PL = 38,
      PR = 8;
    const pW = W - PL - PR,
      pH = H - PT - PB;
    const lo = Math.min(...ylds, ...prev) - 0.1,
      hi = Math.max(...ylds, ...prev) + 0.1,
      rng = hi - lo;
    const toY = (v: number) => PT + (1 - (v - lo) / rng) * pH;
    const toX = (i: number) => PL + (i / (tenors.length - 1)) * pW;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#070a05';
    ctx.fillRect(0, 0, W, H);
    // grid
    for (let i = 0; i <= 4; i++) {
      const y = PT + (i / 4) * pH;
      const v = hi - (i / 4) * rng;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PL, y);
      ctx.lineTo(W - PR, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '7.5px monospace';
      ctx.fillText(v.toFixed(2) + '%', 1, y + 3);
    }
    // inversion zone
    const inv = ylds[4] > ylds[8];
    if (inv) {
      ctx.fillStyle = 'rgba(255,26,107,0.07)';
      ctx.fillRect(PL, PT, pW, pH);
    }
    // previous curve (dashed)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    prev.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v));
      else ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
    ctx.setLineDash([]);
    // current curve
    const grad = ctx.createLinearGradient(PL, 0, W - PR, 0);
    grad.addColorStop(0, '#ff1a6b');
    grad.addColorStop(0.5, '#ffb300');
    grad.addColorStop(1, '#00d084');
    ctx.beginPath();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ylds.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v));
      else ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
    ylds.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(toX(i), toY(v), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb300';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '7px monospace';
      ctx.fillText(tenors[i], toX(i) - 8, H - 4);
    });
    if (inv) {
      ctx.fillStyle = '#ff1a6b';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('⚠ 2Y>10Y INVERSION', PL + 4, PT + 12);
    }
  });
  const spread2_10 = ylds.length > 0 ? (ylds[4] - ylds[8]).toFixed(2) : '0.00';
  const inv = +spread2_10 > 0;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#070a05',
        border: '1px solid #ffb30028',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #ffb30018',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#ffb300', letterSpacing: '0.22em' }}>
          US TREASURY YIELD CURVE
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className="font-mono" style={{ fontSize: 8, color: inv ? '#ff1a6b' : '#00d084' }}>
            2Y-10Y {inv ? '+' : '−'}
            {Math.abs(+spread2_10).toFixed(2)}%
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
            10Y {ylds[8]?.toFixed(2)}%
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
            30Y {ylds[10]?.toFixed(2)}%
          </span>
          <span className="font-mono" style={{ fontSize: 7, color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
        </div>
      </div>
      <canvas ref={ref} width={480} height={160} style={{ width: '100%', flex: 1, display: 'block' }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 10 — COT POSITIONING (CFTC)
   ══════════════════════════════════════════════════════════════════ */
function WCotPositioning() {
  const [rows] = useState(() => [
    { asset: 'BTC', netSpec: +42800, chg: +3200, pctile: 78, extreme: false, bull: true },
    { asset: 'GOLD', netSpec: +186000, chg: -8400, pctile: 82, extreme: true, bull: true },
    { asset: 'CRUDE', netSpec: +64200, chg: +1100, pctile: 55, extreme: false, bull: true },
    { asset: 'EUR', netSpec: -38400, chg: -4200, pctile: 24, extreme: false, bull: false },
    { asset: 'JPY', netSpec: -184000, chg: -12000, pctile: 8, extreme: true, bull: false },
    { asset: 'SPX E-M', netSpec: +298000, chg: +18000, pctile: 91, extreme: true, bull: true },
    { asset: 'NAS100', netSpec: +186000, chg: +9200, pctile: 88, extreme: true, bull: true },
    { asset: 'T-BONDS', netSpec: -121000, chg: -6800, pctile: 12, extreme: true, bull: false },
    { asset: 'COPPER', netSpec: +28400, chg: +2100, pctile: 62, extreme: false, bull: true },
    { asset: 'SILVER', netSpec: +14200, chg: -1400, pctile: 58, extreme: false, bull: true },
  ]);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#080b06',
        border: '1px solid #c8fb4e28',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #c8fb4e14',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#c8fb4e', letterSpacing: '0.22em' }}>
          CFTC COT · NET SPECULATOR POSITIONING
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
            PCTILE = 3yr historical rank
          </span>
          <span className="font-mono" style={{ fontSize: 7.5, color: '#ffb300' }}>
            ◎ SIM
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '56px 74px 52px 48px 1fr',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['ASSET', 'NET SPEC', 'WK CHG', 'PCTILE', 'POSITIONING BAR'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}
          >
            {h}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              padding: '2.5px 7px',
              borderBottom: '1px dashed rgba(255,255,255,0.04)',
              background: r.extreme ? 'rgba(255,179,0,0.04)' : 'transparent',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '56px 74px 52px 48px 1fr',
                alignItems: 'center',
              }}
            >
              <span className="font-mono" style={{ fontSize: 9, color: '#c8fb4e' }}>
                {r.asset}
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 9, color: r.bull ? '#00d084' : '#ff1a6b', fontWeight: 600 }}
              >
                {r.netSpec > 0 ? '+' : ''}
                {(r.netSpec / 1000).toFixed(1)}K
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 8, color: r.chg > 0 ? '#00d08499' : '#ff1a6b99' }}
              >
                {r.chg > 0 ? '+' : ''}
                {(r.chg / 1000).toFixed(1)}K
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    color: r.pctile > 80 ? '#ff1a6b' : r.pctile < 20 ? '#ff1a6b' : 'rgba(255,255,255,0.6)',
                    fontWeight: r.extreme ? 700 : 400,
                  }}
                >
                  {r.pctile}%
                </span>
                {r.extreme && (
                  <span className="hud-label" style={{ fontSize: 6.5, color: '#ffb300' }}>
                    EXT
                  </span>
                )}
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: `${50 - r.pctile / 2}%`,
                    height: '100%',
                    width: `${r.pctile / 2}%`,
                    background: r.bull ? '#00d08488' : '#ff1a6b88',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    width: 1,
                    height: '100%',
                    background: 'rgba(255,255,255,0.3)',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 11 — LIQUIDITY MAP
   ══════════════════════════════════════════════════════════════════ */
function WLiquidityMap({ symbol = 'BTCUSD' }: { symbol?: string } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { levels, spot, status } = useZeusLiquidityMap(symbol);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || levels.length === 0) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width,
      H = cv.height,
      PAD = 8;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#04090f';
    ctx.fillRect(0, 0, W, H);
    const maxL = Math.max(...levels.map((l) => l.liq));
    const bw = (H - PAD * 2) / levels.length;
    const maxBar = W * 0.55;
    levels.forEach((l, i) => {
      const y = PAD + i * bw,
        barW = (l.liq / maxL) * maxBar;
      ctx.fillStyle = (l.bull ? '#00d084' : '#ff1a6b') + (l.liq > 600 ? 'cc' : '44');
      ctx.fillRect(1, y + 1, barW, bw - 2);
      if (l.isEH || l.isEL) {
        ctx.strokeStyle = '#ffb300';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(1, y + bw / 2);
        ctx.lineTo(maxBar + 30, y + bw / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffb300';
        ctx.font = '7px monospace';
        ctx.fillText(l.isEH ? 'EQH' : 'EQL', maxBar + 2, y + bw * 0.75);
      }
      if (Math.abs(l.p - spot) < 600) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y + bw / 2);
        ctx.lineTo(W, y + bw / 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 7.5px monospace';
        ctx.fillText('SPOT', W - 32, y + bw * 0.75);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '7px monospace';
      ctx.fillText('$' + (l.p / 1000).toFixed(0) + 'K', maxBar + 32, y + bw * 0.75);
      ctx.fillStyle = l.liq > 400 ? '#ffb300' : 'rgba(255,255,255,0.25)';
      ctx.font = '7px monospace';
      ctx.fillText(l.liq.toFixed(0) + 'M', maxBar + 58, y + bw * 0.75);
    });
  });
  const topLiq = levels.filter((l) => l.liq > 500).length;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#04090f',
        border: '1px solid #00e5ff28',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #00e5ff14',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#00e5ff', letterSpacing: '0.22em' }}>
          LIQUIDITY MAP · BINANCE LIVE
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className="font-mono" style={{ fontSize: 8, color: '#ffb300' }}>
            {topLiq} HIGH-LIQ ZONES
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
            EQH/EQL = equal highs/lows
          </span>
          <span className="font-mono" style={{ fontSize: 7, color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
        </div>
      </div>
      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: 9, color: '#00e5ff' }}>
            FETCHING ORDER BOOK...
          </span>
        </div>
      )}
      {status !== 'loading' && (
        <canvas ref={ref} width={480} height={200} style={{ width: '100%', flex: 1, display: 'block' }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 12 — SECTOR ROTATION
   ══════════════════════════════════════════════════════════════════ */
function WSectorRotation() {
  const [sectors] = useState(() => [
    { n: 'Technology', sym: 'XLK', rs: +2.81, mom: +1.44, q: 'LEADING', w1: +3.2, m1: +8.1, m3: +14.2 },
    { n: 'Healthcare', sym: 'XLV', rs: +0.54, mom: +0.22, q: 'IMPROVING', w1: +0.8, m1: +2.1, m3: +4.5 },
    { n: 'Financials', sym: 'XLF', rs: +1.24, mom: +0.88, q: 'LEADING', w1: +1.4, m1: +3.8, m3: +9.2 },
    { n: 'Energy', sym: 'XLE', rs: -0.32, mom: +0.11, q: 'IMPROVING', w1: -0.4, m1: -1.2, m3: +2.1 },
    { n: 'Utilities', sym: 'XLU', rs: -1.84, mom: -0.92, q: 'LAGGING', w1: -2.1, m1: -4.2, m3: -8.8 },
    { n: 'Real Estate', sym: 'XLRE', rs: -1.12, mom: -0.44, q: 'LAGGING', w1: -1.5, m1: -3.1, m3: -5.4 },
    { n: 'Consumer Disc', sym: 'XLY', rs: +0.88, mom: +0.62, q: 'LEADING', w1: +1.1, m1: +2.9, m3: +6.8 },
    { n: 'Materials', sym: 'XLB', rs: -0.21, mom: +0.08, q: 'IMPROVING', w1: -0.3, m1: -0.8, m3: +1.2 },
    { n: 'Industrials', sym: 'XLI', rs: +0.44, mom: +0.18, q: 'LEADING', w1: +0.6, m1: +1.4, m3: +3.8 },
    { n: 'Comm Services', sym: 'XLC', rs: +1.62, mom: +0.94, q: 'LEADING', w1: +2.0, m1: +5.2, m3: +11.4 },
    { n: 'Cons Staples', sym: 'XLP', rs: -0.88, mom: -0.32, q: 'WEAKENING', w1: -1.1, m1: -2.4, m3: -4.2 },
  ]);
  const qColor = (q: string) =>
    q === 'LEADING' ? '#00d084' : q === 'IMPROVING' ? '#00e5ff' : q === 'WEAKENING' ? '#ffb300' : '#ff1a6b';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#05080c',
        border: '1px solid #00d08430',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #00d08418',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#00d084', letterSpacing: '0.22em' }}>
          SECTOR ROTATION · RS vs SPX
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
            JdK RS-Momentum · GICS sectors
          </span>
          <span className="font-mono" style={{ fontSize: 7.5, color: '#ffb300' }}>
            ◎ SIM
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '82px 36px 34px 34px 36px 36px 36px 1fr',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['SECTOR', 'ETF', 'RS', 'MOM', '1W', '1M', '3M', 'QUADRANT'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}
          >
            {h}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
        {sectors.map((s, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '82px 36px 34px 34px 36px 36px 36px 1fr',
              padding: '2.5px 7px',
              borderBottom: '1px dashed rgba(255,255,255,0.04)',
              alignItems: 'center',
            }}
          >
            <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>
              {s.n}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: '#00e5ff' }}>
              {s.sym}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 9, color: s.rs > 0 ? '#00d084' : '#ff1a6b', fontWeight: 600 }}
            >
              {s.rs > 0 ? '+' : ''}
              {s.rs.toFixed(2)}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: s.mom > 0 ? '#00d08499' : '#ff1a6b99' }}>
              {s.mom > 0 ? '+' : ''}
              {s.mom.toFixed(2)}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: s.w1 > 0 ? '#00d08480' : '#ff1a6b80' }}>
              {s.w1 > 0 ? '+' : ''}
              {s.w1.toFixed(1)}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: s.m1 > 0 ? '#00d08080' : '#ff1a6b80' }}>
              {s.m1 > 0 ? '+' : ''}
              {s.m1.toFixed(1)}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: s.m3 > 0 ? '#00d08080' : '#ff1a6b80' }}>
              {s.m3 > 0 ? '+' : ''}
              {s.m3.toFixed(1)}
            </span>
            <span className="hud-label" style={{ fontSize: 7, color: qColor(s.q), letterSpacing: '0.08em' }}>
              {s.q}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 13 — PORTFOLIO RISK DASHBOARD
   ══════════════════════════════════════════════════════════════════ */
function WRiskDashboard() {
  // DEMO catalog metrics — not live NAV (honesty-report allow when labeled DEMO)
  const metrics = [
    { l: 'VaR 95% (1D)', v: '−2841 USD', n: '2.84% NAV · DEMO', warn: false },
    { l: 'VaR 99% (1D)', v: '−4188 USD', n: '4.19% NAV · DEMO', warn: true },
    { l: 'Expected Shortfall', v: '−5240 USD', n: 'CVaR 99% · DEMO', warn: true },
    { l: 'Sharpe Ratio', v: '1.84', n: 'trailing 1Y', warn: false },
    { l: 'Sortino Ratio', v: '2.41', n: 'downside σ', warn: false },
    { l: 'Calmar Ratio', v: '3.12', n: 'ret / maxDD', warn: false },
    { l: 'Max Drawdown', v: '−12.4%', n: 'peak → trough', warn: true },
    { l: 'Beta (vs SPX)', v: '0.68', n: 'rolling 60d', warn: false },
    { l: 'Information Ratio', v: '0.92', n: 'vs benchmark', warn: false },
    { l: 'Win Rate', v: '58.3%', n: '267 trades', warn: false },
    { l: 'Profit Factor', v: '1.74', n: 'gross P/L', warn: false },
    { l: 'Avg Win / Loss', v: '2.14x', n: 'R-multiple', warn: false },
  ];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0308',
        border: '1px solid #ff1a6b28',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #ff1a6b18',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#ff1a6b', letterSpacing: '0.22em' }}>
          PORTFOLIO RISK DASHBOARD · DEMO
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
            DEMO NAV: $100,000 · Simulated metrics
          </span>
          <span className="font-mono" style={{ fontSize: 7.5, color: '#ffb300' }}>
            ◎ SIM
          </span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 7px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '3px 8px',
        }}
        className="nx-scroll"
      >
        {metrics.map((m, i) => (
          <div
            key={i}
            style={{
              padding: '4px 6px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${m.warn ? 'rgba(255,26,107,0.3)' : 'rgba(255,255,255,0.06)'}`,
              position: 'relative',
            }}
          >
            {m.warn && (
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 4,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#ff1a6b',
                }}
              />
            )}
            <div
              className="hud-label"
              style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}
            >
              {m.l}
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 13,
                color: m.warn ? '#ff1a6b' : '#fff',
                letterSpacing: '-0.02em',
                marginTop: 1,
              }}
            >
              {m.v}
            </div>
            <div className="font-mono" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
              {m.n}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 14 — CREDIT SPREAD MONITOR
   ══════════════════════════════════════════════════════════════════ */
function WCreditSpreads() {
  const [rows] = useState(() => [
    { l: 'US HY OAS (ICE)', v: 362, chg: +8, prev: 354, base: 280, unit: 'bps', warn: true },
    { l: 'US IG OAS (ICE)', v: 98, chg: +3, prev: 95, base: 80, unit: 'bps', warn: false },
    { l: 'EUR HY OAS', v: 418, chg: +14, prev: 404, base: 310, unit: 'bps', warn: true },
    { l: 'CDX NA IG (5Y)', v: 68, chg: +2, prev: 66, base: 50, unit: 'bps', warn: false },
    { l: 'CDX NA HY (5Y)', v: 388, chg: +11, prev: 377, base: 290, unit: 'bps', warn: true },
    { l: 'US 2Y Swap Spread', v: 24.8, chg: -0.4, prev: 25.2, base: 15, unit: 'bps', warn: false },
    { l: 'TED Spread', v: 18.4, chg: +0.9, prev: 17.5, base: 10, unit: 'bps', warn: false },
    { l: 'LIBOR-OIS Spread', v: 11.2, chg: +0.1, prev: 11.1, base: 8, unit: 'bps', warn: false },
    { l: 'EM Sovereign (EMBI)', v: 491, chg: +22, prev: 469, base: 380, unit: 'bps', warn: true },
    { l: 'SOFR Basis (vs FF)', v: 5.2, chg: -0.2, prev: 5.4, base: 4, unit: 'bps', warn: false },
  ]);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#080a04',
        border: '1px solid #ffb30030',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #ffb30018',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#ffb300', letterSpacing: '0.22em' }}>
          CREDIT SPREAD MONITOR
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
            HY/IG · CDS · Swap · TED spreads
          </span>
          <span className="font-mono" style={{ fontSize: 7.5, color: '#ffb300' }}>
            ◎ SIM
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 50px 44px 1fr',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['INSTRUMENT', 'SPREAD', 'CHG', 'BAR vs MEAN'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}
          >
            {h}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 50px 44px 1fr',
              padding: '3px 7px',
              borderBottom: '1px dashed rgba(255,255,255,0.04)',
              alignItems: 'center',
              background: r.warn ? 'rgba(255,26,107,0.04)' : 'transparent',
            }}
          >
            <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>
              {r.l}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 10, color: r.warn ? '#ff1a6b' : '#ffb300', fontWeight: 600 }}
            >
              {r.v}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: r.chg > 0 ? '#ff1a6b' : '#00d084' }}>
              {r.chg > 0 ? '+' : ''}
              {r.chg.toFixed(1)}
            </span>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${Math.min(100, (r.v / r.base / 2) * 100)}%`,
                  background: r.warn ? '#ff1a6b55' : '#ffb30055',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  width: 1,
                  height: '100%',
                  background: 'rgba(255,255,255,0.2)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 15 — INSTITUTIONAL FLOW
   ══════════════════════════════════════════════════════════════════ */
function WInstFlow() {
  const [rows] = useState(() => [
    { asset: 'US Equities', flow: +4820, units: '$M', d7: +12400, bias: '+' },
    { asset: 'US Bonds', flow: -1240, units: '$M', d7: -8200, bias: '-' },
    { asset: 'Gold / Silver', flow: +680, units: '$M', d7: +2800, bias: '+' },
    { asset: 'BTC / ETH', flow: +290, units: '$M', d7: +1200, bias: '+' },
    { asset: 'EM Equities', flow: -380, units: '$M', d7: -2100, bias: '-' },
    { asset: 'DM ex-US Eq', flow: +240, units: '$M', d7: +980, bias: '+' },
    { asset: 'Crude / Energy', flow: -120, units: '$M', d7: -440, bias: '-' },
    { asset: 'Currencies', flow: +80, units: '$M', d7: +320, bias: '+' },
  ]);
  const maxFlow = Math.max(...rows.map((r) => Math.abs(r.flow)));
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#040c08',
        border: '1px solid #00d08428',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #00d08418',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#00d084', letterSpacing: '0.22em' }}>
          INSTITUTIONAL FLOW · SMART MONEY
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
            ETF + prime broker + 13F composite
          </span>
          <span className="font-mono" style={{ fontSize: 7.5, color: '#ffb300' }}>
            ◎ SIM
          </span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }} className="nx-scroll">
        {rows.map((r, i) => (
          <div key={i} style={{ padding: '3px 7px', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
                {r.asset}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span
                  className="font-mono"
                  style={{ fontSize: 9, color: r.flow > 0 ? '#00d084' : '#ff1a6b', fontWeight: 600 }}
                >
                  {r.flow > 0 ? '+' : ''}
                  {r.flow.toFixed(0)}M
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 8, color: r.d7 > 0 ? '#00d08466' : '#ff1a6b66' }}
                >
                  {r.d7 > 0 ? '+' : ''}
                  {(r.d7 / 1000).toFixed(1)}B 7d
                </span>
              </div>
            </div>
            <div
              style={{ height: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', overflow: 'hidden' }}
            >
              {r.flow > 0 ? (
                <>
                  <div style={{ width: '50%' }} />
                  <div style={{ width: `${(r.flow / maxFlow) * 50}%`, background: '#00d08477' }} />
                </>
              ) : (
                <>
                  <div style={{ width: `${50 - (Math.abs(r.flow) / maxFlow) * 50}%` }} />
                  <div style={{ width: `${(Math.abs(r.flow) / maxFlow) * 50}%`, background: '#ff1a6b77' }} />
                  <div style={{ width: '50%' }} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 16 — VOL SURFACE (IV TERM STRUCTURE)
   ══════════════════════════════════════════════════════════════════ */
function WVolSurface() {
  const ref = useRef<HTMLCanvasElement>(null);
  const {
    volSurface: surf,
    volExpiries: expiries,
    atmIv30d,
    rrSkew30d: rrSkew,
    status,
  } = useDeribitOptionsData('BTC');
  const strikes = [0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15]; // axis labels only
  useEffect(() => {
    const cv = ref.current;
    if (!cv || surf.length === 0 || !surf[0]) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width,
      H = cv.height,
      PL = 28,
      PT = 14,
      PR = 8,
      PB = 22;
    const pW = W - PL - PR,
      pH = H - PT - PB;
    const cellW = pW / expiries.length,
      cellH = pH / strikes.length;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#06030f';
    ctx.fillRect(0, 0, W, H);
    const allV = surf.flat();
    const lo = Math.min(...allV),
      hi = Math.max(...allV);
    for (let i = 0; i < expiries.length; i++) {
      for (let j = 0; j < strikes.length; j++) {
        const v = surf[i][j],
          t = (v - lo) / (hi - lo);
        const r = Math.round(255 * t),
          g = Math.round(80 + 100 * t),
          b = Math.round(255 * (1 - t));
        ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
        ctx.fillRect(PL + i * cellW + 1, PT + j * cellH + 1, cellW - 2, cellH - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '7px monospace';
        ctx.fillText(v.toFixed(0) + '%', PL + i * cellW + 3, PT + j * cellH + cellH * 0.7);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '7px monospace';
      ctx.fillText(expiries[i], PL + i * cellW + 2, H - 4);
    }
    strikes.forEach((s, j) => {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '7px monospace';
      ctx.fillText((s * 100).toFixed(0) + '%', 1, PT + j * cellH + cellH * 0.7);
    });
    // term at ATM
    ctx.beginPath();
    ctx.strokeStyle = '#ffb300';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < expiries.length; i++) {
      const y = PT + 3 * cellH + cellH / 2,
        x = PL + i * cellW + cellW / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  const atmTerm = surf.length > 0 ? surf.map((e) => e[3]) : [30, 30, 30, 30, 30, 30, 30];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#06030f',
        border: '1px solid #e879f930',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #e879f918',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#e879f9', letterSpacing: '0.22em' }}>
          IV SURFACE · DERIBIT LIVE
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className="font-mono" style={{ fontSize: 8, color: '#e879f9' }}>
            ATM 30d: {atmIv30d.toFixed(1)}%
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: rrSkew > 0 ? '#ff1a6b' : '#00d084' }}>
            25d RR: {rrSkew > 0 ? '+' : ''}
            {rrSkew.toFixed(1)}%
          </span>
          <span className="font-mono" style={{ fontSize: 7, color: statusColor(status) }}>
            {statusLabel(status)}
          </span>
        </div>
      </div>
      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-mono" style={{ fontSize: 9, color: '#e879f9' }}>
            FETCHING VOL SURFACE...
          </span>
        </div>
      )}
      {status !== 'loading' && (
        <canvas ref={ref} width={480} height={170} style={{ width: '100%', flex: 1, display: 'block' }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 17 — MACRO POSITIONING (G10 + COMMODITIES)
   ══════════════════════════════════════════════════════════════════ */
function WMacroPositioning() {
  const [rows] = useState(() => [
    { sym: 'EUR/USD', pos: '+12.4K', netUsd: '$1.24B', beta: 0.42, regime: 'RISK-ON', dir: '+' },
    { sym: 'GBP/USD', pos: '+8.2K', netUsd: '$0.82B', beta: 0.38, regime: 'RISK-ON', dir: '+' },
    { sym: 'USD/JPY', pos: '-184K', netUsd: '-$1.84B', beta: 0.71, regime: 'CARRY', dir: '-' },
    { sym: 'AUD/USD', pos: '+6.1K', netUsd: '$0.61B', beta: 0.58, regime: 'COMMODITY', dir: '+' },
    { sym: 'USD/CAD', pos: '-9.8K', netUsd: '-$0.98B', beta: 0.44, regime: 'COMMODITY', dir: '-' },
    { sym: 'GOLD', pos: '+186K', netUsd: '$8.2B', beta: 0.22, regime: 'SAFE', dir: '+' },
    { sym: 'CRUDE', pos: '+64K', netUsd: '$2.8B', beta: 0.51, regime: 'REFLATION', dir: '+' },
    { sym: 'SILVER', pos: '+14K', netUsd: '$0.6B', beta: 0.68, regime: 'RISK-ON', dir: '+' },
    { sym: 'COPPER', pos: '+28K', netUsd: '$1.1B', beta: 0.62, regime: 'REFLATION', dir: '+' },
    { sym: 'NAT GAS', pos: '-18K', netUsd: '-$0.4B', beta: 0.18, regime: 'SEASONAL', dir: '-' },
  ]);
  const regCol = (r: string) =>
    r === 'RISK-ON'
      ? '#00d084'
      : r === 'CARRY'
        ? '#e879f9'
        : r === 'SAFE'
          ? '#00e5ff'
          : r === 'REFLATION'
            ? '#ffb300'
            : 'rgba(255,255,255,0.4)';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#050b06',
        border: '1px solid #c8fb4e28',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #c8fb4e14',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#c8fb4e', letterSpacing: '0.22em' }}>
          MACRO POSITIONING · G10 FX + COMMODITIES
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
            CFTC + Prime broker composite beta
          </span>
          <span className="font-mono" style={{ fontSize: 7.5, color: '#ffb300' }}>
            ◎ SIM
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '52px 52px 56px 30px 1fr',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['SYMBOL', 'NET POS', 'NET USD', 'β', 'REGIME'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}
          >
            {h}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '52px 52px 56px 30px 1fr',
              padding: '2.5px 7px',
              borderBottom: '1px dashed rgba(255,255,255,0.04)',
              alignItems: 'center',
            }}
          >
            <span className="font-mono" style={{ fontSize: 9, color: '#c8fb4e' }}>
              {r.sym}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: r.dir === '+' ? '#00d084' : '#ff1a6b' }}>
              {r.pos}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 8, color: r.dir === '+' ? '#00d08499' : '#ff1a6b99' }}
            >
              {r.netUsd}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>
              {r.beta.toFixed(2)}
            </span>
            <span
              className="hud-label"
              style={{ fontSize: 7, color: regCol(r.regime), letterSpacing: '0.08em' }}
            >
              {r.regime}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 18 — OPEN POSITIONS (MT5 LIVE)
   ══════════════════════════════════════════════════════════════════ */
interface PosMock {
  ticket: number;
  symbol: string;
  type: string;
  lots: number;
  openPrice: number;
  currentPrice: number;
  pnl: number;
  comment: string;
}
function WPositions({ connected, posRows }: { connected: boolean; posRows: PosRow[] }) {
  const mock: PosMock[] = [
    {
      ticket: 102441,
      symbol: 'EURUSD',
      type: 'BUY',
      lots: 0.5,
      openPrice: 1.0871,
      currentPrice: 1.0893,
      pnl: +110.0,
      comment: 'Zeus-L',
    },
    {
      ticket: 102442,
      symbol: 'GBPUSD',
      type: 'SELL',
      lots: 0.3,
      openPrice: 1.2742,
      currentPrice: 1.2718,
      pnl: +72.0,
      comment: 'Zeus-S',
    },
    {
      ticket: 102443,
      symbol: 'BTCUSD',
      type: 'BUY',
      lots: 0.01,
      openPrice: 77800,
      currentPrice: 78120,
      pnl: +32.0,
      comment: 'Manual',
    },
    {
      ticket: 102444,
      symbol: 'XAUUSD',
      type: 'SELL',
      lots: 0.1,
      openPrice: 2341,
      currentPrice: 2338,
      pnl: +30.0,
      comment: 'Zeus-S',
    },
    {
      ticket: 102445,
      symbol: 'USDJPY',
      type: 'BUY',
      lots: 0.4,
      openPrice: 151.42,
      currentPrice: 151.28,
      pnl: -56.0,
      comment: 'Manual',
    },
  ];
  const adapted: PosMock[] = posRows.map((p, i) => ({
    ticket: 100000 + i,
    symbol: p.sym,
    type: p.side === 'LONG' ? 'BUY' : 'SELL',
    lots: parseFloat(p.size) || 0.1,
    openPrice: parseFloat(p.entry) || 1,
    currentPrice: parseFloat(p.mark) || 1,
    pnl: parseFloat(p.pnl) || 0,
    comment: p.bot,
  }));
  const rows: PosMock[] = connected && adapted.length > 0 ? adapted : mock;
  const totalPnl = rows.reduce((s, p) => s + p.pnl, 0);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#040e07',
        border: '1px solid #00d08430',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #00d08418',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#00d084', letterSpacing: '0.22em' }}>
          OPEN POSITIONS {connected ? '· LIVE MT5' : '· SIM DATA'}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <span
            className="font-mono"
            style={{ fontSize: 9, color: totalPnl >= 0 ? '#00d084' : '#ff1a6b', fontWeight: 700 }}
          >
            TOTAL P&amp;L {totalPnl >= 0 ? '+' : ''}
            {totalPnl.toFixed(2)}
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
            {rows.length} POSITIONS
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '48px 56px 30px 32px 60px 60px 52px 1fr',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['TICKET', 'SYMBOL', 'DIR', 'LOTS', 'OPEN', 'CURRENT', 'P&L', 'TAG'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}
          >
            {h}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
        {rows.map((p, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 56px 30px 32px 60px 60px 52px 1fr',
              padding: '2.5px 7px',
              borderBottom: '1px dashed rgba(255,255,255,0.04)',
              alignItems: 'center',
              background: p.pnl > 0 ? 'rgba(0,208,132,0.04)' : 'rgba(255,26,107,0.04)',
            }}
          >
            <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
              {p.ticket}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: '#00e5ff', fontWeight: 600 }}>
              {p.symbol}
            </span>
            <span
              className="hud-label"
              style={{
                fontSize: 8,
                color: p.type === 'BUY' ? '#00d084' : '#ff1a6b',
                letterSpacing: '0.08em',
              }}
            >
              {p.type}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>
              {p.lots.toFixed(2)}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>
              {p.openPrice.toFixed(p.symbol.includes('USD') ? 2 : 5)}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
              {p.currentPrice.toFixed(p.symbol.includes('USD') ? 2 : 5)}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 10, color: p.pnl >= 0 ? '#00d084' : '#ff1a6b', fontWeight: 700 }}
            >
              {p.pnl >= 0 ? '+' : ''}
              {p.pnl.toFixed(2)}
            </span>
            <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.3)' }}>
              {p.comment}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 19 — EQUITY CURVE + METRICS
   ══════════════════════════════════════════════════════════════════ */
function WEquityCurve({ balance, equityArr }: { balance: number; equityArr: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Use real MT5 equity history when available; otherwise show single-point flat line
  const equity =
    equityArr.length > 1
      ? equityArr.map((v, i) => ({ d: `T-${equityArr.length - 1 - i}`, v }))
      : [{ d: 'NOW', v: balance > 1000 ? balance : 100000 }];
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width,
      H = cv.height,
      PAD = 8,
      LH = 18;
    const vals = equity.map((e) => e.v);
    const lo = Math.min(...vals) * 0.99,
      hi = Math.max(...vals) * 1.01,
      rng = hi - lo;
    const toX = (i: number) => PAD + (i / (equity.length - 1)) * (W - PAD * 2);
    const toY = (v: number) => PAD + (1 - (v - lo) / rng) * (H - PAD * 2 - LH);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#040c06';
    ctx.fillRect(0, 0, W, H);
    let peak = equity[0].v,
      maxDD = 0;
    equity.forEach((e) => {
      if (e.v > peak) peak = e.v;
      const dd = (peak - e.v) / peak;
      if (dd > maxDD) maxDD = dd;
    });
    // drawdown fill
    let pk2 = equity[0].v;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(equity[0].v));
    for (let i = 1; i < equity.length; i++) {
      if (equity[i].v > pk2) pk2 = equity[i].v;
      ctx.lineTo(toX(i), toY(equity[i].v));
    }
    ctx.lineTo(toX(equity.length - 1), H - LH);
    ctx.lineTo(toX(0), H - LH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,208,132,0.08)';
    ctx.fill();
    pk2 = equity[0].v;
    for (let i = 1; i < equity.length; i++) {
      if (equity[i].v < pk2) {
        const j = equity.findIndex((e, k) => k > i && e.v >= pk2) || equity.length - 1;
        ctx.beginPath();
        ctx.moveTo(toX(i - 1), toY(equity[i - 1].v));
        for (let k = i; k <= j && k < equity.length; k++) ctx.lineTo(toX(k), toY(equity[k].v));
        ctx.lineTo(toX(Math.min(j, equity.length - 1)), toY(pk2));
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,26,107,0.18)';
        ctx.fill();
      } else pk2 = equity[i].v;
    }
    // equity line
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#00d084');
    grad.addColorStop(1, '#00e5ff');
    ctx.beginPath();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    equity.forEach((e, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(e.v));
      else ctx.lineTo(toX(i), toY(e.v));
    });
    ctx.stroke();
    equity.forEach((e, i) => {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '6.5px monospace';
      ctx.fillText(e.d, toX(i) - 8, H - 4);
    });
  });
  const start = equity[0].v,
    end = balance > 1000 ? balance : equity[equity.length - 1].v;
  const ret = (((end - start) / start) * 100).toFixed(1);
  const dd = Math.max(
    ...equity.map((_, i) => {
      const p = Math.max(...equity.slice(0, i + 1).map((e) => e.v));
      return ((p - equity[i].v) / p) * 100;
    }),
  ).toFixed(1);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#040c06',
        border: '1px solid #00d08430',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid #00d08418',
          flexShrink: 0,
        }}
      >
        <span className="hud-label" style={{ fontSize: 8, color: '#00d084', letterSpacing: '0.22em' }}>
          EQUITY CURVE · ACCOUNT PERFORMANCE
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className="font-mono" style={{ fontSize: 9, color: '#00d084', fontWeight: 700 }}>
            {+ret > 0 ? '+' : ''}
            {ret}% total
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: '#ff1a6b' }}>
            −{dd}% maxDD
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: '#00e5ff' }}>
            Sharpe 1.84
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: '#ffb300' }}>
            ${end.toLocaleString()}
          </span>
        </div>
      </div>
      <canvas ref={ref} width={480} height={160} style={{ width: '100%', flex: 1, display: 'block' }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 20 — EXECUTION LOG + SLIPPAGE
   ══════════════════════════════════════════════════════════════════ */
function WExecutionLog() {
  const [rows] = useState(() => [
    {
      t: '14:28:03',
      sym: 'EURUSD',
      dir: 'BUY',
      lots: 0.5,
      req: 1.0871,
      fill: 1.08712,
      slip: +0.2,
      algo: 'Zeus-L',
      imp: 'LOW',
      lat: 14,
    },
    {
      t: '14:25:11',
      sym: 'GBPUSD',
      dir: 'SELL',
      lots: 0.3,
      req: 1.2742,
      fill: 1.27418,
      slip: -0.2,
      algo: 'Zeus-S',
      imp: 'LOW',
      lat: 18,
    },
    {
      t: '14:22:44',
      sym: 'XAUUSD',
      dir: 'SELL',
      lots: 0.1,
      req: 2341.0,
      fill: 2340.85,
      slip: -1.5,
      algo: 'Manual',
      imp: 'MED',
      lat: 52,
    },
    {
      t: '14:19:30',
      sym: 'USDJPY',
      dir: 'BUY',
      lots: 0.4,
      req: 151.42,
      fill: 151.425,
      slip: +0.5,
      algo: 'Zeus-L',
      imp: 'LOW',
      lat: 11,
    },
    {
      t: '14:15:02',
      sym: 'BTCUSD',
      dir: 'BUY',
      lots: 0.01,
      req: 77800,
      fill: 77804,
      slip: +4.0,
      algo: 'Manual',
      imp: 'HIGH',
      lat: 88,
    },
    {
      t: '14:11:19',
      sym: 'EURUSD',
      dir: 'SELL',
      lots: 1.0,
      req: 1.0865,
      fill: 1.08644,
      slip: -0.6,
      algo: 'Zeus-S',
      imp: 'MED',
      lat: 22,
    },
    {
      t: '14:08:55',
      sym: 'GBPUSD',
      dir: 'BUY',
      lots: 0.5,
      req: 1.2719,
      fill: 1.27192,
      slip: +0.2,
      algo: 'Zeus-L',
      imp: 'LOW',
      lat: 16,
    },
    {
      t: '14:05:33',
      sym: 'XAUUSD',
      dir: 'BUY',
      lots: 0.2,
      req: 2338.5,
      fill: 2338.65,
      slip: +1.5,
      algo: 'Manual',
      imp: 'MED',
      lat: 44,
    },
    {
      t: '14:02:10',
      sym: 'USDJPY',
      dir: 'SELL',
      lots: 0.3,
      req: 151.68,
      fill: 151.675,
      slip: -0.5,
      algo: 'Zeus-S',
      imp: 'LOW',
      lat: 19,
    },
  ]);
  const impCol = (imp: string) => (imp === 'HIGH' ? '#ff1a6b' : imp === 'MED' ? '#ffb300' : '#00d08499');
  const avgSlip = (rows.reduce((s, r) => s + Math.abs(r.slip), 0) / rows.length).toFixed(1);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#030e10',
        border: '1px solid rgba(0,229,255,0.18)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 7px',
          borderBottom: '1px solid rgba(0,229,255,0.1)',
          flexShrink: 0,
        }}
      >
        <span
          className="hud-label"
          style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.22em' }}
        >
          EXECUTION LOG · SLIPPAGE + IMPACT
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className="font-mono" style={{ fontSize: 8, color: '#ffb300' }}>
            AVG SLIP {avgSlip} pips
          </span>
          <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
            LATENCY in ms
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '46px 52px 28px 28px 58px 58px 36px 44px 26px 26px',
          padding: '2px 7px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        {['TIME', 'SYM', 'DIR', 'LOTS', 'REQ', 'FILL', 'SLIP', 'ALGO', 'IMP', 'LAT'].map((h) => (
          <span
            key={h}
            className="hud-label"
            style={{ fontSize: 6.5, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}
          >
            {h}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }} className="nx-scroll">
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '46px 52px 28px 28px 58px 58px 36px 44px 26px 26px',
              padding: '2.5px 7px',
              borderBottom: '1px dashed rgba(255,255,255,0.04)',
              alignItems: 'center',
              background: i === 0 ? 'rgba(0,229,255,0.04)' : 'transparent',
            }}
          >
            <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
              {r.t}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: '#00e5ff' }}>
              {r.sym}
            </span>
            <span
              className="hud-label"
              style={{ fontSize: 8, color: r.dir === 'BUY' ? '#00d084' : '#ff1a6b', letterSpacing: '0.06em' }}
            >
              {r.dir}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
              {r.lots}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
              {r.req}
            </span>
            <span className="font-mono" style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.75)' }}>
              {r.fill}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 9, color: Math.abs(r.slip) > 2 ? '#ff1a6b' : 'rgba(255,255,255,0.45)' }}
            >
              {r.slip > 0 ? '+' : ''}
              {r.slip.toFixed(1)}
            </span>
            <span className="font-mono" style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
              {r.algo}
            </span>
            <span
              className="hud-label"
              style={{ fontSize: 7, color: impCol(r.imp), letterSpacing: '0.06em' }}
            >
              {r.imp}
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 8, color: r.lat > 50 ? '#ffb300' : 'rgba(255,255,255,0.3)' }}
            >
              {r.lat}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET 21 — ORDER TICKET (live MT5 order placement)
   ══════════════════════════════════════════════════════════════════ */
function WOrderTicket({
  connected,
  livePrice = 0,
  activeSymbol = 'BTCUSD',
}: {
  connected: boolean;
  livePrice?: number;
  activeSymbol?: string;
}) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [lots, setLots] = useState('0.01');
  const [slPips, setSlPips] = useState('50');
  const [tpPips, setTpPips] = useState('100');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const lotsNum = parseFloat(lots) || 0.01;
  const slNum = parseInt(slPips) || 50;
  const tpNum = parseInt(tpPips) || 100;
  const pipVal = activeSymbol.includes('JPY')
    ? 0.01
    : activeSymbol.includes('XAU')
      ? 0.1
      : activeSymbol.startsWith('BTC')
        ? 1
        : 0.0001;
  const sl = side === 'BUY' ? livePrice - slNum * pipVal : livePrice + slNum * pipVal;
  const tp = side === 'BUY' ? livePrice + tpNum * pipVal : livePrice - tpNum * pipVal;
  const rr = slNum > 0 ? (tpNum / slNum).toFixed(1) : '—';

  async function placeOrder() {
    if (!connected) {
      setErr('MT5 bridge offline — connect first');
      return;
    }
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const cfg = await window.jarvisBridge.config
        ?.getMt5?.()
        .catch(() => ({ host: 'localhost', port: 1234 }));
      const { host, port } = cfg ?? { host: 'localhost', port: 1234 };
      const body = { symbol: activeSymbol, side, volume: lotsNum, sl: +sl.toFixed(5), tp: +tp.toFixed(5) };
      const r = await window.jarvisBridge.mt5({ host, port, endpoint: 'order', method: 'POST', body });
      if (r.ok) {
        setMsg(`✓ ORDER SENT — ${side} ${lotsNum} ${activeSymbol} @ market`);
      } else {
        setErr(r.err || `Error: ${r.status}`);
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
    setBusy(false);
  }

  const borderColor = side === 'BUY' ? '#00d084' : '#ff1a6b';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#030e10',
        border: `1px solid ${borderColor}33`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 8px',
          borderBottom: `1px solid ${borderColor}22`,
          flexShrink: 0,
        }}
      >
        <span
          className="hud-label"
          style={{ fontSize: 8, color: 'var(--cyan-dim)', letterSpacing: '0.22em' }}
        >
          ORDER TICKET · {activeSymbol}
        </span>
        {connected ? (
          <span className="hud-label" style={{ fontSize: 7, color: '#00d084' }}>
            ● LIVE
          </span>
        ) : (
          <span className="hud-label" style={{ fontSize: 7, color: '#ff1a6b' }}>
            ● OFFLINE
          </span>
        )}
      </div>
      <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Side */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['BUY', 'SELL'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className="hud-label"
              style={{
                flex: 1,
                padding: '7px 0',
                fontSize: 10,
                cursor: 'pointer',
                letterSpacing: '0.22em',
                border: `1px solid ${s === 'BUY' ? '#00d084' : '#ff1a6b'}${side === s ? '' : '44'}`,
                background:
                  side === s
                    ? s === 'BUY'
                      ? 'rgba(0,208,132,0.12)'
                      : 'rgba(255,26,107,0.12)'
                    : 'transparent',
                color: s === 'BUY' ? '#00d084' : '#ff1a6b',
              }}
            >
              {s}
            </button>
          ))}
        </div>
        {/* Price display */}
        <div style={{ textAlign: 'center', padding: '4px 0' }}>
          <span className="font-mono" style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)' }}>
            {livePrice > 0
              ? livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })
              : '—'}
          </span>
          <span className="hud-label" style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>
            MARKET
          </span>
        </div>
        {/* Inputs */}
        {[
          { label: 'LOTS', value: lots, set: setLots, step: '0.01', min: '0.01' },
          { label: 'SL (pips)', value: slPips, set: setSlPips, step: '1', min: '1' },
          { label: 'TP (pips)', value: tpPips, set: setTpPips, step: '1', min: '1' },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="hud-label"
              style={{
                fontSize: 7.5,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.14em',
                width: 54,
                flexShrink: 0,
              }}
            >
              {row.label}
            </span>
            <input
              type="number"
              value={row.value}
              onChange={(e) => row.set(e.target.value)}
              step={row.step}
              min={row.min}
              style={{
                flex: 1,
                padding: '3px 7px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.75)',
                fontFamily: 'JetBrains Mono',
                fontSize: 11,
                outline: 'none',
              }}
            />
          </div>
        ))}
        {/* R:R display */}
        <div style={{ display: 'flex', gap: 16, padding: '4px 0' }}>
          <div>
            <span className="hud-label" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
              SL{' '}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: '#ff1a6b' }}>
              {sl.toFixed(5)}
            </span>
          </div>
          <div>
            <span className="hud-label" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
              TP{' '}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: '#00d084' }}>
              {tp.toFixed(5)}
            </span>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span className="hud-label" style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
              R:R{' '}
            </span>
            <span className="font-mono" style={{ fontSize: 9, color: '#ffb300' }}>
              1:{rr}
            </span>
          </div>
        </div>
        {/* Submit */}
        <button
          onClick={placeOrder}
          disabled={busy || !connected}
          className="hud-label"
          style={{
            padding: '9px 0',
            fontSize: 9.5,
            letterSpacing: '0.26em',
            cursor: busy || !connected ? 'not-allowed' : 'pointer',
            border: `1px solid ${borderColor}`,
            background: `${borderColor}14`,
            color: borderColor,
            opacity: busy || !connected ? 0.5 : 1,
          }}
        >
          {busy ? '◌ PLACING…' : `▶ PLACE ${side}`}
        </button>
        {msg && (
          <span className="font-mono" style={{ fontSize: 9, color: '#00d084', textAlign: 'center' }}>
            {msg}
          </span>
        )}
        {err && (
          <span className="font-mono" style={{ fontSize: 9, color: '#ff1a6b', textAlign: 'center' }}>
            {err}
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDGET CELL RENDERER
   ══════════════════════════════════════════════════════════════════ */
export function WidgetCell({
  id,
  connected,
  livePrice,
  posRows,
  balance,
  equityArr,
  onRemove,
  activeSymbol = 'BTCUSD',
}: {
  id: WidgetId;
  connected: boolean;
  livePrice: number;
  posRows: PosRow[];
  balance: number;
  equityArr: number[];
  onRemove?: (id: WidgetId) => void;
  activeSymbol?: string;
}) {
  const def = WIDGET_REGISTRY.find((w) => w.id === id);
  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {onRemove && (
        <button
          onClick={() => onRemove(id)}
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            zIndex: 10,
            background: 'rgba(255,26,107,0.15)',
            border: '1px solid rgba(255,26,107,0.4)',
            color: '#ff1a6b',
            width: 14,
            height: 14,
            borderRadius: 2,
            cursor: 'pointer',
            fontSize: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          ×
        </button>
      )}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {id === 'PRICE_CHART' && (
          <WPriceChart connected={connected} livePrice={livePrice} symbol={activeSymbol} />
        )}
        {id === 'ORDER_BOOK' && <WOrderBook symbol={activeSymbol} />}
        {id === 'CVD' && <WCVD symbol={activeSymbol} />}
        {id === 'GAMMA_EXPOSURE' && <WGammaExposure />}
        {id === 'OPTIONS_FLOW' && <WOptionsFlow />}
        {id === 'DARK_POOL' && <WDarkPool />}
        {id === 'FUNDING_RATES' && <WFundingRates />}
        {id === 'CORRELATION' && <WCorrelation />}
        {id === 'YIELD_CURVE' && <WYieldCurve />}
        {id === 'COT_POSITIONING' && <WCotPositioning />}
        {id === 'LIQUIDITY_MAP' && <WLiquidityMap symbol={activeSymbol} />}
        {id === 'SECTOR_ROTATION' && <WSectorRotation />}
        {id === 'RISK_DASHBOARD' && <WRiskDashboard />}
        {id === 'CREDIT_SPREADS' && <WCreditSpreads />}
        {id === 'INST_FLOW' && <WInstFlow />}
        {id === 'VOL_SURFACE' && <WVolSurface />}
        {id === 'MACRO_POSITIONING' && <WMacroPositioning />}
        {id === 'POSITIONS' && <WPositions connected={connected} posRows={posRows} />}
        {id === 'EQUITY_CURVE' && <WEquityCurve balance={balance} equityArr={equityArr} />}
        {id === 'EXECUTION_LOG' && <WExecutionLog />}
        {id === 'ORDER_TICKET' && (
          <WOrderTicket connected={connected} livePrice={livePrice} activeSymbol={activeSymbol} />
        )}
        {!def && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="font-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
              UNKNOWN WIDGET: {id}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SETTINGS PANEL MODAL
   ══════════════════════════════════════════════════════════════════ */
