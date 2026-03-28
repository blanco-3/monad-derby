export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

export const SIMPLE_SWAP_ABI = [
  "function getReserves(address tokenA, address tokenB) view returns (uint256 reserveA, uint256 reserveB)",
  "function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256 amountOut)",
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to) returns (uint256 amountOut)",
  "function getPrice(address tokenA, address tokenB) view returns (uint256 price)",
] as const;

export const AGENT_ARENA_ABI = [
  "function startRound(uint256 durationSeconds) returns (uint256 roundId)",
  "function finalizeReportedRound(int256[] finalPnLsBps, uint256 winnerIndex, bytes32 proofHash) returns (address winner, string winnerName)",
  "function getCurrentRound() view returns (uint256 id, uint256 startTime, uint256 endTime, bool active, bool ended, address winner, string winnerName)",
  "function getAgentCount() view returns (uint256)",
  "function getRoundCount() view returns (uint256)",
  "function agents(uint256 index) view returns (address wallet, string memory name, bool registered)",
] as const;

export const BETTING_POOL_ABI = [
  "function resetPool()",
  "function getAllOdds() view returns (uint256[] memory)",
  "function getPoolInfo() view returns (uint256 roundId, uint256[] memory pools, uint256 total, bool isSettled, uint256 winner)",
  "function placeBet(uint256 agentIndex) payable",
] as const;
