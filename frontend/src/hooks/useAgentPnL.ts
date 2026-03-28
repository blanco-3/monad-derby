import { useCallback, useMemo, useState } from "react";
import type { AgentState } from "../types";

export function useAgentPnL() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [chartData, setChartData] = useState<Array<Record<string, number | string>>>([]);

  const handlePnlUpdate = useCallback(
    (payload: { agents: AgentState[] }, startedAt: number | null, latestPrice: number | null) => {
      // No startTransition — chart updates must be immediate (live-feel)
      setAgents(payload.agents);
      setChartData((current) => {
        const elapsed = startedAt ? Math.max(0, Number(((Date.now() - startedAt) / 1000).toFixed(1))) : current.length * 0.5;
        const nextPoint: Record<string, number | string> = {
          elapsed,
          btcPrice: latestPrice ?? current[current.length - 1]?.btcPrice ?? 0,
        };
        payload.agents.forEach((agent) => {
          nextPoint[agent.name] = agent.pnlPercent;
        });
        // Skip this point if no PnL moved — prevents zero-slope flat segments
        const last = current[current.length - 1];
        if (last) {
          const anyMoved = payload.agents.some(
            (a) => Math.abs(((last[a.name] as number) ?? 0) - (nextPoint[a.name] as number)) >= 0.001,
          );
          if (!anyMoved) return current;
        }
        return [...current.slice(-299), nextPoint];
      });
    },
    [],
  );

  const leaderName = useMemo(() => {
    return [...agents].sort((a, b) => a.rank - b.rank)[0]?.name ?? null;
  }, [agents]);

  const reset = useCallback(() => {
    setChartData([]);
  }, []);

  return {
    agents,
    chartData,
    leaderName,
    handlePnlUpdate,
    reset,
  };
}
