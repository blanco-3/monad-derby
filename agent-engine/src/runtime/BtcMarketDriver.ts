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

/**
 * Contrasting follow-up scenarios for each regime.
 * Chosen to create natural drama: a trend reversal, a breakout after consolidation, etc.
 */
const CONTRASTING_SCENARIOS: Record<ScenarioName, ScenarioName[]> = {
  "trend up":      ["crash/rebound", "trend down",  "whipsaw",    "range"      ],
  "trend down":    ["breakout",      "trend up",    "whipsaw",    "range"      ],
  "range":         ["breakout",      "breakout",    "trend up",   "trend down" ],
  "breakout":      ["crash/rebound", "whipsaw",     "trend down", "range"      ],
  "crash/rebound": ["breakout",      "trend up",    "whipsaw",    "range"      ],
  "whipsaw":       ["trend up",      "trend down",  "breakout",   "crash/rebound"],
};

/**
 * Scenario pool weighted toward exciting regimes.
 * "range" is least exciting (slow), others create dramatic price action.
 */
const SCENARIO_POOL: ScenarioName[] = [
  "trend up", "trend up",
  "trend down", "trend down",
  "breakout", "breakout",
  "crash/rebound",
  "whipsaw", "whipsaw",
  "range",
];

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
  private lastLivePrice: number | null = null;
  private lastLiveAt = 0;
  private coinbaseSocket: WebSocket | null = null;
  private coinbaseConnected = false;
  private roundStartedAt = Date.now();

  // Multi-phase scenario management
  private scenario: ScenarioState = { name: "range", anchorPrice: 68_000, breakoutDirection: 1 };
  private phaseList: ScenarioState[] = [];
  private phaseStarts: number[] = []; // progress values (0–1) where each phase begins
  private currentPhaseIndex = 0;

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

    // Build multi-phase scenario for this round
    this.buildPhases(basePrice);
    this.scenario = this.phaseList[0]!;
    this.currentPhaseIndex = 0;

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
      // Check for phase transition before computing next price
      this.applyPhaseTransition(progress);

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
    if (this.sampleWindow.length > 160) this.sampleWindow.shift();

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

  // ─── Phase management ─────────────────────────────────────────────────────

  /**
   * Build 2–3 scenario phases for the round.
   * Each phase uses a contrasting scenario to create leaderboard drama.
   *
   * Example 3-phase race:
   *   Phase 1 (0–40%): "trend up"  → Momentum wins
   *   Phase 2 (40–70%): "crash/rebound" → MeanRev catches up
   *   Phase 3 (70–100%): "breakout" → final sprint
   */
  private buildPhases(basePrice: number): void {
    const numPhases = this.random() < 0.40 ? 3 : 2;
    const dir = (): (1 | -1) => (this.random() > 0.5 ? 1 : -1);

    const p1Name: ScenarioName = pickOne(SCENARIO_POOL, this.random);
    const p2Name: ScenarioName = pickOne(CONTRASTING_SCENARIOS[p1Name], this.random);

    this.phaseList = [
      { name: p1Name, anchorPrice: basePrice, breakoutDirection: dir() },
      { name: p2Name, anchorPrice: basePrice, breakoutDirection: dir() },
    ];

    if (numPhases === 2) {
      // Single transition at 38–62% of race
      const t1 = 0.38 + this.random() * 0.24;
      this.phaseStarts = [0, t1];
    } else {
      // Two transitions creating a 3-act race
      const t1 = 0.28 + this.random() * 0.15;       // 28–43%
      const t2 = t1 + 0.25 + this.random() * 0.18;  // t1+(25–43%)
      const p3Name: ScenarioName = pickOne(CONTRASTING_SCENARIOS[p2Name], this.random);
      this.phaseList.push({ name: p3Name, anchorPrice: basePrice, breakoutDirection: dir() });
      this.phaseStarts = [0, t1, Math.min(t2, 0.82)];
    }
  }

  /** Apply any pending scenario transition based on current race progress. */
  private applyPhaseTransition(progress: number): void {
    while (
      this.currentPhaseIndex + 1 < this.phaseList.length &&
      progress >= (this.phaseStarts[this.currentPhaseIndex + 1] ?? 1)
    ) {
      this.currentPhaseIndex++;
      // Reset anchor to current price for smooth regime transition
      this.scenario = {
        ...this.phaseList[this.currentPhaseIndex]!,
        anchorPrice: this.currentPrice,
      };
      this.currentRegime = this.scenario.name;
    }
  }

  // ─── Price generation ─────────────────────────────────────────────────────

  private syntheticNextPrice(roundProgress: number): number {
    // Use local progress within the current phase so scenario-internal
    // timing (e.g., breakout ramp, crash recovery) works correctly.
    const phaseStart = this.phaseStarts[this.currentPhaseIndex] ?? 0;
    const phaseEnd = this.phaseStarts[this.currentPhaseIndex + 1] ?? 1;
    const phaseRange = Math.max(phaseEnd - phaseStart, 0.01);
    const localProgress = Math.min((roundProgress - phaseStart) / phaseRange, 1);

    // Gaussian noise (sum of 3 uniforms ≈ normal)
    const noise = ((this.random() + this.random() + this.random()) / 3 - 0.5) * 2;

    // Scenario drift & volatility
    let drift = 0;
    let vol = 0.0014;

    switch (this.scenario.name) {
      case "trend up":
        // Accelerates slightly mid-phase then flattens — more realistic trend
        drift = 0.00045 + Math.sin(localProgress * Math.PI) * 0.00040;
        vol = 0.0017;
        break;
      case "trend down":
        drift = -0.00045 - Math.sin(localProgress * Math.PI) * 0.00040;
        vol = 0.0019;
        break;
      case "range": {
        const dist = (this.currentPrice - this.scenario.anchorPrice) / this.scenario.anchorPrice;
        drift = -dist * 0.12;
        vol = 0.0011;
        break;
      }
      case "breakout":
        // Slow build-up then acceleration
        drift = (localProgress < 0.30 ? 0.00006 : 0.0013) * this.scenario.breakoutDirection;
        vol = localProgress < 0.30 ? 0.0010 : 0.0028;
        break;
      case "crash/rebound":
        // Sharp drop then recovery — most dramatic scenario
        drift = localProgress < 0.38 ? -0.0018 : 0.0013;
        vol = 0.0035;
        break;
      case "whipsaw":
        // High-frequency reversals — punishes momentum, rewards mean-reversion
        drift = Math.sin(localProgress * 20 * Math.PI) * 0.0009;
        vol = 0.0038;
        break;
    }

    // ── Shock events ──────────────────────────────────────────────────────
    // Small shocks: regime-dependent, ~6-12 per 60s race
    const shockProb = ({ whipsaw: 0.11, "crash/rebound": 0.10, breakout: 0.08 } as Record<string, number>)[this.scenario.name] ?? 0.06;
    const shockMag  = ({ whipsaw: 0.0080, "crash/rebound": 0.011, breakout: 0.007 } as Record<string, number>)[this.scenario.name] ?? 0.0060;
    const smallShock = this.random() < shockProb ? ((this.random() - 0.5) * 2) * shockMag : 0;

    // Flash event: large sudden spike (~1 per race on average).
    // Probability 0.9%/tick × 120 ticks ≈ 67% chance of at least one per 60s.
    // Magnitude ±1.4–2.8% — can meaningfully flip standings.
    const flashShock = this.random() < 0.009
      ? (this.random() > 0.5 ? 1 : -1) * (0.014 + this.random() * 0.014)
      : 0;

    const change = drift + noise * vol + smallShock + flashShock;
    return Math.max(8_000, this.currentPrice * (1 + change));
  }

  // ─── Return / volatility helpers ──────────────────────────────────────────

  private computeReturn(windowMs: number): number {
    const latest = this.sampleWindow[this.sampleWindow.length - 1];
    if (!latest) return 0;
    const target = latest.timestamp - windowMs;
    for (let i = this.sampleWindow.length - 1; i >= 0; i--) {
      const pt = this.sampleWindow[i]!;
      if (pt.timestamp <= target) return (latest.price - pt.price) / pt.price;
    }
    const earliest = this.sampleWindow[0];
    if (!earliest) return 0;
    return (latest.price - earliest.price) / earliest.price;
  }

  private computeVolatility(): number {
    if (this.sampleWindow.length < 3) return 0;
    const recent = this.sampleWindow.slice(-20);
    const returns: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1]!;
      const cur  = recent[i]!;
      returns.push((cur.price - prev.price) / prev.price);
    }
    if (returns.length === 0) return 0;
    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance);
  }

  // ─── Coinbase live feed ───────────────────────────────────────────────────

  private isLiveFresh(): boolean {
    return this.coinbaseConnected && this.lastLivePrice !== null && Date.now() - this.lastLiveAt < 5_000;
  }

  private connectCoinbase(): void {
    this.coinbaseSocket = new WebSocket(this.config.race.coinbaseWsUrl);
    this.coinbaseSocket.on("open", () => {
      this.coinbaseConnected = true;
      this.coinbaseSocket?.send(JSON.stringify({
        type: "subscribe",
        product_ids: ["BTC-USD"],
        channels: ["ticker", "heartbeat"],
      }));
    });
    this.coinbaseSocket.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString()) as CoinbaseMessage;
        if (payload.type !== "ticker" || payload.product_id !== "BTC-USD" || !payload.price) return;
        const price = Number(payload.price);
        if (!Number.isFinite(price) || price <= 0) return;
        this.lastLivePrice = price;
        this.lastLiveAt = Date.now();
      } catch { /* ignore */ }
    });
    const reconnect = () => {
      this.coinbaseConnected = false;
      setTimeout(() => this.connectCoinbase(), 1_500);
    };
    this.coinbaseSocket.on("close", reconnect);
    this.coinbaseSocket.on("error", reconnect);
  }
}
