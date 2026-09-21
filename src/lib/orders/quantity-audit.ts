/**
 * Quantity confirmation audit helpers (server-side).
 * Silent overwrites are forbidden — every change needs actor + reason + timestamp.
 */

export type QuantityAuditEntry = {
  orderId: string;
  orderItemId?: string | null;
  fieldName: "confirmed_quantity" | "estimated_quantity" | "piece_count";
  oldQuantity: number | null;
  newQuantity: number;
  actorId: string | null;
  reason: string;
  createdAt: string;
};

export function buildQuantityAuditEntry(params: {
  orderId: string;
  orderItemId?: string | null;
  fieldName?: QuantityAuditEntry["fieldName"];
  oldQuantity: number | null;
  newQuantity: number;
  actorId: string | null;
  reason: string;
  now?: Date;
}): QuantityAuditEntry {
  if (!params.reason.trim()) {
    throw new Error("Quantity change requires a reason");
  }
  if (!Number.isInteger(params.newQuantity) || params.newQuantity < 0) {
    throw new Error("New quantity must be a non-negative integer");
  }
  if (
    params.oldQuantity != null &&
    params.oldQuantity === params.newQuantity
  ) {
    throw new Error("Quantity is unchanged");
  }
  return {
    orderId: params.orderId,
    orderItemId: params.orderItemId ?? null,
    fieldName: params.fieldName ?? "confirmed_quantity",
    oldQuantity: params.oldQuantity,
    newQuantity: params.newQuantity,
    actorId: params.actorId,
    reason: params.reason.trim(),
    createdAt: (params.now ?? new Date()).toISOString(),
  };
}
