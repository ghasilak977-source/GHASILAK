import { addOmr, normalizeOmr, subOmr } from "@/lib/money/omr";
import { createClient } from "@/lib/supabase/server";
import { isActiveOrderStatus } from "@/lib/orders/status";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x.toISOString();
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

export type AdminDashboardStats = {
  ordersToday: number;
  activeOrders: number;
  completedToday: number;
  revenueTodayOmr: string;
  revenueMonthOmr: string;
  contributionMonthOmr: string;
  netProfitMonthOmr: string;
  laundryPayablesOmr: string;
  driverPayablesOmr: string;
  cashHeldByDriversOmr: string;
};

export type AdminOrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  piece_count: number;
  estimated_piece_count: number | null;
  total_omr: string;
  partner_cost_total_omr: string;
  driver_commission_omr: string;
  packaging_cost_omr: string;
  discount_omr: string;
  other_direct_cost_omr: string;
  contribution_omr: string;
  margin_percentage: string;
  subtotal_omr: string;
  customer_notes: string | null;
  internal_notes: string | null;
  scheduled_pickup_at: string | null;
  created_at: string;
  customer_id: string;
  partner_id: string | null;
  pickup_driver_id: string | null;
  delivery_driver_id: string | null;
  zone_id: string | null;
  pickup_address_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  area_name_en?: string | null;
  area_name_ar?: string | null;
  partner_name?: string | null;
  driver_name?: string | null;
};

async function sumField(
  rows: Array<Record<string, unknown>> | null | undefined,
  field: string,
): Promise<string> {
  return (rows ?? []).reduce(
    (s, r) => addOmr(s, normalizeOmr(String(r[field] ?? "0"))),
    "0.000",
  );
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = await createClient();
  const today = startOfDay();
  const month = startOfMonth();

  const { data: todayOrders } = await supabase
    .from("orders")
    .select("id, status, total_omr, contribution_omr, delivered_at, created_at")
    .gte("created_at", today);

  const { data: monthOrders } = await supabase
    .from("orders")
    .select("id, status, total_omr, contribution_omr, partner_cost_total_omr")
    .gte("created_at", month)
    .neq("status", "cancelled");

  const { data: active } = await supabase
    .from("orders")
    .select("id, status")
    .not("status", "in", "(delivered,cancelled,failed,draft)");

  const { data: laundrySettlements } = await supabase
    .from("laundry_settlements")
    .select("net_amount_omr, status")
    .in("status", ["draft", "pending", "approved"]);

  const { data: driverSettlements } = await supabase
    .from("driver_settlements")
    .select("net_amount_omr, status")
    .in("status", ["draft", "pending", "approved"]);

  const { data: pendingComm } = await supabase
    .from("driver_commissions")
    .select("commission_omr, status")
    .in("status", ["pending", "approved"]);

  const { data: cashCollected } = await supabase
    .from("orders")
    .select("cash_collected_omr")
    .not("cash_collected_by_driver_id", "is", null);

  const { data: confirmedHandovers } = await supabase
    .from("cash_handovers")
    .select("amount_omr")
    .eq("status", "confirmed");

  const todayRows = (todayOrders ?? []) as Record<string, unknown>[];
  const monthRows = (monthOrders ?? []) as Record<string, unknown>[];

  const completedToday = todayRows.filter(
    (o) => o.status === "delivered" || (o.delivered_at && String(o.delivered_at) >= today),
  ).length;

  const revenueTodayOmr = await sumField(
    todayRows.filter((o) => o.status !== "cancelled"),
    "total_omr",
  );
  const revenueMonthOmr = await sumField(monthRows, "total_omr");
  const contributionMonthOmr = await sumField(monthRows, "contribution_omr");

  // Net profit proxy: contribution this month (already revenue − laundry − commission − packaging − other)
  const netProfitMonthOmr = contributionMonthOmr;

  let laundryPayablesOmr = await sumField(
    laundrySettlements as Record<string, unknown>[] | null,
    "net_amount_omr",
  );
  if (laundryPayablesOmr === "0.000") {
    // Fallback: partner costs on undelivered/unsettled delivered orders
    const { data: unpaidLaundry } = await supabase
      .from("orders")
      .select("partner_cost_total_omr")
      .eq("status", "delivered");
    laundryPayablesOmr = await sumField(
      unpaidLaundry as Record<string, unknown>[] | null,
      "partner_cost_total_omr",
    );
  }

  let driverPayablesOmr = await sumField(
    driverSettlements as Record<string, unknown>[] | null,
    "net_amount_omr",
  );
  if (driverPayablesOmr === "0.000") {
    driverPayablesOmr = await sumField(
      pendingComm as Record<string, unknown>[] | null,
      "commission_omr",
    );
  }

  const collected = await sumField(
    cashCollected as Record<string, unknown>[] | null,
    "cash_collected_omr",
  );
  const handed = await sumField(
    confirmedHandovers as Record<string, unknown>[] | null,
    "amount_omr",
  );

  return {
    ordersToday: todayRows.length,
    activeOrders: (active ?? []).length,
    completedToday,
    revenueTodayOmr,
    revenueMonthOmr,
    contributionMonthOmr,
    netProfitMonthOmr,
    laundryPayablesOmr,
    driverPayablesOmr,
    cashHeldByDriversOmr: subOmr(collected, handed),
  };
}

export async function getRecentOrders(limit = 8): Promise<AdminOrderRow[]> {
  return listAdminOrders({ limit });
}

export async function getLateOrders(limit = 8): Promise<AdminOrderRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, payment_method, piece_count, estimated_piece_count, total_omr, partner_cost_total_omr, driver_commission_omr, packaging_cost_omr, discount_omr, other_direct_cost_omr, contribution_omr, margin_percentage, subtotal_omr, customer_notes, internal_notes, scheduled_pickup_at, created_at, customer_id, partner_id, pickup_driver_id, delivery_driver_id, zone_id, pickup_address_id",
    )
    .not("status", "in", "(delivered,cancelled,failed)")
    .lt("scheduled_pickup_at", new Date().toISOString())
    .order("scheduled_pickup_at", { ascending: true })
    .limit(limit);
  return enrichOrders((data ?? []) as AdminOrderRow[]);
}

export async function getStuckOrders(limit = 8): Promise<AdminOrderRow[]> {
  const supabase = await createClient();
  const cutoff = hoursAgo(48);
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, payment_method, piece_count, estimated_piece_count, total_omr, partner_cost_total_omr, driver_commission_omr, packaging_cost_omr, discount_omr, other_direct_cost_omr, contribution_omr, margin_percentage, subtotal_omr, customer_notes, internal_notes, scheduled_pickup_at, created_at, customer_id, partner_id, pickup_driver_id, delivery_driver_id, zone_id, pickup_address_id",
    )
    .not("status", "in", "(delivered,cancelled,failed,draft)")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(limit);
  return enrichOrders((data ?? []) as AdminOrderRow[]);
}

export type OrderListFilters = {
  status?: string;
  orderNumber?: string;
  paymentStatus?: string;
  customerId?: string;
  driverId?: string;
  partnerId?: string;
  zoneId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export async function listAdminOrders(
  filters: OrderListFilters = {},
): Promise<AdminOrderRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, payment_method, piece_count, estimated_piece_count, total_omr, partner_cost_total_omr, driver_commission_omr, packaging_cost_omr, discount_omr, other_direct_cost_omr, contribution_omr, margin_percentage, subtotal_omr, customer_notes, internal_notes, scheduled_pickup_at, created_at, customer_id, partner_id, pickup_driver_id, delivery_driver_id, zone_id, pickup_address_id",
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.paymentStatus) q = q.eq("payment_status", filters.paymentStatus);
  if (filters.orderNumber)
    q = q.ilike("order_number", `%${filters.orderNumber}%`);
  if (filters.customerId) q = q.eq("customer_id", filters.customerId);
  if (filters.partnerId) q = q.eq("partner_id", filters.partnerId);
  if (filters.zoneId) q = q.eq("zone_id", filters.zoneId);
  if (filters.driverId) {
    q = q.or(
      `pickup_driver_id.eq.${filters.driverId},delivery_driver_id.eq.${filters.driverId}`,
    );
  }
  if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
  if (filters.dateTo) q = q.lte("created_at", filters.dateTo);

  const { data } = await q;
  return enrichOrders((data ?? []) as AdminOrderRow[]);
}

async function enrichOrders(rows: AdminOrderRow[]): Promise<AdminOrderRow[]> {
  if (!rows.length) return [];
  const supabase = await createClient();

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const partnerIds = [
    ...new Set(rows.map((r) => r.partner_id).filter(Boolean) as string[]),
  ];
  const driverIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.pickup_driver_id, r.delivery_driver_id])
        .filter(Boolean) as string[],
    ),
  ];
  const addressIds = [
    ...new Set(
      rows.map((r) => r.pickup_address_id).filter(Boolean) as string[],
    ),
  ];

  const [{ data: customers }, { data: partners }, { data: drivers }, { data: addresses }] =
    await Promise.all([
      supabase.from("customers").select("id, profile_id").in("id", customerIds),
      partnerIds.length
        ? supabase
            .from("laundry_partners")
            .select("id, name_en, name_ar")
            .in("id", partnerIds)
        : Promise.resolve({ data: [] }),
      driverIds.length
        ? supabase.from("drivers").select("id, profile_id").in("id", driverIds)
        : Promise.resolve({ data: [] }),
      addressIds.length
        ? supabase
            .from("addresses")
            .select("id, area_name_en, area_name_ar")
            .in("id", addressIds)
        : Promise.resolve({ data: [] }),
    ]);

  const profileIds = [
    ...new Set([
      ...((customers ?? []) as { profile_id: string }[]).map((c) => c.profile_id),
      ...((drivers ?? []) as { profile_id: string }[]).map((d) => d.profile_id),
    ]),
  ];
  const { data: profiles } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", profileIds)
    : { data: [] };

  const profileMap = new Map(
    ((profiles ?? []) as { id: string; full_name: string; phone: string | null }[]).map(
      (p) => [p.id, p],
    ),
  );
  const custMap = new Map(
    ((customers ?? []) as { id: string; profile_id: string }[]).map((c) => [
      c.id,
      c,
    ]),
  );
  const partnerMap = new Map(
    ((partners ?? []) as { id: string; name_en: string; name_ar: string }[]).map(
      (p) => [p.id, p],
    ),
  );
  const driverMap = new Map(
    ((drivers ?? []) as { id: string; profile_id: string }[]).map((d) => [
      d.id,
      d,
    ]),
  );
  const addrMap = new Map(
    ((addresses ?? []) as {
      id: string;
      area_name_en: string;
      area_name_ar: string;
    }[]).map((a) => [a.id, a]),
  );

  return rows.map((r) => {
    const cust = custMap.get(r.customer_id);
    const custProfile = cust ? profileMap.get(cust.profile_id) : null;
    const drvId = r.pickup_driver_id || r.delivery_driver_id;
    const drv = drvId ? driverMap.get(drvId) : null;
    const drvProfile = drv ? profileMap.get(drv.profile_id) : null;
    const partner = r.partner_id ? partnerMap.get(r.partner_id) : null;
    const addr = r.pickup_address_id ? addrMap.get(r.pickup_address_id) : null;
    return {
      ...r,
      total_omr: normalizeOmr(String(r.total_omr ?? "0")),
      partner_cost_total_omr: normalizeOmr(String(r.partner_cost_total_omr ?? "0")),
      driver_commission_omr: normalizeOmr(String(r.driver_commission_omr ?? "0")),
      packaging_cost_omr: normalizeOmr(String(r.packaging_cost_omr ?? "0")),
      discount_omr: normalizeOmr(String(r.discount_omr ?? "0")),
      other_direct_cost_omr: normalizeOmr(String(r.other_direct_cost_omr ?? "0")),
      contribution_omr: normalizeOmr(String(r.contribution_omr ?? "0")),
      margin_percentage: normalizeOmr(String(r.margin_percentage ?? "0")),
      subtotal_omr: normalizeOmr(String(r.subtotal_omr ?? "0")),
      customer_name: custProfile?.full_name ?? null,
      customer_phone: custProfile?.phone ?? null,
      partner_name: partner?.name_en ?? null,
      driver_name: drvProfile?.full_name ?? null,
      area_name_en: addr?.area_name_en ?? null,
      area_name_ar: addr?.area_name_ar ?? null,
    };
  });
}

export async function getAdminOrderDetail(orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;

  const enriched = (await enrichOrders([order as AdminOrderRow]))[0];

  const [
    { data: items },
    { data: history },
    { data: photos },
    { data: address },
    { data: payments },
  ] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", orderId),
    supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase.from("order_photos").select("*").eq("order_id", orderId),
    (order as { pickup_address_id: string | null }).pickup_address_id
      ? supabase
          .from("addresses")
          .select("*")
          .eq("id", (order as { pickup_address_id: string }).pickup_address_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("payments").select("*").eq("order_id", orderId),
  ]);

  return {
    order: enriched,
    raw: order as Record<string, unknown>,
    items: items ?? [],
    history: history ?? [],
    photos: photos ?? [],
    address: address as Record<string, unknown> | null,
    payments: payments ?? [],
  };
}

export { isActiveOrderStatus, startOfDay, startOfMonth, hoursAgo };
