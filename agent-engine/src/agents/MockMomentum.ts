import type { IStrategy, MarketData, RaceDecision } from "./IStrategy.js";
import { clamp, createSeededRandom } from "../utils.js";

/**
 * Claude — Aggressive Momentum.
 *
 * Nearly always in a position. Rides trends hard, cuts quickly on reversals.
 * High sizePercent: 45–90%. Flips direction whenever the momentum signal flips.
 * "Never flat unless completely confused."
 */
export class MockMomentum implements IStrategy {
  name = "MockMomentum";

  async decide(market: MarketData): Promise<RaceDecision> {
    const noise = createSeededRandom(
      `${market.seed ?? "seed"}:claude:${market.history.length}:${Math.floor(market.elapsed)}`
    )();

    const r1 = market.recentReturns.oneSecond;
    const r5 = market.recentReturns.fiveSecond;
    const r15 = market.recentReturns.fifteenSecond;

    // Composite momentum: weighted recent returns
    const impulse = r1 * 0.55 + r5 * 0.30 + r15 * 0.15;
    const regime = market.regime.toLowerCase();
    const trending = regime.includes("trend") || regime.includes("breakout");
    const choppy = regime.includes("range") || regime.includes("whipsaw");

    // Reversal trap: 1s and 5s signals conflict at high vol
    const reversalTrap =
      r1 !== 0 && r5 !== 0 &&
      Math.sign(r1) !== Math.sign(r5) &&
      market.volatility > 0.006;

    // Portfolio-aware aggression: falling behind → take more risk
    const equity = market.portfolio.equity;
    const pnlRatio = (equity - 1000) / 1000;
    const myRank = market.leaderboard.findIndex((l) => l.name === "Claude") + 1;
    const behind = myRank === market.leaderboard.length; // last place
    const leading = myRank === 1;

    // Base conviction from impulse strength
    let conviction = clamp(
      Math.abs(impulse) * 18_000 + noise * 15 + (behind ? 12 : 0),
      22, 94
    );
    if (choppy) conviction *= 0.78;
    if (reversalTrap) conviction *= 0.65;
    if (leading && pnlRatio > 0.03) conviction *= 0.88; // protect lead slightly

    // Direction: always commit unless impulse is truly near zero
    const threshold = trending ? 0.0003 : 0.0005;
    let action: RaceDecision["action"];

    if (impulse > threshold) {
      action = "long";
    } else if (impulse < -threshold) {
      action = "short";
    } else if (reversalTrap) {
      // Take the 1s direction — fast reaction
      action = r1 > 0 ? "long" : "short";
    } else {
      // When uncertain: lean into the longer-term trend + noise tiebreak
      action = r15 !== 0 ? (r15 > 0 ? "long" : "short") : (noise > 0.5 ? "long" : "short");
    }

    const sizeBase = clamp(conviction * (trending ? 0.85 : 0.68), 40, behind ? 90 : 78);

    return {
      action,
      sizePercent: Math.round(sizeBase),
      confidence: Math.round(conviction),
      reason:
        action === "long"
          ? reversalTrap
            ? `Trap fade long ${fmt(r1)}`
            : `Momentum up ${fmt(impulse)}`
          : reversalTrap
            ? `Trap fade short ${fmt(r1)}`
            : `Momentum down ${fmt(impulse)}`,
      source: "sim",
    };
  }
}

function fmt(v: number): string {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}
