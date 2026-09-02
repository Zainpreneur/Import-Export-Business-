import { ORDER_STATUS, ORDER_STATUS_LABEL } from "../lib/types";

const STATUS_TONE: Record<number, string> = {
  [ORDER_STATUS.CREATED]: "tone-neutral",
  [ORDER_STATUS.CONFIRMED]: "tone-info",
  [ORDER_STATUS.SHIPPED]: "tone-info",
  [ORDER_STATUS.IN_TRANSIT]: "tone-info",
  [ORDER_STATUS.CUSTOMS_CLEARED]: "tone-info",
  [ORDER_STATUS.DELIVERED]: "tone-success",
  [ORDER_STATUS.CANCELLED]: "tone-danger",
};

export function StatusBadge({ status }: { status: number }) {
  return (
    <span className={`badge ${STATUS_TONE[status] ?? "tone-neutral"}`}>
      {ORDER_STATUS_LABEL[status] ?? `Unknown (${status})`}
    </span>
  );
}
