import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminStatCard,
} from "@/components/admin/admin-shell";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { getAdminDashboardStats } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";
import { addOmr, formatOmr, normalizeOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.reports };
}

export default async function AdminReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { admin, configured } = await gateAdmin(locale);
  if (!configured || !admin) {
    return (
      <AdminShell locale={locale} title={dict.admin.nav.reports}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const stats = await getAdminDashboardStats();
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: monthOrders } = await supabase
    .from("orders")
    .select("status, total_omr, contribution_omr, partner_cost_total_omr, driver_commission_omr, created_at")
    .gte("created_at", monthStart.toISOString())
    .neq("status", "cancelled");

  const byStatus = new Map<string, number>();
  let laundry = "0.000";
  let commission = "0.000";
  for (const o of (monthOrders ?? []) as Record<string, unknown>[]) {
    byStatus.set(String(o.status), (byStatus.get(String(o.status)) || 0) + 1);
    laundry = addOmr(laundry, normalizeOmr(String(o.partner_cost_total_omr ?? "0")));
    commission = addOmr(
      commission,
      normalizeOmr(String(o.driver_commission_omr ?? "0")),
    );
  }

  return (
    <AdminShell locale={locale} title={dict.admin.nav.reports}>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard
          label={dict.admin.revenueMonth}
          value={formatOmr(stats.revenueMonthOmr, locale)}
        />
        <AdminStatCard
          label={dict.admin.contribution}
          value={formatOmr(stats.contributionMonthOmr, locale)}
        />
        <AdminStatCard
          label={dict.admin.partnerCost}
          value={formatOmr(laundry, locale)}
        />
        <AdminStatCard
          label={dict.admin.pendingCommission}
          value={formatOmr(commission, locale)}
        />
      </div>

      <h2 className="mb-2 font-display font-bold">{dict.admin.status}</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[...byStatus.entries()].map(([status, count]) => (
          <li
            key={status}
            className="flex justify-between rounded-xl border bg-white px-3 py-2 text-sm"
          >
            <span>{status}</span>
            <span className="font-semibold">{count}</span>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
