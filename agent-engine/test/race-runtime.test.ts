import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";
import { MockRuntime } from "../src/runtime/MockRuntime.js";
import { MockMomentum } from "../src/agents/MockMomentum.js";
import { MockMeanRev } from "../src/agents/MockMeanRev.js";
import { MockArbitrage } from "../src/agents/MockArbitrage.js";
import { AIStrategy } from "../src/agents/AIStrategy.js";
import type { AgentConfig } from "../src/agents/AgentConfig.js";
import type { IStrategy, MarketData, RaceDecision } from "../src/agents/IStrategy.js";

type SimulatedRace = {
  prices: number[];
  decisions: Array<{ agent: string; action: string; sizePercent: number; elapsedSeconds: number }>;
  result: Awaited<ReturnType<MockRuntime["endRound"]>>;
};

test("seeded synthetic race is reproducible with the same seed", async () => {
  const first = await simulateRace({ ROUND_SEED: "proof-seed-alpha" });
  const second = await simulateRace({ ROUND_SEED: "proof-seed-alpha" });

  assert.deepEqual(first.prices, second.prices);
  assert.deepEqual(first.decisions, second.decisions);
  assert.equal(first.result.winnerName, second.result.winnerName);
  assert.deepEqual(first.result.finalPnls, second.result.finalPnls);
  assert.equal(first.result.proofHash, second.result.proofHash);
});

test("different seeds produce a different BTC tape or outcome", async () => {
  const first = await simulateRace({ ROUND_SEED: "proof-seed-alpha" });
  const second = await simulateRace({ ROUND_SEED: "proof-seed-beta" });

  assert.notDeepEqual(first.prices, second.prices);
});

test("mock strategies preserve distinct directional personalities", async () => {
  const momentum = new MockMomentum();
  const meanReversion = new MockMeanRev();
  const regimeSwitch = new MockArbitrage();

  const uptrend = createMarketData({
    price: 70_400,
    recentReturns: { oneSecond: 0.004, fiveSecond: 0.008, fifteenSecond: 0.012 },
    volatility: 0.004,
  });
  const overbought = createMarketData({
    price: 72_500,
    historyPrices: Array.from({ length: 20 }, (_, index) => 68_000 + index * 40),
    recentReturns: { oneSecond: 0.001, fiveSecond: 0.002, fifteenSecond: 0.003 },
    volatility: 0.003,
  });
  const highVolatility = createMarketData({
    price: 69_200,
    recentReturns: { oneSecond: 0.005, fiveSecond: 0.004, fifteenSecond: 0.003 },
    volatility: 0.02,
  });

  assert.equal((await momentum.decide(uptrend)).action, "long");
  assert.equal((await meanReversion.decide(overbought)).action, "short");
  assert.equal((await regimeSwitch.decide(highVolatility)).action, "short");
});

test("AI strategy falls back cleanly when the provider key is missing", async () => {
  const proofs: Array<{ fallback: boolean; error?: string }> = [];
  const strategy = new AIStrategy(
    {
      name: "Claude",
      color: "#7F77DD",
      walletKey: "0x0",
      strategy: "ai",
      strategyDescription: "test",
      tradeInterval: 900,
      aiConfig: undefined,
    },
    new MockMomentum(),
    {
      mode: "live",
      maxCallsPerRound: 2,
      roundDurationSeconds: 20,
      onProof: (proof) => proofs.push({ fallback: proof.fallback, error: proof.error }),
    },
  );

  const decision = await strategy.decide(createMarketData({ elapsed: 9, historyLength: 10 }));

  assert.equal(decision.source, "fallback");
  assert.equal(proofs.length, 1);
  assert.equal(proofs[0]?.fallback, true);
  assert.match(proofs[0]?.error ?? "", /missing api key/i);
});

test("AI strategy falls back on invalid JSON responses", async () => {
  const originalFetch = globalThis.fetch;
  const proofs: Array<{ fallback: boolean; error?: string }> = [];

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "this is not strict json" } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  try {
    const strategy = new AIStrategy(
      {
        name: "GPT",
        color: "#1D9E75",
        walletKey: "0x0",
        strategy: "ai",
        strategyDescription: "test",
        tradeInterval: 1400,
        aiConfig: {
          provider: "openai",
          model: "gpt-4.1-mini",
          apiKey: "test-key",
        },
      },
      new MockMeanRev(),
      {
        mode: "live",
        maxCallsPerRound: 2,
        roundDurationSeconds: 20,
        onProof: (proof) => proofs.push({ fallback: proof.fallback, error: proof.error }),
      },
    );

    const decision = await strategy.decide(createMarketData({ elapsed: 9, historyLength: 12 }));

    assert.equal(decision.source, "fallback");
    assert.equal(proofs.length, 1);
    assert.equal(proofs[0]?.fallback, true);
    assert.match(proofs[0]?.error ?? "", /invalid ai decision/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function simulateRace(envOverrides: Record<string, string> = {}): Promise<SimulatedRace> {
  const config = loadConfig({
    DEMO_MODE: "mock",
    ROUND_DURATION_SECONDS: "18",
    COUNTDOWN_SECONDS: "0",
    FEED_INTERVAL_MS: "500",
    PRICE_FEED_MODE: "synthetic",
    RACE_RANDOMNESS_MODE: "seeded",
    AI_EXECUTION_MODE: "disabled",
    STARTING_PRICE: "68000",
    STARTING_EQUITY: "1000",
    ...envOverrides,
  });

  const runtime = new MockRuntime(config);
  await runtime.init();
  await runtime.prepareRound();
  await runtime.startRound(config.roundDurationSeconds, {
    randomnessMode: config.race.randomnessMode,
    seed: config.race.roundSeed ?? null,
  });

  const runtimeAgents = await runtime.getAgents();
  const strategies = config.agents.map((agent) => createStrategy(agent));
  const nextDecisionAtMs = config.agents.map(() => 0);
  const prices: number[] = [];
  const decisions: SimulatedRace["decisions"] = [];
  const totalTicks = Math.ceil((config.roundDurationSeconds * 1000) / config.feedIntervalMs);

  for (let step = 0; step < totalTicks; step += 1) {
    const tick = await runtime.tick();
    prices.push(Number(tick.price.toFixed(2)));
    const elapsedMs = step * config.feedIntervalMs;

    for (let index = 0; index < runtimeAgents.length; index += 1) {
      if (elapsedMs < nextDecisionAtMs[index]!) continue;

      const marketData = await runtime.getMarketData(runtimeAgents[index]!.address);
      const decision = await strategies[index]!.decide(marketData);
      const execution = await runtime.executeDecision(runtimeAgents[index]!, decision);
      if (execution) {
        decisions.push({
          agent: execution.agent,
          action: execution.action,
          sizePercent: execution.sizePercent,
          elapsedSeconds: execution.elapsedSeconds,
        });
      }
      nextDecisionAtMs[index] = nextDecisionAtMs[index]! + config.agents[index]!.tradeInterval;
    }
  }

  const result = await runtime.endRound();
  return { prices, decisions, result };
}

function createStrategy(agent: AgentConfig): IStrategy {
  switch (agent.name) {
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

function createMarketData(overrides: {
  price?: number;
  historyLength?: number;
  historyPrices?: number[];
  elapsed?: number;
  recentReturns?: MarketData["recentReturns"];
  volatility?: number;
} = {}): MarketData {
  const historyPrices =
    overrides.historyPrices ??
    Array.from({ length: overrides.historyLength ?? 12 }, (_, index) => 68_000 + index * 20);

  return {
    symbol: "BTC/USD",
    price: overrides.price ?? historyPrices[historyPrices.length - 1] ?? 68_000,
    source: "synthetic",
    history: historyPrices.map((price, index) => ({
      index,
      timestamp: 1_700_000_000_000 + index * 500,
      price,
      source: "synthetic",
      regime: "range",
      recentReturns: {
        oneSecond: 0,
        fiveSecond: 0,
        fifteenSecond: 0,
      },
      volatility: overrides.volatility ?? 0.004,
    })),
    recentReturns: overrides.recentReturns ?? {
      oneSecond: 0.001,
      fiveSecond: 0.002,
      fifteenSecond: 0.004,
    },
    volatility: overrides.volatility ?? 0.004,
    regime: "range",
    elapsed: overrides.elapsed ?? 12,
    roundDuration: 20,
    seed: "test-seed",
    portfolio: {
      equity: 1_000,
      cash: 1_000,
      realizedPnl: 0,
      unrealizedPnl: 0,
    },
    currentPosition: {
      action: "flat",
      sizePercent: 0,
      entryPrice: null,
      quantity: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
    },
    leaderboard: [],
  };
}
