# Import / Export Business

An on-chain import/export trading platform built on the [Stacks](https://www.stacks.co)
blockchain, driven from a web frontend with **[Stacks.js](https://docs.hiro.so/stacks/stacks.js)**.

The business logic — registering trade parties, listing products, placing orders, settling
payment in STX, and moving a shipment through customs — lives in a Clarity smart contract, so
every order and shipment-status update is a transparent, auditable on-chain event. The frontend
is a thin client: it never touches a private key or a centralized database, it just reads
contract state and asks the visitor's wallet (Leather, Xverse, …) to sign transactions via
`@stacks/connect`.

## Architecture

```
contracts/import-export.clar   Clarity smart contract — the whole business model
tests/import-export.test.ts    Clarinet SDK / vitest tests covering every code path
Clarinet.toml                  Clarinet project config
settings/                      Simnet (tests) and Devnet (local node) account config

frontend/                      React + TypeScript + Vite app, talks to the contract via Stacks.js
  src/lib/network.ts             Network + deployed contract address configuration
  src/lib/session.ts             Wallet connect/disconnect (@stacks/connect)
  src/lib/contract.ts            Read-only queries + contract-call transactions
  src/lib/types.ts               TS types mirroring the Clarity data model
  src/components/                Party / Product / Order UI panels
```

### On-chain data model

| Entity      | Represents                                                             |
|-------------|-------------------------------------------------------------------------|
| **Party**   | A registered supplier (exporter) or client (importer) wallet            |
| **Product** | Inventory a supplier has listed, with an HS code, origin and unit price |
| **Order**   | A buyer's trade order against a product, import or export               |
| **Shipment**| The order's status as it moves through a fixed pipeline (below), tracked inside the order record |

Shipment/order status pipeline (each step can only advance one stage at a time):

```
Created → Confirmed → Shipped → In transit → Customs cleared → Delivered
                                                        ↘
                                          Cancelled (only before "Shipped")
```

Payment settles in STX directly between buyer and seller via `stx-transfer?` once the seller
has confirmed the order. Inventory is reserved at order-creation time and released again if the
order is cancelled, so stock can never be oversold.

See the full function/error reference in the contract's doc-comments:
[`contracts/import-export.clar`](./contracts/import-export.clar).

## Smart contract: setup & tests

Requires [Clarinet](https://docs.hiro.so/stacks/clarinet) for local development (the test suite
itself only needs Node — it runs Clarity in-process via `@stacks/clarinet-sdk`, no Rust binary
required).

```bash
npm install
npm test          # runs tests/import-export.test.ts against the contract with vitest
npm run test:watch
```

To interact with the contract locally against a real devnet, and Clarinet CLI is installed:

```bash
clarinet check              # static-analyze the contract
clarinet console             # REPL against a fresh simnet
clarinet devnet start          # spin up a local devnet (uses settings/Devnet.toml)
```

## Frontend: setup & run

```bash
cd frontend
npm install
cp .env.example .env   # then fill in the deployed contract's address/name
npm run dev             # http://localhost:5173
```

Environment variables (`frontend/.env`):

| Variable                 | Purpose                                                      |
|---------------------------|----------------------------------------------------------------|
| `VITE_STACKS_NETWORK`      | `mainnet` \| `testnet` \| `devnet`                              |
| `VITE_CONTRACT_ADDRESS`    | Principal that deployed `import-export.clar`                    |
| `VITE_CONTRACT_NAME`       | Deployed contract name (defaults to `import-export`)             |
| `VITE_DEVNET_API_URL`      | Only for `devnet`: URL of your local `clarinet devnet` node       |

### Using the app

1. **Connect Wallet** (Leather/Xverse) in the header.
2. **Register** the wallet once, as a supplier or client, under "Trade parties".
3. Suppliers **list products** (name, HS code, origin, STX unit price, stock) under "Product
   catalog".
4. Clients **create an order** against another party's product under "Orders & shipment
   tracking".
5. The seller **confirms** the order, the buyer **pays** in STX, and the seller **advances** the
   shipment through customs one stage at a time until it's **delivered**. Either side can
   **cancel** any time before the goods ship, which restores the reserved inventory.

## Deploying the contract

```bash
clarinet deployments generate --testnet   # or --mainnet
clarinet deployments apply --testnet
```

Then point the frontend's `.env` at the resulting contract address/name.
