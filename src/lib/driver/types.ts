import { percentOfOmr, normalizeOmr, subOmr, addOmr } from "@/lib/money/omr";

/** Driver-safe order card — never includes laundry cost, margin, or profit. */
export type DriverOrderCard = {
  id: string;
  order_number: string;
  status: string;
  pickup_driver_id: string | null;
  delivery_driver_id: string | null;
  scheduled_pickup_at: string | null;
  scheduled_delivery_at: string | null;
  estimated_piece_count: number | null;
  piece_count: number;
  customer_notes: string | null;
  pickup_notes: string | null;
  delivery_notes: string | null;
  payment_method: string | null;
  payment_status: string | null;
  cash_collected_omr: string;
  cash_collected_at: string | null;
  cash_collected_by_driver_id: string | null;
  arrived_at_pickup_at: string | null;
  arrived_at_delivery_at: string | null;
  delivery_confirmation_code: string | null;
  qr_token: string | null;
  qr_scanned_at_pickup: string | null;
  driver_commission_percent: string | null;
  driver_commission_omr: string;
  eligible_revenue_omr: string;
  customer_total_omr: string;
  area_code: string | null;
  area_name_en: string | null;
  area_name_ar: string | null;
  street: string | null;
  building: string | null;
  unit: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  address_notes: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
};

export type DriverJobType = "pickup" | "delivery";

export function jobTypeForDriver(
  order: Pick<DriverOrderCard, "pickup_driver_id" | "delivery_driver_id" | "status">,
  driverId: string,
): DriverJobType | "both" | null {
  const isPickup = order.pickup_driver_id === driverId;
  const isDelivery = order.delivery_driver_id === driverId;
  if (isPickup && isDelivery) return "both";
  if (isPickup) return "pickup";
  if (isDelivery) return "delivery";
  return null;
}

export function isPickupActive(status: string): boolean {
  return [
    "pending",
    "confirmed",
    "driver_assigned",
    "pickup_assigned",
    "driver_on_way",
  ].includes(status);
}

export function isDeliveryActive(status: string): boolean {
  return [
    "ready_for_delivery",
    "ready",
    "out_for_delivery",
    "quality_check",
    "ironing",
    "washing",
    "received_at_laundry",
    "at_laundry",
    "picked_up",
  ].includes(status);
}

/** Commission on eligible revenue (subtotal − discount). Snapshot should already exist on order. */
export function computeDriverCommission(
  eligibleRevenueOmr: string,
  ratePercent: string,
): string {
  return percentOfOmr(normalizeOmr(eligibleRevenueOmr), normalizeOmr(ratePercent));
}

export function mapsUrl(params: {
  latitude?: number | null;
  longitude?: number | null;
  label?: string | null;
}): string {
  if (params.latitude != null && params.longitude != null) {
    return `https://www.google.com/maps?q=${params.latitude},${params.longitude}`;
  }
  const q = encodeURIComponent(params.label || "Muscat Oman");
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function whatsappCustomerUrl(phone: string | null, message: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export type CashHeldBreakdown = {
  collectedOmr: string;
  handedOverOmr: string;
  heldOmr: string;
};

export function computeCashHeld(
  collectedAmounts: string[],
  confirmedHandoverAmounts: string[],
): CashHeldBreakdown {
  const collectedOmr = collectedAmounts.reduce(
    (sum, a) => addOmr(sum, normalizeOmr(a || "0")),
    "0.000",
  );
  const handedOverOmr = confirmedHandoverAmounts.reduce(
    (sum, a) => addOmr(sum, normalizeOmr(a || "0")),
    "0.000",
  );
  return {
    collectedOmr,
    handedOverOmr,
    heldOmr: subOmr(collectedOmr, handedOverOmr),
  };
}

/** Statuses a driver may set without admin override. */
export const DRIVER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  confirmed: ["driver_on_way"],
  driver_assigned: ["driver_on_way"],
  pickup_assigned: ["driver_on_way"],
  driver_on_way: ["picked_up"],
  ready_for_delivery: ["out_for_delivery"],
  ready: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

export function canDriverTransition(from: string, to: string): boolean {
  return (DRIVER_ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}
