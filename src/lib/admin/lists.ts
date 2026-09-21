import { addOmr, normalizeOmr, subOmr } from "@/lib/money/omr";
import { createClient } from "@/lib/supabase/server";
import { computeCashHeld } from "@/lib/driver/types";

export type AdminCustomerRow = {
  id: string;
  profile_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  area: string | null;
  orders_count: number;
  pieces: number;
  total_spend_omr: string;
  average_order_omr: string;
  last_order_at: string | null;
};

export async function listAdminCustomers(): Promise<AdminCustomerRow[]> {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, profile_id, status, total_orders, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!customers?.length) return [];

  const profileIds = (customers as { profile_id: string }[]).map((c) => c.profile_id);
  const customerIds = (customers as { id: string }[]).map((c) => c.id);

  const [{ data: profiles }, { data: orders }, { data: addresses }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, email")
        .in("id", profileIds),
      supabase
        .from("orders")
        .select("customer_id, total_omr, piece_count, created_at, status")
        .in("customer_id", customerIds),
      supabase
        .from("addresses")
        .select("customer_id, area_name_en, is_default")
        .in("customer_id", customerIds),
    ]);

  const profileMap = new Map(
    ((profiles ?? []) as {
      id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
    }[]).map((p) => [p.id, p]),
  );

  const ordersByCust = new Map<string, Record<string, unknown>[]>();
  for (const o of (orders ?? []) as Record<string, unknown>[]) {
    const cid = String(o.customer_id);
    if (!ordersByCust.has(cid)) ordersByCust.set(cid, []);
    ordersByCust.get(cid)!.push(o);
  }

  const areaByCust = new Map<string, string>();
  for (const a of (addresses ?? []) as {
    customer_id: string;
    area_name_en: string;
    is_default: boolean;
  }[]) {
    if (a.is_default || !areaByCust.has(a.customer_id)) {
      areaByCust.set(a.customer_id, a.area_name_en);
    }
  }

  return (customers as {
    id: string;
    profile_id: string;
    status: string;
  }[]).map((c) => {
    const p = profileMap.get(c.profile_id);
    const custOrders = (ordersByCust.get(c.id) ?? []).filter(
      (o) => o.status !== "cancelled",
    );
    const total = custOrders.reduce(
      (s, o) => addOmr(s, normalizeOmr(String(o.total_omr ?? "0"))),
      "0.000",
    );
    const pieces = custOrders.reduce(
      (s, o) => s + Number(o.piece_count ?? 0),
      0,
    );
    const count = custOrders.length;
    const last = custOrders
      .map((o) => String(o.created_at))
      .sort()
      .at(-1);
    const avg =
      count > 0
        ? normalizeOmr(
            (
              Number(total) / count
            ).toFixed(3),
          )
        : "0.000";
    // Prefer bigint-safe avg: use string division via scaled math is hard; use addOmr loop
    let avgSafe = "0.000";
    if (count > 0) {
      // approximate with normalize of (total scaled / count) — use money helper carefully
      const { toBaisa, fromBaisa } = requireOmrHelpers();
      avgSafe = fromBaisa(toBaisa(total) / BigInt(count));
    }

    return {
      id: c.id,
      profile_id: c.profile_id,
      full_name: p?.full_name ?? "—",
      phone: p?.phone ?? null,
      email: p?.email ?? null,
      status: c.status,
      area: areaByCust.get(c.id) ?? null,
      orders_count: count,
      pieces,
      total_spend_omr: total,
      average_order_omr: avgSafe || avg,
      last_order_at: last ?? null,
    };
  });
}

function requireOmrHelpers() {
  // Inline scaled helpers without exporting private money internals
  const THOUSAND = BigInt(1000);
  function toBaisa(v: string): bigint {
    const n = normalizeOmr(v);
    const [w, f = ""] = n.split(".");
    return BigInt(w) * THOUSAND + BigInt((f + "000").slice(0, 3));
  }
  function fromBaisa(scaled: bigint): string {
    const whole = scaled / THOUSAND;
    const frac = (scaled % THOUSAND).toString().padStart(3, "0");
    return `${whole}.${frac}`;
  }
  return { toBaisa, fromBaisa };
}

export async function getAdminCustomerDetail(customerId: string) {
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return null;

  const profileId = (customer as { profile_id: string }).profile_id;
  const [{ data: profile }, { data: addresses }, { data: orders }, { data: complaints }, { data: ratings }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
      supabase.from("addresses").select("*").eq("customer_id", customerId),
      supabase
        .from("orders")
        .select("id, order_number, status, total_omr, piece_count, payment_status, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase.from("complaints").select("*").eq("customer_id", customerId),
      supabase.from("ratings").select("*").eq("customer_id", customerId),
    ]);

  const orderIds = ((orders ?? []) as { id: string }[]).map((o) => o.id);
  const { data: payments } = orderIds.length
    ? await supabase.from("payments").select("*").in("order_id", orderIds)
    : { data: [] };

  return {
    customer,
    profile,
    addresses: addresses ?? [],
    orders: orders ?? [],
    payments: payments ?? [],
    complaints: complaints ?? [],
    ratings: ratings ?? [],
  };
}

export type AdminDriverRow = {
  id: string;
  profile_id: string;
  full_name: string;
  phone: string | null;
  status: string;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  commission_percent: string;
  assigned_jobs: number;
  completed_jobs: number;
  pending_commission_omr: string;
  cash_held_omr: string;
};

export async function listAdminDrivers(): Promise<AdminDriverRow[]> {
  const supabase = await createClient();
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, profile_id, status, vehicle_type, vehicle_plate, commission_rule_id")
    .order("created_at", { ascending: false });
  if (!drivers?.length) return [];

  const ids = (drivers as { id: string }[]).map((d) => d.id);
  const profileIds = (drivers as { profile_id: string }[]).map((d) => d.profile_id);
  const ruleIds = [
    ...new Set(
      (drivers as { commission_rule_id: string | null }[])
        .map((d) => d.commission_rule_id)
        .filter(Boolean) as string[],
    ),
  ];

  const [
    { data: profiles },
    { data: rules },
    { data: defaultRule },
    { data: orders },
    { data: commissions },
    { data: cashOrders },
    { data: handovers },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").in("id", profileIds),
    ruleIds.length
      ? supabase
          .from("driver_commission_rules")
          .select("id, commission_percent")
          .in("id", ruleIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("driver_commission_rules")
      .select("commission_percent")
      .eq("is_default", true)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, status, pickup_driver_id, delivery_driver_id")
      .or(
        ids.map((id) => `pickup_driver_id.eq.${id},delivery_driver_id.eq.${id}`).join(","),
      ),
    supabase
      .from("driver_commissions")
      .select("driver_id, commission_omr, status")
      .in("driver_id", ids),
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
    ((profiles ?? []) as { id: string; full_name: string; phone: string | null }[]).map(
      (p) => [p.id, p],
    ),
  );
  const ruleMap = new Map(
    ((rules ?? []) as { id: string; commission_percent: string }[]).map((r) => [
      r.id,
      normalizeOmr(String(r.commission_percent)),
    ]),
  );
  const defaultPct = normalizeOmr(
    String(
      (defaultRule as { commission_percent?: string } | null)?.commission_percent ??
        "15",
    ),
  );

  return (drivers as {
    id: string;
    profile_id: string;
    status: string;
    vehicle_type: string | null;
    vehicle_plate: string | null;
    commission_rule_id: string | null;
  }[]).map((d) => {
    const p = profileMap.get(d.profile_id);
    const related = ((orders ?? []) as {
      status: string;
      pickup_driver_id: string | null;
      delivery_driver_id: string | null;
    }[]).filter(
      (o) => o.pickup_driver_id === d.id || o.delivery_driver_id === d.id,
    );
    const pending = ((commissions ?? []) as {
      driver_id: string;
      commission_omr: string;
      status: string;
    }[])
      .filter((c) => c.driver_id === d.id && c.status === "pending")
      .reduce(
        (s, c) => addOmr(s, normalizeOmr(String(c.commission_omr))),
        "0.000",
      );
    const collected = ((cashOrders ?? []) as {
      cash_collected_by_driver_id: string;
      cash_collected_omr: string;
    }[])
      .filter((o) => o.cash_collected_by_driver_id === d.id)
      .map((o) => String(o.cash_collected_omr));
    const handed = ((handovers ?? []) as {
      driver_id: string;
      amount_omr: string;
    }[])
      .filter((h) => h.driver_id === d.id)
      .map((h) => String(h.amount_omr));
    const held = computeCashHeld(collected, handed);

    return {
      id: d.id,
      profile_id: d.profile_id,
      full_name: p?.full_name ?? "—",
      phone: p?.phone ?? null,
      status: d.status,
      vehicle_type: d.vehicle_type,
      vehicle_plate: d.vehicle_plate,
      commission_percent:
        (d.commission_rule_id && ruleMap.get(d.commission_rule_id)) || defaultPct,
      assigned_jobs: related.filter((o) => o.status !== "delivered" && o.status !== "cancelled")
        .length,
      completed_jobs: related.filter((o) => o.status === "delivered").length,
      pending_commission_omr: pending,
      cash_held_omr: held.heldOmr,
    };
  });
}

export async function listAdminPartners() {
  const supabase = await createClient();
  const { data: partners } = await supabase
    .from("laundry_partners")
    .select("*")
    .order("name_en");
  if (!partners?.length) return [];

  const ids = (partners as { id: string }[]).map((p) => p.id);
  const [{ data: orders }, { data: settlements }, { data: complaints }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("partner_id, piece_count, partner_cost_total_omr, status, picked_up_at, delivered_at")
        .in("partner_id", ids),
      supabase
        .from("laundry_settlements")
        .select("partner_id, net_amount_omr, status")
        .in("partner_id", ids),
      supabase
        .from("complaints")
        .select("id, order_id")
        .limit(500),
    ]);

  return (partners as Record<string, unknown>[]).map((p) => {
    const pid = String(p.id);
    const pOrders = ((orders ?? []) as Record<string, unknown>[]).filter(
      (o) => o.partner_id === pid,
    );
    const pieces = pOrders.reduce((s, o) => s + Number(o.piece_count ?? 0), 0);
    const payable = pOrders
      .filter((o) => o.status === "delivered")
      .reduce(
        (s, o) => addOmr(s, normalizeOmr(String(o.partner_cost_total_omr ?? "0"))),
        "0.000",
      );
    const paid = ((settlements ?? []) as {
      partner_id: string;
      net_amount_omr: string;
      status: string;
    }[])
      .filter((s) => s.partner_id === pid && s.status === "paid")
      .reduce(
        (s, row) => addOmr(s, normalizeOmr(String(row.net_amount_omr))),
        "0.000",
      );
    const turnarounds = pOrders
      .filter((o) => o.picked_up_at && o.delivered_at)
      .map((o) => {
        const a = new Date(String(o.picked_up_at)).getTime();
        const b = new Date(String(o.delivered_at)).getTime();
        return (b - a) / 3600_000;
      });
    const avgTurn =
      turnarounds.length > 0
        ? Math.round(
            (turnarounds.reduce((s, n) => s + n, 0) / turnarounds.length) * 10,
          ) / 10
        : null;

    return {
      id: pid,
      code: String(p.code ?? ""),
      name_en: String(p.name_en ?? ""),
      name_ar: String(p.name_ar ?? ""),
      status: String(p.status ?? ""),
      default_cost_per_piece_omr: normalizeOmr(
        String(p.default_cost_per_piece_omr ?? "0"),
      ),
      orders_count: pOrders.length,
      pieces,
      amount_payable_omr: payable,
      paid_omr: paid,
      outstanding_omr: subOmr(payable, paid),
      avg_turnaround_hours: avgTurn,
      complaints_count: 0,
      rewash_count: 0,
      _complaintIds: complaints ?? [],
    };
  });
}
