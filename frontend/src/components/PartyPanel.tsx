import { useState } from "react";
import { registerParty } from "../lib/contract";
import { PARTY_TYPE, type Party } from "../lib/types";

export function PartyPanel({
  address,
  myParty,
  parties,
  onSubmitted,
}: {
  address: string | null;
  myParty: Party | null;
  parties: Party[];
  onSubmitted: () => void;
}) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [partyType, setPartyType] = useState<number>(PARTY_TYPE.SUPPLIER);
  const [busy, setBusy] = useState(false);

  const canRegister = address && !myParty;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !country) return;
    setBusy(true);
    try {
      await registerParty(name, partyType, country, {
        onFinish: () => {
          setBusy(false);
          setName("");
          setCountry("");
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
      <h2>Trade parties</h2>
      <p className="subtle">
        Every wallet registers once, as either a supplier (exporter) or a client (importer),
        before it can list products or place orders.
      </p>

      {myParty ? (
        <div className="callout">
          You're registered as <strong>{myParty.name}</strong> (
          {myParty.partyType === PARTY_TYPE.SUPPLIER ? "supplier" : "client"}, {myParty.country})
          {!myParty.active && " — inactive"}
        </div>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Company / organization name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} required />
          </label>
          <label>
            Country
            <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={32} required />
          </label>
          <label>
            Role
            <select value={partyType} onChange={(e) => setPartyType(Number(e.target.value))}>
              <option value={PARTY_TYPE.SUPPLIER}>Supplier / exporter</option>
              <option value={PARTY_TYPE.CLIENT}>Client / importer</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={!canRegister || busy}>
            {busy ? "Confirm in wallet…" : "Register party"}
          </button>
          {!address && <p className="subtle">Connect your wallet first.</p>}
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Role</th>
            <th>Country</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.partyType === PARTY_TYPE.SUPPLIER ? "Supplier" : "Client"}</td>
              <td>{p.country}</td>
              <td>{p.active ? "Active" : "Inactive"}</td>
            </tr>
          ))}
          {parties.length === 0 && (
            <tr>
              <td colSpan={5} className="subtle">
                No parties registered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
