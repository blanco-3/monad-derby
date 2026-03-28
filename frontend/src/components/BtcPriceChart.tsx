import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Candle = {
  t: number;   // open time ms
  o: number; h: number; l: number; c: number;
  closed: boolean;
};

type Point = { time: string; price: number; open: number };

const REST_URL = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=90";
const WS_URL   = "wss://stream.binance.com:9443/ws/btcusdt@kline_1m";

function toPoint(c: Candle): Point {
  const d = new Date(c.t);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { time: `${hh}:${mm}`, price: c.c, open: c.o };
}

export function BtcPriceChart() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    // ── 1. Fetch historical candles ──────────────────────────────────────
    fetch(REST_URL)
      .then((r) => r.json())
      .then((rows: unknown[]) => {
        if (cancelledRef.current) return;
        const hist: Candle[] = (rows as number[][]).map((k) => ({
          t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], closed: true,
        }));
        setCandles(hist);
      })
      .catch(() => { /* graceful fail */ });

    // ── 2. Real-time WebSocket ────────────────────────────────────────────
    const connect = () => {
      if (cancelledRef.current) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { k: { t: number; o: string; h: string; l: string; c: string; x: boolean } };
          const k = msg.k;
          const candle: Candle = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, closed: k.x };
          setCandles((prev) => {
            const idx = prev.findIndex((c) => c.t === candle.t);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = candle;
              return next;
            }
            return [...prev.slice(-89), candle];
          });
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (!cancelledRef.current) retryRef.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      cancelledRef.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  const points = candles.map(toPoint);
  const last   = candles[candles.length - 1];
  const prev   = candles[candles.length - 2];

  const priceUp    = last && prev ? last.c >= prev.c : true;
  const lineColor  = priceUp ? "#34d399" : "#f87171";
  const changePct  = last && prev ? ((last.c - prev.c) / prev.c) * 100 : null;

  // Y-axis domain with small padding
  const prices = points.map((p) => p.price);
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 0;
  const pad  = (maxP - minP) * 0.15 || 1;

  return (
    <div className="glass-panel flex h-full flex-col rounded-[28px] p-4">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.4em] text-muted">BTC / USDT · 1m</div>
            <div className="mt-0.5 text-lg font-bold tabular-nums leading-none" style={{ color: lineColor }}>
              {last
                ? `$${last.c.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—"}
            </div>
          </div>
          {changePct !== null && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                priceUp ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
              }`}
            >
              {changePct >= 0 ? "+" : ""}{changePct.toFixed(3)}%
            </span>
          )}
        </div>
        <div className="flex gap-3 text-[10px] text-muted/60 tabular-nums">
          {last && (
            <>
              <span>H <span className="text-slate-300">${last.h.toLocaleString()}</span></span>
              <span>L <span className="text-slate-300">${last.l.toLocaleString()}</span></span>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted">Connecting to Binance…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="btc-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="none"
                tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 9 }}
                tickLine={false}
                interval={14}
              />
              <YAxis
                stroke="none"
                tick={{ fill: "rgba(255,255,255,0.28)", fontSize: 9 }}
                tickLine={false}
                width={54}
                domain={[minP - pad, maxP + pad]}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(8,10,22,0.97)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "8px 12px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}
                itemStyle={{ fontSize: 11 }}
                formatter={(v: number) => [
                  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                  "BTC",
                ]}
                cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={lineColor}
                strokeWidth={1.5}
                fill="url(#btc-fill)"
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: lineColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
