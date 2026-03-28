import type { AppConfig } from "../config.js";
import type { BettingSnapshot, PlaceBetResult } from "./RuntimeAdapter.js";
import { BaseRaceRuntime } from "./BaseRaceRuntime.js";
import { clamp } from "../utils.js";

type Bet = {
  agentIndex: number;
  amount: number;
};

type RoundPool = {
  pools: number[];
  totalPool: number;
  settled: boolean;
  winnerIndex: number | null;
  bets: Map<string, Bet[]>;
};

export class MockRuntime extends BaseRaceRuntime {
  private readonly roundPools = new Map<number, RoundPool>();

  constructor(config: AppConfig) {
    super(config, "mock");
  }

  async placeBet(userId: string, agentIndex: number, amount: number): Promise<PlaceBetResult> {
    const pool = this.roundPools.get(this.activeRoundId);
    if (!pool) {
      throw new Error("mock pool not initialized");
    }
    if (agentIndex < 0 || agentIndex >= pool.pools.length) {
      throw new Error("invalid agent");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("invalid bet amount");
    }

    pool.pools[agentIndex] += amount;
    pool.totalPool += amount;
    const existing = pool.bets.get(userId) ?? [];
    existing.push({ agentIndex, amount });
    pool.bets.set(userId, existing);

    return {
      userId,
      agentIndex,
      amount,
      totalPool: pool.totalPool,
      odds: this.computeOdds(pool, agentIndex),
    };
  }

  async getBettingSnapshot(): Promise<BettingSnapshot> {
    const pool = this.roundPools.get(this.activeRoundId);
    if (!pool) {
      return this.emptySnapshot(this.activeRoundId);
    }

    return {
      roundId: this.activeRoundId,
      odds: pool.pools.map((_, index) => roundToOdds(this.computeOdds(pool, index))),
      pools: pool.pools.map((value) => roundToOdds(value)),
      totalPool: roundToOdds(pool.totalPool),
      settled: pool.settled,
      winnerIndex: pool.settled ? pool.winnerIndex : null,
    };
  }

  protected async prepareBettingRound(): Promise<number> {
    if (this.activeRoundId !== 0) {
      const previous = this.roundPools.get(this.activeRoundId);
      if (previous && !previous.settled) {
        throw new Error("previous mock round not settled");
      }
    }

    const roundId = this.roundId + 1;
    this.roundPools.set(roundId, {
      pools: Array.from({ length: this.agents.length }, () => 0),
      totalPool: 0,
      settled: false,
      winnerIndex: null,
      bets: new Map(),
    });
    return roundId;
  }

  protected async startBettingRound(_durationSeconds: number): Promise<void> {
    return;
  }

  protected async finalizeBettingRound(result: {
    roundId: number;
    finalPnls: number[];
    winnerIndex: number;
    winnerAddress: string;
    winnerName: string;
    proofHash: string;
  }): Promise<{ betting: BettingSnapshot; payouts?: Record<string, number> }> {
    const pool = this.roundPools.get(result.roundId);
    if (!pool) {
      return { betting: this.emptySnapshot(result.roundId) };
    }

    pool.settled = true;
    pool.winnerIndex = result.winnerIndex;

    return {
      betting: await this.getBettingSnapshot(),
      payouts: this.computePayouts(pool),
    };
  }

  private computeOdds(pool: RoundPool, agentIndex: number): number {
    const agentPool = pool.pools[agentIndex] ?? 0;
    if (agentPool <= 0 || pool.totalPool <= 0) return 0;
    return pool.totalPool / agentPool;
  }

  private computePayouts(pool: RoundPool): Record<string, number> {
    const payouts: Record<string, number> = {};
    if (pool.winnerIndex === null) return payouts;

    const winnerPool = pool.pools[pool.winnerIndex] ?? 0;
    if (winnerPool <= 0) return payouts;

    const distributable = pool.totalPool * 0.97;
    for (const [userId, bets] of pool.bets.entries()) {
      const winningAmount = bets
        .filter((bet) => bet.agentIndex === pool.winnerIndex)
        .reduce((sum, bet) => sum + bet.amount, 0);
      if (winningAmount <= 0) continue;
      payouts[userId] = roundToOdds((winningAmount / winnerPool) * distributable);
    }
    return payouts;
  }

  private emptySnapshot(roundId: number): BettingSnapshot {
    return {
      roundId,
      odds: Array.from({ length: this.agents.length }, () => 0),
      pools: Array.from({ length: this.agents.length }, () => 0),
      totalPool: 0,
      settled: false,
      winnerIndex: null,
    };
  }
}

function roundToOdds(value: number): number {
  return clamp(Number(value.toFixed(4)), 0, Number.MAX_SAFE_INTEGER);
}
