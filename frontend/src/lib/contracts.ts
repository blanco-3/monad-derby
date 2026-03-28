import { generatedAbis, generatedContractAddresses } from "./contracts.generated";

export const bettingPoolAbi = [
  ...(generatedAbis.bettingPool.length > 0 ? generatedAbis.bettingPool : ["function placeBet(uint256 agentIndex) payable"]),
] as const;

export const contractAddresses = {
  swap: import.meta.env.VITE_SWAP_CONTRACT ?? generatedContractAddresses.swap,
  arena: import.meta.env.VITE_ARENA_CONTRACT ?? generatedContractAddresses.arena,
  betting: import.meta.env.VITE_BETTING_CONTRACT ?? generatedContractAddresses.betting,
};

export const monadChain = {
  chainId: Number(import.meta.env.VITE_MONAD_CHAIN_ID ?? 10143),
  chainName: import.meta.env.VITE_MONAD_CHAIN_NAME ?? "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: [import.meta.env.VITE_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: import.meta.env.VITE_MONAD_EXPLORER_URL ? [import.meta.env.VITE_MONAD_EXPLORER_URL] : [],
};
