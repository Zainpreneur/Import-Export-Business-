import { StacksDevnet, StacksMainnet, StacksNetwork, StacksTestnet } from "@stacks/network";

export type NetworkName = "mainnet" | "testnet" | "devnet";

export const NETWORK_NAME: NetworkName =
  (import.meta.env.VITE_STACKS_NETWORK as NetworkName | undefined) ?? "testnet";

export function getNetwork(): StacksNetwork {
  switch (NETWORK_NAME) {
    case "mainnet":
      return new StacksMainnet();
    case "devnet":
      return new StacksDevnet({
        url: import.meta.env.VITE_DEVNET_API_URL ?? "http://localhost:3999",
      });
    case "testnet":
    default:
      return new StacksTestnet();
  }
}

// The deployed contract's principal + name. Populate these via
// .env (see .env.example) once the contract has been published with
// `clarinet deployments generate --testnet` / `--mainnet`.
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ?? "ST000000000000000000002AMW42H";
export const CONTRACT_NAME = import.meta.env.VITE_CONTRACT_NAME ?? "import-export";
