import type { RaceDecision } from "../agents/IStrategy.js";
import type { RuntimeAdapter, RuntimeAgentAccount, DecisionExecutionResult } from "../runtime/RuntimeAdapter.js";

export class TxExecutor {
  constructor(private readonly runtime: RuntimeAdapter) {}

  async execute(agent: RuntimeAgentAccount, decision: RaceDecision): Promise<DecisionExecutionResult | null> {
    return await this.runtime.executeDecision(agent, decision);
  }
}
