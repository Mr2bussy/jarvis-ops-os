/**
 * GodModeChart — lightweight-charts v5 candlestick for Jarvis GodMode tab.
 * Fetches directly from Binance public API (no backend needed).
 * Renders Entry (cyan), SL (red), TP1/TP2 (green) price lines.
 */
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type IPriceLine,
  type PriceLineOptions,
  ColorType,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import { useEffect, useRef, useState, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────────────────────── */
export interface GodModeTradeSetup {
  entry: number | null;
  sl:    number | null;
  tp1:   number | null;
  tp2:   number | null;
  bias:  "long" | "short" | null;
}

interface Props {
  symbol?:   string;
  interval?: string;
  setup?:    GodModeTradeSetup;
}

/* ─── Binance symbol map ───────────────────────────────────────────────────── */
function toBinanceSymbol(sym: string): string | null {
  const MAP: Record<string, string> = {
    BTCUSD: "BTCUSDT", ETHUSD: "ETHUSDT", SOLUSD: "SOLUSDT",
    BNBUSD: "BNBUSDT", XRPUSD: "XRPUSDT", DOGEUSD: "DOGEUSDT",
    ADAUSD: "ADAUSDT", AVAXUSD: "AVAXUSDT", DOTUSD: "DOTUSDT",
    LINKUSD: "LINKUSDT", MATICUSD: "MATICUSDT", LTCUSD: "LTCUSDT",
    SHIBUSDT: "SHIBUSDT", NEARUSD: "NEARUSDT", INJUSD: "INJUSDT",
    SUIUSD: "SUIUSDT", APTUSD: "APTUSDT", ARBUSD: "ARBUSDT",
  };
  return MAP[sym] ?? null;
}

/* ─── Yahoo Finance fallback symbol map ──────────────────────────────────────── */
function toYahooSymbol(sym: string): string | null {
  const MAP: Record<string, string> = {
    XAUUSD: 'GC=F',      XAGUSD: 'SI=F',
    US500:  '^GSPC',     US30:   '^DJI',     NAS100: '^NDX',
    DAX:    '^GDAXI',    FTSE:   '^FTSE',
    EURUSD: 'EURUSD=X',  USDJPY: 'USDJPY=X', GBPUSD: 'GBPUSD=X',
    USDCHF: 'USDCHF=X',  AUDUSD: 'AUDUSD=X', NZDUSD: 'NZDUSD=X',
    EURGBP: 'EURGBP=X',  GBPJPY: 'GBPJPY=X', EURJPY: 'EURJPY=X',
    OIL:    'CL=F',      USOIL:  'CL=F',     UKOIL:  'BZ=F',
  };
  return MAP[sym] ?? null;
}

const YAHOO_INTERVAL_MAP: Record<string, { interval: string; range: string }> = {
  '1m':  { interval: '1m',  range: '1d'  },
  '3m':  { interval: '2m',  range: '5d'  },
  '5m':  { interval: '5m',  range: '5d'  },
  '15m': { interval: '15m', range: '5d'  },
  '30m': { interval: '30m', range: '1mo' },
  '1h':  { interval: '1h',  range: '3mo' },
  '2h':  { interval: '1h',  range: '3mo' },
  '4h':  { interval: '1h',  range: '3mo' },
  '6h':  { interval: '1h',  range: '3mo' },
  '8h':  { interval: '1h',  range: '3mo' },
  '12h': { interval: '1h',  range: '3mo' },
  '1d':  { interval: '1d',  range: '2y'  },
  '3d':  { interval: '1d',  range: '2y'  },
  '1w':  { interval: '1wk', range: '5y'  },
};

/* ─── Palette ────────────────────────────────────────────────────────────── */
const C = {
  bg:       "#03060B",
  grid:     "#0c1a22",
  text:     "#7ecddd",
  entry:    "#22D3EE",
  sl:       "#EF4444",
  tp1:      "#10B981",
  tp2:      "#34D399",
  wick:     "#4B5563",
  bull:     "#06B6D4",
  bear:     "#EF4444",
};

const INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function GodModeChart({
  symbol = "BTCUSD",
  interval: initialInterval = "4h",
  setup,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRefs     = useRef<Record<string, IPriceLine | null>>({
    entry: null, sl: null, tp1: null, tp2: null,
  });

  const [interval, setInterval] = useState(initialInterval);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [noData, setNoData]     = useState(false);

  /* ── Init chart ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor: C.text,
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: C.grid },
        horzLines: { color: C.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.entry, width: 1, style: LineStyle.Dotted, labelBackgroundColor: "#0a1f26" },
        horzLine: { color: C.entry, width: 1, style: LineStyle.Dotted, labelBackgroundColor: "#0a1f26" },
      },
      rightPriceScale: {
        borderColor: C.grid,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: C.grid,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:         C.bull,
      downColor:       C.bear,
      borderUpColor:   C.bull,
      borderDownColor: C.bear,
      wickUpColor:     C.entry,
      wickDownColor:   C.wick,
    });

    chartRef.current  = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (el) {
        chart.applyOptions({ width: el.clientWidth, height: el.clientHeight || 380 });
        chart.timeScale().fitContent();
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  }, []);

  /* ── Fetch candles (parallel pages, AbortController for instant cancel) ── */
  const abortRef = useRef<AbortController | null>(null);

  const fetchCandles = useCallback(async () => {
    const binanceSym = toBinanceSymbol(symbol);
    const yahooSym   = toYahooSymbol(symbol);

    if (!binanceSym && !yahooSym) {
      setNoData(true);
      setLoading(false);
      return;
    }
    setNoData(false);
    if (!seriesRef.current) return;

    // Cancel any in-flight fetch from a previous interval/symbol change
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);

    /* ── Yahoo Finance path (forex / metals / indices) ─────────────────────────── */
    if (!binanceSym && yahooSym) {
      try {
        const { interval: yiv, range } = YAHOO_INTERVAL_MAP[interval] ?? { interval: '1h', range: '3mo' };
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${yiv}&range=${range}&includePrePost=false`,
          { signal: ac.signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (ac.signal.aborted) return;
        const result = json?.chart?.result?.[0];
        if (!result) throw new Error('No chart data');
        const ts: number[] = result.timestamp ?? [];
        const q = result.indicators?.quote?.[0] ?? {};
        const candles: CandlestickData[] = ts
          .map((t, i): CandlestickData | null => {
            const c = q.close?.[i];
            if (c == null || isNaN(c)) return null;
            return {
              time:  t as CandlestickData['time'],
              open:  q.open?.[i]  ?? c,
              high:  q.high?.[i]  ?? c,
              low:   q.low?.[i]   ?? c,
              close: c,
            };
          })
          .filter((c): c is CandlestickData => c !== null);
        if (!ac.signal.aborted) {
          seriesRef.current?.setData(candles);
          chartRef.current?.timeScale().fitContent();
        }
      } catch (e: unknown) {
        if ((e as Error)?.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load candles');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
      return;
    }

    /* ── Binance path (crypto) ─────────────────────────────────────────────────── */
    try {
      type RawKline = [number, string, string, string, string, ...unknown[]];
      const BATCH = 1000;

      // How many pages to fetch per interval (fast TFs need fewer — less history needed)
      const PAGES: Record<string, number> = {
        "1m": 2, "3m": 2, "5m": 3, "15m": 3,
        "30m": 4, "1h": 4, "2h": 5, "4h": 5, "6h": 5, "8h": 5,
        "12h": 5, "1d": 5, "3d": 5, "1w": 5,
      };
      const pages = PAGES[interval] ?? 5;

      // First fetch to get current time anchor & discover oldest available candle time
      const firstRes = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${binanceSym!}&interval=${interval}&limit=${BATCH}`,
        { signal: ac.signal }
      );
      if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
      const firstBatch: RawKline[] = await firstRes.json();
      if (!Array.isArray(firstBatch) || firstBatch.length === 0) throw new Error("No candles");

      // Build endTime anchors for remaining pages in one shot
      let endTime = firstBatch[0][0] - 1;
      const extraFetches: Promise<RawKline[]>[] = [];
      for (let p = 1; p < pages; p++) {
        const et = endTime;
        extraFetches.push(
          fetch(
            `https://api.binance.com/api/v3/klines?symbol=${binanceSym!}&interval=${interval}&limit=${BATCH}&endTime=${et}`,
            { signal: ac.signal }
          ).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
        );
        // Estimate the endTime for the next page (interval ms × BATCH candles back)
        const intervalMs: Record<string, number> = {
          "1m": 60000, "3m": 180000, "5m": 300000, "15m": 900000,
          "30m": 1800000, "1h": 3600000, "2h": 7200000, "4h": 14400000,
          "6h": 21600000, "8h": 28800000, "12h": 43200000,
          "1d": 86400000, "3d": 259200000, "1w": 604800000,
        };
        endTime = et - (intervalMs[interval] ?? 14400000) * BATCH;
      }

      const extraBatches = await Promise.all(extraFetches);

      // Merge all batches, deduplicate, sort ascending
      const allRaw: RawKline[] = [...firstBatch, ...extraBatches.flat()];
      const seen = new Set<number>();
      const candles: CandlestickData[] = allRaw
        .filter(k => { const t = k[0]; if (seen.has(t)) return false; seen.add(t); return true; })
        .sort((a, b) => a[0] - b[0])
        .map(k => ({
          time:  Math.floor(k[0] / 1000) as CandlestickData["time"],
          open:  parseFloat(k[1]),
          high:  parseFloat(k[2]),
          low:   parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));

      if (ac.signal.aborted) return; // stale — newer request already fired
      seriesRef.current?.setData(candles);
      chartRef.current?.timeScale().fitContent();
    } catch (e: unknown) {
      if ((e as Error)?.name === "AbortError") return; // intentionally cancelled
      setError(e instanceof Error ? e.message : "Failed to load candles");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [symbol, interval]);

  useEffect(() => { fetchCandles(); }, [fetchCandles]);

  /* ── Draw price lines ───────────────────────────────────────────────── */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const upsert = (key: string, price: number | null | undefined, opts: Partial<PriceLineOptions>) => {
      if (lineRefs.current[key]) {
        series.removePriceLine(lineRefs.current[key]!);
        lineRefs.current[key] = null;
      }
      if (price && price > 0) {
        lineRefs.current[key] = series.createPriceLine({
          price,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "",
          color: "#ffffff",
          ...opts,
        } as PriceLineOptions);
      }
    };

    if (!setup) {
      Object.keys(lineRefs.current).forEach(k => upsert(k, null, {}));
      return;
    }

    upsert("entry", setup.entry, {
      color: C.entry,
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      title: `ENTRY  ${setup.entry?.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    });
    upsert("sl", setup.sl, {
      color: C.sl,
      lineWidth: 1,
      title: `SL  ${setup.sl?.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    });
    upsert("tp1", setup.tp1, {
      color: C.tp1,
      lineWidth: 1,
      title: `TP1  ${setup.tp1?.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    });
    upsert("tp2", setup.tp2, {
      color: C.tp2,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: `TP2  ${setup.tp2?.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    });
  }, [setup]);


  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Interval selector */}
      <div style={{ display: "flex", gap: 4, padding: "4px 0 6px", flexShrink: 0 }}>
        {INTERVALS.map(iv => (
          <button
            key={iv}
            onClick={() => setInterval(iv)}
            className="hud-label"
            style={{
              padding: "2px 7px",
              fontSize: 8,
              letterSpacing: "0.14em",
              cursor: "pointer",
              background: interval === iv ? "rgba(34,211,238,0.15)" : "transparent",
              color: interval === iv ? C.entry : "rgba(255,255,255,0.35)",
              border: `1px solid ${interval === iv ? C.entry + "80" : "rgba(255,255,255,0.08)"}`,
              transition: "all 0.15s",
            }}
          >
            {iv.toUpperCase()}
          </button>
        ))}
        <button
          onClick={fetchCandles}
          className="hud-label"
          style={{
            marginLeft: "auto",
            padding: "2px 8px",
            fontSize: 8,
            letterSpacing: "0.14em",
            cursor: "pointer",
            background: "transparent",
            color: "rgba(255,255,255,0.3)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          ↻
        </button>
      </div>

      {/* Chart container */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 200 }} />
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", background: "rgba(3,6,11,0.75)",
            color: C.entry, fontSize: 10, fontFamily: "monospace", letterSpacing: "0.2em",
          }}>
            LOADING…
          </div>
        )}
        {noData && !loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", background: "rgba(3,6,11,0.88)",
            color: "rgba(255,255,255,0.25)", fontSize: 9, fontFamily: "monospace",
            textAlign: "center", padding: 20, gap: 8, letterSpacing: "0.18em",
          }}>
            <div style={{ fontSize: 22, marginBottom: 4, opacity: 0.3 }}>◇</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>NO DATA SOURCE</div>
            <div style={{ fontSize: 8, opacity: 0.6 }}>{symbol} · NOT MAPPED</div>
          </div>
        )}
        {error && !loading && !noData && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", color: C.sl, fontSize: 10, fontFamily: "monospace",
            textAlign: "center", padding: 16,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
