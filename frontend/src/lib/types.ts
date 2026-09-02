// Mirrors the constants declared in contracts/import-export.clar.

export const PARTY_TYPE = { SUPPLIER: 1, CLIENT: 2 } as const;
export const ORDER_TYPE = { EXPORT: 1, IMPORT: 2 } as const;

export const ORDER_STATUS = {
  CREATED: 0,
  CONFIRMED: 1,
  SHIPPED: 2,
  IN_TRANSIT: 3,
  CUSTOMS_CLEARED: 4,
  DELIVERED: 5,
  CANCELLED: 6,
} as const;

export const ORDER_STATUS_LABEL: Record<number, string> = {
  0: "Created",
  1: "Confirmed",
  2: "Shipped",
  3: "In transit",
  4: "Customs cleared",
  5: "Delivered",
  6: "Cancelled",
};

export interface Party {
  id: number;
  owner: string;
  name: string;
  partyType: number;
  country: string;
  active: boolean;
}

export interface Product {
  id: number;
  owner: string;
  supplierId: number;
  name: string;
  hsCode: string;
  originCountry: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: number;
  buyer: string;
  seller: string;
  productId: number;
  orderType: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: number;
  paid: boolean;
  trackingNumber: string | null;
  createdAt: number;
}
