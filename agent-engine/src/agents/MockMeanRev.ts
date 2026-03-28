import type { IStrategy, MarketData, RaceDecision } from "./IStrategy.js";
import { average, clamp, createSeededRandom } from "../utils.js";

/**
 * GPT — Aggressive Mean Reversion.
 *
 * Constantly counter-trends. Fades every stretched move.
 * Never sits flat — always has an opinion. High sizePercent when deviation is large.
 * "The market always comes back. Always."
 */
export class MockMeanRev implements IStrategy {
  name = "MockMeanRev";

  async decide(market: MarketData): Promise<RaceDecision> {
    const series = market.history.slice(-20).map((p) => p.price);
    const mean = average(series);
    const deviation = mean > 0 ? (market.price - mean) / mean : 0;

    const noise = createSeededRandom(
      `${market.seed ?? "seed"}:gpt:${market.history.length}:${Math.floor(market.elapsed)}`
    )();

    const regime = market.regime.toLowerCase();
    const rangeFriendly = regime.includes("range") || regime.includes("whipsaw");
    const trending = regime.includes("trend") || regime.includes("crash");

    // Looser threshold in mean-reversion-friendly regimes
    const threshold = rangeFriendly ? 0.0006 : 0.0009;

    // Portfolio awareness: if behind, increase aggression
    const myRank = market.leaderboard.findIndex((l) => l.name === "GPT") + 1;
    const behind = myRank === market.leaderboard.length;
    const leading = myRank === 1;
    const pnlRatio = (market.portfolio.equity - 1000) / 1000;

    const confidence = clamp(
      Math.abs(deviation) * 17_000 + 28 + noise * 14 +
      (rangeFriendly ? 12 : 0) + (behind ? 10 : 0),
      24, 92
    );

    // Direction: fade any significant deviation; use short-term return as tiebreak
    let action: RaceDecision["action"];

    if (Math.abs(deviation) > threshold) {
      // Classic mean-reversion: price too high → short, too low → long
      action = deviation > 0 ? "short" : "long";
    } else if (Math.abs(market.recentReturns.fiveSecond) > 0.004) {
      // Big 5s move without significant deviation — fade it
      action = market.recentReturns.fiveSecond > 0 ? "short" : "long";
    } else {
      // No clear mean-rev setup: use slight counter-momentum bias + noise
      const counterBias = -(market.recentReturns.oneSecond * 0.6 + market.recentReturns.fiveSecond * 0.4);
      action = counterBias > 0 ? "long" : counterBias < 0 ? "short" : (noise > 0.5 ? "long" : "short");
    }

    // In strong trends, be less aggressive (mean-rev hurts in trend)
    const sizeMult = trending ? 0.62 : rangeFriendly ? 0.88 : 0.74;
    const sizeMax = behind ? 88 : leading && pnlRatio > 0.04 ? 65 : 80;

    return {
      action,
      sizePercent: Math.round(clamp(confidence * sizeMult, 35, sizeMax)),
      confidence: Math.round(confidence),
      reason:
        Math.abs(deviation) > threshold
          ? `${action === "long" ? "Oversold" : "Overbought"} dev ${fmt(deviation)}`
          : `Counter-trend fade ${fmt(market.recentReturns.fiveSecond)}`,
      source: "sim",
    };
  }
}

function fmt(v: number): string {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}
