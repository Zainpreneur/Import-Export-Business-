import { openContractCall, type FinishedTxData } from "@stacks/connect";
import {
  callReadOnlyFunction,
  cvToJSON,
  noneCV,
  someCV,
  stringAsciiCV,
  uintCV,
} from "@stacks/transactions";
import { CONTRACT_ADDRESS, CONTRACT_NAME, getNetwork } from "./network";
import { userSession } from "./session";
import type { Order, Party, Product } from "./types";

const network = getNetwork();

// -----------------------------------------------------------------------
// Read-only calls
// -----------------------------------------------------------------------

async function readOnly(functionName: string, functionArgs: any[] = []) {
  const senderAddress = CONTRACT_ADDRESS; // any valid principal works for read-only calls
  const result = await callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName,
    functionArgs,
    network,
    senderAddress,
  });
  return cvToJSON(result);
}

function unwrapOptionalTuple(json: any): Record<string, any> | null {
  if (!json || json.value === null || json.value === undefined) return null;
  return json.value.value;
}

function cvNum(field: any): number {
  return Number(field.value);
}

export async function getTotalParties(): Promise<number> {
  const json = await readOnly("get-total-parties");
  return Number(json.value);
}

export async function getTotalProducts(): Promise<number> {
  const json = await readOnly("get-total-products");
  return Number(json.value);
}

export async function getTotalOrders(): Promise<number> {
  const json = await readOnly("get-total-orders");
  return Number(json.value);
}

export async function getParty(id: number): Promise<Party | null> {
  const json = await readOnly("get-party", [uintCV(id)]);
  const tuple = unwrapOptionalTuple(json);
  if (!tuple) return null;
  return {
    id,
    owner: tuple.owner.value,
    name: tuple.name.value,
    partyType: cvNum(tuple["party-type"]),
    country: tuple.country.value,
    active: tuple.active.value,
  };
}

export async function getProduct(id: number): Promise<Product | null> {
  const json = await readOnly("get-product", [uintCV(id)]);
  const tuple = unwrapOptionalTuple(json);
  if (!tuple) return null;
  return {
    id,
    owner: tuple.owner.value,
    supplierId: cvNum(tuple["supplier-id"]),
    name: tuple.name.value,
    hsCode: tuple["hs-code"].value,
    originCountry: tuple["origin-country"].value,
    unitPrice: cvNum(tuple["unit-price"]),
    quantity: cvNum(tuple.quantity),
  };
}

export async function getOrder(id: number): Promise<Order | null> {
  const json = await readOnly("get-order", [uintCV(id)]);
  const tuple = unwrapOptionalTuple(json);
  if (!tuple) return null;
  return {
    id,
    buyer: tuple.buyer.value,
    seller: tuple.seller.value,
    productId: cvNum(tuple["product-id"]),
    orderType: cvNum(tuple["order-type"]),
    quantity: cvNum(tuple.quantity),
    unitPrice: cvNum(tuple["unit-price"]),
    totalPrice: cvNum(tuple["total-price"]),
    status: cvNum(tuple.status),
    paid: tuple.paid.value,
    trackingNumber: tuple["tracking-number"].value ? tuple["tracking-number"].value.value : null,
    createdAt: cvNum(tuple["created-at"]),
  };
}

/** Fetch every party/product/order currently recorded on-chain, in id order. */
export async function listAll(): Promise<{ parties: Party[]; products: Product[]; orders: Order[] }> {
  const [totalParties, totalProducts, totalOrders] = await Promise.all([
    getTotalParties(),
    getTotalProducts(),
    getTotalOrders(),
  ]);

  const parties = await Promise.all(
    Array.from({ length: totalParties }, (_, i) => getParty(i + 1))
  );
  const products = await Promise.all(
    Array.from({ length: totalProducts }, (_, i) => getProduct(i + 1))
  );
  const orders = await Promise.all(
    Array.from({ length: totalOrders }, (_, i) => getOrder(i + 1))
  );

  return {
    parties: parties.filter((p): p is Party => p !== null),
    products: products.filter((p): p is Product => p !== null),
    orders: orders.filter((o): o is Order => o !== null),
  };
}

// -----------------------------------------------------------------------
// Contract-call (write) transactions, signed in the connected wallet
// -----------------------------------------------------------------------

function callContract(
  functionName: string,
  functionArgs: any[],
  { onFinish, onCancel }: { onFinish?: (data: FinishedTxData) => void; onCancel?: () => void } = {}
) {
  return openContractCall({
    network,
    userSession,
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName,
    functionArgs,
    onFinish,
    onCancel,
  });
}

export function registerParty(
  name: string,
  partyType: number,
  country: string,
  callbacks?: Parameters<typeof callContract>[2]
) {
  return callContract(
    "register-party",
    [stringAsciiCV(name), uintCV(partyType), stringAsciiCV(country)],
    callbacks
  );
}

export function addProduct(
  supplierId: number,
  name: string,
  hsCode: string,
  originCountry: string,
  unitPriceMicroStx: number,
  quantity: number,
  callbacks?: Parameters<typeof callContract>[2]
) {
  return callContract(
    "add-product",
    [
      uintCV(supplierId),
      stringAsciiCV(name),
      stringAsciiCV(hsCode),
      stringAsciiCV(originCountry),
      uintCV(unitPriceMicroStx),
      uintCV(quantity),
    ],
    callbacks
  );
}

export function updateInventory(productId: number, quantity: number, callbacks?: Parameters<typeof callContract>[2]) {
  return callContract("update-inventory", [uintCV(productId), uintCV(quantity)], callbacks);
}

export function createOrder(
  productId: number,
  quantity: number,
  orderType: number,
  callbacks?: Parameters<typeof callContract>[2]
) {
  return callContract("create-order", [uintCV(productId), uintCV(quantity), uintCV(orderType)], callbacks);
}

export function confirmOrder(orderId: number, callbacks?: Parameters<typeof callContract>[2]) {
  return callContract("confirm-order", [uintCV(orderId)], callbacks);
}

export function payOrder(orderId: number, callbacks?: Parameters<typeof callContract>[2]) {
  return callContract("pay-order", [uintCV(orderId)], callbacks);
}

export function updateShipmentStatus(
  orderId: number,
  newStatus: number,
  trackingNumber: string | null,
  callbacks?: Parameters<typeof callContract>[2]
) {
  return callContract(
    "update-shipment-status",
    [uintCV(orderId), uintCV(newStatus), trackingNumber ? someCV(stringAsciiCV(trackingNumber)) : noneCV()],
    callbacks
  );
}

export function cancelOrder(orderId: number, callbacks?: Parameters<typeof callContract>[2]) {
  return callContract("cancel-order", [uintCV(orderId)], callbacks);
}
