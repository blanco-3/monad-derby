import type { MarketData } from "../agents/IStrategy.js";
import type { RuntimeAdapter } from "../runtime/RuntimeAdapter.js";

export class MarketDataFeed {
  constructor(private readonly runtime: RuntimeAdapter) {}

  async poll() {
    return await this.runtime.tick();
  }

  async getMarketData(agentAddress: string, elapsed?: number): Promise<MarketData> {
    return await this.runtime.getMarketData(agentAddress, elapsed);
  }
}
