import type { IStrategy, MarketData, RaceDecision } from "./IStrategy.js";
import { clamp, createSeededRandom } from "../utils.js";

/**
 * Gemini — Volatility-Regime Switcher.
 *
 * Fastest trader. Detects regime flips and vol spikes instantly.
 * Flips direction more often than the others. Highest aggression under uncertainty.
 * "Vol is alpha. Regime flip = opportunity."
 */
export class MockArbitrage implements IStrategy {
  name = "MockArbitrage";

  async decide(market: MarketData): Promise<RaceDecision> {
    const noise = createSeededRandom(
      `${market.seed ?? "seed"}:gemini:${market.history.length}:${Math.floor(market.elapsed)}`
    )();

    const r1 = market.recentReturns.oneSecond;
    const r5 = market.recentReturns.fiveSecond;
    const r15 = market.recentReturns.fifteenSecond;
    const vol = market.volatility;
    const regime = market.regime.toLowerCase();

    // Regime-flip detection: 1s and 5s are opposite signs at elevated vol
    const signFlip = r1 !== 0 && r5 !== 0 && Math.sign(r1) !== Math.sign(r5);
    const highVol = vol > 0.008;
    const extremeVol = vol > 0.018;

    // Directional skew: blend short-term signals
    const directional = r1 * 0.60 + r5 * 0.30 + r15 * 0.10;

    // Under high vol: bet on reversal (volatility mean-reversion)
    // Under low vol: ride the direction (momentum)
    const skew = extremeVol ? -directional * 1.3 : highVol ? -directional * 0.7 : directional * 0.9;

    // Portfolio awareness
    const myRank = market.leaderboard.findIndex((l) => l.name === "Gemini") + 1;
    const behind = myRank === market.leaderboard.length;
    const leading = myRank === 1;
    const pnlRatio = (market.portfolio.equity - 1000) / 1000;

    // Scenario-specific logic
    let action: RaceDecision["action"];

    if (regime.includes("crash") && r15 < -0.008 && r1 > -0.001) {
      // Crash recovery: buy the dip aggressively
      action = "long";
    } else if (regime.includes("breakout") && Math.abs(r1) > 0.0008) {
      // Breakout: ride the direction of the break
      action = r1 > 0 ? "long" : "short";
    } else if (signFlip && highVol) {
      // Regime flip: bet on reversal
      action = r1 > 0 ? "long" : "short"; // 1s is showing recovery
    } else if (extremeVol && Math.abs(skew) > 0.0006) {
      // Extreme vol: strong reversal bet
      action = skew > 0 ? "long" : "short";
    } else if (Math.abs(skew) > 0.0004) {
      action = skew > 0 ? "long" : "short";
    } else {
      // No clear signal: take the 15s direction + noise tiebreak (never truly flat)
      action = r15 !== 0 ? (r15 > 0 ? "long" : "short") : (noise > 0.5 ? "long" : "short");
    }

    // Conviction scales with vol and signal clarity
    const conviction = clamp(
      Math.abs(skew) * 22_000 + vol * 3_000 + (signFlip ? 18 : 0) + 25 + noise * 12 + (behind ? 14 : 0),
      28, 96
    );

    // Gemini sizes up aggressively — highest sizePercent of the three
    const sizeMax = behind ? 95 : leading && pnlRatio > 0.04 ? 70 : 88;
    const sizeMult = signFlip ? 0.92 : highVol ? 0.85 : 0.78;

    return {
      action,
      sizePercent: Math.round(clamp(conviction * sizeMult, 42, sizeMax)),
      confidence: Math.round(conviction),
      reason: signFlip
        ? `Regime flip → ${action} ${fmt(r1)}`
        : extremeVol
          ? `Vol spike reversal ${fmt(skew)}`
          : `Skew ${action} ${fmt(skew)}`,
      source: "sim",
    };
  }
}

function fmt(v: number): string {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}
