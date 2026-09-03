import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const CONTRACT = "import-export";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const supplierWallet = accounts.get("wallet_1")!; // exporter / seller
const clientWallet = accounts.get("wallet_2")!;   // importer / buyer

const PARTY_TYPE_SUPPLIER = 1;
const PARTY_TYPE_CLIENT = 2;
const ORDER_TYPE_EXPORT = 1;

function registerSupplier() {
  return simnet.callPublicFn(
    CONTRACT,
    "register-party",
    [Cl.stringAscii("Acme Exports"), Cl.uint(PARTY_TYPE_SUPPLIER), Cl.stringAscii("DE")],
    supplierWallet
  );
}

function registerClient() {
  return simnet.callPublicFn(
    CONTRACT,
    "register-party",
    [Cl.stringAscii("Globex Imports"), Cl.uint(PARTY_TYPE_CLIENT), Cl.stringAscii("US")],
    clientWallet
  );
}

function addProduct(supplierId: number) {
  return simnet.callPublicFn(
    CONTRACT,
    "add-product",
    [
      Cl.uint(supplierId),
      Cl.stringAscii("Industrial Bearings"),
      Cl.stringAscii("8482.10"),
      Cl.stringAscii("DE"),
      Cl.uint(1_000_000), // 1 STX per unit
      Cl.uint(500),
    ],
    supplierWallet
  );
}

describe("party management", () => {
  it("registers a supplier and a client", () => {
    const supplier = registerSupplier();
    expect(supplier.result).toBeOk(Cl.uint(1));

    const client = registerClient();
    expect(client.result).toBeOk(Cl.uint(2)); // party ids share one global counter
  });

  it("rejects a second registration from the same wallet", () => {
    registerSupplier();
    const again = registerSupplier();
    expect(again.result).toBeErr(Cl.uint(102)); // ERR-PARTY-ALREADY-REGISTERED
  });

  it("rejects an invalid party type", () => {
    const bad = simnet.callPublicFn(
      CONTRACT,
      "register-party",
      [Cl.stringAscii("Nobody"), Cl.uint(9), Cl.stringAscii("US")],
      clientWallet
    );
    expect(bad.result).toBeErr(Cl.uint(104)); // ERR-INVALID-PARTY-TYPE
  });
});

describe("product / inventory management", () => {
  it("lets a registered supplier list a product", () => {
    registerSupplier();
    const product = addProduct(1);
    expect(product.result).toBeOk(Cl.uint(1));

    const stored = simnet.callReadOnlyFn(CONTRACT, "get-product", [Cl.uint(1)], deployer);
    expect(stored.result).toBeSome(
      Cl.tuple({
        owner: Cl.principal(supplierWallet),
        "supplier-id": Cl.uint(1),
        name: Cl.stringAscii("Industrial Bearings"),
        "hs-code": Cl.stringAscii("8482.10"),
        "origin-country": Cl.stringAscii("DE"),
        "unit-price": Cl.uint(1_000_000),
        quantity: Cl.uint(500),
      })
    );
  });

  it("rejects a client trying to list a product", () => {
    registerClient();
    const attempt = simnet.callPublicFn(
      CONTRACT,
      "add-product",
      [Cl.uint(1), Cl.stringAscii("Bad Item"), Cl.stringAscii("0000.00"), Cl.stringAscii("US"), Cl.uint(1), Cl.uint(1)],
      clientWallet
    );
    expect(attempt.result).toBeErr(Cl.uint(104)); // ERR-INVALID-PARTY-TYPE
  });
});

describe("order lifecycle", () => {
  function setup() {
    registerSupplier();
    registerClient();
    addProduct(1);
  }

  it("creates an order and reserves inventory", () => {
    setup();
    const order = simnet.callPublicFn(
      CONTRACT,
      "create-order",
      [Cl.uint(1), Cl.uint(10), Cl.uint(ORDER_TYPE_EXPORT)],
      clientWallet
    );
    expect(order.result).toBeOk(Cl.uint(1));

    const product = simnet.callReadOnlyFn(CONTRACT, "get-product", [Cl.uint(1)], deployer);
    expect(product.result).toBeSome(
      Cl.tuple({
        owner: Cl.principal(supplierWallet),
        "supplier-id": Cl.uint(1),
        name: Cl.stringAscii("Industrial Bearings"),
        "hs-code": Cl.stringAscii("8482.10"),
        "origin-country": Cl.stringAscii("DE"),
        "unit-price": Cl.uint(1_000_000),
        quantity: Cl.uint(490),
      })
    );
  });

  it("walks an order through confirm -> pay -> ship -> deliver", () => {
    setup();
    simnet.callPublicFn(CONTRACT, "create-order", [Cl.uint(1), Cl.uint(10), Cl.uint(ORDER_TYPE_EXPORT)], clientWallet);

    const confirm = simnet.callPublicFn(CONTRACT, "confirm-order", [Cl.uint(1)], supplierWallet);
    expect(confirm.result).toBeOk(Cl.bool(true));

    const pay = simnet.callPublicFn(CONTRACT, "pay-order", [Cl.uint(1)], clientWallet);
    expect(pay.result).toBeOk(Cl.bool(true));

    const shipped = simnet.callPublicFn(
      CONTRACT,
      "update-shipment-status",
      [Cl.uint(1), Cl.uint(2), Cl.some(Cl.stringAscii("TRACK-0001"))],
      supplierWallet
    );
    expect(shipped.result).toBeOk(Cl.bool(true));

    const inTransit = simnet.callPublicFn(
      CONTRACT,
      "update-shipment-status",
      [Cl.uint(1), Cl.uint(3), Cl.none()],
      supplierWallet
    );
    expect(inTransit.result).toBeOk(Cl.bool(true));

    const cleared = simnet.callPublicFn(
      CONTRACT,
      "update-shipment-status",
      [Cl.uint(1), Cl.uint(4), Cl.none()],
      supplierWallet
    );
    expect(cleared.result).toBeOk(Cl.bool(true));

    const delivered = simnet.callPublicFn(
      CONTRACT,
      "update-shipment-status",
      [Cl.uint(1), Cl.uint(5), Cl.none()],
      supplierWallet
    );
    expect(delivered.result).toBeOk(Cl.bool(true));

    const status = simnet.callReadOnlyFn(CONTRACT, "get-order-status", [Cl.uint(1)], deployer);
    expect(status.result).toBeOk(Cl.uint(5)); // STATUS-DELIVERED
  });

  it("rejects skipping ahead in the shipment pipeline", () => {
    setup();
    simnet.callPublicFn(CONTRACT, "create-order", [Cl.uint(1), Cl.uint(10), Cl.uint(ORDER_TYPE_EXPORT)], clientWallet);
    simnet.callPublicFn(CONTRACT, "confirm-order", [Cl.uint(1)], supplierWallet);

    // jump straight to "in transit" (u3) skipping "shipped" (u2)
    const badJump = simnet.callPublicFn(
      CONTRACT,
      "update-shipment-status",
      [Cl.uint(1), Cl.uint(3), Cl.none()],
      supplierWallet
    );
    expect(badJump.result).toBeErr(Cl.uint(112)); // ERR-INVALID-STATUS-TRANSITION
  });

  it("moves STX from buyer to seller on payment", () => {
    setup();
    simnet.callPublicFn(CONTRACT, "create-order", [Cl.uint(1), Cl.uint(10), Cl.uint(ORDER_TYPE_EXPORT)], clientWallet);
    simnet.callPublicFn(CONTRACT, "confirm-order", [Cl.uint(1)], supplierWallet);

    const before = simnet.getAssetsMap().get("STX")!;
    const pay = simnet.callPublicFn(CONTRACT, "pay-order", [Cl.uint(1)], clientWallet);
    expect(pay.result).toBeOk(Cl.bool(true));
    const after = simnet.getAssetsMap().get("STX")!;

    expect(after.get(supplierWallet)! - before.get(supplierWallet)!).toBe(10_000_000n);
  });

  it("cancels an order before shipment and restores inventory", () => {
    setup();
    simnet.callPublicFn(CONTRACT, "create-order", [Cl.uint(1), Cl.uint(10), Cl.uint(ORDER_TYPE_EXPORT)], clientWallet);

    const cancel = simnet.callPublicFn(CONTRACT, "cancel-order", [Cl.uint(1)], clientWallet);
    expect(cancel.result).toBeOk(Cl.bool(true));

    const product = simnet.callReadOnlyFn(CONTRACT, "get-product", [Cl.uint(1)], deployer);
    expect(product.result).toBeSome(
      Cl.tuple({
        owner: Cl.principal(supplierWallet),
        "supplier-id": Cl.uint(1),
        name: Cl.stringAscii("Industrial Bearings"),
        "hs-code": Cl.stringAscii("8482.10"),
        "origin-country": Cl.stringAscii("DE"),
        "unit-price": Cl.uint(1_000_000),
        quantity: Cl.uint(500),
      })
    );
  });

  it("rejects ordering more than is in stock", () => {
    setup();
    const tooMany = simnet.callPublicFn(
      CONTRACT,
      "create-order",
      [Cl.uint(1), Cl.uint(1000), Cl.uint(ORDER_TYPE_EXPORT)],
      clientWallet
    );
    expect(tooMany.result).toBeErr(Cl.uint(107)); // ERR-INSUFFICIENT-INVENTORY
  });

  it("rejects a non-party updating shipment status", () => {
    setup();
    simnet.callPublicFn(CONTRACT, "create-order", [Cl.uint(1), Cl.uint(10), Cl.uint(ORDER_TYPE_EXPORT)], clientWallet);
    simnet.callPublicFn(CONTRACT, "confirm-order", [Cl.uint(1)], supplierWallet);

    const intruder = accounts.get("wallet_3")!;
    const attempt = simnet.callPublicFn(
      CONTRACT,
      "update-shipment-status",
      [Cl.uint(1), Cl.uint(2), Cl.none()],
      intruder
    );
    expect(attempt.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
  });
});
