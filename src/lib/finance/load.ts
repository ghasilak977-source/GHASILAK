import { createClient } from "@/lib/supabase/server";
import {
  computeFinanceKpis,
  cashHeldForDriver,
  aggregateOwnerCapital,
  type FinanceKpis,
} from "@/lib/finance/kpis";
import { normalizeOmr, sumOmr } from "@/lib/finance/types";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function loadFinanceKpis(): Promise<FinanceKpis | null> {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();

  const [
    { data: orders },
    { data: expenses },
    { data: ledger },
    { data: cashOrders },
    { data: handovers },
    { data: pendingComm },
    { data: laundrySettlements },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "total_omr, contribution_omr, partner_cost_total_omr, driver_commission_omr, discount_omr, piece_count, payment_status, status, created_at, cash_collected_omr, cash_collected_by_driver_id",
      )
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("business_expenses")
      .select("expense_category, category, amount_omr, status")
      .limit(2000),
    supabase
      .from("financial_transactions")
      .select("tx_type, amount_omr, direction")
      .limit(5000),
    supabase
      .from("orders")
      .select("cash_collected_omr, cash_collected_by_driver_id")
      .not("cash_collected_by_driver_id", "is", null),
    supabase
      .from("cash_handovers")
      .select("amount_omr, status, driver_id")
      .eq("status", "confirmed"),
    supabase
      .from("driver_commissions")
      .select("commission_omr, status")
      .in("status", ["pending", "approved"]),
    supabase
      .from("laundry_settlements")
      .select("net_amount_omr, status")
      .in("status", ["draft", "pending", "approved"]),
  ]);

  const collected = ((cashOrders ?? []) as { cash_collected_omr: string }[]).map(
    (r) => String(r.cash_collected_omr ?? "0"),
  );
  const handed = ((handovers ?? []) as { amount_omr: string }[]).map((r) =>
    String(r.amount_omr ?? "0"),
  );
  const held = cashHeldForDriver(collected, handed);

  let laundryPayables = sumOmr(
    ((laundrySettlements ?? []) as { net_amount_omr: string }[]).map((s) =>
      String(s.net_amount_omr),
    ),
  );
  if (laundryPayables === "0.000") {
    laundryPayables = sumOmr(
      ((orders ?? []) as { status: string; partner_cost_total_omr: string }[])
        .filter((o) => o.status === "delivered")
        .map((o) => String(o.partner_cost_total_omr ?? "0")),
    );
  }

  const driverPayables = sumOmr(
    ((pendingComm ?? []) as { commission_omr: string }[]).map((c) =>
      String(c.commission_omr),
    ),
  );

  return computeFinanceKpis({
    orders: ((orders ?? []) as Record<string, unknown>[]).map((o) => ({
      total_omr: normalizeOmr(String(o.total_omr ?? "0")),
      contribution_omr: normalizeOmr(String(o.contribution_omr ?? "0")),
      partner_cost_total_omr: normalizeOmr(String(o.partner_cost_total_omr ?? "0")),
      driver_commission_omr: normalizeOmr(String(o.driver_commission_omr ?? "0")),
      discount_omr: normalizeOmr(String(o.discount_omr ?? "0")),
      piece_count: Number(o.piece_count ?? 0),
      payment_status: String(o.payment_status ?? ""),
      status: String(o.status ?? ""),
      created_at: String(o.created_at),
    })),
    expenses: ((expenses ?? []) as Record<string, unknown>[]).map((e) => ({
      expense_category: e.expense_category
        ? String(e.expense_category)
        : undefined,
      category: e.category ? String(e.category) : undefined,
      amount_omr: normalizeOmr(String(e.amount_omr ?? "0")),
      status: String(e.status ?? ""),
    })),
    ledger: ((ledger ?? []) as Record<string, unknown>[]).map((t) => ({
      tx_type: String(t.tx_type),
      amount_omr: normalizeOmr(String(t.amount_omr ?? "0")),
      direction: t.direction as "in" | "out",
    })),
    cashHeldOmr: held.heldOmr,
    laundryPayablesOmr: laundryPayables,
    driverPayablesOmr: driverPayables,
  });
}

export async function loadOwnerCapital() {
  if (!hasSupabaseEnv()) {
    return {
      contributionsOmr: "0.000",
      withdrawalsOmr: "0.000",
      netCapitalOmr: "0.000",
    };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("financial_transactions")
    .select("tx_type, amount_omr, direction")
    .in("tx_type", ["owner_contribution", "owner_withdrawal"]);
  return aggregateOwnerCapital(
    ((data ?? []) as { tx_type: string; amount_omr: string; direction: "in" | "out" }[]).map(
      (t) => ({
        tx_type: t.tx_type,
        amount_omr: normalizeOmr(String(t.amount_omr)),
        direction: t.direction,
      }),
    ),
  );
}

export async function loadDriverCashHeldRows() {
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, profile_id")
    .eq("status", "active");
  if (!drivers?.length) return [];

  const ids = (drivers as { id: string; profile_id: string }[]).map((d) => d.id);
  const profileIds = (drivers as { profile_id: string }[]).map((d) => d.profile_id);

  const [{ data: profiles }, { data: collected }, { data: handovers }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", profileIds),
      supabase
        .from("orders")
        .select("cash_collected_omr, cash_collected_by_driver_id")
        .in("cash_collected_by_driver_id", ids),
      supabase
        .from("cash_handovers")
        .select("driver_id, amount_omr, status")
        .in("driver_id", ids)
        .eq("status", "confirmed"),
    ]);

  const profileMap = new Map(
    ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  return (drivers as { id: string; profile_id: string }[]).map((d) => {
    const col = ((collected ?? []) as {
      cash_collected_by_driver_id: string;
      cash_collected_omr: string;
    }[])
      .filter((o) => o.cash_collected_by_driver_id === d.id)
      .map((o) => String(o.cash_collected_omr));
    const hand = ((handovers ?? []) as {
      driver_id: string;
      amount_omr: string;
    }[])
      .filter((h) => h.driver_id === d.id)
      .map((h) => String(h.amount_omr));
    const held = cashHeldForDriver(col, hand);
    return {
      driverId: d.id,
      driverName: profileMap.get(d.profile_id) || "—",
      collectedOmr: held.collectedOmr,
      handedOverOmr: held.handedOverOmr,
      outstandingOmr: held.heldOmr,
    };
  });
}
