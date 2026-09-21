"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  isStaffRole,
  isFinanceRole,
  isAdminRole,
} from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/admin/audit";
import { planStatusChange } from "@/lib/orders/status-change";
import { buildQuantityAuditEntry } from "@/lib/orders/quantity-audit";
import { normalizeOmr, compareOmr } from "@/lib/money/omr";
import {
  getDefaultBusinessSettings,
  mergeBusinessSettings,
  type BusinessSettings,
} from "@/lib/settings/business-settings";

async function requireStaff() {
  const session = await getSessionUser();
  if (!session || !isStaffRole(session.role)) return null;
  return session;
}

function revalidateAdmin() {
  revalidatePath("/[locale]/admin", "layout");
}

export async function adminAssignDriver(params: {
  orderId: string;
  driverId: string;
  role: "pickup" | "delivery" | "both";
}) {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("orders")
    .select("pickup_driver_id, delivery_driver_id, status")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!before) return { ok: false as const, error: "not_found" };

  const patch: Record<string, unknown> = {};
  if (params.role === "pickup" || params.role === "both") {
    patch.pickup_driver_id = params.driverId;
  }
  if (params.role === "delivery" || params.role === "both") {
    patch.delivery_driver_id = params.driverId;
  }
  if (
    ["pending", "confirmed"].includes(
      String((before as { status: string }).status),
    )
  ) {
    patch.status = "driver_assigned";
  }

  const { error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", params.orderId);
  if (error) return { ok: false as const, error: error.message };

  await writeAuditLog({
    actorId: session.id,
    action: "order.assign_driver",
    entityType: "orders",
    entityId: params.orderId,
    before,
    after: patch,
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminAssignLaundry(params: {
  orderId: string;
  partnerId: string;
}) {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("orders")
    .select("partner_id")
    .eq("id", params.orderId)
    .maybeSingle();

  const { error } = await supabase
    .from("orders")
    .update({ partner_id: params.partnerId })
    .eq("id", params.orderId);
  if (error) return { ok: false as const, error: error.message };

  await writeAuditLog({
    actorId: session.id,
    action: "order.assign_laundry",
    entityType: "orders",
    entityId: params.orderId,
    before,
    after: { partner_id: params.partnerId },
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminChangeOrderStatus(params: {
  orderId: string;
  toStatus: string;
  reason: string;
  adminOverride?: boolean;
}) {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!order) return { ok: false as const, error: "not_found" };

  const planned = planStatusChange({
    orderId: params.orderId,
    fromStatus: (order as { status: string }).status,
    toStatus: params.toStatus,
    actorId: session.id,
    adminOverride: params.adminOverride ?? true,
    reason: params.reason,
  });
  if (!planned.ok) return { ok: false as const, error: planned.message };

  const { error } = await supabase
    .from("orders")
    .update(planned.plan.orderPatch)
    .eq("id", params.orderId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("order_status_history").insert(planned.plan.historyRow);
  if (planned.plan.auditRow) {
    await writeAuditLog({
      actorId: planned.plan.auditRow.actor_id,
      action: planned.plan.auditRow.action,
      entityType: planned.plan.auditRow.entity_type,
      entityId: planned.plan.auditRow.entity_id,
      before: planned.plan.auditRow.before_data,
      after: planned.plan.auditRow.after_data,
    });
  }
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminConfirmPieceCount(params: {
  orderId: string;
  confirmedCount: number;
  reason: string;
}) {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("piece_count, confirmed_piece_count, estimated_piece_count")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!order) return { ok: false as const, error: "not_found" };

  let audit;
  try {
    audit = buildQuantityAuditEntry({
      orderId: params.orderId,
      fieldName: "confirmed_quantity",
      oldQuantity:
        (order as { confirmed_piece_count: number | null }).confirmed_piece_count ??
        (order as { piece_count: number }).piece_count,
      newQuantity: params.confirmedCount,
      actorId: session.id,
      reason: params.reason,
    });
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "invalid",
    };
  }

  const { error } = await supabase
    .from("orders")
    .update({
      confirmed_piece_count: params.confirmedCount,
      piece_count: params.confirmedCount,
    })
    .eq("id", params.orderId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("order_quantity_audits").insert({
    order_id: audit.orderId,
    order_item_id: audit.orderItemId,
    field_name: audit.fieldName,
    old_quantity: audit.oldQuantity,
    new_quantity: audit.newQuantity,
    actor_id: audit.actorId,
    reason: audit.reason,
  });

  await writeAuditLog({
    actorId: session.id,
    action: "order.confirm_quantity",
    entityType: "orders",
    entityId: params.orderId,
    before: { piece_count: (order as { piece_count: number }).piece_count },
    after: { confirmed_piece_count: params.confirmedCount, reason: params.reason },
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminAddExpense(params: {
  orderId?: string;
  category: string;
  description: string;
  amountOmr: string;
  vendorName?: string;
}) {
  const session = await requireStaff();
  if (!session || !isFinanceRole(session.role)) {
    return { ok: false as const, error: "unauthorized" };
  }
  let amount: string;
  try {
    amount = normalizeOmr(params.amountOmr);
  } catch {
    return { ok: false as const, error: "invalid_amount" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("business_expenses").insert({
    category: params.category,
    description: params.description,
    amount_omr: amount,
    currency_code: "OMR",
    status: "approved",
    incurred_on: new Date().toISOString().slice(0, 10),
    vendor_name: params.vendorName || null,
    created_by: session.id,
    notes: params.orderId ? `order:${params.orderId}` : null,
  });
  if (error) return { ok: false as const, error: error.message };

  await writeAuditLog({
    actorId: session.id,
    action: "finance.expense_added",
    entityType: "business_expenses",
    after: { ...params, amount },
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminIssueRefund(params: {
  orderId: string;
  amountOmr: string;
  reason: string;
}) {
  const session = await requireStaff();
  if (!session || !isFinanceRole(session.role)) {
    return { ok: false as const, error: "unauthorized" };
  }
  let amount: string;
  try {
    amount = normalizeOmr(params.amountOmr);
  } catch {
    return { ok: false as const, error: "invalid_amount" };
  }
  if (compareOmr(amount, "0.000") <= 0) {
    return { ok: false as const, error: "invalid_amount" };
  }

  const supabase = await createClient();
  const { data: tx, error } = await supabase
    .from("financial_transactions")
    .insert({
      tx_type: "refund",
      amount_omr: amount,
      currency_code: "OMR",
      direction: "out",
      order_id: params.orderId,
      description: params.reason,
      created_by: session.id,
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };

  await supabase
    .from("orders")
    .update({ payment_status: "refunded" })
    .eq("id", params.orderId);

  await writeAuditLog({
    actorId: session.id,
    action: "finance.refund",
    entityType: "orders",
    entityId: params.orderId,
    after: { amount, reason: params.reason, tx_id: (tx as { id?: string } | null)?.id },
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminConfirmCashHandover(params: {
  handoverId: string;
  confirm: boolean;
  rejectionReason?: string;
}) {
  const session = await requireStaff();
  if (!session || !isFinanceRole(session.role)) {
    return { ok: false as const, error: "unauthorized" };
  }
  const supabase = await createClient();
  const patch = params.confirm
    ? {
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        received_by: session.id,
      }
    : {
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_reason: params.rejectionReason || "Rejected by finance",
        received_by: session.id,
      };

  const { error } = await supabase
    .from("cash_handovers")
    .update(patch)
    .eq("id", params.handoverId);
  if (error) return { ok: false as const, error: error.message };

  await writeAuditLog({
    actorId: session.id,
    action: params.confirm
      ? "finance.cash_handover_confirmed"
      : "finance.cash_handover_rejected",
    entityType: "cash_handovers",
    entityId: params.handoverId,
    after: patch,
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminSaveSettings(partial: Partial<BusinessSettings>) {
  const session = await requireStaff();
  if (!session || !(session.role === "admin" || session.role === "manager")) {
    return { ok: false as const, error: "unauthorized" };
  }
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("business_settings")
    .select("key, value");
  const before = mergeBusinessSettings(
    (rows as Array<{ key: string; value: unknown }> | null) ?? [],
  );
  const next = { ...before, ...partial };

  for (const [key, value] of Object.entries(next)) {
    if (!(key in getDefaultBusinessSettings())) continue;
    await supabase.from("business_settings").upsert(
      {
        key,
        value: value as never,
        updated_by: session.id,
      },
      { onConflict: "key" },
    );
  }

  await writeAuditLog({
    actorId: session.id,
    action: "settings.update",
    entityType: "business_settings",
    before,
    after: next,
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminUpsertService(params: {
  id?: string;
  code: string;
  name_en: string;
  name_ar: string;
  default_customer_price_omr: string;
  default_partner_cost_omr: string;
  is_active: boolean;
  category_id?: string | null;
}) {
  const session = await requireStaff();
  if (!session || !(session.role === "admin" || session.role === "manager")) {
    return { ok: false as const, error: "unauthorized" };
  }
  const supabase = await createClient();
  const price = normalizeOmr(params.default_customer_price_omr);
  const cost = normalizeOmr(params.default_partner_cost_omr);
  const row = {
    code: params.code,
    name_en: params.name_en,
    name_ar: params.name_ar,
    default_customer_price_omr: price,
    default_partner_cost_omr: cost,
    is_active: params.is_active,
    category_id: params.category_id ?? null,
  };

  let before = null;
  if (params.id) {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    before = data;
    const { error } = await supabase.from("services").update(row).eq("id", params.id);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await supabase.from("services").insert(row);
    if (error) return { ok: false as const, error: error.message };
  }

  await writeAuditLog({
    actorId: session.id,
    action: params.id ? "service.update" : "service.create",
    entityType: "services",
    entityId: params.id,
    before,
    after: row,
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminUpsertZone(params: {
  id?: string;
  code: string;
  name_en: string;
  name_ar: string;
  is_active: boolean;
  default_partner_id?: string | null;
  min_order_omr?: string | null;
  delivery_fee_omr?: string;
  estimated_turnaround_hours?: number | null;
}) {
  const session = await requireStaff();
  if (!session || !(session.role === "admin" || session.role === "manager")) {
    return { ok: false as const, error: "unauthorized" };
  }
  const supabase = await createClient();
  const row = {
    code: params.code,
    name_en: params.name_en,
    name_ar: params.name_ar,
    is_active: params.is_active,
    default_partner_id: params.default_partner_id ?? null,
    min_order_omr: params.min_order_omr
      ? normalizeOmr(params.min_order_omr)
      : null,
    delivery_fee_omr: normalizeOmr(params.delivery_fee_omr || "0"),
    estimated_turnaround_hours: params.estimated_turnaround_hours ?? null,
  };

  if (params.id) {
    const { error } = await supabase.from("service_zones").update(row).eq("id", params.id);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await supabase.from("service_zones").insert(row);
    if (error) return { ok: false as const, error: error.message };
  }

  await writeAuditLog({
    actorId: session.id,
    action: params.id ? "zone.update" : "zone.create",
    entityType: "service_zones",
    entityId: params.id,
    after: row,
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminUpsertSlot(params: {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
  zone_id?: string | null;
}) {
  const session = await requireStaff();
  if (!session || !(session.role === "admin" || session.role === "manager")) {
    return { ok: false as const, error: "unauthorized" };
  }
  const supabase = await createClient();
  const row = {
    day_of_week: params.day_of_week,
    start_time: params.start_time,
    end_time: params.end_time,
    capacity: params.capacity,
    is_active: params.is_active,
    zone_id: params.zone_id ?? null,
  };
  if (params.id) {
    const { error } = await supabase.from("pickup_slots").update(row).eq("id", params.id);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await supabase.from("pickup_slots").insert(row);
    if (error) return { ok: false as const, error: error.message };
  }
  await writeAuditLog({
    actorId: session.id,
    action: params.id ? "slot.update" : "slot.create",
    entityType: "pickup_slots",
    entityId: params.id,
    after: row,
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminUpsertPromo(params: {
  id?: string;
  code: string;
  description_en?: string;
  description_ar?: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  min_order_omr?: string;
  usage_limit?: number | null;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}) {
  const session = await requireStaff();
  if (!session || !(session.role === "admin" || session.role === "manager")) {
    return { ok: false as const, error: "unauthorized" };
  }
  const supabase = await createClient();
  const row = {
    code: params.code.toUpperCase(),
    description_en: params.description_en || null,
    description_ar: params.description_ar || null,
    discount_type: params.discount_type,
    discount_value: normalizeOmr(params.discount_value),
    min_order_omr: normalizeOmr(params.min_order_omr || "0"),
    usage_limit: params.usage_limit ?? null,
    is_active: params.is_active,
    starts_at: params.starts_at || null,
    ends_at: params.ends_at || null,
  };
  if (params.id) {
    const { error } = await supabase.from("promo_codes").update(row).eq("id", params.id);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await supabase.from("promo_codes").insert(row);
    if (error) return { ok: false as const, error: error.message };
  }
  await writeAuditLog({
    actorId: session.id,
    action: params.id ? "promo.update" : "promo.create",
    entityType: "promo_codes",
    entityId: params.id,
    after: row,
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminUpdateComplaint(params: {
  id: string;
  status: string;
  resolution_notes?: string;
  complaint_type?: string;
  compensation_omr?: string;
}) {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    status: params.status === "investigating" ? "in_progress" : params.status,
    resolution_notes: params.resolution_notes || null,
  };
  if (params.complaint_type) patch.complaint_type = params.complaint_type;
  if (params.compensation_omr) {
    patch.compensation_omr = normalizeOmr(params.compensation_omr);
  }
  if (params.status === "resolved" || params.status === "rejected") {
    patch.resolved_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("complaints")
    .update(patch)
    .eq("id", params.id);
  if (error) return { ok: false as const, error: error.message };
  await writeAuditLog({
    actorId: session.id,
    action: "complaint.update",
    entityType: "complaints",
    entityId: params.id,
    after: patch,
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminCreateComplaint(params: {
  subject: string;
  description: string;
  complaint_type: string;
  order_id?: string;
  customer_id?: string;
}) {
  const session = await requireStaff();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("complaints").insert({
    subject: params.subject,
    description: params.description,
    complaint_type: params.complaint_type,
    order_id: params.order_id || null,
    customer_id: params.customer_id || null,
    opened_by: session.id,
    status: "open",
  });
  if (error) return { ok: false as const, error: error.message };
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminSetDriverCommission(params: {
  driverId: string;
  commissionPercent: string;
  name?: string;
}) {
  const session = await requireStaff();
  if (!session || !(session.role === "admin" || session.role === "manager")) {
    return { ok: false as const, error: "unauthorized" };
  }
  const percent = normalizeOmr(params.commissionPercent);
  const supabase = await createClient();
  const { data: rule, error } = await supabase
    .from("driver_commission_rules")
    .insert({
      name: params.name || `Driver override ${percent}%`,
      commission_percent: percent,
      is_default: false,
      is_active: true,
      effective_from: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };

  const { error: uerr } = await supabase
    .from("drivers")
    .update({ commission_rule_id: (rule as { id: string }).id })
    .eq("id", params.driverId);
  if (uerr) return { ok: false as const, error: uerr.message };

  await writeAuditLog({
    actorId: session.id,
    action: "driver.commission_override",
    entityType: "drivers",
    entityId: params.driverId,
    after: { commission_percent: percent, rule_id: (rule as { id: string }).id },
  });
  revalidateAdmin();
  return { ok: true as const };
}

export async function adminUpdateUserRole(params: {
  profileId: string;
  role: string;
}) {
  const session = await requireStaff();
  if (!session || !isAdminRole(session.role)) {
    return { ok: false as const, error: "unauthorized" };
  }
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", params.profileId)
    .maybeSingle();
  const { error } = await supabase
    .from("profiles")
    .update({ role: params.role })
    .eq("id", params.profileId);
  if (error) return { ok: false as const, error: error.message };

  await writeAuditLog({
    actorId: session.id,
    action: "user.role_change",
    entityType: "profiles",
    entityId: params.profileId,
    before,
    after: { role: params.role },
  });
  revalidateAdmin();
  return { ok: true as const };
}
