import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useEffect, useRef, useState } from "react";
import { AgentCard } from "./components/AgentCard";
import { AiProofPanel } from "./components/AiProofPanel";
import { ChatPanel } from "./components/ChatPanel";
import { Countdown } from "./components/Countdown";
import { PnLChart } from "./components/PnLChart";
import { QuickBet } from "./components/QuickBet";
import { RaceControl } from "./components/RaceControl";
import { RaceHistoryPanel } from "./components/RaceHistoryPanel";
import { TxFeed } from "./components/TxFeed";
import { useAgentPnL } from "./hooks/useAgentPnL";
import { useBettingOdds } from "./hooks/useBettingOdds";
import { useMonadWs } from "./hooks/useMonadWs";
import type { AiProofPayload, ConnectionPayload, DecisionPayload, MarketTickPayload, RaceRecord, RoundEndPayload, RoundStatePayload } from "./types";

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
  randomnessMode: "full-random",
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
  randomnessMode: "full-random",
};

export default function App() {
  const [roundState, setRoundState] = useState<RoundStatePayload>(INITIAL_ROUND_STATE);
  const [decisionFeed, setDecisionFeed] = useState<DecisionPayload[]>([]);
  const [latestRoundEnd, setLatestRoundEnd] = useState<RoundEndPayload | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionPayload>(INITIAL_CONNECTION);
  const [marketTick, setMarketTick] = useState<MarketTickPayload | null>(null);
  const [proofs, setProofs] = useState<AiProofPayload[]>([]);
  const [history, setHistory] = useState<RaceRecord[]>([]);
  const latestPriceRef = useRef<number | null>(null);
  const roundStartedAtRef = useRef<number | null>(null);

  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });

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
    onDecision: (payload) => setDecisionFeed((cur) => [...cur.slice(-99), payload]),
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
    onRoundEnd: setLatestRoundEnd,
    onConnection: setConnectionInfo,
    onAiProof: (payload) => setProofs((cur) => [...cur.slice(-11), payload]),
    onHistoryUpdate: setHistory,
  });

  useEffect(() => {
    const boot = async () => {
      const baseUrl = import.meta.env.VITE_AGENT_HTTP_URL ?? "http://localhost:8787";
      let statusResponse: Response;
      try {
        statusResponse = await fetch(`${baseUrl}/api/status`);
      } catch {
        return;
      }
      if (!statusResponse.ok) return;
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

      const agentsResponse = await fetch(`${baseUrl}/api/agents`);
      const agentsData = (await agentsResponse.json()) as { agents: typeof agents };
      handlePnlUpdate({ agents: agentsData.agents }, statusData.status.startedAt, latestPriceRef.current);
    };
    void boot();
  }, [handleOddsUpdate, handlePnlUpdate]);

  const startRaceWithOptions = async (options: { randomnessMode: "seeded" | "full-random"; seed: string | null }) => {
    const baseUrl = import.meta.env.VITE_AGENT_HTTP_URL ?? "http://localhost:8787";
    await fetch(`${baseUrl}/api/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
  };

  const sortedAgents = [...agents].sort((a, b) => a.rank - b.rank);

  const wsOnline = connectionState === "open";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col px-6 py-5">

      {/* ── Header ── */}
      <header className="mb-5 flex items-center gap-4">
        {/* Left: branding + status */}
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.5em] text-muted">Monad Blitz Seoul</div>
          <h1 className="mt-1 text-4xl font-bold text-white leading-none">MonadDerby</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className={`rounded-full px-2.5 py-1 ${wsOnline ? "bg-emerald-500/12 text-emerald-300" : "bg-amber-500/12 text-amber-300"}`}>
              {wsOnline ? "● Live" : "○ Reconnecting"}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1">{roundState.market}</span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 uppercase">AI {roundState.aiMode}</span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 uppercase">{connectionInfo.mode}</span>
            <span className="rounded-full bg-white/5 px-2.5 py-1">{marketTick?.regime ?? "idle"}</span>
          </div>
        </div>

        {/* Center: countdown */}
        <Countdown roundState={roundState} />

        {/* Right: race control + wallet */}
        <div className="flex items-center gap-3">
          <RaceControl roundState={roundState} onStart={startRaceWithOptions} />
          <button
            type="button"
            onClick={() => void open({ view: address ? "Account" : "Connect" })}
            className={[
              "rounded-2xl border px-5 py-3.5 text-sm font-semibold transition-all",
              isConnected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                : "border-white/15 bg-white/8 text-white hover:bg-white/12",
            ].join(" ")}
          >
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connect Wallet"}
          </button>
        </div>
      </header>

      {/* ── Winner Banner ── */}
      {latestRoundEnd ? (
        <section className="glass-panel mb-5 animate-riseIn rounded-[24px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(239,159,39,0.14),rgba(15,18,28,0.8))] px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.4em] text-amber-200/70">Winner</div>
              <div className="mt-0.5 text-xl font-semibold text-white">
                {latestRoundEnd.winnerName} wins Round #{latestRoundEnd.roundId}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 text-xs">
              <span className="rounded-full bg-black/30 px-4 py-2 text-slate-100">
                PnL {latestRoundEnd.finalPnls[latestRoundEnd.winnerIndex]?.toFixed(3)}%
              </span>
              <span className="rounded-full bg-black/30 px-4 py-2 font-mono text-slate-200">
                {latestRoundEnd.proofHash.slice(0, 14)}...
              </span>
              <span className={`rounded-full px-4 py-2 ${latestRoundEnd.betting.settled ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/12 text-amber-200"}`}>
                {latestRoundEnd.betting.settled ? "Settled on-chain" : "Settlement pending"}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Race History strip ── */}
      <section className="mb-5 shrink-0">
        <RaceHistoryPanel history={history} />
      </section>

      {/* ── Main grid: Chart | QuickBet | AgentCards ── */}
      <main className="grid min-h-0 flex-1 grid-cols-[1fr_220px_320px] gap-5">

        {/* Chart */}
        <PnLChart
          data={chartData}
          leaderName={leaderName}
          latestPrice={marketTick?.price ?? null}
          priceSource={roundState.priceSource}
          seed={roundState.seed}
          regime={marketTick?.regime ?? null}
        />

        {/* Quick Bet sidebar */}
        <QuickBet
          agents={agents}
          snapshot={snapshot}
          mode={roundState.bettingMode}
          userId={userId}
          roundState={roundState}
          latestRoundEnd={latestRoundEnd}
        />

        {/* Agent cards */}
        <div className="grid h-full grid-rows-[repeat(3,1fr)_130px] gap-4">
          {sortedAgents.map((agent) => (
            <AgentCard
              key={agent.name}
              agent={agent}
              isWinner={roundState.phase === "ended" && roundState.winnerName === agent.name}
            />
          ))}
          <AiProofPanel items={proofs} />
        </div>
      </main>

      {/* ── Bottom: Chat | Decision feed ── */}
      <section className="mt-5 shrink-0 grid grid-cols-[340px_1fr] gap-5 h-[220px]">
        <ChatPanel
          wsUrl={import.meta.env.VITE_AGENT_WS_URL ?? "ws://localhost:8787/ws"}
          userId={userId}
        />
        <TxFeed items={decisionFeed} />
      </section>
    </div>
  );
}
