export type RoundPhase = "idle" | "countdown" | "live" | "ended";
export type RaceAction = "long" | "short" | "flat";
export type DecisionSource = "sim" | "ai" | "fallback";

export interface AgentState {
  name: string;
  color: string;
  address: string;
  pnlPercent: number;
  pnlBps: number;
  tradeCount: number;
  rank: number;
  strategy: string;
  strategyDescription: string;
  stance: RaceAction;
  exposurePercent: number;
  confidence: number;
  source: DecisionSource;
  lastDecision?: {
    eventId: string;
    action: RaceAction;
    sizePercent: number;
    confidence: number;
    reason: string;
    source: DecisionSource;
    provider?: string;
    price: number;
    timestamp: number;
  };
}

export interface BettingSnapshot {
  roundId: number;
  odds: number[];
  pools: number[];
  totalPool: number;
  settled: boolean;
  winnerIndex: number | null;
}

export interface RoundStatePayload {
  mode: "mock" | "chain";
  bettingMode: "mock" | "chain";
  phase: RoundPhase;
  roundId: number;
  countdownRemaining: number | null;
  startedAt: number | null;
  endsAt: number | null;
  winnerIndex: number | null;
  winnerName: string | null;
  market: "BTC/USD";
  randomnessMode: "seeded" | "full-random";
  seed: string | null;
  aiMode: "disabled" | "shadow" | "live";
  priceFeedMode: "synthetic" | "coinbase";
  priceSource: "synthetic" | "coinbase";
}

export interface DecisionPayload {
  eventId: string;
  agent: string;
  color: string;
  action: RaceAction;
  sizePercent: number;
  confidence: number;
  reason: string;
  source: DecisionSource;
  provider?: string;
  price: number;
  blockNumber: number;
  timestamp: number;
  elapsedSeconds: number;
}

export interface MarketTickPayload {
  index: number;
  blockNumber: number;
  timestamp: number;
  price: number;
  source: "synthetic" | "coinbase";
  regime: string;
  recentReturns: {
    oneSecond: number;
    fiveSecond: number;
    fifteenSecond: number;
  };
  volatility: number;
  seed: string | null;
}

export interface AiProofPayload {
  agent: string;
  provider: "anthropic" | "openai" | "google";
  model: string;
  mode: "shadow" | "live";
  promptHash: string;
  rawResponse: string;
  parsedDecision?: {
    action: RaceAction;
    sizePercent: number;
    confidence: number;
    reason: string;
    source: DecisionSource;
  };
  fallback: boolean;
  error?: string;
  timestamp: number;
}

export interface ConnectionPayload {
  mode: "mock" | "chain";
  fallback: boolean;
  aiMode: "disabled" | "shadow" | "live";
  priceFeedMode: "synthetic" | "coinbase";
  randomnessMode: "seeded" | "full-random";
}

export interface RoundEndPayload {
  roundId: number;
  winnerIndex: number;
  winnerName: string;
  winnerAddress: string;
  finalPnls: number[];
  endedAt: number;
  betting: BettingSnapshot;
  proofHash: string;
  payouts?: Record<string, number>;
  agents: AgentState[];
}

export interface WsEnvelope<T = unknown> {
  type: string;
  payload: T;
}
