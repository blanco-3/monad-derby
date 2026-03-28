import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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
  { name: "Claude", color: "#7F77DD" },
  { name: "GPT", color: "#1D9E75" },
  { name: "Gemini", color: "#EF9F27" },
];

const regimeBadge: Record<string, string> = {
  trending_up: "bg-emerald-500/15 text-emerald-300",
  trending_down: "bg-rose-500/15 text-rose-300",
  volatile: "bg-amber-500/15 text-amber-200",
  ranging: "bg-blue-500/15 text-blue-300",
  idle: "bg-white/5 text-muted",
};

export function PnLChart({ data, leaderName, latestPrice, priceSource, seed: _seed, regime }: Props) {
  const regimeKey = regime ?? "idle";
  const badgeCls = regimeBadge[regimeKey] ?? "bg-white/5 text-muted";

  return (
    <div className="glass-panel flex h-full flex-col rounded-[28px] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted">BTC / USD Race</div>
          <div className="mt-1 text-2xl font-semibold text-white">
            {leaderName ? (
              <>
                <span
                  style={{ color: AGENTS.find((a) => a.name === leaderName)?.color }}
                >
                  {leaderName}
                </span>{" "}
                leading
              </>
            ) : (
              "Live Performance"
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-sm">
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 tabular-nums text-white">
            {latestPrice ? `$${latestPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 uppercase text-muted">
            {priceSource}
          </span>
          <span className={`rounded-full px-4 py-1.5 capitalize ${badgeCls}`}>
            {regimeKey.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {AGENTS.map(({ name, color }) => (
                <linearGradient key={name} id={`grad-${name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="elapsed"
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}s`}
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              unit="%"
              width={42}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(8,10,20,0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16,
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                padding: "10px 14px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4 }}
              itemStyle={{ fontSize: 12 }}
              formatter={(value: number, name: string) => [`${value.toFixed(3)}%`, name]}
              labelFormatter={(label: number) => `t + ${label.toFixed(1)}s`}
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
              formatter={(value) => (
                <span style={{ color: AGENTS.find((a) => a.name === value)?.color ?? "#fff" }}>
                  {value}
                </span>
              )}
            />
            {AGENTS.map(({ name, color }) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stroke={color}
                strokeWidth={leaderName === name ? 3 : 1.5}
                fill={`url(#grad-${name})`}
                dot={false}
                isAnimationActive={false}
                strokeLinecap="round"
                strokeLinejoin="round"
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
