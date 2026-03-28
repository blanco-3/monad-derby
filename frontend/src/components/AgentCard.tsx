import type { AgentState } from "../types";

const rankLabel = (rank: number) => {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  return "3rd";
};

const stanceTone: Record<AgentState["stance"], string> = {
  long: "text-emerald-300",
  short: "text-rose-300",
  flat: "text-slate-300",
};

export function AgentCard({ agent, isWinner = false }: { agent: AgentState; isWinner?: boolean }) {
  const isPositive = agent.pnlPercent >= 0;

  return (
    <div
      className={`glass-panel animate-riseIn h-full overflow-hidden rounded-[24px] p-4 ${
        isWinner ? "border-[rgba(255,255,255,0.2)] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_80px_rgba(0,0,0,0.45),0_0_48px_rgba(127,119,221,0.12)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full shadow-[0_0_18px_currentColor]" style={{ color: agent.color, backgroundColor: agent.color }} />
          <div>
            <div className="text-lg font-semibold text-white">{agent.name}</div>
            <div className="max-w-[260px] text-xs text-muted">{agent.strategyDescription}</div>
          </div>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs ${isWinner ? "border-amber-300/40 bg-amber-400/10 text-amber-200" : "border-white/10 text-muted"}`}>
          {isWinner ? `Winner ${rankLabel(agent.rank)}` : rankLabel(agent.rank)}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className={`font-mono text-3xl font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
          {isPositive ? "+" : ""}
          {agent.pnlPercent.toFixed(2)}%
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
            <span className="text-muted">Exp</span> {agent.exposurePercent.toFixed(0)}%
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
            <span className="text-muted">Conf</span> {agent.confidence}%
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold uppercase ${stanceTone[agent.stance]}`}>
          {agent.stance}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase text-slate-200">{agent.source}</span>
      </div>

      <div className="mt-3 min-h-[74px] rounded-2xl border border-white/8 bg-white/5 p-3 text-sm text-slate-200">
        {agent.lastDecision ? (
          <div className="space-y-2">
            <div className="font-mono text-xs text-white">
              {agent.lastDecision.action.toUpperCase()} {agent.lastDecision.sizePercent}% @ ${agent.lastDecision.price.toFixed(2)}
            </div>
            <div className="max-h-[2.8rem] overflow-hidden text-xs text-slate-300">{agent.lastDecision.reason}</div>
          </div>
        ) : (
          <div className="text-xs text-muted">Waiting for the first market read.</div>
        )}
      </div>
    </div>
  );
}
