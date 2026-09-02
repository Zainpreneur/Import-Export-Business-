import { useState } from "react";
import { addProduct } from "../lib/contract";
import { PARTY_TYPE, type Party, type Product } from "../lib/types";

function stx(microStx: number) {
  return `${(microStx / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} STX`;
}

export function ProductPanel({
  myParty,
  products,
  onSubmitted,
}: {
  myParty: Party | null;
  products: Product[];
  onSubmitted: () => void;
}) {
  const isSupplier = myParty?.partyType === PARTY_TYPE.SUPPLIER && myParty.active;

  const [name, setName] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [origin, setOrigin] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!myParty || !isSupplier) return;
    const unitPriceMicroStx = Math.round(Number(price) * 1_000_000);
    const qty = Number(quantity);
    if (!name || !hsCode || !origin || !unitPriceMicroStx || !qty) return;

    setBusy(true);
    try {
      await addProduct(myParty.id, name, hsCode, origin, unitPriceMicroStx, qty, {
        onFinish: () => {
          setBusy(false);
          setName("");
          setHsCode("");
          setOrigin("");
          setPrice("");
          setQuantity("");
          onSubmitted();
        },
        onCancel: () => setBusy(false),
      });
    } catch {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Product catalog</h2>
      <p className="subtle">Suppliers list the goods available for export, priced in STX.</p>

      {isSupplier && (
        <form className="form form-grid" onSubmit={handleSubmit}>
          <label>
            Product name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} required />
          </label>
          <label>
            HS code
            <input
              value={hsCode}
              onChange={(e) => setHsCode(e.target.value)}
              placeholder="e.g. 8482.10"
              maxLength={16}
              required
            />
          </label>
          <label>
            Origin country
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} maxLength={32} required />
          </label>
          <label>
            Unit price (STX)
            <input
              type="number"
              min="0"
              step="0.000001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </label>
          <label>
            Quantity in stock
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Confirm in wallet…" : "List product"}
          </button>
        </form>
      )}
      {!isSupplier && (
        <p className="subtle">Register as an active supplier to list products.</p>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>HS code</th>
            <th>Origin</th>
            <th>Unit price</th>
            <th>In stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.hsCode}</td>
              <td>{p.originCountry}</td>
              <td>{stx(p.unitPrice)}</td>
              <td>{p.quantity}</td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={6} className="subtle">
                No products listed yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
