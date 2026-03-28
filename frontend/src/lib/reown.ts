import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { defineChain } from "@reown/appkit/networks";

const DEFAULT_LOCALHOST_PROJECT_ID = "b56e18d47c72ab683b10814fe9495694";

const chainId = Number(import.meta.env.VITE_MONAD_CHAIN_ID ?? 10143);
const chainName = import.meta.env.VITE_MONAD_CHAIN_NAME ?? "Monad Testnet";
const rpcUrl = import.meta.env.VITE_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const explorerUrl = import.meta.env.VITE_MONAD_EXPLORER_URL;

export const reownProjectId = import.meta.env.VITE_REOWN_PROJECT_ID ?? DEFAULT_LOCALHOST_PROJECT_ID;
export const usingFallbackReownProjectId = !import.meta.env.VITE_REOWN_PROJECT_ID;

export const derbyNetwork = defineChain({
  id: chainId,
  caipNetworkId: `eip155:${chainId}`,
  chainNamespace: "eip155",
  name: chainName,
  nativeCurrency: {
    decimals: 18,
    name: "MON",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
  blockExplorers: explorerUrl
    ? {
        default: {
          name: `${chainName} Explorer`,
          url: explorerUrl,
        },
      }
    : undefined,
  testnet: true,
});

const metadata = {
  name: "MonadDerby",
  description: "AI trading race and prediction arena on Monad.",
  url: window.location.origin,
  icons: [`${window.location.origin}/favicon.ico`],
};

createAppKit({
  adapters: [new EthersAdapter()],
  networks: [derbyNetwork],
  defaultNetwork: derbyNetwork,
  projectId: reownProjectId,
  metadata,
  themeMode: "dark",
  features: {
    analytics: false,
  },
});
