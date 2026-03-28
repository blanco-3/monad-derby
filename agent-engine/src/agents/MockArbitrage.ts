import type { IStrategy, MarketData, RaceDecision } from "./IStrategy.js";
import { clamp, createSeededRandom } from "../utils.js";

export class MockArbitrage implements IStrategy {
  name = "MockArbitrage";

  async decide(market: MarketData): Promise<RaceDecision> {
    const noise = createSeededRandom(`${market.seed ?? "seed"}:gemini:${market.history.length}:${Math.floor(market.elapsed)}`)();
    const shortMove = market.recentReturns.oneSecond;
    const mediumMove = market.recentReturns.fiveSecond;
    const longMove = market.recentReturns.fifteenSecond;
    const volatility = market.volatility;
    const regime = market.regime.toLowerCase();
    const directionalSkew = mediumMove * 0.35 + shortMove * 0.65;
    const signFlip = shortMove !== 0 && mediumMove !== 0 && Math.sign(shortMove) !== Math.sign(mediumMove);
    const reversalBias = volatility > 0.012 ? -directionalSkew : directionalSkew * 0.45;

    let action: RaceDecision["action"] = "flat";
    if (signFlip && volatility > 0.0022) {
      action = shortMove > 0 ? "long" : "short";
    } else if (regime.includes("crash/rebound") && longMove < -0.01 && shortMove > -0.0006) {
      action = "long";
    } else if (regime.includes("breakout") && Math.abs(shortMove) > 0.001) {
      action = shortMove > 0 ? "long" : "short";
    } else if (reversalBias > 0.0012 || (market.history.length >= 5 && noise > 0.75)) {
      action = "long";
    } else if (reversalBias < -0.0012 || (market.history.length >= 5 && noise < 0.25)) {
      action = "short";
    }

    const confidence = clamp(Math.abs(reversalBias) * 20_000 + volatility * 2_500 + (signFlip ? 16 : 0) + 18 + noise * 9, 20, 92);

    return {
      action,
      sizePercent: action === "flat" ? 0 : Math.round(clamp(confidence * 0.78, signFlip ? 28 : 20, signFlip ? 72 : 60)),
      confidence: Math.round(confidence),
      reason:
        action === "flat"
          ? "Volatility edge not clean enough"
          : `${volatility > 0.015 ? "Regime flip" : "Volatility skew"} ${formatPercent(reversalBias)}`,
      source: "sim",
    };
  }
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}
