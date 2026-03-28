/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_HTTP_URL?: string;
  readonly VITE_AGENT_WS_URL?: string;
  readonly VITE_REOWN_PROJECT_ID?: string;
  readonly VITE_SWAP_CONTRACT?: string;
  readonly VITE_ARENA_CONTRACT?: string;
  readonly VITE_BETTING_CONTRACT?: string;
  readonly VITE_MONAD_CHAIN_ID?: string;
  readonly VITE_MONAD_CHAIN_NAME?: string;
  readonly VITE_MONAD_RPC_URL?: string;
  readonly VITE_MONAD_EXPLORER_URL?: string;
}
