import type { AgentConfig } from "./agents/AgentConfig.js";

export const DEFAULT_ROUND_DURATION_SECONDS = 120;
export const DEFAULT_COUNTDOWN_SECONDS = 3;
export const DEFAULT_FEED_INTERVAL_MS = 500;
export const DEFAULT_PORT = 8787;
export const DEFAULT_MARKET_SYMBOL = "BTC/USD" as const;
export const DEFAULT_STARTING_PRICE = 68_000;
export const DEFAULT_STARTING_EQUITY = 1_000;
export const DEFAULT_PRICE_FEED_MODE = "synthetic" as const;
export const DEFAULT_RANDOMNESS_MODE = "seeded" as const;
export const DEFAULT_AI_EXECUTION_MODE = "disabled" as const;
export const DEFAULT_AI_MAX_CALLS_PER_AGENT_PER_ROUND = 2;
export const DEFAULT_COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";

export const ANVIL_DEFAULT_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
] as const;

export function createDefaultAgentConfigs(env: NodeJS.ProcessEnv): AgentConfig[] {
  return [
    {
      name: "Claude",
      color: "#7F77DD",
      walletKey: env.AGENT_1_PRIVATE_KEY ?? ANVIL_DEFAULT_PRIVATE_KEYS[1],
      strategy: env.ANTHROPIC_API_KEY ? "ai" : "mock",
      strategyDescription: "Aggressive breakout momentum rider with sharp conviction spikes.",
      tradeInterval: 1_050,
      aiConfig: env.ANTHROPIC_API_KEY
        ? {
            provider: "anthropic",
            model: env.ANTHROPIC_MODEL ?? "claude-3-7-sonnet-latest",
            apiKey: env.ANTHROPIC_API_KEY,
          }
        : undefined,
    },
    {
      name: "GPT",
      color: "#1D9E75",
      walletKey: env.AGENT_2_PRIVATE_KEY ?? ANVIL_DEFAULT_PRIVATE_KEYS[2],
      strategy: env.OPENAI_API_KEY ? "ai" : "mock",
      strategyDescription: "Slow mean-reversion trader that fades stretched BTC moves.",
      tradeInterval: 1_250,
      aiConfig: env.OPENAI_API_KEY
        ? {
            provider: "openai",
            model: env.OPENAI_MODEL ?? "gpt-4.1-mini",
            apiKey: env.OPENAI_API_KEY,
          }
        : undefined,
    },
    {
      name: "Gemini",
      color: "#EF9F27",
      walletKey: env.AGENT_3_PRIVATE_KEY ?? ANVIL_DEFAULT_PRIVATE_KEYS[3],
      strategy: env.GOOGLE_API_KEY ? "ai" : "mock",
      strategyDescription: "Fast volatility switcher that flips with regime changes.",
      tradeInterval: 850,
      aiConfig: env.GOOGLE_API_KEY
        ? {
            provider: "google",
            model: env.GOOGLE_MODEL ?? "gemini-2.0-flash",
            apiKey: env.GOOGLE_API_KEY,
          }
        : undefined,
    },
  ];
}
