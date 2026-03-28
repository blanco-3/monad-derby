import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import { BrowserProvider, Contract, parseEther, type Eip1193Provider } from "ethers";
import { useState } from "react";
import { bettingPoolAbi, contractAddresses } from "../lib/contracts";
import type { AgentState, BettingSnapshot, RoundEndPayload, RoundStatePayload } from "../types";

type Props = {
  agents: AgentState[];
  snapshot: BettingSnapshot;
  prevOdds: number[];
  mode: "mock" | "chain";
  userId: string;
  roundState: RoundStatePayload;
  latestRoundEnd: RoundEndPayload | null;
};

// +1 / +5 / +10 / +50 accumulative style (홀짝 / sports betting reference)
const PRESETS = [
  { label: "+1", value: 1 },
  { label: "+5", value: 5 },
  { label: "+10", value: 10 },
  { label: "+50", value: 50 },
  { label: "MAX", value: 100 },
];

/** Race progress 0–1 based on round start/end times */
function raceProgress(roundState: RoundStatePayload): number {
  if (roundState.phase !== "live" || !roundState.startedAt || !roundState.endsAt) return 0;
  return Math.min((Date.now() - roundState.startedAt) / (roundState.endsAt - roundState.startedAt), 1);
}

/** Format probability as percentage string */
function fmtPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

/** Arrow indicator for odds movement */
function OddsArrow({ cur, prev }: { cur: number; prev: number }) {
  const delta = cur - prev;
  if (Math.abs(delta) < 0.02) return null;
  return (
    <span className={`text-[9px] font-bold ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
      {delta > 0 ? "↑" : "↓"}
    </span>
  );
}

export function QuickBet({ agents, snapshot, prevOdds, mode, userId, roundState, latestRoundEnd }: Props) {
  const [selected, setSelected] = useState(0);
  const [amount, setAmount] = useState(10);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<unknown>("eip155");

  const progress = raceProgress(roundState);
  const lateBetBlock = progress > 0.90;
  const canBet = !lateBetBlock && (roundState.phase === "live" || roundState.phase === "countdown");

  const addAmount = (val: number) => {
    if (val === 100) { setAmount(100); return; }
    setAmount((prev) => Math.min(prev + val, 999));
  };
  const resetAmount = () => setAmount(10);

  const placeBet = async () => {
    if (amount <= 0) { setStatus({ text: "금액을 선택하세요", ok: false }); return; }
    setPlacing(true);
    setStatus(null);
    try {
      if (mode === "mock") {
        const baseUrl = import.meta.env.VITE_AGENT_HTTP_URL ?? "http://localhost:8787";
        const res = await fetch(`${baseUrl}/api/bet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, agentIndex: selected, amount }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!data.ok) throw new Error(data.error ?? "실패");
        setStatus({ text: `${agents[selected]?.name}에 ${amount} MON 베팅!`, ok: true });
      } else {
        if (!isConnected || !walletProvider || !address) {
          await open({ view: "Connect" });
          setStatus({ text: "지갑 연결 후 다시 시도", ok: false });
          return;
        }
        if (!contractAddresses.betting) throw new Error("컨트랙트 없음");
        const provider = new BrowserProvider(walletProvider as Eip1193Provider, chainId ? Number(chainId) : undefined);
        const signer = await provider.getSigner(address);
        const contract = new Contract(contractAddresses.betting, bettingPoolAbi, signer);
        const tx = await contract.placeBet(selected, { value: parseEther(amount.toString()) });
        await tx.wait();
        setStatus({ text: `✓ ${agents[selected]?.name} ${amount} MON 온체인 확정`, ok: true });
      }
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : "실패", ok: false });
    } finally {
      setPlacing(false);
    }
  };

  const claimWinnings = async () => {
    if (!isConnected || !walletProvider || !address) { await open({ view: "Connect" }); return; }
    if (!contractAddresses.betting) return;
    setClaiming(true);
    try {
      const provider = new BrowserProvider(walletProvider as Eip1193Provider, chainId ? Number(chainId) : undefined);
      const signer = await provider.getSigner(address);
      const contract = new Contract(contractAddresses.betting, bettingPoolAbi, signer);
      const tx = await contract.claimWinnings();
      await tx.wait();
      setStatus({ text: "상금 수령 완료! 🎉", ok: true });
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : "수령 실패", ok: false });
    } finally {
      setClaiming(false);
    }
  };

  const canClaim = mode === "chain" && latestRoundEnd?.betting.settled === true;
  const selectedAgent = agents[selected];
  const selectedOdds = snapshot.odds[selected] ?? 0;
  const expectedPayout = selectedOdds > 0 ? amount * selectedOdds : null;

  return (
    <div className="glass-panel flex h-full flex-col rounded-[28px] p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.4em] text-muted">Quick Bet</div>

      {/* ── Agent selector with probability gauges ── */}
      <div className="mb-3 flex flex-col gap-1.5">
        {agents.map((agent, i) => {
          const betProb = snapshot.probabilities[i] ?? 1 / agents.length;
          const perfProb = snapshot.perfProbabilities?.[i] ?? null;
          const agentOdds = snapshot.odds[i] ?? 0;
          const prevOdd = prevOdds[i] ?? agentOdds;
          const isSelected = selected === i;

          return (
            <button
              key={agent.name}
              type="button"
              onClick={() => setSelected(i)}
              className={[
                "relative flex flex-col overflow-hidden rounded-xl border px-3 py-2 transition-all text-left",
                isSelected ? "border-white/25 bg-white/10" : "border-white/8 bg-white/3 hover:bg-white/7",
              ].join(" ")}
            >
              {/* Probability fill bar (betting-pool implied) */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 opacity-12 transition-all duration-700"
                style={{ width: `${betProb * 100}%`, backgroundColor: agent.color }}
              />

              {/* Top row: name + odds */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isSelected && (
                    <div className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: agent.color }} />
                  )}
                  <span className={`text-sm font-bold ${isSelected ? "text-white" : "text-slate-300"}`}>
                    {agent.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <OddsArrow cur={agentOdds} prev={prevOdd} />
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: isSelected ? agent.color : "#94a3b8" }}
                  >
                    {agentOdds > 0 ? `${agentOdds.toFixed(2)}×` : "—"}
                  </span>
                </div>
              </div>

              {/* Bottom row: implied probability + perf probability */}
              <div className="relative mt-0.5 flex items-center justify-between">
                {/* Betting-pool implied probability */}
                <div className="flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-slate-500" />
                  <span className="text-[10px] text-muted">베팅 {fmtPct(betProb)}</span>
                </div>
                {/* AI performance-implied probability */}
                {perfProb !== null && (
                  <div className="flex items-center gap-1">
                    <div className="h-1 w-1 rounded-full" style={{ backgroundColor: agent.color, opacity: 0.7 }} />
                    <span className="text-[10px]" style={{ color: agent.color, opacity: 0.8 }}>
                      AI {fmtPct(perfProb)}
                    </span>
                  </div>
                )}
              </div>

              {/* Thin probability bar at bottom */}
              <div className="relative mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${betProb * 100}%`, backgroundColor: agent.color }}
                />
                {/* AI prob marker */}
                {perfProb !== null && (
                  <div
                    className="absolute top-0 h-full w-0.5 rounded-full opacity-70 transition-all duration-700"
                    style={{ left: `${perfProb * 100}%`, backgroundColor: "#fff" }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Betting amount input ── */}
      <div className="mb-3 rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted">베팅 금액</span>
          <button type="button" onClick={resetAmount} className="text-[10px] text-muted underline hover:text-white">
            초기화
          </button>
        </div>
        <div className="mb-3 flex items-baseline gap-1.5">
          <input
            type="number"
            min="1"
            max="999"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
            className="w-full bg-transparent font-mono text-3xl font-bold text-white outline-none"
          />
          <span className="text-sm font-semibold text-muted">MON</span>
        </div>

        {/* Preset buttons — accumulative style */}
        <div className="grid grid-cols-5 gap-1">
          {PRESETS.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              onClick={() => addAmount(value)}
              className={[
                "rounded-lg py-1.5 text-xs font-bold transition",
                label === "MAX"
                  ? "border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                  : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/12",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Expected payout (net-of-vig, matches actual payout) ── */}
      {expectedPayout !== null && expectedPayout > 0 ? (
        <div className="mb-3 rounded-xl bg-white/4 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">예상 수령</span>
            <span className="font-mono text-sm font-bold text-emerald-400">
              {expectedPayout.toFixed(2)} MON
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] text-muted">순수익 (3% 수수료 포함)</span>
            <span className={`font-mono text-xs font-semibold ${expectedPayout - amount >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {expectedPayout - amount >= 0 ? "+" : ""}{(expectedPayout - amount).toFixed(2)} MON
            </span>
          </div>
        </div>
      ) : null}

      {/* ── Late-bet warning ── */}
      {lateBetBlock ? (
        <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs text-amber-300">
          ⏱ 베팅 마감 — 레이스 90% 경과
        </div>
      ) : null}

      {/* ── Place Bet button ── */}
      <button
        type="button"
        onClick={() => void placeBet()}
        disabled={placing || !canBet}
        className={[
          "w-full rounded-2xl py-3.5 text-sm font-bold tracking-wide transition-all",
          placing || !canBet
            ? "cursor-not-allowed bg-white/8 text-white/30"
            : selectedAgent
              ? "shadow-lg hover:brightness-110"
              : "bg-violet-500 text-white",
        ].join(" ")}
        style={
          !placing && canBet && selectedAgent
            ? {
                background: `linear-gradient(135deg, ${selectedAgent.color}cc, ${selectedAgent.color}88)`,
                color: "#fff",
                boxShadow: `0 4px 20px ${selectedAgent.color}44`,
              }
            : undefined
        }
      >
        {placing
          ? "처리 중..."
          : lateBetBlock
            ? "⏱ 베팅 마감"
            : !canBet
              ? "대기 중"
              : `${selectedAgent?.name ?? ""}에 ${amount} MON`}
      </button>

      {/* Claim button (chain mode, post-settlement) */}
      {canClaim ? (
        <button
          type="button"
          onClick={() => void claimWinnings()}
          disabled={claiming}
          className="mt-2 w-full rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {claiming ? "수령 중..." : "상금 수령 🏆"}
        </button>
      ) : null}

      {/* Pool total */}
      <div className="mt-auto flex items-center justify-between border-t border-white/8 pt-3">
        <span className="text-[10px] text-muted">Total Pool</span>
        <span className="font-mono text-sm font-bold text-white">{snapshot.totalPool.toFixed(1)} MON</span>
      </div>

      {/* Status message */}
      {status ? (
        <div
          className={`mt-2 rounded-xl px-3 py-2 text-xs font-medium ${
            status.ok ? "bg-emerald-500/12 text-emerald-300" : "bg-rose-500/12 text-rose-300"
          }`}
        >
          {status.text}
        </div>
      ) : null}
    </div>
  );
}
