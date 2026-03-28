import { Wallet, keccak256, toUtf8Bytes } from "ethers";
import type { AppConfig } from "../config.js";
import type { RuntimeAdapter, RuntimeAgentAccount, RuntimeAgentSnapshot, RuntimeStatus, MarketTick, DecisionExecutionResult, LeaderboardEntry, RoundEndResult, BettingSnapshot, RuntimeMode, RoundStartOptions } from "./RuntimeAdapter.js";
import type { MarketData, PricePoint, PositionSnapshot, RaceDecision } from "../agents/IStrategy.js";
import { BtcMarketDriver } from "./BtcMarketDriver.js";
import { clamp, rankDescending, roundTo, uid } from "../utils.js";

type InternalAgentState = {
  info: RuntimeAgentAccount;
  startingEquity: number;
  realizedPnl: number;
  quantity: number;
  entryPrice: number | null;
};

export abstract class BaseRaceRuntime implements RuntimeAdapter {
  readonly mode: RuntimeMode;

  protected readonly driver: BtcMarketDriver;
  protected readonly agents: RuntimeAgentAccount[] = [];
  protected readonly agentStates = new Map<string, InternalAgentState>();
  protected readonly history: PricePoint[] = [];
  protected readonly decisionLog: DecisionExecutionResult[] = [];

  protected phase: RuntimeStatus["phase"] = "idle";
  protected roundId = 0;
  protected activeRoundId = 0;
  protected startedAt: number | null = null;
  protected endsAt: number | null = null;
  protected winnerIndex: number | null = null;
  protected winnerName: string | null = null;
  protected roundSeed: string | null = null;
  protected latestTick: MarketTick | null = null;
  protected activeRandomnessMode: RuntimeStatus["randomnessMode"];
  protected activeRoundDurationSeconds: number;

  protected readonly feeRate = 0.0007;
  protected readonly baseSlippage = 0.0004;

  constructor(protected readonly config: AppConfig, mode: RuntimeMode) {
    this.mode = mode;
    this.driver = new BtcMarketDriver(config);
    this.activeRandomnessMode = config.race.randomnessMode;
    this.activeRoundDurationSeconds = config.roundDurationSeconds;
  }

  async init(): Promise<void> {
    this.agents.length = 0;
    this.agentStates.clear();

    for (const agent of this.config.agents) {
      const wallet = new Wallet(agent.walletKey);
      const account = {
        name: agent.name,
        color: agent.color,
        address: wallet.address,
        strategyDescription: agent.strategyDescription,
      } satisfies RuntimeAgentAccount;

      this.agents.push(account);
      this.agentStates.set(wallet.address.toLowerCase(), {
        info: account,
        startingEquity: this.config.race.startingEquity,
        realizedPnl: 0,
        quantity: 0,
        entryPrice: null,
      });
    }

    await this.driver.init();
  }

  async getAgents(): Promise<RuntimeAgentAccount[]> {
    return this.agents.map((agent) => ({ ...agent }));
  }

  async prepareRound(): Promise<number> {
    const roundId = await this.prepareBettingRound();
    this.activeRoundId = roundId;
    return roundId;
  }

  async startRound(durationSeconds: number, options?: RoundStartOptions): Promise<RuntimeStatus> {
    if (this.activeRoundId === 0) {
      await this.prepareRound();
    }

    this.roundId = this.activeRoundId;
    this.phase = "live";
    this.startedAt = Date.now();
    this.endsAt = this.startedAt + durationSeconds * 1000;
    this.winnerIndex = null;
    this.winnerName = null;
    this.activeRoundDurationSeconds = durationSeconds;
    this.activeRandomnessMode = options?.randomnessMode ?? this.config.race.randomnessMode;
    this.roundSeed =
      this.activeRandomnessMode === "seeded"
        ? options?.seed?.trim() || this.config.race.roundSeed?.trim() || uid("seed")
        : uid("seed");
    this.history.length = 0;
    this.decisionLog.length = 0;
    this.latestTick = null;

    for (const state of this.agentStates.values()) {
      state.startingEquity = this.config.race.startingEquity;
      state.realizedPnl = 0;
      state.quantity = 0;
      state.entryPrice = null;
    }

    this.driver.startRound(this.roundSeed, this.startedAt, this.activeRandomnessMode);
    await this.startBettingRound(durationSeconds);
    return this.getStatus();
  }

  async tick(): Promise<MarketTick> {
    const durationMs = Math.max(1, this.activeRoundDurationSeconds * 1000);
    const elapsedMs = this.isDeterministicSyntheticMode()
      ? this.history.length * this.config.feedIntervalMs
      : this.startedAt
        ? Math.max(0, Date.now() - this.startedAt)
        : 0;
    const progress = clamp(elapsedMs / durationMs, 0, 1);
    const tick = await this.driver.nextTick(progress);
    this.latestTick = tick;
    this.history.push({
      index: tick.index,
      timestamp: tick.timestamp,
      price: tick.price,
      source: tick.source,
      regime: tick.regime,
      recentReturns: tick.recentReturns,
      volatility: tick.volatility,
    });
    if (this.history.length > 180) {
      this.history.shift();
    }
    return tick;
  }

  async getMarketData(agentAddress: string, elapsed?: number): Promise<MarketData> {
    if (!this.latestTick) {
      await this.tick();
    }

    const tick = this.latestTick;
    const snapshot = await this.getAgentSnapshot(agentAddress);
    if (!tick) {
      throw new Error("market tick unavailable");
    }

    return {
      symbol: "BTC/USD",
      price: tick.price,
      source: tick.source,
      history: [...this.history],
      recentReturns: tick.recentReturns,
      volatility: tick.volatility,
      regime: tick.regime,
      elapsed: elapsed ?? this.getElapsedSeconds(tick.timestamp),
      roundDuration: this.activeRoundDurationSeconds,
      seed: this.roundSeed,
      portfolio: {
        equity: snapshot.equity,
        cash: snapshot.cash,
        realizedPnl: snapshot.realizedPnl,
        unrealizedPnl: snapshot.unrealizedPnl,
      },
      currentPosition: snapshot.position,
      leaderboard: await this.getLeaderboard(),
    };
  }

  async executeDecision(agent: RuntimeAgentAccount, decision: RaceDecision): Promise<DecisionExecutionResult | null> {
    if (this.phase !== "live") return null;
    if (!this.latestTick) {
      await this.tick();
    }

    const tick = this.latestTick;
    const state = this.agentStates.get(agent.address.toLowerCase());
    if (!tick || !state) return null;

    const execution = this.applyDecision(state, tick, decision);
    if (!execution) return null;

    this.decisionLog.push(execution);
    if (this.decisionLog.length > 300) {
      this.decisionLog.shift();
    }

    return execution;
  }

  async getAgentSnapshot(address: string): Promise<RuntimeAgentSnapshot> {
    const state = this.agentStates.get(address.toLowerCase());
    const price = this.latestTick?.price ?? this.config.race.startingPrice;
    if (!state) {
      throw new Error("agent snapshot missing");
    }

    const unrealizedPnl = this.getUnrealizedPnl(state, price);
    const equity = state.startingEquity + state.realizedPnl + unrealizedPnl;
    const pnlPercent = state.startingEquity > 0 ? ((equity - state.startingEquity) / state.startingEquity) * 100 : 0;

    return {
      address: state.info.address,
      cash: roundTo(state.startingEquity + state.realizedPnl, 2),
      equity: roundTo(equity, 2),
      realizedPnl: roundTo(state.realizedPnl, 2),
      unrealizedPnl: roundTo(unrealizedPnl, 2),
      pnlPercent: roundTo(pnlPercent, 2),
      position: this.toPositionSnapshot(state, price),
    };
  }

  async getAgentPnls(addresses: string[]): Promise<number[]> {
    return await Promise.all(addresses.map(async (address) => (await this.getAgentSnapshot(address)).pnlPercent));
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const snapshots = await Promise.all(
      this.agents.map(async (agent) => {
        const snapshot = await this.getAgentSnapshot(agent.address);
        return {
          name: agent.name,
          pnlPercent: snapshot.pnlPercent,
          action: snapshot.position.action,
          sizePercent: snapshot.position.sizePercent,
        } satisfies LeaderboardEntry;
      }),
    );

    return snapshots.sort((a, b) => b.pnlPercent - a.pnlPercent);
  }

  async getStatus(): Promise<RuntimeStatus> {
    return {
      mode: this.mode,
      bettingMode: this.mode,
      roundId: this.roundId || this.activeRoundId,
      phase: this.phase,
      startedAt: this.startedAt,
      endsAt: this.endsAt,
      winnerIndex: this.winnerIndex,
      winnerName: this.winnerName,
      market: "BTC/USD",
      randomnessMode: this.activeRandomnessMode,
      seed: this.roundSeed,
      aiMode: this.config.race.aiExecutionMode,
      priceFeedMode: this.config.race.priceFeedMode,
      priceSource: this.latestTick?.source ?? "synthetic",
    };
  }

  async endRound(): Promise<RoundEndResult> {
    if (this.phase !== "live") {
      throw new Error("round not active");
    }

    if (!this.latestTick) {
      await this.tick();
    }

    const finalPnls = await this.getAgentPnls(this.agents.map((agent) => agent.address));
    const winnerIndex = finalPnls.reduce((bestIndex, value, index) => (value > finalPnls[bestIndex]! ? index : bestIndex), 0);
    const winner = this.agents[winnerIndex]!;
    const proofHash = this.computeProofHash(finalPnls);

    this.phase = "ended";
    this.winnerIndex = winnerIndex;
    this.winnerName = winner.name;

    const { betting, payouts } = await this.finalizeBettingRound({
      roundId: this.roundId,
      finalPnls,
      winnerIndex,
      winnerAddress: winner.address,
      winnerName: winner.name,
      proofHash,
    });

    return {
      roundId: this.roundId,
      winnerIndex,
      winnerName: winner.name,
      winnerAddress: winner.address,
      finalPnls,
      endedAt: Date.now(),
      betting,
      proofHash,
      payouts,
    };
  }

  private applyDecision(state: InternalAgentState, tick: MarketTick, decision: RaceDecision): DecisionExecutionResult | null {
    const currentPrice = tick.price;
    const currentEquity = state.startingEquity + state.realizedPnl + this.getUnrealizedPnl(state, currentPrice);
    const targetQuantity =
      decision.action === "flat" || decision.sizePercent <= 0
        ? 0
        : ((currentEquity * (decision.sizePercent / 100)) / currentPrice) * (decision.action === "long" ? 1 : -1);

    const deltaQuantity = targetQuantity - state.quantity;
    if (Math.abs(deltaQuantity) < 1e-6 && decision.action === this.toPositionSnapshot(state, currentPrice).action) {
      return null;
    }

    const fillPrice = currentPrice * (1 + (deltaQuantity >= 0 ? this.baseSlippage : -this.baseSlippage));
    const fee = Math.abs(deltaQuantity) * fillPrice * this.feeRate;
    let realizedDelta = 0;

    const currentQuantity = state.quantity;
    const currentEntry = state.entryPrice;
    const currentSign = Math.sign(currentQuantity);
    const targetSign = Math.sign(targetQuantity);

    if (currentQuantity !== 0 && currentEntry !== null) {
      if (targetQuantity === 0 || currentSign !== targetSign) {
        realizedDelta += currentQuantity * (fillPrice - currentEntry);
        state.quantity = 0;
        state.entryPrice = null;
      } else if (Math.abs(targetQuantity) < Math.abs(currentQuantity)) {
        const closedQuantity = Math.abs(currentQuantity) - Math.abs(targetQuantity);
        realizedDelta += closedQuantity * (fillPrice - currentEntry) * currentSign;
      }
    }

    if (targetQuantity !== 0) {
      if (state.quantity === 0 || state.entryPrice === null || currentSign !== targetSign) {
        state.quantity = targetQuantity;
        state.entryPrice = fillPrice;
      } else if (Math.abs(targetQuantity) > Math.abs(currentQuantity)) {
        const added = Math.abs(targetQuantity) - Math.abs(currentQuantity);
        const blendedNotional = Math.abs(currentQuantity) * state.entryPrice + added * fillPrice;
        state.quantity = targetQuantity;
        state.entryPrice = blendedNotional / Math.abs(targetQuantity);
      } else {
        state.quantity = targetQuantity;
        if (Math.abs(targetQuantity) < 1e-6) {
          state.entryPrice = null;
        }
      }
    }

    if (targetQuantity === 0) {
      state.quantity = 0;
      state.entryPrice = null;
    }

    state.realizedPnl += realizedDelta - fee;

    return {
      eventId: uid("decision"),
      agent: state.info.name,
      color: state.info.color,
      action: decision.action,
      sizePercent: decision.sizePercent,
      confidence: decision.confidence,
      reason: decision.reason,
      source: decision.source,
      price: roundTo(fillPrice, 2),
      blockNumber: tick.blockNumber,
      timestamp: tick.timestamp,
      elapsedSeconds: this.getElapsedSeconds(tick.timestamp),
    };
  }

  private getUnrealizedPnl(state: InternalAgentState, currentPrice: number): number {
    if (!state.quantity || state.entryPrice === null) return 0;
    return state.quantity * (currentPrice - state.entryPrice);
  }

  private toPositionSnapshot(state: InternalAgentState, price: number): PositionSnapshot {
    const action = state.quantity > 0 ? "long" : state.quantity < 0 ? "short" : "flat";
    const equity = state.startingEquity + state.realizedPnl + this.getUnrealizedPnl(state, price);
    const notional = Math.abs(state.quantity) * price;
    return {
      action,
      sizePercent: equity > 0 ? roundTo((notional / equity) * 100, 1) : 0,
      entryPrice: state.entryPrice ? roundTo(state.entryPrice, 2) : null,
      quantity: roundTo(state.quantity, 6),
      realizedPnl: roundTo(state.realizedPnl, 2),
      unrealizedPnl: roundTo(this.getUnrealizedPnl(state, price), 2),
    };
  }

  private computeProofHash(finalPnls: number[]): string {
    return keccak256(
      toUtf8Bytes(
        JSON.stringify({
          roundId: this.roundId,
          seed: this.roundSeed,
          prices: this.history.map((point) => [point.index, point.price, point.source]),
          decisions: this.decisionLog.map((entry) => ({
            agent: entry.agent,
            action: entry.action,
            sizePercent: entry.sizePercent,
            reason: entry.reason,
            source: entry.source,
            price: entry.price,
            elapsedSeconds: entry.elapsedSeconds,
          })),
          finalPnls,
        }),
      ),
    );
  }

  protected getRanks(finalPnls: number[]): number[] {
    return rankDescending(finalPnls);
  }

  private isDeterministicSyntheticMode(): boolean {
    return this.activeRandomnessMode === "seeded" && this.config.race.priceFeedMode === "synthetic";
  }

  private getElapsedSeconds(timestamp: number): number {
    if (!this.startedAt) return 0;
    return roundTo(Math.max(0, (timestamp - this.startedAt) / 1000), 1);
  }

  protected abstract prepareBettingRound(): Promise<number>;
  protected abstract startBettingRound(durationSeconds: number): Promise<void>;
  protected abstract finalizeBettingRound(result: {
    roundId: number;
    finalPnls: number[];
    winnerIndex: number;
    winnerAddress: string;
    winnerName: string;
    proofHash: string;
  }): Promise<{ betting: BettingSnapshot; payouts?: Record<string, number> }>;

  abstract getBettingSnapshot(): Promise<BettingSnapshot>;
}
