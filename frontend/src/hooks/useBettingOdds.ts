import { useRef, useState } from "react";
import type { BettingSnapshot } from "../types";

const EMPTY_ODDS: BettingSnapshot = {
  roundId: 0,
  odds: [2.91, 2.91, 2.91],
  pools: [0, 0, 0],
  totalPool: 0,
  probabilities: [0.333, 0.333, 0.333],
  perfProbabilities: null,
  settled: false,
  winnerIndex: null,
};

export function useBettingOdds() {
  const [snapshot, setSnapshot] = useState<BettingSnapshot>(EMPTY_ODDS);
  // Track previous odds to show ↑↓ movement since last update
  const prevOddsRef = useRef<number[]>([2.91, 2.91, 2.91]);

  const handleOddsUpdate = (next: BettingSnapshot) => {
    prevOddsRef.current = snapshot.odds;
    setSnapshot(next);
  };

  return {
    snapshot,
    prevOdds: prevOddsRef.current,
    handleOddsUpdate,
  };
}
