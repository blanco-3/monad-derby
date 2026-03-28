import { EventEmitter } from "node:events";
import type { AgentConfig, AgentState } from "../agents/AgentConfig.js";
import { AIStrategy, type AiProofEvent } from "../agents/AIStrategy.js";
import type { IStrategy } from "../agents/IStrategy.js";
import { MockArbitrage } from "../agents/MockArbitrage.js";
import { MockMeanRev } from "../agents/MockMeanRev.js";
import { MockMomentum } from "../agents/MockMomentum.js";
import type { AppConfig } from "../config.js";
import { MarketDataFeed } from "./MarketDataFeed.js";
import { TxExecutor } from "./TxExecutor.js";
import type { BettingSnapshot, RoundEndResult, RuntimeAdapter, RuntimeAgentAccount, RuntimeStatus, RoundStartOptions } from "../runtime/RuntimeAdapter.js";
import { rankDescending } from "../utils.js";

type ManagedAgent = {
  config: AgentConfig;
  runtime: RuntimeAgentAccount;
  strategy: IStrategy;
  busy: boolean;
  state: AgentState;
};

export type RoundManagerEvents = {
  connection: {
    mode: string;
    fallback: boolean;
    aiMode: AppConfig["race"]["aiExecutionMode"];
    priceFeedMode: AppConfig["race"]["priceFeedMode"];
    randomnessMode: AppConfig["race"]["randomnessMode"];
  };
  roundState: RuntimeStatus & { countdownRemaining: number | null };
  marketTick: Awaited<ReturnType<RuntimeAdapter["tick"]>>;
  decision: Awaited<ReturnType<RuntimeAdapter["executeDecision"]>>;
  pnlUpdate: { agents: AgentState[] };
  oddsUpdate: BettingSnapshot;
  roundEnd: RoundEndResult & { agents: AgentState[] };
  aiProof: AiProofEvent;
};

/**
 * Converts live PnL standings to win probabilities via softmax.
 *
 * Temperature T=2 means differences in PnL are moderately amplified —
 * small leads don't overwhelm the market but a clear leader gets
 * noticeably higher probability (similar to Elo-based prediction models).
 *
 * All-zeros input → equal probabilities (race hasn't diverged yet).
 */
function computeWinProbabilities(pnls: number[]): number[] {
  const n = pnls.length;
  if (n === 0) return [];
  const T = 2.0;
  const scaled = pnls.map((p) => p / T);
  const maxV = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - maxV)); // numerically stable
  const sum = exps.reduce((a, b) => a + b, 0);
  if (sum === 0) return Array.from({ length: n }, () => 1 / n);
  return exps.map((e) => Number((e / sum).toFixed(4)));
}

export class RoundManager extends EventEmitter {
  private readonly feed: MarketDataFeed;
  private readonly executor: TxExecutor;
  private readonly managedAgents: ManagedAgent[] = [];
  private readonly agentIntervals = new Map<string, NodeJS.Timeout>();
  private marketInterval: NodeJS.Timeout | null = null;
  private refreshingMarket = false;
  private pendingMarketRefresh = false;
  private countdownInterval: NodeJS.Timeout | null = null;
  private endTimer: NodeJS.Timeout | null = null;
  private countdownRemaining: number | null = null;
  private queuedStartOptions: RoundStartOptions | null = null;
  private status: RuntimeStatus;

  constructor(private readonly runtime: RuntimeAdapter, private readonly config: AppConfig) {
    super();
    this.feed = new MarketDataFeed(runtime);
    this.executor = new TxExecutor(runtime);
    this.status = {
      mode: runtime.mode,
      bettingMode: runtime.mode,
      roundId: 0,
      phase: "idle",
      startedAt: null,
      endsAt: null,
      winnerIndex: null,
      winnerName: null,
      market: "BTC/USD",
      randomnessMode: config.race.randomnessMode,
      seed: null,
      aiMode: config.race.aiExecutionMode,
      priceFeedMode: config.race.priceFeedMode,
      priceSource: "synthetic",
    };
  }

  async init(): Promise<void> {
    const runtimeAgents = await this.runtime.getAgents();

    this.managedAgents.length = 0;
    runtimeAgents.forEach((runtimeAgent, index) => {
      const agentConfig = this.config.agents[index]!;
      this.managedAgents.push({
        config: agentConfig,
        runtime: runtimeAgent,
        strategy: this.createStrategy(agentConfig),
        busy: false,
        state: {
          name: runtimeAgent.name,
          color: runtimeAgent.color,
          address: runtimeAgent.address,
          pnlPercent: 0,
          pnlBps: 0,
          tradeCount: 0,
          rank: index + 1,
          strategy: this.config.race.aiExecutionMode === "disabled" ? "SIM" : "AI READY",
          strategyDescription: runtimeAgent.strategyDescription,
          stance: "flat",
          exposurePercent: 0,
          confidence: 0,
          source: "sim",
        },
      });
    });

    this.status = await this.runtime.getStatus();
    this.emit("connection", {
      mode: this.runtime.mode,
      fallback: false,
      aiMode: this.config.race.aiExecutionMode,
      priceFeedMode: this.config.race.priceFeedMode,
      randomnessMode: this.config.race.randomnessMode,
    });
    await this.refreshPnls();
    await this.broadcastState();
  }

  async startRound(durationSeconds = this.config.roundDurationSeconds, options?: RoundStartOptions): Promise<RuntimeStatus> {
    if (this.status.phase === "countdown" || this.status.phase === "live") {
      return this.status;
    }

    this.queuedStartOptions = options ?? null;
    const roundId = await this.runtime.prepareRound();
    this.status = {
      ...(await this.runtime.getStatus()),
      roundId,
      phase: "countdown",
      startedAt: null,
      endsAt: null,
      winnerIndex: null,
      winnerName: null,
      randomnessMode: options?.randomnessMode ?? this.status.randomnessMode,
      seed: options?.randomnessMode === "seeded" ? options.seed?.trim() ?? null : null,
    };
    this.countdownRemaining = this.config.countdownSeconds;
    await this.broadcastState();

    this.countdownInterval = setInterval(() => {
      if (this.countdownRemaining === null) return;
      this.countdownRemaining -= 1;
      void this.broadcastState();

      if (this.countdownRemaining <= 0) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        this.countdownRemaining = null;
        void this.beginLiveRound(durationSeconds, this.queuedStartOptions ?? undefined);
      }
    }, 1000);

    return this.status;
  }

  async placeBet(userId: string, agentIndex: number, amount: number) {
    if (!this.runtime.placeBet) {
      throw new Error("betting API only available in mock mode");
    }
    const result = await this.runtime.placeBet(userId, agentIndex, amount);
    await this.broadcastOdds(); // includes perfProbabilities
    return result;
  }

  async getStatus() {
    return {
      ...this.status,
      countdownRemaining: this.countdownRemaining,
    };
  }

  async getAgents(): Promise<AgentState[]> {
    await this.refreshPnls();
    return this.managedAgents.map((agent) => ({ ...agent.state }));
  }

  private async beginLiveRound(durationSeconds: number, options?: RoundStartOptions): Promise<void> {
    this.managedAgents.forEach((agent) => {
      agent.strategy = this.createStrategy(agent.config);
      agent.busy = false;
      agent.state.tradeCount = 0;
      agent.state.lastDecision = undefined;
      agent.state.stance = "flat";
      agent.state.exposurePercent = 0;
      agent.state.confidence = 0;
      agent.state.source = "sim";
    });

    this.status = await this.runtime.startRound(durationSeconds, options);
    this.queuedStartOptions = null;
    const tick = await this.feed.poll();
    this.emit("marketTick", tick);
    await this.refreshPnls();
    await this.broadcastState();
    await this.broadcastOdds();

    // Push-on-receive: trigger market refresh immediately when live price arrives
    this.runtime.setLivePriceCallback?.(() => void this.refreshMarket());

    // Fallback polling interval (covers synthetic mode + live feed gaps)
    this.marketInterval = setInterval(() => {
      void this.refreshMarket();
    }, this.config.feedIntervalMs);

    for (const agent of this.managedAgents) {
      const handle = setInterval(() => {
        void this.runAgentLoop(agent);
      }, agent.config.tradeInterval);
      this.agentIntervals.set(agent.runtime.address.toLowerCase(), handle);
    }

    this.endTimer = setTimeout(() => {
      void this.endRound();
    }, durationSeconds * 1000);
  }

  private async refreshMarket(): Promise<void> {
    if (this.status.phase !== "live") return;
    // If already running, queue one more refresh — never drop the latest price
    if (this.refreshingMarket) {
      this.pendingMarketRefresh = true;
      return;
    }
    this.refreshingMarket = true;
    try {
      do {
        this.pendingMarketRefresh = false;
        const tick = await this.feed.poll();
        this.status = await this.runtime.getStatus();
        this.emit("marketTick", tick);
        await this.refreshPnls();
        await this.broadcastOdds();
      } while (this.pendingMarketRefresh && this.status.phase === "live");
    } finally {
      this.refreshingMarket = false;
      this.pendingMarketRefresh = false;
    }
  }

  private async runAgentLoop(agent: ManagedAgent): Promise<void> {
    if (this.status.phase !== "live" || agent.busy) return;
    agent.busy = true;

    try {
      const marketData = await this.feed.getMarketData(agent.runtime.address);
      const decision = await agent.strategy.decide(marketData);
      const execution = await this.executor.execute(agent.runtime, decision);

      if (!execution) {
        return;
      }

      agent.state.tradeCount += 1;
      agent.state.stance = execution.action;
      agent.state.exposurePercent = execution.sizePercent;
      agent.state.confidence = execution.confidence;
      agent.state.source = execution.source;
      agent.state.lastDecision = {
        eventId: execution.eventId,
        action: execution.action,
        sizePercent: execution.sizePercent,
        confidence: execution.confidence,
        reason: execution.reason,
        source: execution.source,
        provider: execution.provider,
        price: execution.price,
        timestamp: execution.timestamp,
      };

      this.emit("decision", execution);
      await this.refreshPnls();
    } catch {
      // One failed loop must not break the race.
    } finally {
      agent.busy = false;
    }
  }

  async endRound(): Promise<RoundEndResult | null> {
    if (this.status.phase !== "live") return null;

    this.clearLiveTimers();
    const result = await this.runtime.endRound();
    this.status = await this.runtime.getStatus();
    await this.refreshPnls();

    this.emit("oddsUpdate", result.betting);
    this.emit("roundEnd", {
      ...result,
      agents: this.managedAgents.map((agent) => ({ ...agent.state })),
    });
    await this.broadcastState();

    // Auto-restart: begin the next round after a brief results window.
    // Gives viewers ~8 seconds to see the winner before the next race.
    const autoRestartMs = (this.config.autoRestartDelaySeconds ?? 8) * 1000;
    if (autoRestartMs > 0) {
      setTimeout(() => {
        void this.startRound(this.config.roundDurationSeconds);
      }, autoRestartMs);
    }

    return result;
  }

  private async refreshPnls(): Promise<void> {
    const snapshots = await Promise.all(
      this.managedAgents.map(async (agent) => {
        const snapshot = await this.runtime.getAgentSnapshot(agent.runtime.address);
        return { agent, snapshot };
      }),
    );
    const finalPnls = snapshots.map(({ snapshot }) => snapshot.pnlPercent);
    const ranks = rankDescending(finalPnls);

    snapshots.forEach(({ agent, snapshot }, index) => {
      agent.state.pnlPercent = snapshot.pnlPercent;
      agent.state.pnlBps = Math.round(snapshot.pnlPercent * 100);
      agent.state.rank = ranks[index] ?? index + 1;
      agent.state.stance = snapshot.position.action;
      agent.state.exposurePercent = snapshot.position.sizePercent;
    });

    this.emit("pnlUpdate", {
      agents: this.managedAgents.map((agent) => ({ ...agent.state })),
    });
  }

  private async broadcastState(): Promise<void> {
    const runtimeStatus = await this.runtime.getStatus();
    this.status =
      this.countdownRemaining !== null
        ? {
            ...runtimeStatus,
            roundId: this.status.roundId || runtimeStatus.roundId,
            phase: "countdown",
            startedAt: null,
            endsAt: null,
            winnerIndex: null,
            winnerName: null,
            randomnessMode: this.queuedStartOptions?.randomnessMode ?? this.status.randomnessMode,
            seed: this.queuedStartOptions?.randomnessMode === "seeded" ? this.queuedStartOptions.seed?.trim() ?? null : null,
          }
        : runtimeStatus;
    this.emit("roundState", {
      ...this.status,
      countdownRemaining: this.countdownRemaining,
    });
  }

  private async broadcastOdds(): Promise<void> {
    const snapshot = await this.runtime.getBettingSnapshot();
    const pnls = this.managedAgents.map((a) => a.state.pnlPercent);
    this.emit("oddsUpdate", {
      ...snapshot,
      perfProbabilities: computeWinProbabilities(pnls),
    });
  }

  private clearLiveTimers() {
    if (this.marketInterval) clearInterval(this.marketInterval);
    if (this.endTimer) clearTimeout(this.endTimer);
    this.marketInterval = null;
    this.endTimer = null;

    // Stop live price push callbacks
    this.runtime.clearLivePriceCallback?.();

    for (const handle of this.agentIntervals.values()) {
      clearInterval(handle);
    }
    this.agentIntervals.clear();
  }

  private createStrategy(config: AgentConfig): IStrategy {
    const fallback = this.createFallbackStrategy(config.name);
    if (this.config.race.aiExecutionMode === "disabled") {
      return fallback;
    }

    return new AIStrategy(config, fallback, {
      mode: this.config.race.aiExecutionMode,
      maxCallsPerRound: this.config.race.aiMaxCallsPerAgentPerRound,
      roundDurationSeconds: this.config.roundDurationSeconds,
      onProof: (proof) => this.emit("aiProof", proof),
    });
  }

  private createFallbackStrategy(agentName: string): IStrategy {
    switch (agentName) {
      case "Claude":
        return new MockMomentum();
      case "GPT":
        return new MockMeanRev();
      case "Gemini":
        return new MockArbitrage();
      default:
        return new MockMomentum();
    }
  }
}
