import { validateStatusTransition } from "@/lib/orders/transitions";
import type { OrderStatus } from "@/types/database";

export type StatusChangeRequest = {
  orderId: string;
  fromStatus: OrderStatus | string;
  toStatus: OrderStatus | string;
  actorId: string | null;
  note?: string | null;
  adminOverride?: boolean;
  reason?: string | null;
};

export type StatusChangePlan = {
  historyRow: {
    order_id: string;
    from_status: string;
    to_status: string;
    changed_by: string | null;
    note: string | null;
  };
  orderPatch: {
    status: string;
    cancelled_at?: string | null;
    cancellation_reason?: string | null;
  };
  auditRow: {
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    before_data: { status: string };
    after_data: { status: string; reason?: string };
  } | null;
};

/**
 * Pure planner for status changes — DB writes happen in API/admin callers.
 */
export function planStatusChange(
  req: StatusChangeRequest,
): { ok: true; plan: StatusChangePlan } | { ok: false; message: string } {
  const result = validateStatusTransition({
    from: req.fromStatus,
    to: req.toStatus,
    adminOverride: req.adminOverride,
    reason: req.reason,
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const note =
    req.note?.trim() ||
    (result.requiresAudit ? req.reason?.trim() || null : null);

  const orderPatch: StatusChangePlan["orderPatch"] = {
    status: req.toStatus,
  };
  if (req.toStatus === "cancelled") {
    orderPatch.cancelled_at = new Date().toISOString();
    orderPatch.cancellation_reason = note;
  }

  return {
    ok: true,
    plan: {
      historyRow: {
        order_id: req.orderId,
        from_status: req.fromStatus,
        to_status: req.toStatus,
        changed_by: req.actorId,
        note,
      },
      orderPatch,
      auditRow: result.requiresAudit
        ? {
            actor_id: req.actorId,
            action: "order.status.admin_override",
            entity_type: "orders",
            entity_id: req.orderId,
            before_data: { status: String(req.fromStatus) },
            after_data: {
              status: String(req.toStatus),
              reason: req.reason?.trim(),
            },
          }
        : null,
    },
  };
}
