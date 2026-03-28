import { useEffect, useMemo, useRef, useState } from "react";
import { AgentCard } from "./components/AgentCard";
import { AiProofPanel } from "./components/AiProofPanel";
import { BetPanel } from "./components/BetPanel";
import { Countdown } from "./components/Countdown";
import { PnLChart } from "./components/PnLChart";
import { RaceControl } from "./components/RaceControl";
import { TxFeed } from "./components/TxFeed";
import { useAgentPnL } from "./hooks/useAgentPnL";
import { useBettingOdds } from "./hooks/useBettingOdds";
import { useMonadWs } from "./hooks/useMonadWs";
import type { AiProofPayload, ConnectionPayload, DecisionPayload, MarketTickPayload, RoundEndPayload, RoundStatePayload } from "./types";

const INITIAL_ROUND_STATE: RoundStatePayload = {
  mode: "mock",
  bettingMode: "mock",
  phase: "idle",
  roundId: 0,
  countdownRemaining: null,
  startedAt: null,
  endsAt: null,
  winnerIndex: null,
  winnerName: null,
  market: "BTC/USD",
  randomnessMode: "seeded",
  seed: null,
  aiMode: "disabled",
  priceFeedMode: "synthetic",
  priceSource: "synthetic",
};

const INITIAL_CONNECTION: ConnectionPayload = {
  mode: "mock",
  fallback: false,
  aiMode: "disabled",
  priceFeedMode: "synthetic",
  randomnessMode: "seeded",
};

export default function App() {
  const [roundState, setRoundState] = useState<RoundStatePayload>(INITIAL_ROUND_STATE);
  const [decisionFeed, setDecisionFeed] = useState<DecisionPayload[]>([]);
  const [latestRoundEnd, setLatestRoundEnd] = useState<RoundEndPayload | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionPayload>(INITIAL_CONNECTION);
  const [marketTick, setMarketTick] = useState<MarketTickPayload | null>(null);
  const [proofs, setProofs] = useState<AiProofPayload[]>([]);
  const latestPriceRef = useRef<number | null>(null);
  const roundStartedAtRef = useRef<number | null>(null);
  const [userId] = useState(() => {
    const existing = window.localStorage.getItem("monad-derby-user-id");
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem("monad-derby-user-id", next);
    return next;
  });

  const { agents, chartData, leaderName, handlePnlUpdate, reset } = useAgentPnL();
  const { snapshot, handleOddsUpdate } = useBettingOdds();
  const { connectionState } = useMonadWs({
    onDecision: (payload) => {
      setDecisionFeed((current) => [...current.slice(-99), payload]);
    },
    onMarketTick: (payload) => {
      latestPriceRef.current = payload.price;
      setMarketTick(payload);
    },
    onPnlUpdate: (payload) => handlePnlUpdate(payload, roundStartedAtRef.current, latestPriceRef.current),
    onOddsUpdate: handleOddsUpdate,
    onRoundState: (payload) => {
      roundStartedAtRef.current = payload.startedAt;
      setRoundState(payload);
      if (payload.phase === "countdown") {
        reset();
        setDecisionFeed([]);
        setLatestRoundEnd(null);
        setProofs([]);
      }
    },
    onRoundEnd: (payload) => {
      setLatestRoundEnd(payload);
    },
    onConnection: setConnectionInfo,
    onAiProof: (payload) => {
      setProofs((current) => [...current.slice(-11), payload]);
    },
  });

  useEffect(() => {
    const boot = async () => {
      const statusResponse = await fetch(import.meta.env.VITE_AGENT_HTTP_URL ?? "http://localhost:8787/api/status");
      const statusData = (await statusResponse.json()) as {
        status: RoundStatePayload;
        betting: typeof snapshot;
        connection: ConnectionPayload;
        proofs: AiProofPayload[];
      };
      setRoundState(statusData.status);
      roundStartedAtRef.current = statusData.status.startedAt;
      handleOddsUpdate(statusData.betting);
      setConnectionInfo(statusData.connection);
      setProofs(statusData.proofs ?? []);

      const agentsResponse = await fetch((import.meta.env.VITE_AGENT_HTTP_URL ?? "http://localhost:8787") + "/api/agents");
      const agentsData = (await agentsResponse.json()) as { agents: typeof agents };
      handlePnlUpdate({ agents: agentsData.agents }, statusData.status.startedAt, latestPriceRef.current);
    };

    void boot();
  }, [handleOddsUpdate, handlePnlUpdate]);

  const sortedAgents = useMemo(() => [...agents].sort((a, b) => a.rank - b.rank), [agents]);

  const startRace = async () => {
    return;
  };

  const startRaceWithOptions = async (options: { randomnessMode: "seeded" | "full-random"; seed: string | null }) => {
    await fetch((import.meta.env.VITE_AGENT_HTTP_URL ?? "http://localhost:8787") + "/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1680px] px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.45em] text-muted">Monad Blitz Seoul</div>
          <h1 className="mt-2 text-5xl font-bold text-white">MonadDerby</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className={`rounded-full px-3 py-1 ${connectionState === "open" ? "bg-emerald-500/12 text-emerald-300" : "bg-amber-500/12 text-amber-300"}`}>
              {connectionState === "open" ? "WS Online" : "Reconnecting"}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1">{roundState.market}</span>
            <span className="rounded-full bg-white/5 px-3 py-1 uppercase">{roundState.randomnessMode}</span>
            <span className="rounded-full bg-white/5 px-3 py-1 uppercase">AI {roundState.aiMode}</span>
            <span className="rounded-full bg-white/5 px-3 py-1 uppercase">{roundState.priceSource}</span>
            <span className="rounded-full bg-white/5 px-3 py-1">{marketTick?.regime ?? "idle"}</span>
            <span className="rounded-full bg-white/5 px-3 py-1">
              {connectionInfo.mode.toUpperCase()}
              {connectionInfo.fallback ? " fallback" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Countdown roundState={roundState} />
          <RaceControl roundState={roundState} onStart={startRaceWithOptions} />
        </div>
      </header>

      {latestRoundEnd ? (
        <section className="glass-panel mb-6 animate-riseIn rounded-[28px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(239,159,39,0.16),rgba(15,18,28,0.8))] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-amber-200/80">Winner Locked</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {latestRoundEnd.winnerName} wins the BTC race
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 text-sm">
              <span className="rounded-full bg-black/25 px-4 py-2 text-slate-100">
                Best PnL {latestRoundEnd.finalPnls[latestRoundEnd.winnerIndex]?.toFixed(2)}%
              </span>
              <span className="rounded-full bg-black/25 px-4 py-2 text-slate-100">
                Proof <span className="font-mono">{latestRoundEnd.proofHash.slice(0, 12)}...</span>
              </span>
              <span className={`rounded-full px-4 py-2 ${latestRoundEnd.betting.settled ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
                {latestRoundEnd.betting.settled ? "On-chain settled" : "Settlement pending"}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      <main className="grid grid-cols-[1.8fr_1fr] gap-6">
        <section className="h-[620px]">
          <PnLChart
            data={chartData}
            leaderName={leaderName}
            latestPrice={marketTick?.price ?? null}
            priceSource={roundState.priceSource}
            seed={roundState.seed}
            regime={marketTick?.regime ?? null}
          />
        </section>
        <section className="grid h-[620px] grid-rows-[repeat(3,minmax(0,1fr))_160px] gap-4">
          {sortedAgents.map((agent) => (
            <AgentCard key={agent.name} agent={agent} isWinner={roundState.phase === "ended" && roundState.winnerName === agent.name} />
          ))}
          <AiProofPanel items={proofs} />
        </section>
      </main>

      <section className="mt-6 grid grid-cols-[1.2fr_1fr] gap-6">
        <div className="h-[340px]">
          <TxFeed items={decisionFeed} />
        </div>
        <div className="h-[340px]">
          <BetPanel
            agents={agents}
            snapshot={snapshot}
            mode={roundState.bettingMode}
            userId={userId}
            latestRoundEnd={latestRoundEnd}
          />
        </div>
      </section>
    </div>
  );
}
