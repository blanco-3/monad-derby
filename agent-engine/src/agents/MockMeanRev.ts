import type { IStrategy, MarketData, RaceDecision } from "./IStrategy.js";
import { average, clamp, createSeededRandom } from "../utils.js";

export class MockMeanRev implements IStrategy {
  name = "MockMeanRev";

  async decide(market: MarketData): Promise<RaceDecision> {
    const series = market.history.slice(-18).map((point) => point.price);
    const mean = average(series);
    const deviation = mean > 0 ? (market.price - mean) / mean : 0;
    const noise = createSeededRandom(`${market.seed ?? "seed"}:gpt:${market.history.length}:${Math.floor(market.elapsed)}`)();
    const regime = market.regime.toLowerCase();
    const rangeFriendly = regime.includes("range") || regime.includes("whipsaw");
    const threshold = rangeFriendly ? 0.001 : 0.0015;
    const confidence = clamp(Math.abs(deviation) * 15_500 + 24 + noise * 10 + (rangeFriendly ? 10 : 0), 18, 88);

    let action: RaceDecision["action"] = "flat";
    if (deviation > threshold) action = "short";
    else if (deviation < -threshold) action = "long";
    else if (rangeFriendly && Math.abs(deviation) > threshold * 0.55) action = deviation > 0 ? "short" : "long";
    else if (market.history.length >= 8 && Math.abs(market.recentReturns.fiveSecond) > 0.0045 && noise > 0.76) {
      action = market.recentReturns.fiveSecond > 0 ? "short" : "long";
    }

    return {
      action,
      sizePercent: action === "flat" ? 0 : Math.round(clamp(confidence * (rangeFriendly ? 0.8 : 0.68), 18, rangeFriendly ? 64 : 52)),
      confidence: Math.round(confidence),
      reason:
        action === "flat"
          ? "Waiting for a cleaner mean-revert setup"
          : `${action === "long" ? "Oversold" : "Overbought"} deviation ${formatPercent(deviation)}`,
      source: "sim",
    };
  }
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}
