import { useState } from "react";
import type { BettingSnapshot } from "../types";

const EMPTY_ODDS: BettingSnapshot = {
  roundId: 0,
  odds: [0, 0, 0],
  pools: [0, 0, 0],
  totalPool: 0,
  settled: false,
  winnerIndex: null,
};

export function useBettingOdds() {
  const [snapshot, setSnapshot] = useState<BettingSnapshot>(EMPTY_ODDS);

  return {
    snapshot,
    handleOddsUpdate: setSnapshot,
  };
}
