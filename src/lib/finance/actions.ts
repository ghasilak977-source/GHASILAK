"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { isFinanceRole } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/admin/audit";
import {
  assertOwnerWithdrawalNotExpense,
  normalizeOmr,
  validateLedgerEntry,
  type ExpenseCategory,
  type LedgerTxType,
} from "@/lib/finance/types";
import {
  canDeleteSettlement,
  canTransitionSettlement,
  planDriverSettlement,
  planLaundrySettlement,
} from "@/lib/finance/settlements";

async function requireFinance() {
  const session = await getSessionUser();
  if (!session || !isFinanceRole(session.role)) return null;
  return session;
}

function revalidateFinance() {
  revalidatePath("/[locale]/admin/finance", "layout");
  revalidatePath("/[locale]/admin", "layout");
}

export async function financePostLedger(params: {
  type: LedgerTxType;
  amountOmr: string;
  direction: "in" | "out";
  orderId?: string;
  customerId?: string;
  driverId?: string;
  laundryPartnerId?: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  asBusinessExpense?: boolean;
}) {
  const session = await requireFinance();
  if (!session) return { ok: false as const, error: "unauthorized" };

  const ownerCheck = assertOwnerWithdrawalNotExpense({
    txType: params.type,
    asBusinessExpense: params.asBusinessExpense,
  });
  if (!ownerCheck.ok) return { ok: false as const, error: ownerCheck.message };

  const validated = validateLedgerEntry({
    type: params.type,
    amountOmr: params.amountOmr,
    direction: params.direction,
  });
  if (!validated.ok) return { ok: false as const, error: validated.message };

  const supabase = await createClient();
  const { error } = await supabase.from("financial_transactions").insert({
    tx_type: params.type,
    amount_omr: validated.amount,
    currency_code: "OMR",
    direction: params.direction,
    order_id: params.orderId || null,
    customer_id: params.customerId || null,
    driver_id: params.driverId || null,
    laundry_partner_id: params.laundryPartnerId || null,
    payment_method: params.paymentMethod || null,
    reference: params.reference || null,
    notes: params.notes || null,
    description: params.notes || params.type,
    created_by: session.id,
    occurred_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };

  await writeAuditLog({
    actorId: session.id,
    action: "finance.ledger_post",
    entityType: "financial_transactions",
    after: params,
  });
  revalidateFinance();
  return { ok: true as const };
}

export async function financeRecordOwnerCapital(params: {
  kind: "owner_contribution" | "owner_withdrawal";
  amountOmr: string;
  reference?: string;
  notes?: string;
}) {
  return financePostLedger({
    type: params.kind,
    amountOmr: params.amountOmr,
    direction: params.kind === "owner_contribution" ? "in" : "out",
    reference: params.reference,
    notes: params.notes,
    asBusinessExpense: false,
  });
}

export async function financeAddBusinessExpense(params: {
  category: ExpenseCategory;
  description: string;
  amountOmr: string;
  vendorName?: string;
  receiptPath?: string;
  incurredOn?: string;
}) {
  const session = await requireFinance();
  if (!session) return { ok: false as const, error: "unauthorized" };

  // Guard: never allow owner withdrawal masquerading as expense
  if (
    params.category === "other" &&
    /owner\s*withdraw/i.test(params.description)
  ) {
    return {
      ok: false as const,
      error: "Owner withdrawal must use owner capital ledger, not expenses",
    };
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
    expense_category: params.category,
    description: params.description,
    amount_omr: amount,
    currency_code: "OMR",
    status: "approved",
    incurred_on: params.incurredOn || new Date().toISOString().slice(0, 10),
    vendor_name: params.vendorName || null,
    receipt_path: params.receiptPath || null,
    created_by: session.id,
  });
  if (error) return { ok: false as const, error: error.message };

  await financePostLedger({
    type: "business_expense",
    amountOmr: amount,
    direction: "out",
    notes: params.description,
    reference: params.category,
  });

  revalidateFinance();
  return { ok: true as const };
}

export async function financeGenerateLaundrySettlement(params: {
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  unitCostOmr?: string;
}) {
  const session = await requireFinance();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("laundry_partners")
    .select("id, default_cost_per_piece_omr")
    .eq("id", params.partnerId)
    .maybeSingle();
  if (!partner) return { ok: false as const, error: "partner_not_found" };

  const unit = normalizeOmr(
    params.unitCostOmr ||
      String(
        (partner as { default_cost_per_piece_omr: string })
          .default_cost_per_piece_omr,
      ),
  );

  const { data: orders } = await supabase
    .from("orders")
    .select("id, piece_count, partner_cost_total_omr, status, delivered_at")
    .eq("partner_id", params.partnerId)
    .eq("status", "delivered")
    .gte("delivered_at", `${params.periodStart}T00:00:00.000Z`)
    .lte("delivered_at", `${params.periodEnd}T23:59:59.999Z`);

  const { data: existingItems } = await supabase
    .from("laundry_settlement_items")
    .select("order_id");
  const settled = new Set(
    ((existingItems ?? []) as { order_id: string }[]).map((i) => i.order_id),
  );

  const planned = planLaundrySettlement({
    partnerId: params.partnerId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    unitCostOmr: unit,
    alreadySettledOrderIds: settled,
    orders: ((orders ?? []) as {
      id: string;
      piece_count: number;
      partner_cost_total_omr: string;
    }[]).map((o) => ({
      orderId: o.id,
      pieceCount: o.piece_count,
      partnerCostOmr: String(o.partner_cost_total_omr),
    })),
  });
  if (!planned.ok) return { ok: false as const, error: planned.message };
  if (planned.plan.lines.length === 0) {
    return { ok: false as const, error: "no_orders_in_period" };
  }

  const { data: settlement, error } = await supabase
    .from("laundry_settlements")
    .insert({
      partner_id: params.partnerId,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      status: "draft",
      gross_cost_omr: planned.plan.grossCostOmr,
      deductions_omr: planned.plan.deductionsOmr,
      net_amount_omr: planned.plan.netAmountOmr,
      currency_code: "OMR",
    })
    .select("id, settlement_number")
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };

  const sid = (settlement as { id: string }).id;
  const { error: itemsErr } = await supabase
    .from("laundry_settlement_items")
    .insert(
      planned.plan.lines.map((l) => ({
        settlement_id: sid,
        order_id: l.orderId,
        amount_omr: l.amountOmr,
      })),
    );
  if (itemsErr) return { ok: false as const, error: itemsErr.message };

  await writeAuditLog({
    actorId: session.id,
    action: "finance.laundry_settlement_draft",
    entityType: "laundry_settlements",
    entityId: sid,
    after: planned.plan,
  });
  revalidateFinance();
  return {
    ok: true as const,
    settlementId: sid,
    settlementNumber: (settlement as { settlement_number: string })
      .settlement_number,
  };
}

export async function financeGenerateDriverSettlement(params: {
  driverId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const session = await requireFinance();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();

  const { data: commissions } = await supabase
    .from("driver_commissions")
    .select(
      "id, order_id, base_amount_omr, commission_percent, commission_omr, status, created_at",
    )
    .eq("driver_id", params.driverId)
    .in("status", ["pending", "approved"])
    .gte("created_at", `${params.periodStart}T00:00:00.000Z`)
    .lte("created_at", `${params.periodEnd}T23:59:59.999Z`);

  const { data: existingItems } = await supabase
    .from("driver_settlement_items")
    .select("commission_id");
  const settled = new Set(
    ((existingItems ?? []) as { commission_id: string }[]).map(
      (i) => i.commission_id,
    ),
  );

  const planned = planDriverSettlement({
    driverId: params.driverId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    alreadySettledCommissionIds: settled,
    commissions: ((commissions ?? []) as {
      id: string;
      order_id: string;
      base_amount_omr: string;
      commission_percent: string;
      commission_omr: string;
    }[]).map((c) => ({
      commissionId: c.id,
      orderId: c.order_id,
      baseAmountOmr: String(c.base_amount_omr),
      commissionPercent: String(c.commission_percent),
      commissionOmr: String(c.commission_omr),
    })),
  });
  if (!planned.ok) return { ok: false as const, error: planned.message };
  if (planned.plan.lines.length === 0) {
    return { ok: false as const, error: "no_commissions_in_period" };
  }

  const { data: settlement, error } = await supabase
    .from("driver_settlements")
    .insert({
      driver_id: params.driverId,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      status: "draft",
      gross_commission_omr: planned.plan.grossCommissionOmr,
      deductions_omr: planned.plan.deductionsOmr,
      net_amount_omr: planned.plan.netAmountOmr,
      currency_code: "OMR",
    })
    .select("id, settlement_number")
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };

  const sid = (settlement as { id: string }).id;
  const { error: itemsErr } = await supabase
    .from("driver_settlement_items")
    .insert(
      planned.plan.lines.map((l) => ({
        settlement_id: sid,
        commission_id: l.commissionId,
        amount_omr: l.commissionOmr,
      })),
    );
  if (itemsErr) return { ok: false as const, error: itemsErr.message };

  await writeAuditLog({
    actorId: session.id,
    action: "finance.driver_settlement_draft",
    entityType: "driver_settlements",
    entityId: sid,
    after: planned.plan,
  });
  revalidateFinance();
  return {
    ok: true as const,
    settlementId: sid,
    settlementNumber: (settlement as { settlement_number: string })
      .settlement_number,
  };
}

export async function financeTransitionSettlement(params: {
  kind: "driver" | "laundry";
  settlementId: string;
  toStatus: "draft" | "pending" | "approved" | "paid" | "cancelled";
  paymentReference?: string;
  paymentMethod?: string;
  notes?: string;
}) {
  const session = await requireFinance();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();
  const table =
    params.kind === "driver" ? "driver_settlements" : "laundry_settlements";

  const { data: row } = await supabase
    .from(table)
    .select("status, net_amount_omr")
    .eq("id", params.settlementId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "not_found" };

  const from = (row as { status: string }).status as
    | "draft"
    | "pending"
    | "approved"
    | "paid"
    | "cancelled";
  const check = canTransitionSettlement(from, params.toStatus);
  if (!check.ok) return { ok: false as const, error: check.message };

  const patch: Record<string, unknown> = {
    status: params.toStatus,
    notes: params.notes || null,
  };
  if (params.toStatus === "approved") patch.approved_by = session.id;
  if (params.toStatus === "paid") {
    patch.paid_at = new Date().toISOString();
    patch.payment_reference = params.paymentReference || null;
    patch.payment_method = params.paymentMethod || null;
  }

  const { error } = await supabase
    .from(table)
    .update(patch)
    .eq("id", params.settlementId);
  if (error) return { ok: false as const, error: error.message };

  if (params.toStatus === "paid") {
    await supabase.from("financial_transactions").insert({
      tx_type:
        params.kind === "driver" ? "driver_payment" : "laundry_payment",
      amount_omr: normalizeOmr(String((row as { net_amount_omr: string }).net_amount_omr)),
      currency_code: "OMR",
      direction: "out",
      driver_settlement_id:
        params.kind === "driver" ? params.settlementId : null,
      laundry_settlement_id:
        params.kind === "laundry" ? params.settlementId : null,
      reference: params.paymentReference || null,
      payment_method: params.paymentMethod || null,
      created_by: session.id,
      occurred_at: new Date().toISOString(),
      description: `${params.kind} settlement paid`,
    });

    if (params.kind === "driver") {
      const { data: items } = await supabase
        .from("driver_settlement_items")
        .select("commission_id")
        .eq("settlement_id", params.settlementId);
      const ids = ((items ?? []) as { commission_id: string }[]).map(
        (i) => i.commission_id,
      );
      if (ids.length) {
        await supabase
          .from("driver_commissions")
          .update({ status: "settled" })
          .in("id", ids);
      }
    }
  }

  await writeAuditLog({
    actorId: session.id,
    action: "finance.settlement_transition",
    entityType: table,
    entityId: params.settlementId,
    before: { status: from },
    after: patch,
  });
  revalidateFinance();
  return { ok: true as const };
}

export async function financeDeleteSettlement(params: {
  kind: "driver" | "laundry";
  settlementId: string;
}) {
  const session = await requireFinance();
  if (!session) return { ok: false as const, error: "unauthorized" };
  const supabase = await createClient();
  const table =
    params.kind === "driver" ? "driver_settlements" : "laundry_settlements";

  const { data: row } = await supabase
    .from(table)
    .select("status")
    .eq("id", params.settlementId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "not_found" };
  if (
    !canDeleteSettlement(
      (row as { status: string }).status as
        | "draft"
        | "pending"
        | "approved"
        | "paid"
        | "cancelled",
    )
  ) {
    return {
      ok: false as const,
      error: "Paid settlements cannot be deleted; use reversal/adjustment",
    };
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", params.settlementId);
  if (error) return { ok: false as const, error: error.message };

  await writeAuditLog({
    actorId: session.id,
    action: "finance.settlement_delete",
    entityType: table,
    entityId: params.settlementId,
  });
  revalidateFinance();
  return { ok: true as const };
}
