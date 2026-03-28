import type { IStrategy, MarketData, RaceDecision } from "./IStrategy.js";
import { clamp, createSeededRandom } from "../utils.js";

export class MockMomentum implements IStrategy {
  name = "MockMomentum";

  async decide(market: MarketData): Promise<RaceDecision> {
    const noise = createSeededRandom(`${market.seed ?? "seed"}:claude:${market.history.length}:${Math.floor(market.elapsed)}`)();
    const oneSecond = market.recentReturns.oneSecond;
    const fiveSecond = market.recentReturns.fiveSecond;
    const impulse = oneSecond * 0.6 + fiveSecond * 0.4;
    const regime = market.regime.toLowerCase();
    const trending = regime.includes("trend") || regime.includes("breakout");
    const choppy = regime.includes("range") || regime.includes("whipsaw");
    const reversalTrap = oneSecond !== 0 && fiveSecond !== 0 && Math.sign(oneSecond) !== Math.sign(fiveSecond) && market.volatility > 0.005;
    let conviction = clamp(Math.abs(impulse) * 16_000 + noise * 12, 14, 92);
    if (choppy) conviction *= 0.72;
    if (reversalTrap) conviction *= 0.62;
    const action =
      impulse > (trending ? 0.0008 : 0.0012)
        ? "long"
        : impulse < (trending ? -0.0008 : -0.0012)
          ? "short"
          : trending && Math.abs(impulse) > 0.00045
            ? impulse > 0
              ? "long"
              : "short"
            : market.history.length >= 6 && !reversalTrap && !choppy && noise > 0.84
              ? noise > 0.92
                ? "long"
                : "short"
              : "flat";

    return {
      action,
      sizePercent:
        action === "flat"
          ? 0
          : Math.round(clamp(conviction * (trending ? 0.64 : 0.5), trending ? 16 : 10, noise > 0.94 ? 68 : 54)),
      confidence: Math.round(conviction),
      reason:
        action === "flat"
          ? reversalTrap
            ? "Momentum trap risk rising"
            : "Breakout not confirmed yet"
          : action === "long"
            ? `Momentum breakout ${formatPercent(impulse)}`
            : `Momentum breakdown ${formatPercent(impulse)}`,
      source: "sim",
    };
  }
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}
