import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { DriverOrderCard } from "@/lib/driver/types";
import {
  computeCashHeld,
  isDeliveryActive,
  isPickupActive,
  type CashHeldBreakdown,
} from "@/lib/driver/types";
import { addOmr, normalizeOmr, subOmr } from "@/lib/money/omr";

export type DriverContext = {
  profileId: string;
  driverId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  status: string;
};

export type DriverCommissionRow = {
  id: string;
  order_id: string;
  commission_percent: string;
  base_amount_omr: string;
  commission_omr: string;
  status: string;
  created_at: string;
  order_number?: string | null;
};

export type DriverHandoverRow = {
  id: string;
  amount_omr: string;
  status: string;
  notes: string | null;
  submitted_at: string | null;
  handed_over_at: string | null;
  confirmed_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export type DriverDashboardStats = {
  todaysPickups: number;
  todaysDeliveries: number;
  completedJobs: number;
  pendingCommissionOmr: string;
  approvedCommissionOmr: string;
  settledCommissionOmr: string;
  cashHeld: CashHeldBreakdown;
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return (
    t >= new Date(startOfTodayIso()).getTime() &&
    t <= new Date(endOfTodayIso()).getTime()
  );
}

export async function requireDriver(): Promise<DriverContext | null> {
  if (!hasSupabaseEnv()) return null;
  const session = await getSessionUser();
  if (!session || session.role !== "driver") return null;

  const supabase = await createClient();
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, status, vehicle_type, vehicle_plate")
    .eq("profile_id", session.id)
    .maybeSingle();

  if (!driver) return null;

  return {
    profileId: session.id,
    driverId: (driver as { id: string }).id,
    fullName: session.profile?.full_name || "",
    phone: session.phone || session.profile?.phone || null,
    email: session.email,
    vehicleType: (driver as { vehicle_type: string | null }).vehicle_type,
    vehiclePlate: (driver as { vehicle_plate: string | null }).vehicle_plate,
    status: (driver as { status: string }).status,
  };
}

function mapCard(row: Record<string, unknown>): DriverOrderCard {
  return {
    id: String(row.id),
    order_number: String(row.order_number),
    status: String(row.status),
    pickup_driver_id: (row.pickup_driver_id as string) ?? null,
    delivery_driver_id: (row.delivery_driver_id as string) ?? null,
    scheduled_pickup_at: (row.scheduled_pickup_at as string) ?? null,
    scheduled_delivery_at: (row.scheduled_delivery_at as string) ?? null,
    estimated_piece_count: (row.estimated_piece_count as number) ?? null,
    piece_count: Number(row.piece_count ?? 0),
    customer_notes: (row.customer_notes as string) ?? null,
    pickup_notes: (row.pickup_notes as string) ?? null,
    delivery_notes: (row.delivery_notes as string) ?? null,
    payment_method: (row.payment_method as string) ?? null,
    payment_status: (row.payment_status as string) ?? null,
    cash_collected_omr: normalizeOmr(String(row.cash_collected_omr ?? "0")),
    cash_collected_at: (row.cash_collected_at as string) ?? null,
    cash_collected_by_driver_id:
      (row.cash_collected_by_driver_id as string) ?? null,
    arrived_at_pickup_at: (row.arrived_at_pickup_at as string) ?? null,
    arrived_at_delivery_at: (row.arrived_at_delivery_at as string) ?? null,
    delivery_confirmation_code:
      (row.delivery_confirmation_code as string) ?? null,
    qr_token: (row.qr_token as string) ?? null,
    qr_scanned_at_pickup: (row.qr_scanned_at_pickup as string) ?? null,
    driver_commission_percent: row.driver_commission_percent
      ? normalizeOmr(String(row.driver_commission_percent))
      : null,
    driver_commission_omr: normalizeOmr(
      String(row.driver_commission_omr ?? "0"),
    ),
    eligible_revenue_omr: normalizeOmr(
      String(row.eligible_revenue_omr ?? "0"),
    ),
    customer_total_omr: normalizeOmr(String(row.customer_total_omr ?? "0")),
    area_code: (row.area_code as string) ?? null,
    area_name_en: (row.area_name_en as string) ?? null,
    area_name_ar: (row.area_name_ar as string) ?? null,
    street: (row.street as string) ?? null,
    building: (row.building as string) ?? null,
    unit: (row.unit as string) ?? null,
    landmark: (row.landmark as string) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    address_notes: (row.address_notes as string) ?? null,
    customer_name: (row.customer_name as string) ?? null,
    customer_phone: (row.customer_phone as string) ?? null,
    created_at: String(row.created_at),
  };
}

/**
 * Load assigned orders via driver-safe projection.
 * Falls back to orders table if the view is not yet migrated.
 */
export async function getAssignedDriverOrders(
  driverId: string,
): Promise<DriverOrderCard[]> {
  const supabase = await createClient();

  const { data: viewData, error: viewError } = await supabase
    .from("driver_order_cards")
    .select("*")
    .or(`pickup_driver_id.eq.${driverId},delivery_driver_id.eq.${driverId}`)
    .order("scheduled_pickup_at", { ascending: true });

  if (!viewError && viewData) {
    return (viewData as Record<string, unknown>[]).map(mapCard);
  }

  // Fallback without view (pre-migration): build safe cards manually
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, pickup_driver_id, delivery_driver_id, scheduled_pickup_at, scheduled_delivery_at, estimated_piece_count, piece_count, customer_notes, pickup_notes, delivery_notes, payment_method, payment_status, cash_collected_omr, cash_collected_at, cash_collected_by_driver_id, arrived_at_pickup_at, arrived_at_delivery_at, delivery_confirmation_code, qr_token, qr_scanned_at_pickup, driver_commission_percent, driver_commission_omr, subtotal_omr, discount_omr, total_omr, pickup_address_id, customer_id, created_at",
    )
    .or(`pickup_driver_id.eq.${driverId},delivery_driver_id.eq.${driverId}`)
    .order("scheduled_pickup_at", { ascending: true });

  if (!orders?.length) return [];

  const cards: DriverOrderCard[] = [];
  for (const o of orders as Record<string, unknown>[]) {
    let area: Record<string, unknown> | null = null;
    let customerName: string | null = null;
    let customerPhone: string | null = null;

    if (o.pickup_address_id) {
      const { data: addr } = await supabase
        .from("addresses")
        .select(
          "area_code, area_name_en, area_name_ar, street, building, unit, landmark, latitude, longitude, notes",
        )
        .eq("id", o.pickup_address_id as string)
        .maybeSingle();
      area = (addr as Record<string, unknown>) ?? null;
    }
    if (o.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("profile_id")
        .eq("id", o.customer_id as string)
        .maybeSingle();
      if (cust) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", (cust as { profile_id: string }).profile_id)
          .maybeSingle();
        customerName =
          (profile as { full_name?: string } | null)?.full_name ?? null;
        customerPhone =
          (profile as { phone?: string } | null)?.phone ?? null;
      }
    }

    const subtotal = normalizeOmr(String(o.subtotal_omr ?? "0"));
    const discount = normalizeOmr(String(o.discount_omr ?? "0"));
    const eligible = subOmr(subtotal, discount);

    cards.push(
      mapCard({
        ...o,
        eligible_revenue_omr: eligible,
        customer_total_omr: o.total_omr,
        area_code: area?.area_code,
        area_name_en: area?.area_name_en,
        area_name_ar: area?.area_name_ar,
        street: area?.street,
        building: area?.building,
        unit: area?.unit,
        landmark: area?.landmark,
        latitude: area?.latitude,
        longitude: area?.longitude,
        address_notes: area?.notes,
        customer_name: customerName,
        customer_phone: customerPhone,
      }),
    );
  }
  return cards;
}

export async function getDriverOrderCard(
  driverId: string,
  orderId: string,
): Promise<DriverOrderCard | null> {
  const all = await getAssignedDriverOrders(driverId);
  return all.find((o) => o.id === orderId) ?? null;
}

export async function getDriverCommissions(
  driverId: string,
): Promise<DriverCommissionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("driver_commissions")
    .select(
      "id, order_id, commission_percent, base_amount_omr, commission_omr, status, created_at",
    )
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });

  if (!data?.length) return [];

  const rows = data as DriverCommissionRow[];
  const orderIds = [...new Set(rows.map((r) => r.order_id))];
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number")
    .in("id", orderIds);
  const map = new Map(
    ((orders ?? []) as { id: string; order_number: string }[]).map((o) => [
      o.id,
      o.order_number,
    ]),
  );

  return rows.map((r) => ({
    ...r,
    commission_percent: normalizeOmr(String(r.commission_percent)),
    base_amount_omr: normalizeOmr(String(r.base_amount_omr)),
    commission_omr: normalizeOmr(String(r.commission_omr)),
    order_number: map.get(r.order_id) ?? null,
  }));
}

export async function getDriverCashHandovers(
  driverId: string,
): Promise<DriverHandoverRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cash_handovers")
    .select(
      "id, amount_omr, status, notes, submitted_at, handed_over_at, confirmed_at, rejected_at, rejection_reason, created_at",
    )
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as DriverHandoverRow[]).map((h) => ({
    ...h,
    amount_omr: normalizeOmr(String(h.amount_omr)),
  }));
}

export async function getDriverCashHeld(
  driverId: string,
): Promise<CashHeldBreakdown> {
  const supabase = await createClient();
  const { data: collected } = await supabase
    .from("orders")
    .select("cash_collected_omr")
    .eq("cash_collected_by_driver_id", driverId);

  const { data: handovers } = await supabase
    .from("cash_handovers")
    .select("amount_omr, status")
    .eq("driver_id", driverId)
    .eq("status", "confirmed");

  return computeCashHeld(
    ((collected ?? []) as { cash_collected_omr: string }[]).map((r) =>
      String(r.cash_collected_omr ?? "0"),
    ),
    ((handovers ?? []) as { amount_omr: string }[]).map((r) =>
      String(r.amount_omr ?? "0"),
    ),
  );
}

export async function getDriverDashboardStats(
  driverId: string,
  orders: DriverOrderCard[],
): Promise<DriverDashboardStats> {
  const todaysPickups = orders.filter(
    (o) =>
      o.pickup_driver_id === driverId &&
      isPickupActive(o.status) &&
      (isToday(o.scheduled_pickup_at) || !o.scheduled_pickup_at),
  ).length;

  const todaysDeliveries = orders.filter(
    (o) =>
      o.delivery_driver_id === driverId &&
      (o.status === "out_for_delivery" ||
        o.status === "ready_for_delivery" ||
        o.status === "ready") &&
      (isToday(o.scheduled_delivery_at) || !o.scheduled_delivery_at),
  ).length;

  const completedJobs = orders.filter((o) => o.status === "delivered").length;

  const commissions = await getDriverCommissions(driverId);
  const sumBy = (statuses: string[]) =>
    commissions
      .filter((c) => statuses.includes(c.status))
      .reduce((sum, c) => addOmr(sum, c.commission_omr), "0.000");

  const cashHeld = await getDriverCashHeld(driverId);

  return {
    todaysPickups,
    todaysDeliveries,
    completedJobs,
    pendingCommissionOmr: sumBy(["pending"]),
    approvedCommissionOmr: sumBy(["approved"]),
    settledCommissionOmr: sumBy(["settled"]),
    cashHeld,
  };
}

export function addressLine(
  order: DriverOrderCard,
  locale: "ar" | "en",
): string {
  const area =
    locale === "ar"
      ? order.area_name_ar || order.area_name_en
      : order.area_name_en || order.area_name_ar;
  return [order.building, order.street, order.unit, area]
    .filter(Boolean)
    .join(", ");
}

export function groupOrdersForRoute(
  orders: DriverOrderCard[],
  driverId: string,
  locale: "ar" | "en",
): Array<{
  key: string;
  areaLabel: string;
  jobs: Array<{ order: DriverOrderCard; kind: "pickup" | "delivery" }>;
}> {
  const jobs: Array<{
    order: DriverOrderCard;
    kind: "pickup" | "delivery";
    sortAt: string;
  }> = [];

  for (const order of orders) {
    if (order.pickup_driver_id === driverId && isPickupActive(order.status)) {
      jobs.push({
        order,
        kind: "pickup",
        sortAt: order.scheduled_pickup_at || order.created_at,
      });
    }
    if (
      order.delivery_driver_id === driverId &&
      isDeliveryActive(order.status)
    ) {
      jobs.push({
        order,
        kind: "delivery",
        sortAt: order.scheduled_delivery_at || order.created_at,
      });
    }
  }

  jobs.sort((a, b) => a.sortAt.localeCompare(b.sortAt));

  const groups = new Map<
    string,
    {
      key: string;
      areaLabel: string;
      jobs: Array<{ order: DriverOrderCard; kind: "pickup" | "delivery" }>;
    }
  >();

  for (const job of jobs) {
    const areaCode = job.order.area_code || "other";
    const areaLabel =
      locale === "ar"
        ? job.order.area_name_ar || job.order.area_name_en || areaCode
        : job.order.area_name_en || job.order.area_name_ar || areaCode;
    if (!groups.has(areaCode)) {
      groups.set(areaCode, { key: areaCode, areaLabel, jobs: [] });
    }
    groups.get(areaCode)!.jobs.push({ order: job.order, kind: job.kind });
  }

  return [...groups.values()];
}
