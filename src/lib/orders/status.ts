import type { OrderStatus } from "@/types/database";
import type { Dictionary } from "@/messages/en";

/** Customer-facing timeline order (matches Phase 2 product spec). */
export const TRACKING_STEPS = [
  "pending",
  "confirmed",
  "driver_assigned",
  "driver_on_way",
  "picked_up",
  "received_at_laundry",
  "washing",
  "ironing",
  "quality_check",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
] as const;

export type TrackingStep = (typeof TRACKING_STEPS)[number];

const STATUS_RANK: Record<string, number> = {
  draft: -1,
  pending: 0,
  confirmed: 1,
  pickup_assigned: 2,
  driver_assigned: 2,
  driver_on_way: 3,
  picked_up: 4,
  at_laundry: 5,
  received_at_laundry: 5,
  washing: 6,
  ironing: 7,
  quality_check: 8,
  ready: 9,
  ready_for_delivery: 9,
  out_for_delivery: 10,
  delivered: 11,
  cancelled: -2,
  failed: -2,
};

export function statusRank(status: string): number {
  return STATUS_RANK[status] ?? -1;
}

export function normalizeTrackingStatus(status: OrderStatus | string): string {
  switch (status) {
    case "pickup_assigned":
      return "driver_assigned";
    case "at_laundry":
      return "received_at_laundry";
    case "ready":
      return "ready_for_delivery";
    default:
      return status;
  }
}

export function statusLabel(
  status: string,
  dict: Dictionary,
): string {
  const key = normalizeTrackingStatus(status) as keyof typeof dict.tracking.statuses;
  return dict.tracking.statuses[key] ?? status;
}

export function isActiveOrderStatus(status: string): boolean {
  return !["delivered", "cancelled", "failed", "draft"].includes(status);
}

export function isCompletedOrderStatus(status: string): boolean {
  return status === "delivered";
}

export function isCancelledOrderStatus(status: string): boolean {
  return status === "cancelled" || status === "failed";
}

export function formatSlotLabel(start: string, end: string): string {
  const trim = (t: string) => t.slice(0, 5);
  return `${trim(start)} – ${trim(end)}`;
}
