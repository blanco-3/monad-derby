import type { DecisionSource, RaceAction } from "./IStrategy.js";

export interface AgentConfig {
  name: string;
  color: string;
  walletKey: string;
  strategy: "mock" | "ai";
  strategyDescription: string;
  tradeInterval: number;
  aiConfig?: {
    provider: "anthropic" | "openai" | "google";
    model: string;
    apiKey: string;
  };
}

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
