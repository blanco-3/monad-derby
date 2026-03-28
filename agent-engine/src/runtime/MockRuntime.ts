import type { AppConfig } from "../config.js";
import type { BettingSnapshot, PlaceBetResult } from "./RuntimeAdapter.js";
import { BaseRaceRuntime } from "./BaseRaceRuntime.js";

/**
 * House take: 3% deducted at settlement.
 * All displayed odds are NET of this fee so users always see exactly what they'll receive.
 */
const VIG_RATE = 0.03;

/**
 * Virtual seed liquidity per agent (MON).
 * Added to display pools only — not included in real payouts.
 * Ensures odds always show a sensible number before the first real bet,
 * mirroring "morning line" odds in horse racing and Polymarket's initial AMM price.
 *
 * With 3 agents and seed = 5:
 *   Starting odds ≈ (15 * 0.97) / 5 = 2.91×  (symmetric equal-probability market)
 */
const SEED_PER_AGENT = 5;

/** Floor multiplier — a winner always pays at least this. */
const MIN_ODDS = 1.05;

/**
 * Betting closes when the race is this far through its duration.
 * Prevents information-advantage sniping near the finish line.
 * (Betfair suspends in-running markets in final seconds; we use 90%.)
 */
const LATE_BET_CUTOFF = 0.90;

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
    if (!pool) throw new Error("mock pool not initialized");
    if (agentIndex < 0 || agentIndex >= pool.pools.length) throw new Error("invalid agent");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid bet amount");

    // Block information-advantage bets in the final stretch of a live race.
    if (this.phase === "live" && this.startedAt && this.endsAt) {
      const progress = (Date.now() - this.startedAt) / (this.endsAt - this.startedAt);
      if (progress > LATE_BET_CUTOFF) {
        throw new Error("베팅 마감 — 레이스 막바지 (90% 경과)");
      }
    }

    pool.pools[agentIndex]! += amount;
    pool.totalPool += amount;
    const existing = pool.bets.get(userId) ?? [];
    existing.push({ agentIndex, amount });
    pool.bets.set(userId, existing);

    return {
      userId,
      agentIndex,
      amount,
      totalPool: pool.totalPool,
      odds: this.computeNetOdds(pool, agentIndex),
    };
  }

  async getBettingSnapshot(): Promise<BettingSnapshot> {
    const pool = this.roundPools.get(this.activeRoundId);
    if (!pool) return this.emptySnapshot(this.activeRoundId);

    return {
      roundId: this.activeRoundId,
      odds: pool.pools.map((_, i) => round4(this.computeNetOdds(pool, i))),
      pools: pool.pools.map(round4),
      totalPool: round4(pool.totalPool),
      probabilities: this.computeImpliedProbabilities(pool),
      perfProbabilities: null, // injected by RoundManager which has PnL access
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
    if (!pool) return { betting: this.emptySnapshot(result.roundId) };

    pool.settled = true;
    pool.winnerIndex = result.winnerIndex;

    return {
      betting: await this.getBettingSnapshot(),
      payouts: this.computePayouts(pool),
    };
  }

  // ─── Odds computation ──────────────────────────────────────────────────────

  /**
   * Net-of-vig parimutuel odds using virtual seed for display stability.
   *
   * Formula:
   *   displayPool  = realPool  + SEED_PER_AGENT
   *   displayTotal = realTotal + SEED_PER_AGENT * nAgents
   *   netOdds      = (displayTotal / displayPool) * (1 - VIG_RATE)
   *
   * Matches what Polymarket and tote boards show: the exact multiplier
   * the bettor will receive if their pick wins.
   */
  private computeNetOdds(pool: RoundPool, agentIndex: number): number {
    const n = pool.pools.length;
    const displayPool = (pool.pools[agentIndex] ?? 0) + SEED_PER_AGENT;
    const displayTotal = pool.totalPool + SEED_PER_AGENT * n;
    const netOdds = (displayTotal / displayPool) * (1 - VIG_RATE);
    return Math.max(MIN_ODDS, netOdds);
  }

  /**
   * Betting-implied win probability per agent (0–1), computed from seeded display pools.
   * This is what prediction markets (Polymarket, Augur) show as the primary metric.
   */
  private computeImpliedProbabilities(pool: RoundPool): number[] {
    const n = pool.pools.length;
    const displayTotal = pool.totalPool + SEED_PER_AGENT * n;
    return pool.pools.map((p) => {
      const displayPool = p + SEED_PER_AGENT;
      return round4(displayPool / displayTotal);
    });
  }

  // ─── Payout computation ───────────────────────────────────────────────────

  /**
   * Standard parimutuel payout:
   *   bettor share = userWinningBets / totalWinnerPool
   *   payout       = share × totalPool × (1 - VIG_RATE)
   *
   * Only real bets are included — virtual seed does NOT affect payouts.
   */
  private computePayouts(pool: RoundPool): Record<string, number> {
    const payouts: Record<string, number> = {};
    if (pool.winnerIndex === null) return payouts;

    const winnerPool = pool.pools[pool.winnerIndex] ?? 0;
    if (winnerPool <= 0) return payouts;

    const distributable = pool.totalPool * (1 - VIG_RATE);
    for (const [userId, bets] of pool.bets.entries()) {
      const winningStake = bets
        .filter((b) => b.agentIndex === pool.winnerIndex)
        .reduce((sum, b) => sum + b.amount, 0);
      if (winningStake <= 0) continue;
      payouts[userId] = round4((winningStake / winnerPool) * distributable);
    }
    return payouts;
  }

  // ─── Empty / fallback snapshot ─────────────────────────────────────────────

  /**
   * Returned before any round starts.
   * Uses seed-based equal odds so UI never shows "—" on startup.
   * Starting odds = (SEED*n * (1-VIG)) / SEED = n*(1-VIG)
   *   → 3 agents: 3 × 0.97 = 2.91×
   */
  private emptySnapshot(roundId: number): BettingSnapshot {
    const n = this.agents.length || 3;
    const startingOdds = round4(n * (1 - VIG_RATE));
    const equalProb = round4(1 / n);
    return {
      roundId,
      odds: Array.from({ length: n }, () => startingOdds),
      pools: Array.from({ length: n }, () => 0),
      totalPool: 0,
      probabilities: Array.from({ length: n }, () => equalProb),
      perfProbabilities: null,
      settled: false,
      winnerIndex: null,
    };
  }
}

function round4(value: number): number {
  return Math.max(0, Number(value.toFixed(4)));
}
