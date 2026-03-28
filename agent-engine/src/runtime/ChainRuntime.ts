import { Contract, JsonRpcProvider, NonceManager, Wallet, formatEther } from "ethers";
import type { AppConfig } from "../config.js";
import { AGENT_ARENA_ABI, BETTING_POOL_ABI } from "../contracts/abis.js";
import type { BettingSnapshot, RoundStartOptions } from "./RuntimeAdapter.js";
import { BaseRaceRuntime } from "./BaseRaceRuntime.js";

export class ChainRuntime extends BaseRaceRuntime {
  private provider!: JsonRpcProvider;
  private ownerSigner!: NonceManager;
  private arena!: Contract;
  private betting!: Contract;

  constructor(config: AppConfig) {
    super(config, "chain");
  }

  override async init(): Promise<void> {
    const { rpcUrl, deployerPrivateKey, arenaAddress, bettingAddress } = this.config.chain;
    if (!deployerPrivateKey || !arenaAddress || !bettingAddress) {
      throw new Error("missing chain configuration");
    }

    await super.init();

    this.provider = new JsonRpcProvider(rpcUrl);
    this.ownerSigner = new NonceManager(new Wallet(deployerPrivateKey, this.provider));
    this.arena = new Contract(arenaAddress, AGENT_ARENA_ABI, this.ownerSigner);
    this.betting = new Contract(bettingAddress, BETTING_POOL_ABI, this.ownerSigner);
  }

  async getBettingSnapshot(): Promise<BettingSnapshot> {
    const [roundId, pools, totalPool, settled, winnerIndex] = (await this.betting.getPoolInfo()) as [
      bigint,
      bigint[],
      bigint,
      boolean,
      bigint,
    ];
    const oddsRaw = (await this.betting.getAllOdds()) as bigint[];

    const poolAmounts = pools.map((value) => Number(formatEther(value)));
    const totalPoolNum = Number(formatEther(totalPool));
    const impliedProbs = poolAmounts.map((p) =>
      totalPoolNum > 0 ? p / totalPoolNum : 1 / poolAmounts.length
    );

    return {
      roundId: Number(roundId),
      odds: oddsRaw.map((value) => Number(formatEther(value))),
      pools: poolAmounts,
      totalPool: totalPoolNum,
      probabilities: impliedProbs,
      perfProbabilities: null, // enriched by RoundManager.broadcastOdds
      settled,
      winnerIndex: settled ? Number(winnerIndex) : null,
    };
  }

  protected async prepareBettingRound(): Promise<number> {
    const roundCount = Number(await this.arena.getRoundCount());
    const expectedRoundId = roundCount + 1;
    const [bettingRoundId, , , settled] = (await this.betting.getPoolInfo()) as [bigint, bigint[], bigint, boolean, bigint];

    if (Number(bettingRoundId) === expectedRoundId && !settled) {
      return expectedRoundId;
    }

    const resetTx = await this.betting.resetPool();
    await resetTx.wait();
    return expectedRoundId;
  }

  protected async startBettingRound(durationSeconds: number): Promise<void> {
    const tx = await this.arena.startRound(durationSeconds);
    await tx.wait();
  }

  protected async finalizeBettingRound(result: {
    roundId: number;
    finalPnls: number[];
    winnerIndex: number;
    winnerAddress: string;
    winnerName: string;
    proofHash: string;
  }): Promise<{ betting: BettingSnapshot; payouts?: Record<string, number> }> {
    const pnlBps = result.finalPnls.map((value) => Math.round(value * 100));
    const tx = await this.arena.finalizeReportedRound(pnlBps, result.winnerIndex, result.proofHash);
    await tx.wait();

    return {
      betting: await this.getBettingSnapshot(),
    };
  }
}
