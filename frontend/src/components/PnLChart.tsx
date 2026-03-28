import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  data: Array<Record<string, number | string>>;
  leaderName: string | null;
  latestPrice: number | null;
  priceSource: "synthetic" | "coinbase";
  seed: string | null;
  regime: string | null;
};

const COLORS: Record<string, string> = {
  Claude: "#7F77DD",
  GPT: "#1D9E75",
  Gemini: "#EF9F27",
};

export function PnLChart({ data, leaderName, latestPrice, priceSource, seed, regime }: Props) {
  return (
    <div className="glass-panel h-full rounded-[28px] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted">BTC Race</div>
          <div className="mt-1 text-2xl font-semibold text-white">Live Performance Curves</div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-sm text-muted">
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
            BTC <span className="text-white">{latestPrice ? `$${latestPrice.toFixed(2)}` : "loading"}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 uppercase">{priceSource}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 uppercase">{regime ?? "idle"}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
            Leader <span className="text-white">{leaderName ?? "Awaiting first tick"}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Seed {seed ? seed.slice(0, 8) : "pending"}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="86%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="elapsed" stroke="rgba(255,255,255,0.5)" />
          <YAxis yAxisId="pnl" stroke="rgba(255,255,255,0.5)" unit="%" />
          <YAxis yAxisId="price" orientation="right" stroke="rgba(255,255,255,0.35)" hide />
          <Tooltip
            contentStyle={{
              background: "rgba(10, 12, 20, 0.94)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
            }}
          />
          <Legend />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="btcPrice"
            stroke="rgba(255,255,255,0.25)"
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
            name="BTC"
          />
          {Object.entries(COLORS).map(([name, color]) => (
            <Line
              key={name}
              yAxisId="pnl"
              type="monotone"
              dataKey={name}
              stroke={color}
              strokeWidth={leaderName === name ? 4 : 2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
