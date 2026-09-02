import { CONTRACT_ADDRESS, CONTRACT_NAME, NETWORK_NAME } from "../lib/network";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Header({
  address,
  onConnect,
  onDisconnect,
}: {
  address: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <header className="header">
      <div>
        <h1>Import / Export Trade Desk</h1>
        <p className="subtle">
          {NETWORK_NAME} · {CONTRACT_ADDRESS}.{CONTRACT_NAME}
        </p>
      </div>
      {address ? (
        <div className="wallet-status">
          <span className="badge tone-success">{truncate(address)}</span>
          <button className="btn btn-secondary" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={onConnect}>
          Connect Wallet
        </button>
      )}
    </header>
  );
}
