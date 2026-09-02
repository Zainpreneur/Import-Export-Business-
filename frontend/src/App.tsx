import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { PartyPanel } from "./components/PartyPanel";
import { ProductPanel } from "./components/ProductPanel";
import { OrderPanel } from "./components/OrderPanel";
import { listAll } from "./lib/contract";
import { NETWORK_NAME } from "./lib/network";
import { connectWallet, disconnectWallet, getCurrentAddress, isSignedIn } from "./lib/session";
import type { Order, Party, Product } from "./lib/types";

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn()) {
      setAddress(getCurrentAddress(NETWORK_NAME !== "mainnet"));
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAll();
      setParties(data.parties);
      setProducts(data.products);
      setOrders(data.orders);
    } catch (err) {
      setError(
        "Couldn't load contract data. Check that VITE_CONTRACT_ADDRESS / VITE_CONTRACT_NAME " +
          "in your .env point at a deployed instance of import-export.clar on " +
          NETWORK_NAME +
          "."
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const myParty = useMemo(
    () => (address ? parties.find((p) => p.owner === address) ?? null : null),
    [address, parties]
  );

  function handleConnect() {
    connectWallet(() => {
      setAddress(getCurrentAddress(NETWORK_NAME !== "mainnet"));
    });
  }

  function handleDisconnect() {
    disconnectWallet();
    setAddress(null);
  }

  return (
    <div className="app">
      <Header address={address} onConnect={handleConnect} onDisconnect={handleDisconnect} />

      {error && <div className="callout callout-error">{error}</div>}
      {loading && <div className="callout">Loading on-chain data…</div>}

      <PartyPanel address={address} myParty={myParty} parties={parties} onSubmitted={refresh} />
      <ProductPanel myParty={myParty} products={products} onSubmitted={refresh} />
      <OrderPanel
        address={address}
        myParty={myParty}
        products={products}
        orders={orders}
        onSubmitted={refresh}
      />

      <footer className="footer">
        Built on <a href="https://www.stacks.co" target="_blank" rel="noreferrer">Stacks</a> with{" "}
        <a href="https://docs.hiro.so/stacks/stacks.js" target="_blank" rel="noreferrer">
          Stacks.js
        </a>
        . Contract source: <code>contracts/import-export.clar</code>.
      </footer>
    </div>
  );
}
