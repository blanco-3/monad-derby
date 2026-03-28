import WebSocket from "ws";
import type { AppConfig } from "../config.js";
import type { MarketTick, RuntimeMode } from "./RuntimeAdapter.js";
import { createSeededRandom, pickOne, roundTo } from "../utils.js";

type ScenarioName = "trend up" | "trend down" | "range" | "breakout" | "crash/rebound" | "whipsaw";

type ScenarioState = {
  name: ScenarioName;
  anchorPrice: number;
  breakoutDirection: 1 | -1;
};

type CoinbaseMessage = {
  type?: string;
  product_id?: string;
  price?: string;
};

export class BtcMarketDriver {
  private readonly sampleWindow: Array<{ timestamp: number; price: number }> = [];
  private readonly liveMode: boolean;
  private readonly deterministicSyntheticMode: boolean;
  private blockNumber = 1;
  private tickIndex = 0;
  private currentPrice: number;
  private currentSeed: string | null = null;
  private currentRandomnessMode: "seeded" | "full-random" = "seeded";
  private currentSource: MarketTick["source"] = "synthetic";
  private currentRegime = "idle";
  private random = Math.random;
  private scenario: ScenarioState = {
    name: "range",
    anchorPrice: 68_000,
    breakoutDirection: 1,
  };
  private lastLivePrice: number | null = null;
  private lastLiveAt = 0;
  private coinbaseSocket: WebSocket | null = null;
  private coinbaseConnected = false;
  private roundStartedAt = Date.now();

  constructor(private readonly config: AppConfig) {
    this.liveMode = config.race.priceFeedMode === "coinbase";
    this.deterministicSyntheticMode = config.race.randomnessMode === "seeded" && config.race.priceFeedMode === "synthetic";
    this.currentPrice = config.race.startingPrice;
  }

  async init(): Promise<void> {
    if (this.liveMode) {
      this.connectCoinbase();
    }
  }

  startRound(seed: string, startedAt: number, randomnessMode: "seeded" | "full-random") {
    this.currentSeed = seed;
    this.currentRandomnessMode = randomnessMode;
    this.roundStartedAt = startedAt;
    this.random = createSeededRandom(seed);
    this.tickIndex = 0;
    this.blockNumber += 1;
    const basePrice = this.lastLivePrice ?? this.config.race.startingPrice;
    this.currentPrice = basePrice;
    this.sampleWindow.length = 0;
    this.scenario = {
      name: pickOne<ScenarioName>(["trend up", "trend down", "range", "range", "breakout", "crash/rebound", "whipsaw", "whipsaw"], this.random),
      anchorPrice: basePrice,
      breakoutDirection: this.random() > 0.5 ? 1 : -1,
    };
    this.currentSource = this.liveMode && this.isLiveFresh() ? "coinbase" : "synthetic";
    this.currentRegime = this.liveMode && this.isLiveFresh() ? "coinbase live" : this.scenario.name;
  }

  async nextTick(progress: number): Promise<MarketTick> {
    this.tickIndex += 1;
    this.blockNumber += 1;

    if (this.liveMode && this.isLiveFresh()) {
      this.currentPrice = this.lastLivePrice ?? this.currentPrice;
      this.currentSource = "coinbase";
      this.currentRegime = "coinbase live";
    } else {
      this.currentPrice = roundTo(this.syntheticNextPrice(progress), 2);
      this.currentSource = "synthetic";
      this.currentRegime = this.scenario.name;
    }

    const timestamp =
      this.currentSource === "synthetic" && this.deterministicSyntheticMode
        && this.currentRandomnessMode === "seeded"
        ? this.roundStartedAt + this.tickIndex * this.config.feedIntervalMs
        : Date.now();
    this.sampleWindow.push({ timestamp, price: this.currentPrice });
    if (this.sampleWindow.length > 160) {
      this.sampleWindow.shift();
    }

    return {
      index: this.tickIndex,
      blockNumber: this.blockNumber,
      timestamp,
      price: this.currentPrice,
      source: this.currentSource,
      regime: this.currentRegime,
      recentReturns: {
        oneSecond: this.computeReturn(1_000),
        fiveSecond: this.computeReturn(5_000),
        fifteenSecond: this.computeReturn(15_000),
      },
      volatility: this.computeVolatility(),
      seed: this.currentSeed,
    };
  }

  private syntheticNextPrice(progress: number): number {
    const noise = ((this.random() + this.random() + this.random()) / 3 - 0.5) * 2;
    const shock = this.random() < 0.045 ? ((this.random() - 0.5) * 2) * 0.0045 : 0;

    let drift = 0;
    let volatility = 0.0014;

    switch (this.scenario.name) {
      case "trend up":
        drift = 0.00055;
        volatility = 0.0016;
        break;
      case "trend down":
        drift = -0.00055;
        volatility = 0.0017;
        break;
      case "range": {
        const distance = (this.currentPrice - this.scenario.anchorPrice) / this.scenario.anchorPrice;
        drift = -distance * 0.1;
        volatility = 0.0012;
        break;
      }
      case "breakout":
        drift = (progress < 0.28 ? 0.00005 : 0.00115) * this.scenario.breakoutDirection;
        volatility = progress < 0.28 ? 0.0011 : 0.0024;
        break;
      case "crash/rebound":
        drift = progress < 0.34 ? -0.00155 : 0.00115;
        volatility = 0.0031;
        break;
      case "whipsaw":
        drift = Math.sin(progress * 18 * Math.PI) * 0.0008;
        volatility = 0.0034;
        break;
    }

    const change = drift + noise * volatility + shock;
    return Math.max(8_000, this.currentPrice * (1 + change));
  }

  private computeReturn(windowMs: number): number {
    const latest = this.sampleWindow[this.sampleWindow.length - 1];
    if (!latest) return 0;
    const target = latest.timestamp - windowMs;

    for (let index = this.sampleWindow.length - 1; index >= 0; index -= 1) {
      const point = this.sampleWindow[index]!;
      if (point.timestamp <= target) {
        return (latest.price - point.price) / point.price;
      }
    }

    const earliest = this.sampleWindow[0];
    if (!earliest) return 0;
    return (latest.price - earliest.price) / earliest.price;
  }

  private computeVolatility(): number {
    if (this.sampleWindow.length < 3) return 0;
    const recent = this.sampleWindow.slice(-20);
    const returns = [];
    for (let index = 1; index < recent.length; index += 1) {
      const previous = recent[index - 1]!;
      const current = recent[index]!;
      returns.push((current.price - previous.price) / previous.price);
    }
    if (returns.length === 0) return 0;
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance);
  }

  private isLiveFresh(): boolean {
    return this.coinbaseConnected && this.lastLivePrice !== null && Date.now() - this.lastLiveAt < 5_000;
  }

  private connectCoinbase() {
    this.coinbaseSocket = new WebSocket(this.config.race.coinbaseWsUrl);
    this.coinbaseSocket.on("open", () => {
      this.coinbaseConnected = true;
      this.coinbaseSocket?.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: ["BTC-USD"],
          channels: ["ticker", "heartbeat"],
        }),
      );
    });

    this.coinbaseSocket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as CoinbaseMessage;
        if (payload.type !== "ticker" || payload.product_id !== "BTC-USD" || !payload.price) return;
        const price = Number(payload.price);
        if (!Number.isFinite(price) || price <= 0) return;
        this.lastLivePrice = price;
        this.lastLiveAt = Date.now();
      } catch {
        // Ignore malformed websocket payloads.
      }
    });

    const reconnect = () => {
      this.coinbaseConnected = false;
      setTimeout(() => this.connectCoinbase(), 1_500);
    };

    this.coinbaseSocket.on("close", reconnect);
    this.coinbaseSocket.on("error", reconnect);
  }
}
