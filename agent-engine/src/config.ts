import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";
import {
  DEFAULT_AI_EXECUTION_MODE,
  DEFAULT_AI_MAX_CALLS_PER_AGENT_PER_ROUND,
  DEFAULT_COINBASE_WS_URL,
  DEFAULT_COUNTDOWN_SECONDS,
  DEFAULT_FEED_INTERVAL_MS,
  DEFAULT_MARKET_SYMBOL,
  DEFAULT_PORT,
  DEFAULT_PRICE_FEED_MODE,
  DEFAULT_RANDOMNESS_MODE,
  DEFAULT_ROUND_DURATION_SECONDS,
  DEFAULT_STARTING_EQUITY,
  DEFAULT_STARTING_PRICE,
  createDefaultAgentConfigs,
} from "./constants.js";
import type { AgentConfig } from "./agents/AgentConfig.js";
import type { RuntimeMode } from "./runtime/RuntimeAdapter.js";

loadDotEnv();

export interface AppConfig {
  port: number;
  mode: RuntimeMode;
  roundDurationSeconds: number;
  countdownSeconds: number;
  feedIntervalMs: number;
  corsOrigin: string;
  /** Seconds between round end and auto-start of next round. 0 = disabled. */
  autoRestartDelaySeconds: number;
  race: {
    market: typeof DEFAULT_MARKET_SYMBOL;
    priceFeedMode: "synthetic" | "coinbase";
    randomnessMode: "seeded" | "full-random";
    roundSeed?: string;
    aiExecutionMode: "disabled" | "shadow" | "live";
    aiMaxCallsPerAgentPerRound: number;
    coinbaseWsUrl: string;
    startingPrice: number;
    startingEquity: number;
  };
  chain: {
    rpcUrl: string;
    wsUrl?: string;
    deployerPrivateKey?: string;
    arenaAddress?: string;
    bettingAddress?: string;
  };
  agents: AgentConfig[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const deployments = loadDeployments();
  const mode = env.DEMO_MODE === "chain" ? "chain" : "mock";

  return {
    port: Number(env.PORT ?? DEFAULT_PORT),
    mode,
    roundDurationSeconds: Number(env.ROUND_DURATION_SECONDS ?? DEFAULT_ROUND_DURATION_SECONDS),
    countdownSeconds: Number(env.COUNTDOWN_SECONDS ?? DEFAULT_COUNTDOWN_SECONDS),
    feedIntervalMs: Number(env.FEED_INTERVAL_MS ?? DEFAULT_FEED_INTERVAL_MS),
    corsOrigin: env.CORS_ORIGIN ?? "*",
    autoRestartDelaySeconds: Number(env.AUTO_RESTART_DELAY_SECONDS ?? 8),
    race: {
      market: DEFAULT_MARKET_SYMBOL,
      priceFeedMode: env.PRICE_FEED_MODE === "coinbase" ? "coinbase" : DEFAULT_PRICE_FEED_MODE,
      randomnessMode: env.RACE_RANDOMNESS_MODE === "full-random" ? "full-random" : DEFAULT_RANDOMNESS_MODE,
      roundSeed: env.ROUND_SEED,
      aiExecutionMode: parseAiExecutionMode(env.AI_EXECUTION_MODE),
      aiMaxCallsPerAgentPerRound: Number(env.AI_MAX_CALLS_PER_AGENT_PER_ROUND ?? DEFAULT_AI_MAX_CALLS_PER_AGENT_PER_ROUND),
      coinbaseWsUrl: env.COINBASE_WS_URL ?? DEFAULT_COINBASE_WS_URL,
      startingPrice: Number(env.STARTING_PRICE ?? DEFAULT_STARTING_PRICE),
      startingEquity: Number(env.STARTING_EQUITY ?? DEFAULT_STARTING_EQUITY),
    },
    chain: {
      rpcUrl: env.MONAD_RPC_URL ?? "http://127.0.0.1:8545",
      wsUrl: env.MONAD_WS_URL,
      deployerPrivateKey: env.DEPLOYER_PRIVATE_KEY,
      arenaAddress: env.ARENA_CONTRACT ?? deployments.ARENA_CONTRACT,
      bettingAddress: env.BETTING_CONTRACT ?? deployments.BETTING_CONTRACT,
    },
    agents: createDefaultAgentConfigs(env),
  };
}

function parseAiExecutionMode(value: string | undefined): AppConfig["race"]["aiExecutionMode"] {
  if (value === "shadow" || value === "live") {
    return value;
  }
  return DEFAULT_AI_EXECUTION_MODE;
}

function loadDeployments(): Partial<Record<string, string>> {
  const candidates = [
    resolve(process.cwd(), "../contracts/deployments.json"),
    resolve(process.cwd(), "contracts/deployments.json"),
    resolve(process.cwd(), "deployments.json"),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as Partial<Record<string, string>>;
    } catch {
      return {};
    }
  }

  return {};
}
