import { useState } from "react";
import {
  cancelOrder,
  confirmOrder,
  createOrder,
  payOrder,
  updateShipmentStatus,
} from "../lib/contract";
import { ORDER_STATUS, ORDER_TYPE, type Order, type Party, type Product } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

function stx(microStx: number) {
  return `${(microStx / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} STX`;
}

export function OrderPanel({
  address,
  myParty,
  products,
  orders,
  onSubmitted,
}: {
  address: string | null;
  myParty: Party | null;
  products: Product[];
  orders: Order[];
  onSubmitted: () => void;
}) {
  const [productId, setProductId] = useState<number | "">("");
  const [quantity, setQuantity] = useState("");
  const [orderType, setOrderType] = useState<number>(ORDER_TYPE.EXPORT);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !quantity) return;
    setBusyId(-1);
    try {
      await createOrder(Number(productId), Number(quantity), orderType, {
        onFinish: () => {
          setBusyId(null);
          setProductId("");
          setQuantity("");
          onSubmitted();
        },
        onCancel: () => setBusyId(null),
      });
    } catch {
      setBusyId(null);
    }
  }

  function runAction(id: number, promise: Promise<unknown>) {
    setBusyId(id);
    promise
      .then(() => onSubmitted())
      .catch(() => undefined)
      .finally(() => setBusyId(null));
  }

  return (
    <section className="panel">
      <h2>Orders &amp; shipment tracking</h2>
      <p className="subtle">
        A registered party opens a trade order against a listed product. STX settles on-chain and
        the shipment moves through customs in a fixed, auditable sequence.
      </p>

      {myParty && (
        <form className="form form-grid" onSubmit={handleCreate}>
          <label>
            Product
            <select value={productId} onChange={(e) => setProductId(Number(e.target.value))} required>
              <option value="" disabled>
                Select a product
              </option>
              {products
                .filter((p) => p.owner !== address)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} {p.name} — {stx(p.unitPrice)}/unit ({p.quantity} in stock)
                  </option>
                ))}
            </select>
          </label>
          <label>
            Quantity
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
          <label>
            Trade direction
            <select value={orderType} onChange={(e) => setOrderType(Number(e.target.value))}>
              <option value={ORDER_TYPE.EXPORT}>Export (goods leaving seller's country)</option>
              <option value={ORDER_TYPE.IMPORT}>Import (goods entering buyer's country)</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={busyId === -1}>
            {busyId === -1 ? "Confirm in wallet…" : "Create order"}
          </button>
        </form>
      )}
      {!myParty && <p className="subtle">Register as a party to place an order.</p>}

      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Total</th>
            <th>Buyer</th>
            <th>Seller</th>
            <th>Status</th>
            <th>Tracking</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const isBuyer = o.buyer === address;
            const isSeller = o.seller === address;
            const busy = busyId === o.id;

            return (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>#{o.productId}</td>
                <td>{o.quantity}</td>
                <td>{stx(o.totalPrice)}</td>
                <td className="mono">{o.buyer.slice(0, 8)}…</td>
                <td className="mono">{o.seller.slice(0, 8)}…</td>
                <td>
                  <StatusBadge status={o.status} />
                  {o.paid && <span className="badge tone-success">paid</span>}
                </td>
                <td>{o.trackingNumber ?? "—"}</td>
                <td className="actions">
                  {isSeller && o.status === ORDER_STATUS.CREATED && (
                    <button disabled={busy} onClick={() => runAction(o.id, confirmOrder(o.id))}>
                      Confirm
                    </button>
                  )}
                  {isBuyer && o.status === ORDER_STATUS.CONFIRMED && !o.paid && (
                    <button disabled={busy} onClick={() => runAction(o.id, payOrder(o.id))}>
                      Pay
                    </button>
                  )}
                  {isSeller &&
                    o.status >= ORDER_STATUS.CONFIRMED &&
                    o.status < ORDER_STATUS.DELIVERED && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            o.id,
                            updateShipmentStatus(
                              o.id,
                              o.status + 1,
                              o.status === ORDER_STATUS.CONFIRMED
                                ? prompt("Tracking number (optional):") || null
                                : null
                            )
                          )
                        }
                      >
                        Advance → {o.status + 1 <= ORDER_STATUS.DELIVERED ? "next stage" : ""}
                      </button>
                    )}
                  {(isBuyer || isSeller) && o.status < ORDER_STATUS.SHIPPED && (
                    <button disabled={busy} className="btn-danger" onClick={() => runAction(o.id, cancelOrder(o.id))}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {orders.length === 0 && (
            <tr>
              <td colSpan={9} className="subtle">
                No orders yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
