import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  data: Array<Record<string, number | string>>;
  leaderName: string | null;
  latestPrice: number | null;
  priceSource: "synthetic" | "coinbase";
  seed: string | null;
  regime: string | null;
};

const AGENTS = [
  { name: "Claude",  color: "#7F77DD" },
  { name: "GPT",     color: "#1D9E75" },
  { name: "Gemini",  color: "#EF9F27" },
];

const REGIME_BADGE: Record<string, { cls: string; label: string }> = {
  trending_up:   { cls: "bg-emerald-500/15 text-emerald-300",  label: "Trend ↑" },
  trending_down: { cls: "bg-rose-500/15 text-rose-300",        label: "Trend ↓" },
  breakout:      { cls: "bg-sky-500/15 text-sky-300",          label: "Breakout" },
  whipsaw:       { cls: "bg-amber-500/15 text-amber-200",      label: "Whipsaw" },
  volatile:      { cls: "bg-amber-500/15 text-amber-200",      label: "Volatile" },
  ranging:       { cls: "bg-blue-500/15 text-blue-300",        label: "Ranging" },
  "crash/rebound":{ cls: "bg-rose-500/15 text-rose-400",       label: "Crash/Rebound" },
  crash:         { cls: "bg-rose-600/20 text-rose-400",        label: "Crash 🔴" },
  idle:          { cls: "bg-white/5 text-muted",               label: "Idle" },
};

// Custom dot — only renders at the last data point.
function LiveDot(props: {
  cx?: number; cy?: number; index?: number; dataLength: number;
  color: string; isLeader: boolean;
}) {
  const { cx, cy, index, dataLength, color, isLeader } = props;
  if (!cx || !cy || index !== dataLength - 1) return null;
  return (
    <g>
      {isLeader && <circle cx={cx} cy={cy} r={12} fill={color} opacity={0.1} />}
      {isLeader && <circle cx={cx} cy={cy} r={7}  fill={color} opacity={0.2} />}
      <circle cx={cx} cy={cy} r={4}   fill={color} stroke="white" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={1.8} fill="white" opacity={0.85} />
    </g>
  );
}

// Custom tooltip
function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div
      style={{
        background: "rgba(7,9,20,0.97)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 14,
        padding: "10px 14px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        minWidth: 160,
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginBottom: 6 }}>
        t + {typeof label === "number" ? label.toFixed(1) : label}s
      </div>
      {sorted.map((item) => (
        <div key={item.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ color: item.color, fontSize: 12, fontWeight: 600 }}>{item.name}</span>
          <span
            style={{
              fontSize: 12, fontFamily: "monospace", fontWeight: 700,
              color: item.value >= 0 ? "#34d399" : "#f87171",
            }}
          >
            {item.value >= 0 ? "+" : ""}{item.value.toFixed(3)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function PnLChart({ data, leaderName, latestPrice, priceSource, seed: _seed, regime }: Props) {
  const regimeKey  = (regime ?? "idle").toLowerCase().replace(/ /g, "_");
  const badgeInfo  = REGIME_BADGE[regimeKey] ?? REGIME_BADGE["idle"]!;

  // Live PnL values from the last data point
  const lastPoint  = data[data.length - 1];
  const liveValues = AGENTS.map((a) => ({
    ...a,
    pnl: lastPoint ? ((lastPoint[a.name] as number) ?? 0) : 0,
  })).sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="glass-panel flex h-full flex-col rounded-[28px] p-5">
      {/* ── Header ── */}
      <div className="mb-4 shrink-0 flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] uppercase tracking-[0.4em] text-muted">AI Agent Race · PnL %</div>
          {/* Live mini-leaderboard */}
          <div className="mt-2 flex flex-wrap gap-3">
            {liveValues.map((a, i) => (
              <div key={a.name} className="flex items-center gap-1.5">
                {/* Rank badge */}
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    background: i === 0 ? `${a.color}28` : "rgba(255,255,255,0.06)",
                    color: i === 0 ? a.color : "rgba(255,255,255,0.4)",
                    border: `1px solid ${i === 0 ? a.color + "50" : "transparent"}`,
                  }}
                >
                  {i + 1}
                </span>
                {/* Name */}
                <span className="text-sm font-semibold" style={{ color: a.color }}>
                  {a.name}
                </span>
                {/* PnL */}
                <span
                  className="font-mono text-xs font-bold tabular-nums"
                  style={{ color: a.pnl >= 0 ? "#34d399" : "#f87171" }}
                >
                  {a.pnl >= 0 ? "+" : ""}{a.pnl.toFixed(3)}%
                </span>
                {/* Line swatch */}
                <div
                  className="h-px w-6 rounded-full opacity-70"
                  style={{ background: a.color }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right badges */}
        <div className="flex flex-wrap items-start justify-end gap-2 text-xs shrink-0">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 tabular-nums text-white">
            {latestPrice
              ? `$${latestPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase text-muted">
            {priceSource}
          </span>
          <span className={`rounded-full px-3 py-1 capitalize ${badgeInfo.cls}`}>
            {badgeInfo.label}
          </span>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
            <defs>
              {AGENTS.map(({ name, color }) => (
                <linearGradient key={name} id={`grad-${name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={leaderName === name ? 0.28 : 0.12} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
              {/* Glow filter for leader */}
              <filter id="leader-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <CartesianGrid
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="4 5"
              vertical={false}
            />

            <XAxis
              dataKey="elapsed"
              stroke="none"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              tickLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}s`}
            />
            <YAxis
              stroke="none"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              tickLine={false}
              unit="%"
              width={44}
            />

            {/* Zero baseline */}
            <ReferenceLine
              y={0}
              stroke="rgba(255,255,255,0.18)"
              strokeDasharray="6 4"
              label={{
                value: "0%",
                position: "insideTopRight",
                fill: "rgba(255,255,255,0.3)",
                fontSize: 9,
                offset: 4,
              }}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, strokeDasharray: "4 3" }}
            />

            {AGENTS.map(({ name, color }) => {
              const isLeader = leaderName === name;
              return (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={isLeader ? 2.5 : 1.5}
                  strokeOpacity={isLeader ? 1 : 0.65}
                  fill={`url(#grad-${name})`}
                  dot={(dotProps) => (
                    <LiveDot
                      key={`ld-${name}-${dotProps.index}`}
                      {...dotProps}
                      dataLength={data.length}
                      color={color}
                      isLeader={isLeader}
                    />
                  )}
                  isAnimationActive={false}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  activeDot={{ r: 5, strokeWidth: 1.5, stroke: "white", fill: color }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
