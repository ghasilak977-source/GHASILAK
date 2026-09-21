import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminTable,
} from "@/components/admin/admin-shell";
import { FinanceSubnav } from "@/components/admin/finance-subnav";
import { LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { createClient } from "@/lib/supabase/server";
import {
  buildAreaPerformance,
  buildDriverPerformance,
  buildLaundryPerformance,
} from "@/lib/finance/reports";
import { normalizeOmr, resolveDateRange, sumOmr } from "@/lib/finance/types";
import { formatOmr } from "@/lib/money/omr";
import { cashHeldForDriver } from "@/lib/finance/kpis";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.reports };
}

export default async function FinanceReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const sp = await searchParams;
  const { admin, configured } = await gateAdmin(locale);
  if (!configured || !admin) {
    return (
      <AdminShell locale={locale} title={dict.admin.nav.reports}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const preset = (sp.range || "this_month") as
    | "today"
    | "yesterday"
    | "7d"
    | "30d"
    | "this_month"
    | "last_month"
    | "custom";
  const range = resolveDateRange(preset, { from: sp.from, to: sp.to });

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, customer_id, partner_id, pickup_driver_id, delivery_driver_id, piece_count, total_omr, contribution_omr, partner_cost_total_omr, driver_commission_omr, status, created_at, scheduled_pickup_at, picked_up_at, delivered_at, pickup_address_id, zone_id",
    )
    .gte("created_at", range.from.toISOString())
    .lte("created_at", range.to.toISOString())
    .neq("status", "cancelled")
    .limit(5000);

  const orderRows = (orders ?? []) as Record<string, unknown>[];
  const addressIds = [
    ...new Set(
      orderRows
        .map((o) => o.pickup_address_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];
  const partnerIds = [
    ...new Set(
      orderRows.map((o) => o.partner_id as string | null).filter(Boolean) as string[],
    ),
  ];

  const [{ data: addresses }, { data: partners }, { data: drivers }, { data: cashOrders }, { data: handovers }] =
    await Promise.all([
      addressIds.length
        ? supabase
            .from("addresses")
            .select("id, area_code, area_name_en, area_name_ar")
            .in("id", addressIds)
        : Promise.resolve({ data: [] }),
      partnerIds.length
        ? supabase
            .from("laundry_partners")
            .select("id, name_en, name_ar")
            .in("id", partnerIds)
        : Promise.resolve({ data: [] }),
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

  const addrMap = new Map(
    ((addresses ?? []) as {
      id: string;
      area_code: string;
      area_name_en: string;
      area_name_ar: string;
    }[]).map((a) => [a.id, a]),
  );
  const partnerMap = new Map(
    ((partners ?? []) as { id: string; name_en: string; name_ar: string }[]).map(
      (p) => [p.id, p],
    ),
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

  const driverPerf = buildDriverPerformance(
    ((drivers ?? []) as { id: string; profile_id: string }[]).flatMap((d) => {
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
      return related.map((o) => ({
        driverId: d.id,
        driverName: profileMap.get(d.profile_id) || "—",
        assigned: true,
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
    }),
  );

  const salesRevenue = sumOmr(
    orderRows.map((o) => normalizeOmr(String(o.total_omr ?? "0"))),
  );
  const salesContribution = sumOmr(
    orderRows.map((o) => normalizeOmr(String(o.contribution_omr ?? "0"))),
  );

  const qs = new URLSearchParams({
    range: preset,
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
  }).toString();

  return (
    <AdminShell locale={locale} title={dict.admin.nav.reports}>
      <FinanceSubnav locale={locale} dict={dict} current="/reports" />

      <form className="mb-4 flex flex-wrap gap-2">
        {[
          ["today", dict.admin.revenueToday],
          ["7d", dict.admin.revenueWeek],
          ["30d", "30d"],
          ["this_month", dict.admin.revenueMonth],
          ["last_month", "Last month"],
        ].map(([value, label]) => (
          <LinkButton
            key={value}
            href={`/${locale}/admin/finance/reports?range=${value}`}
            variant={preset === value ? "default" : "outline"}
            size="sm"
          >
            {label}
          </LinkButton>
        ))}
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {["sales", "profit", "areas", "laundry", "drivers"].map((kind) => (
          <LinkButton
            key={kind}
            href={`/api/admin/finance/reports?kind=${kind}&${qs}&locale=${locale}`}
            variant="outline"
            size="sm"
          >
            {dict.admin.downloadCsv} · {kind}
          </LinkButton>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-3">
          <p className="text-xs text-muted-foreground">{dict.admin.reportSales}</p>
          <p className="font-display text-xl font-bold">
            {formatOmr(salesRevenue, locale)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-3">
          <p className="text-xs text-muted-foreground">{dict.admin.reportProfit}</p>
          <p className="font-display text-xl font-bold">
            {formatOmr(salesContribution, locale)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-3">
          <p className="text-xs text-muted-foreground">{dict.admin.reportOrders}</p>
          <p className="font-display text-xl font-bold">{orderRows.length}</p>
        </div>
        <div className="rounded-2xl border bg-white p-3">
          <p className="text-xs text-muted-foreground">{dict.admin.pieces}</p>
          <p className="font-display text-xl font-bold">
            {orderRows.reduce((s, o) => s + Number(o.piece_count ?? 0), 0)}
          </p>
        </div>
      </div>

      <h2 className="mb-2 font-display font-bold">{dict.admin.reportAreas}</h2>
      <AdminTable
        headers={[
          dict.admin.area,
          dict.admin.orders,
          dict.admin.pieces,
          dict.admin.revenue,
          dict.admin.contribution,
          dict.admin.aov,
          dict.admin.reportRetention,
        ]}
      >
        {areaPerf.map((a) => (
          <tr key={a.areaCode} className="border-b border-border/50">
            <td className="px-3 py-2">{a.areaName}</td>
            <td className="px-3 py-2">{a.orders}</td>
            <td className="px-3 py-2">{a.pieces}</td>
            <td className="px-3 py-2 font-mono">
              {formatOmr(a.revenueOmr, locale)}
            </td>
            <td className="px-3 py-2 font-mono">
              {formatOmr(a.contributionOmr, locale)}
            </td>
            <td className="px-3 py-2 font-mono">{formatOmr(a.aovOmr, locale)}</td>
            <td className="px-3 py-2">{a.repeatCustomers}</td>
          </tr>
        ))}
      </AdminTable>

      <h2 className="mb-2 mt-8 font-display font-bold">
        {dict.admin.reportLaundry}
      </h2>
      <AdminTable
        headers={[
          dict.admin.name,
          dict.admin.orders,
          dict.admin.pieces,
          dict.admin.partnerCost,
          "late",
          dict.admin.turnaround,
        ]}
      >
        {laundryPerf.map((p) => (
          <tr key={p.partnerId} className="border-b border-border/50">
            <td className="px-3 py-2">{p.partnerName}</td>
            <td className="px-3 py-2">{p.orders}</td>
            <td className="px-3 py-2">{p.pieces}</td>
            <td className="px-3 py-2 font-mono">{formatOmr(p.costOmr, locale)}</td>
            <td className="px-3 py-2">{p.late}</td>
            <td className="px-3 py-2">
              {p.avgTurnaroundHours != null ? p.avgTurnaroundHours : "—"}
            </td>
          </tr>
        ))}
      </AdminTable>

      <h2 className="mb-2 mt-8 font-display font-bold">
        {dict.admin.reportDrivers}
      </h2>
      <AdminTable
        headers={[
          dict.admin.name,
          dict.admin.assignedJobs,
          dict.admin.completedJobs,
          dict.admin.pendingCommission,
          dict.admin.cashHeld,
        ]}
      >
        {driverPerf.map((d) => (
          <tr key={d.driverId} className="border-b border-border/50">
            <td className="px-3 py-2">{d.driverName}</td>
            <td className="px-3 py-2">{d.assigned}</td>
            <td className="px-3 py-2">{d.completed}</td>
            <td className="px-3 py-2 font-mono">
              {formatOmr(d.commissionOmr, locale)}
            </td>
            <td className="px-3 py-2 font-mono">
              {formatOmr(d.cashHeldOmr, locale)}
            </td>
          </tr>
        ))}
      </AdminTable>
    </AdminShell>
  );
}
