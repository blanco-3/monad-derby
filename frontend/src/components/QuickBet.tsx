import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import { BrowserProvider, Contract, parseEther, type Eip1193Provider } from "ethers";
import { useState } from "react";
import { bettingPoolAbi, contractAddresses } from "../lib/contracts";
import type { AgentState, BettingSnapshot, RoundEndPayload, RoundStatePayload } from "../types";

type Props = {
  agents: AgentState[];
  snapshot: BettingSnapshot;
  mode: "mock" | "chain";
  userId: string;
  roundState: RoundStatePayload;
  latestRoundEnd: RoundEndPayload | null;
};

const PRESET_AMOUNTS = ["0.1", "0.5", "1"];

export function QuickBet({ agents, snapshot, mode, userId, roundState, latestRoundEnd }: Props) {
  const [selected, setSelected] = useState(0);
  const [amount, setAmount] = useState("0.5");
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<unknown>("eip155");

  const isLive = roundState.phase === "live";
  const canBet = isLive || roundState.phase === "countdown";

  const placeBet = async () => {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setStatus({ text: "유효한 금액 입력", ok: false });
      return;
    }
    setPlacing(true);
    setStatus(null);
    try {
      if (mode === "mock") {
        const baseUrl = import.meta.env.VITE_AGENT_HTTP_URL ?? "http://localhost:8787";
        const res = await fetch(`${baseUrl}/api/bet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, agentIndex: selected, amount: num }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!data.ok) throw new Error(data.error ?? "실패");
        setStatus({ text: `${agents[selected]?.name}에 ${num} MON 베팅 완료`, ok: true });
      } else {
        if (!isConnected || !walletProvider || !address) {
          await open({ view: "Connect" });
          setStatus({ text: "지갑을 먼저 연결하세요", ok: false });
          return;
        }
        if (!contractAddresses.betting) throw new Error("컨트랙트 주소 없음");
        const provider = new BrowserProvider(walletProvider as Eip1193Provider, chainId ? Number(chainId) : undefined);
        const signer = await provider.getSigner(address);
        const contract = new Contract(contractAddresses.betting, bettingPoolAbi, signer);
        const tx = await contract.placeBet(selected, { value: parseEther(num.toString()) });
        await tx.wait();
        setStatus({ text: `✓ ${agents[selected]?.name}에 ${num} MON 온체인 베팅`, ok: true });
      }
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : "실패", ok: false });
    } finally {
      setPlacing(false);
    }
  };

  const claimWinnings = async () => {
    if (!isConnected || !walletProvider || !address) {
      await open({ view: "Connect" });
      return;
    }
    if (!contractAddresses.betting) return;
    setClaiming(true);
    try {
      const provider = new BrowserProvider(walletProvider as Eip1193Provider, chainId ? Number(chainId) : undefined);
      const signer = await provider.getSigner(address);
      const contract = new Contract(contractAddresses.betting, bettingPoolAbi, signer);
      const tx = await contract.claimWinnings();
      await tx.wait();
      setStatus({ text: "상금 수령 완료!", ok: true });
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : "수령 실패", ok: false });
    } finally {
      setClaiming(false);
    }
  };

  const canClaim =
    mode === "chain" &&
    latestRoundEnd !== null &&
    latestRoundEnd.betting.settled;

  return (
    <div className="glass-panel flex h-full flex-col gap-3 rounded-[28px] p-5">
      <div className="text-xs uppercase tracking-[0.35em] text-muted">Quick Bet</div>

      {/* Agent selector */}
      <div className="flex flex-col gap-2">
        {agents.map((agent, i) => {
          const odds = snapshot.odds[i] ?? 0;
          const pool = snapshot.pools[i] ?? 0;
          const pct = snapshot.totalPool > 0 ? (pool / snapshot.totalPool) * 100 : 0;
          return (
            <button
              key={agent.name}
              type="button"
              onClick={() => setSelected(i)}
              className={[
                "relative flex items-center justify-between rounded-2xl border px-4 py-3 transition-all overflow-hidden",
                selected === i
                  ? "border-white/30 bg-white/10"
                  : "border-white/8 bg-white/4 hover:bg-white/8",
              ].join(" ")}
            >
              {/* pool bar background */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 rounded-2xl opacity-20 transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: agent.color }}
              />
              <div className="relative flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shadow-[0_0_8px_currentColor]"
                  style={{ backgroundColor: agent.color, color: agent.color }} />
                <span className="font-semibold text-white text-sm">{agent.name}</span>
              </div>
              <div className="relative text-right">
                <div className="font-mono text-sm font-bold text-white">{odds > 0 ? `${odds.toFixed(2)}x` : "—"}</div>
                <div className="font-mono text-[10px] text-muted">{pool.toFixed(2)} MON</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Preset amounts */}
      <div className="flex gap-2">
        {PRESET_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAmount(a)}
            className={[
              "flex-1 rounded-xl py-2 text-xs font-semibold transition",
              amount === a ? "bg-white text-black" : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
            ].join(" ")}
          >
            {a}
          </button>
        ))}
        <input
          type="number"
          min="0"
          step="0.1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-16 rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-center text-xs text-white outline-none"
          placeholder="MON"
        />
      </div>

      {/* Place bet button */}
      <button
        type="button"
        onClick={() => void placeBet()}
        disabled={placing || !canBet}
        className={[
          "rounded-2xl py-3.5 text-sm font-bold tracking-wide transition-all",
          placing || !canBet
            ? "cursor-not-allowed bg-white/8 text-white/30"
            : "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(139,92,246,0.55)]",
        ].join(" ")}
      >
        {placing ? "처리 중..." : !canBet ? "대기 중" : `${agents[selected]?.name ?? ""}에 베팅`}
      </button>

      {/* Claim winnings */}
      {canClaim ? (
        <button
          type="button"
          onClick={() => void claimWinnings()}
          disabled={claiming}
          className="rounded-2xl bg-emerald-500/90 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {claiming ? "수령 중..." : "상금 수령 (Claim)"}
        </button>
      ) : null}

      {/* Pool total */}
      <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-2.5">
        <span className="text-xs text-muted">Total Pool</span>
        <span className="font-mono text-sm text-white">{snapshot.totalPool.toFixed(2)} MON</span>
      </div>

      {/* Status */}
      {status ? (
        <div className={`rounded-2xl px-4 py-2.5 text-xs font-medium ${status.ok ? "bg-emerald-500/12 text-emerald-300" : "bg-rose-500/12 text-rose-300"}`}>
          {status.text}
        </div>
      ) : null}
    </div>
  );
}
