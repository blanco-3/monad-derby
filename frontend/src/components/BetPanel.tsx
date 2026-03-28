import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import { BrowserProvider, Contract, parseEther, type Eip1193Provider } from "ethers";
import { useEffect, useState } from "react";
import { bettingPoolAbi, contractAddresses } from "../lib/contracts";
import { usingFallbackReownProjectId } from "../lib/reown";
import type { AgentState, BettingSnapshot, RoundEndPayload } from "../types";

type Props = {
  agents: AgentState[];
  snapshot: BettingSnapshot;
  mode: "mock" | "chain";
  userId: string;
  latestRoundEnd: RoundEndPayload | null;
};

export function BetPanel({ agents, snapshot, mode, userId, latestRoundEnd }: Props) {
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [amount, setAmount] = useState("10");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [lastBet, setLastBet] = useState<{ agentIndex: number; amount: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<unknown>("eip155");
  const walletAddress = address ?? null;

  useEffect(() => {
    if (!latestRoundEnd || !lastBet) return;
    if (mode === "mock") {
      const payout = latestRoundEnd.payouts?.[userId] ?? 0;
      setConfirmation(
        payout > 0
          ? `You won! +${payout.toFixed(2)} MON`
          : latestRoundEnd.winnerIndex === lastBet.agentIndex
            ? "Winner confirmed. Claim path is on-chain."
            : "Better luck next time",
      );
      return;
    }

    setConfirmation(
      latestRoundEnd.winnerIndex === lastBet.agentIndex ? "Winning ticket placed. Claim on-chain." : "Better luck next time",
    );
  }, [latestRoundEnd, lastBet, mode, userId]);

  const placeBet = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setConfirmation("Enter a valid amount");
      return;
    }

    setPlacing(true);
    try {
      if (mode === "mock") {
        const response = await fetch(import.meta.env.VITE_AGENT_HTTP_URL ?? "http://localhost:8787/api/bet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, agentIndex: selectedAgent, amount: numericAmount }),
        });
        const data = (await response.json()) as { ok: boolean; error?: string };
        if (!data.ok) throw new Error(data.error ?? "bet failed");
        setConfirmation(
          walletAddress
            ? `Demo bet placed: ${numericAmount} MON on ${agents[selectedAgent]?.name ?? "agent"} as ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
            : `Demo bet placed: ${numericAmount} MON on ${agents[selectedAgent]?.name ?? "agent"}`,
        );
      } else {
        if (!isConnected || !walletProvider || !walletAddress) {
          setConfirmation("Connect a wallet through Reown first");
          await open({ view: "Connect" });
          return;
        }
        if (!contractAddresses.betting) throw new Error("Betting contract missing");

        const provider = new BrowserProvider(walletProvider as Eip1193Provider, chainId ? Number(chainId) : undefined);
        const signer = await provider.getSigner(walletAddress);
        const contract = new Contract(contractAddresses.betting, bettingPoolAbi, signer);
        const tx = await contract.placeBet(selectedAgent, { value: parseEther(numericAmount.toString()) });
        await tx.wait();
        setConfirmation(`Your bet: ${numericAmount} MON on ${agents[selectedAgent]?.name ?? "agent"} submitted`);
      }

      setLastBet({ agentIndex: selectedAgent, amount: numericAmount });
    } catch (error) {
      setConfirmation(error instanceof Error ? error.message : "Bet failed");
    } finally {
      setPlacing(false);
    }
  };

  const claimWinnings = async () => {
    if (!isConnected || !walletProvider || !walletAddress) {
      setConfirmation("지갑을 먼저 연결하세요");
      await open({ view: "Connect" });
      return;
    }
    if (!contractAddresses.betting) {
      setConfirmation("베팅 컨트랙트 주소가 없습니다");
      return;
    }
    setClaiming(true);
    try {
      const provider = new BrowserProvider(walletProvider as Eip1193Provider, chainId ? Number(chainId) : undefined);
      const signer = await provider.getSigner(walletAddress);
      const contract = new Contract(contractAddresses.betting, bettingPoolAbi, signer);
      const tx = await contract.claimWinnings();
      await tx.wait();
      setConfirmation("상금 수령 완료!");
    } catch (error) {
      setConfirmation(error instanceof Error ? error.message : "수령 실패");
    } finally {
      setClaiming(false);
    }
  };

  const openWalletModal = async () => {
    await open({ view: walletAddress ? "Account" : "Connect" });
  };

  const canClaim =
    mode === "chain" &&
    latestRoundEnd !== null &&
    lastBet !== null &&
    latestRoundEnd.winnerIndex === lastBet.agentIndex &&
    latestRoundEnd.betting.settled;

  return (
    <div className="glass-panel flex h-full flex-col rounded-[28px] p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-muted">Betting Panel</div>
          <div className="mt-1 text-2xl font-semibold text-white">Predict The Winner</div>
        </div>
        <button
          type="button"
          onClick={() => void openWalletModal()}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
        >
          {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect Wallet"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 ${isConnected ? "bg-emerald-500/12 text-emerald-300" : "bg-white/5 text-muted"}`}>
          {isConnected ? "Reown Connected" : "Reown Ready"}
        </span>
        <span className="rounded-full bg-white/5 px-3 py-1 text-muted">{mode === "chain" ? "On-chain bets" : "Mock bets"}</span>
        {usingFallbackReownProjectId ? (
          <span className="rounded-full bg-amber-500/12 px-3 py-1 text-amber-200">localhost project ID</span>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {agents.map((agent, index) => (
          <button
            key={agent.name}
            type="button"
            onClick={() => setSelectedAgent(index)}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              selectedAgent === index ? "border-white/30 bg-white/10" : "border-white/10 bg-white/5"
            }`}
          >
            <div className="text-lg font-semibold" style={{ color: agent.color }}>
              {agent.name}
            </div>
            <div className="mt-2 font-mono text-sm text-white">{(snapshot.odds[index] ?? 0).toFixed(2)}x</div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <input
          type="number"
          min="0"
          step="0.1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg text-white outline-none"
        />
        <button
          type="button"
          onClick={() => void placeBet()}
          disabled={placing}
          className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-60"
        >
          {placing ? "Placing..." : "Place Bet"}
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/8 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm uppercase tracking-[0.2em] text-muted">Pool Heat</span>
          <span className="font-mono text-white">{snapshot.totalPool.toFixed(2)} MON</span>
        </div>
        <div className="space-y-3">
          {agents.map((agent, index) => {
            const total = snapshot.totalPool || 1;
            const width = ((snapshot.pools[index] ?? 0) / total) * 100;
            return (
              <div key={agent.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{agent.name}</span>
                  <span className="font-mono text-muted">{(snapshot.pools[index] ?? 0).toFixed(2)} MON</span>
                </div>
                <div className="h-2 rounded-full bg-white/6">
                  <div className="h-2 rounded-full" style={{ width: `${width}%`, backgroundColor: agent.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {canClaim ? (
        <button
          type="button"
          onClick={() => void claimWinnings()}
          disabled={claiming}
          className="mt-4 w-full rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-black disabled:opacity-60"
        >
          {claiming ? "수령 중..." : "상금 수령 (Claim Winnings)"}
        </button>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/8 bg-black/30 p-4 text-sm text-slate-200">
        <div>
          {confirmation ??
            (mode === "mock"
              ? "Mock mode keeps the race stable. Reown wallet connection is optional and used for demo identity only."
              : "Connect through Reown and place an on-chain bet from the modal-selected wallet.")}
        </div>
        {latestRoundEnd ? (
          <div className="mt-3 border-t border-white/8 pt-3 text-xs text-slate-400">
            Winner {latestRoundEnd.winnerName} | Settled {latestRoundEnd.betting.settled ? "yes" : "pending"} | Proof{" "}
            <span className="font-mono text-slate-300">{latestRoundEnd.proofHash.slice(0, 12)}...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
