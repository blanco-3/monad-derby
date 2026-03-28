import type { MarketData, MarketSource, PositionSnapshot, RaceDecision } from "../agents/IStrategy.js";

export type RuntimeMode = "mock" | "chain";
export type RoundPhase = "idle" | "countdown" | "live" | "ended";

export interface RuntimeAgentAccount {
  name: string;
  color: string;
  address: string;
  strategyDescription: string;
}

export interface MarketTick {
  index: number;
  blockNumber: number;
  timestamp: number;
  price: number;
  source: MarketSource;
  regime: string;
  recentReturns: {
    oneSecond: number;
    fiveSecond: number;
    fifteenSecond: number;
  };
  volatility: number;
  seed: string | null;
}

export interface BettingSnapshot {
  roundId: number;
  /** Net-of-vig parimutuel multipliers (what bettors actually receive) */
  odds: number[];
  /** Raw MON amounts staked per agent */
  pools: number[];
  totalPool: number;
  /** Betting-implied win probability per agent (0-1), computed from seeded pools */
  probabilities: number[];
  /**
   * Performance-implied win probability from live PnL standings (0-1).
   * null when race hasn't started or no PnL data yet.
   */
  perfProbabilities: number[] | null;
  settled: boolean;
  winnerIndex: number | null;
}

export interface RoundStartOptions {
  randomnessMode?: "seeded" | "full-random";
  seed?: string | null;
}

export interface RuntimeStatus {
  mode: RuntimeMode;
  bettingMode: RuntimeMode;
  roundId: number;
  phase: RoundPhase;
  startedAt: number | null;
  endsAt: number | null;
  winnerIndex: number | null;
  winnerName: string | null;
  market: "BTC/USD";
  randomnessMode: "seeded" | "full-random";
  seed: string | null;
  aiMode: "disabled" | "shadow" | "live";
  priceFeedMode: "synthetic" | "coinbase";
  priceSource: MarketSource;
}

export interface RuntimeAgentSnapshot {
  address: string;
  cash: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  pnlPercent: number;
  position: PositionSnapshot;
}

export interface LeaderboardEntry {
  name: string;
  pnlPercent: number;
  action: PositionSnapshot["action"];
  sizePercent: number;
}

export interface DecisionExecutionResult {
  eventId: string;
  agent: string;
  color: string;
  action: RaceDecision["action"];
  sizePercent: number;
  confidence: number;
  reason: string;
  source: RaceDecision["source"];
  provider?: string;
  price: number;
  blockNumber: number;
  timestamp: number;
  elapsedSeconds: number;
  skipped?: boolean;
  skipReason?: string;
}

export interface PlaceBetResult {
  userId: string;
  agentIndex: number;
  amount: number;
  totalPool: number;
  odds: number;
}

export interface RoundEndResult {
  roundId: number;
  winnerIndex: number;
  winnerName: string;
  winnerAddress: string;
  finalPnls: number[];
  endedAt: number;
  betting: BettingSnapshot;
  proofHash: string;
  payouts?: Record<string, number>;
}

export interface RuntimeAdapter {
  readonly mode: RuntimeMode;
  init(): Promise<void>;
  getAgents(): Promise<RuntimeAgentAccount[]>;
  prepareRound(): Promise<number>;
  startRound(durationSeconds: number, options?: RoundStartOptions): Promise<RuntimeStatus>;
  endRound(): Promise<RoundEndResult>;
  tick(): Promise<MarketTick>;
  getMarketData(agentAddress: string, elapsed?: number): Promise<MarketData>;
  executeDecision(agent: RuntimeAgentAccount, decision: RaceDecision): Promise<DecisionExecutionResult | null>;
  getAgentSnapshot(address: string): Promise<RuntimeAgentSnapshot>;
  getAgentPnls(addresses: string[]): Promise<number[]>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  getBettingSnapshot(): Promise<BettingSnapshot>;
  getStatus(): Promise<RuntimeStatus>;
  placeBet?(userId: string, agentIndex: number, amount: number): Promise<PlaceBetResult>;
}
