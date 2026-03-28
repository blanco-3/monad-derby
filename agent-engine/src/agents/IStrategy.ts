export type MarketSource = "synthetic" | "coinbase";
export type RaceAction = "long" | "short" | "flat";
export type DecisionSource = "sim" | "ai" | "fallback";

export interface PricePoint {
  index: number;
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
}

export interface PositionSnapshot {
  action: RaceAction;
  sizePercent: number;
  entryPrice: number | null;
  quantity: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface MarketData {
  symbol: "BTC/USD";
  price: number;
  source: MarketSource;
  history: PricePoint[];
  recentReturns: {
    oneSecond: number;
    fiveSecond: number;
    fifteenSecond: number;
  };
  volatility: number;
  regime: string;
  elapsed: number;
  roundDuration: number;
  seed: string | null;
  portfolio: {
    equity: number;
    cash: number;
    realizedPnl: number;
    unrealizedPnl: number;
  };
  currentPosition: PositionSnapshot;
  leaderboard: Array<{
    name: string;
    pnlPercent: number;
    action: RaceAction;
    sizePercent: number;
  }>;
}

export interface RaceDecision {
  action: RaceAction;
  sizePercent: number;
  confidence: number;
  reason: string;
  source: DecisionSource;
}

export interface IStrategy {
  name: string;
  decide(marketData: MarketData): Promise<RaceDecision>;
}
