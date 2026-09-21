import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isFinanceRole } from "@/lib/auth/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  buildAreaPerformance,
  buildDriverPerformance,
  buildLaundryPerformance,
  toCsvUtf8,
} from "@/lib/finance/reports";
import { normalizeOmr, resolveDateRange, sumOmr } from "@/lib/finance/types";
import { cashHeldForDriver } from "@/lib/finance/kpis";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

type ReportKind = "sales" | "profit" | "areas" | "laundry" | "drivers" | "orders";

function parseKind(raw: string | null): ReportKind | null {
  if (
    raw === "sales" ||
    raw === "profit" ||
    raw === "areas" ||
    raw === "laundry" ||
    raw === "drivers" ||
    raw === "orders"
  ) {
    return raw;
  }
  return null;
}

function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const session = await getSessionUser();
  if (!session || !isFinanceRole(session.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get("kind"));
  if (!kind) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  const localeRaw = url.searchParams.get("locale") || "en";
  const locale: Locale = isLocale(localeRaw) ? localeRaw : "en";

  const preset = (url.searchParams.get("range") || "this_month") as
    | "today"
    | "yesterday"
    | "7d"
    | "30d"
    | "this_month"
    | "last_month"
    | "custom";
  const range = resolveDateRange(preset, {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  });

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_id, partner_id, pickup_driver_id, delivery_driver_id, piece_count, total_omr, contribution_omr, partner_cost_total_omr, driver_commission_omr, packaging_cost_omr, status, created_at, scheduled_pickup_at, picked_up_at, delivered_at, pickup_address_id",
    )
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString())
    .neq("status", "cancelled")
    .limit(5000);

  const orderRows = (orders ?? []) as Record<string, unknown>[];

  if (kind === "sales" || kind === "profit" || kind === "orders") {
    if (kind === "orders") {
      const csv = toCsvUtf8(
        [
          "order_number",
          "created_at",
          "status",
          "pieces",
          "revenue_omr",
          "contribution_omr",
          "partner_cost_omr",
          "driver_commission_omr",
          "packaging_omr",
        ],
        orderRows.map((o) => [
          String(o.order_number ?? o.id),
          String(o.created_at ?? ""),
          String(o.status ?? ""),
          Number(o.piece_count ?? 0),
          normalizeOmr(String(o.total_omr ?? "0")),
          normalizeOmr(String(o.contribution_omr ?? "0")),
          normalizeOmr(String(o.partner_cost_total_omr ?? "0")),
          normalizeOmr(String(o.driver_commission_omr ?? "0")),
          normalizeOmr(String(o.packaging_cost_omr ?? "0")),
        ]),
      );
      return csvResponse(`ghasilak-orders-${preset}.csv`, csv);
    }

    const byDate = new Map<
      string,
      { orders: number; pieces: number; revenue: string; contribution: string }
    >();
    for (const o of orderRows) {
      const day = String(o.created_at ?? "").slice(0, 10) || "unknown";
      if (!byDate.has(day)) {
        byDate.set(day, {
          orders: 0,
          pieces: 0,
          revenue: "0.000",
          contribution: "0.000",
        });
      }
      const g = byDate.get(day)!;
      g.orders += 1;
      g.pieces += Number(o.piece_count ?? 0);
      g.revenue = sumOmr([g.revenue, normalizeOmr(String(o.total_omr ?? "0"))]);
      g.contribution = sumOmr([
        g.contribution,
        normalizeOmr(String(o.contribution_omr ?? "0")),
      ]);
    }

    const headers =
      kind === "sales"
        ? ["date", "orders", "pieces", "revenue_omr"]
        : ["date", "orders", "pieces", "contribution_omr", "revenue_omr"];

    const rows = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, g]) =>
        kind === "sales"
          ? [date, g.orders, g.pieces, g.revenue]
          : [date, g.orders, g.pieces, g.contribution, g.revenue],
      );

    return csvResponse(
      `ghasilak-${kind}-${preset}.csv`,
      toCsvUtf8(headers, rows),
    );
  }

  if (kind === "areas") {
    const addressIds = [
      ...new Set(
        orderRows
          .map((o) => o.pickup_address_id as string | null)
          .filter(Boolean) as string[],
      ),
    ];
    const { data: addresses } = addressIds.length
      ? await supabase
          .from("addresses")
          .select("id, area_code, area_name_en, area_name_ar")
          .in("id", addressIds)
      : { data: [] };
    const addrMap = new Map(
      ((addresses ?? []) as {
        id: string;
        area_code: string;
        area_name_en: string;
        area_name_ar: string;
      }[]).map((a) => [a.id, a]),
    );

    const areaPerf = buildAreaPerformance(
      orderRows.map((o) => {
        const addr = o.pickup_address_id
          ? addrMap.get(String(o.pickup_address_id))
          : null;
        return {
          areaCode: addr?.area_code || "unknown",
          areaName:
            locale === "ar"
              ? addr?.area_name_ar || addr?.area_name_en || "—"
              : addr?.area_name_en || addr?.area_name_ar || "—",
          customerId: String(o.customer_id),
          pieces: Number(o.piece_count ?? 0),
          revenueOmr: normalizeOmr(String(o.total_omr ?? "0")),
          contributionOmr: normalizeOmr(String(o.contribution_omr ?? "0")),
        };
      }),
    );

    return csvResponse(
      `ghasilak-areas-${preset}.csv`,
      toCsvUtf8(
        [
          "area_code",
          "area_name",
          "orders",
          "pieces",
          "revenue_omr",
          "contribution_omr",
          "aov_omr",
          "repeat_customers",
        ],
        areaPerf.map((a) => [
          a.areaCode,
          a.areaName,
          a.orders,
          a.pieces,
          a.revenueOmr,
          a.contributionOmr,
          a.aovOmr,
          a.repeatCustomers,
        ]),
      ),
    );
  }

  if (kind === "laundry") {
    const partnerIds = [
      ...new Set(
        orderRows
          .map((o) => o.partner_id as string | null)
          .filter(Boolean) as string[],
      ),
    ];
    const { data: partners } = partnerIds.length
      ? await supabase
          .from("laundry_partners")
          .select("id, name_en, name_ar")
          .in("id", partnerIds)
      : { data: [] };
    const partnerMap = new Map(
      ((partners ?? []) as { id: string; name_en: string; name_ar: string }[]).map(
        (p) => [p.id, p],
      ),
    );

    const laundryPerf = buildLaundryPerformance(
      orderRows
        .filter((o) => o.partner_id)
        .map((o) => {
          const p = partnerMap.get(String(o.partner_id));
          const late =
            o.scheduled_pickup_at &&
            o.picked_up_at &&
            new Date(String(o.picked_up_at)) >
              new Date(String(o.scheduled_pickup_at));
          const turn =
            o.picked_up_at && o.delivered_at
              ? (new Date(String(o.delivered_at)).getTime() -
                  new Date(String(o.picked_up_at)).getTime()) /
                3600_000
              : null;
          return {
            partnerId: String(o.partner_id),
            partnerName: p
              ? locale === "ar"
                ? p.name_ar
                : p.name_en
              : String(o.partner_id).slice(0, 8),
            pieces: Number(o.piece_count ?? 0),
            costOmr: normalizeOmr(String(o.partner_cost_total_omr ?? "0")),
            late: Boolean(late),
            turnaroundHours: turn,
          };
        }),
      {},
      {},
    );

    return csvResponse(
      `ghasilak-laundry-${preset}.csv`,
      toCsvUtf8(
        [
          "partner_id",
          "partner_name",
          "orders",
          "pieces",
          "cost_omr",
          "late",
          "complaints",
          "rewashes",
          "avg_turnaround_hours",
        ],
        laundryPerf.map((p) => [
          p.partnerId,
          p.partnerName,
          p.orders,
          p.pieces,
          p.costOmr,
          p.late,
          p.complaints,
          p.rewashes,
          p.avgTurnaroundHours,
        ]),
      ),
    );
  }

  // drivers
  const [{ data: drivers }, { data: cashOrders }, { data: handovers }] =
    await Promise.all([
      supabase.from("drivers").select("id, profile_id"),
      supabase
        .from("orders")
        .select("cash_collected_omr, cash_collected_by_driver_id")
        .not("cash_collected_by_driver_id", "is", null),
      supabase
        .from("cash_handovers")
        .select("driver_id, amount_omr, status")
        .eq("status", "confirmed"),
    ]);

  const profileIds = ((drivers ?? []) as { profile_id: string }[]).map(
    (d) => d.profile_id,
  );
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  type DriverPerfInput = {
    driverId: string;
    driverName: string;
    assigned: boolean;
    completed: boolean;
    failedPickup: boolean;
    commissionOmr: string;
    cashHeldOmr: string;
    completionHours: number | null;
  };

  const driverPerfInputs = (
    (drivers ?? []) as { id: string; profile_id: string }[]
  ).flatMap((d): DriverPerfInput[] => {
    const related = orderRows.filter(
      (o) =>
        o.pickup_driver_id === d.id || o.delivery_driver_id === d.id,
    );
    const col = ((cashOrders ?? []) as {
      cash_collected_by_driver_id: string;
      cash_collected_omr: string;
    }[])
      .filter((c) => c.cash_collected_by_driver_id === d.id)
      .map((c) => String(c.cash_collected_omr));
    const hand = ((handovers ?? []) as {
      driver_id: string;
      amount_omr: string;
    }[])
      .filter((h) => h.driver_id === d.id)
      .map((h) => String(h.amount_omr));
    const held = cashHeldForDriver(col, hand);
    if (related.length === 0) {
      return [
        {
          driverId: d.id,
          driverName: profileMap.get(d.profile_id) || "—",
          assigned: false,
          completed: false,
          failedPickup: false,
          commissionOmr: "0.000",
          cashHeldOmr: held.heldOmr,
          completionHours: null,
        },
      ];
    }
    return related.map((o) => ({
      driverId: d.id,
      driverName: profileMap.get(d.profile_id) || "—",
      assigned: true as boolean,
      completed: o.status === "delivered",
      failedPickup: o.status === "cancelled" || o.status === "failed",
      commissionOmr: normalizeOmr(String(o.driver_commission_omr ?? "0")),
      cashHeldOmr: held.heldOmr,
      completionHours:
        o.picked_up_at && o.delivered_at
          ? (new Date(String(o.delivered_at)).getTime() -
              new Date(String(o.picked_up_at)).getTime()) /
            3600_000
          : null,
    }));
  });

  const driverPerf = buildDriverPerformance(driverPerfInputs);

  return csvResponse(
    `ghasilak-drivers-${preset}.csv`,
    toCsvUtf8(
      [
        "driver_id",
        "driver_name",
        "assigned",
        "completed",
        "failed_pickups",
        "commission_omr",
        "cash_held_omr",
        "avg_completion_hours",
      ],
      driverPerf.map((d) => [
        d.driverId,
        d.driverName,
        d.assigned,
        d.completed,
        d.failedPickups,
        d.commissionOmr,
        d.cashHeldOmr,
        d.avgCompletionHours,
      ]),
    ),
  );
}
