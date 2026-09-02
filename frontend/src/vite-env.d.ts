/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STACKS_NETWORK?: "mainnet" | "testnet" | "devnet";
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_CONTRACT_NAME?: string;
  readonly VITE_DEVNET_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
