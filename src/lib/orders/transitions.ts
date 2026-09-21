import type { OrderStatus } from "@/types/database";
import { normalizeTrackingStatus, TRACKING_STEPS } from "@/lib/orders/status";

export const CANONICAL_FLOW = [
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

export type CanonicalStatus = (typeof CANONICAL_FLOW)[number] | "cancelled";

const NEXT: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["driver_assigned", "cancelled"],
  driver_assigned: ["driver_on_way", "cancelled"],
  pickup_assigned: ["driver_on_way", "cancelled"],
  driver_on_way: ["picked_up", "cancelled"],
  picked_up: ["received_at_laundry", "cancelled"],
  received_at_laundry: ["washing", "cancelled"],
  at_laundry: ["washing", "cancelled"],
  washing: ["ironing", "cancelled"],
  ironing: ["quality_check", "cancelled"],
  quality_check: ["ready_for_delivery", "cancelled"],
  ready_for_delivery: ["out_for_delivery", "cancelled"],
  ready: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  failed: [],
  draft: ["pending", "cancelled"],
};

export type StatusTransitionResult =
  | {
      ok: true;
      from: string;
      to: string;
      requiresAudit: boolean;
    }
  | {
      ok: false;
      reason: "terminal" | "invalid" | "missing_reason";
      message: string;
    };

/**
 * Validate a status change.
 * - Normal path: only allowed next statuses (or cancel where permitted).
 * - Admin override: any non-identical change allowed if reason provided → audit required.
 */
export function validateStatusTransition(params: {
  from: OrderStatus | string;
  to: OrderStatus | string;
  adminOverride?: boolean;
  reason?: string | null;
}): StatusTransitionResult {
  const from = normalizeTrackingStatus(params.from);
  const to = normalizeTrackingStatus(params.to);

  if (from === to) {
    return {
      ok: false,
      reason: "invalid",
      message: "Status is unchanged",
    };
  }

  if (params.adminOverride) {
    if (!params.reason || !params.reason.trim()) {
      return {
        ok: false,
        reason: "missing_reason",
        message: "Admin override requires a reason",
      };
    }
    return { ok: true, from, to, requiresAudit: true };
  }

  const allowed = NEXT[params.from] ?? NEXT[from] ?? [];
  const allowedNormalized = allowed.map((s) => normalizeTrackingStatus(s));
  if (!allowed.includes(params.to) && !allowedNormalized.includes(to)) {
    return {
      ok: false,
      reason: "invalid",
      message: `Cannot transition from ${params.from} to ${params.to}`,
    };
  }

  return { ok: true, from, to, requiresAudit: false };
}

export function isTerminalStatus(status: string): boolean {
  const n = normalizeTrackingStatus(status);
  return n === "delivered" || n === "cancelled" || status === "failed";
}

export function expectedNextStatuses(from: string): string[] {
  return [...(NEXT[from] ?? NEXT[normalizeTrackingStatus(from)] ?? [])];
}

export function assertCanonicalFlowMatchesTracking(): boolean {
  return (
    CANONICAL_FLOW.length === TRACKING_STEPS.length &&
    CANONICAL_FLOW.every((s, i) => s === TRACKING_STEPS[i])
  );
}
