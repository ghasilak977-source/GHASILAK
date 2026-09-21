import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminStatCard,
  AdminTable,
} from "@/components/admin/admin-shell";
import { AdminSignOutButton } from "@/components/admin/admin-sign-out";
import { LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import {
  getAdminDashboardStats,
  getLateOrders,
  getRecentOrders,
  getStuckOrders,
} from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";
import { formatOmr } from "@/lib/money/omr";
import { statusLabel } from "@/lib/orders/status";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.dashboard };
}

export default async function AdminDashboardPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.dashboard}>
        <AdminEmpty text={dict.admin.connectDb} />
        <LinkButton href={`/${locale}/admin/login`} className="mt-4">
          {dict.common.login}
        </LinkButton>
      </AdminShell>
    );
  }

  const [stats, recent, late, stuck] = await Promise.all([
    getAdminDashboardStats(),
    getRecentOrders(8),
    getLateOrders(6),
    getStuckOrders(6),
  ]);

  const supabase = await createClient();
  const [{ count: openComplaints }, { data: unpaidDriver }, { data: unpaidLaundry }] =
    await Promise.all([
      supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]),
      supabase
        .from("driver_settlements")
        .select("id, settlement_number, net_amount_omr, status")
        .in("status", ["draft", "pending", "approved"])
        .limit(5),
      supabase
        .from("laundry_settlements")
        .select("id, settlement_number, net_amount_omr, status")
        .in("status", ["draft", "pending", "approved"])
        .limit(5),
    ]);

  const tiles = [
    { label: dict.admin.ordersToday, value: String(stats.ordersToday) },
    { label: dict.admin.activeOrders, value: String(stats.activeOrders) },
    { label: dict.admin.completedToday, value: String(stats.completedToday) },
    {
      label: dict.admin.revenueToday,
      value: formatOmr(stats.revenueTodayOmr, locale),
    },
    {
      label: dict.admin.revenueMonth,
      value: formatOmr(stats.revenueMonthOmr, locale),
    },
    {
      label: dict.admin.contribution,
      value: formatOmr(stats.contributionMonthOmr, locale),
    },
    {
      label: dict.admin.netProfitMonth,
      value: formatOmr(stats.netProfitMonthOmr, locale),
    },
    {
      label: dict.admin.laundryPayables,
      value: formatOmr(stats.laundryPayablesOmr, locale),
    },
    {
      label: dict.admin.driverPayables,
      value: formatOmr(stats.driverPayablesOmr, locale),
    },
    {
      label: dict.admin.cashHeldDrivers,
      value: formatOmr(stats.cashHeldByDriversOmr, locale),
    },
  ];

  return (
    <AdminShell
      locale={locale}
      title={dict.admin.nav.dashboard}
      subtitle={`${dict.admin.greeting} ${admin.fullName || admin.email || admin.role}`}
    >
      <div className="mb-4 flex justify-end">
        <AdminSignOutButton locale={locale} dict={dict} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <AdminStatCard key={t.label} label={t.label} value={t.value} />
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-white p-4">
          <h2 className="mb-2 font-display font-bold">{dict.admin.openComplaints}</h2>
          <p className="font-display text-3xl font-bold text-primary">
            {openComplaints ?? 0}
          </p>
          <LinkButton href={`/${locale}/admin/complaints`} variant="link" className="px-0">
            {dict.common.viewAll}
          </LinkButton>
        </div>
        <div className="rounded-2xl border border-border/70 bg-white p-4 lg:col-span-2">
          <h2 className="mb-2 font-display font-bold">{dict.admin.unpaidSettlements}</h2>
          <ul className="space-y-1 text-sm">
            {[...(unpaidDriver ?? []), ...(unpaidLaundry ?? [])].length === 0 ? (
              <li className="text-muted-foreground">{dict.admin.noRows}</li>
            ) : (
              [...(unpaidDriver ?? []), ...(unpaidLaundry ?? [])].map((s) => (
                <li key={(s as { id: string }).id} className="flex justify-between">
                  <span className="font-mono">
                    {(s as { settlement_number: string }).settlement_number}
                  </span>
                  <span>
                    {formatOmr(
                      String((s as { net_amount_omr: string }).net_amount_omr),
                      locale,
                    )}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {(
        [
          [dict.admin.recentOrders, recent],
          [dict.admin.lateOrders, late],
          [dict.admin.stuckOrders, stuck],
        ] as const
      ).map(([title, rows]) => (
        <section key={title} className="mb-6">
          <h2 className="mb-2 font-display text-lg font-bold">{title}</h2>
          {rows.length === 0 ? (
            <AdminEmpty text={dict.admin.noRows} />
          ) : (
            <AdminTable
              headers={[
                dict.admin.orderNumber,
                dict.admin.customer,
                dict.admin.status,
                dict.admin.amount,
              ]}
            >
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-border/50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/${locale}/admin/orders/${o.id}`}
                      className="font-mono text-primary hover:underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{o.customer_name || "—"}</td>
                  <td className="px-3 py-2">{statusLabel(o.status, dict)}</td>
                  <td className="px-3 py-2 font-mono">
                    {formatOmr(o.total_omr, locale)}
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}
        </section>
      ))}
    </AdminShell>
  );
}
