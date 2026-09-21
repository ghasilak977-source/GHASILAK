import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverShell } from "@/components/driver/driver-shell";
import { DriverJobCard } from "@/components/driver/driver-job-card";
import { LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateDriver } from "@/lib/driver/gate";
import {
  getAssignedDriverOrders,
  getDriverDashboardStats,
} from "@/lib/driver/session";
import { formatOmr } from "@/lib/money/omr";
import { isActiveOrderStatus } from "@/lib/orders/status";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).driver.dashboard };
}

export default async function DriverDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { driver, configured } = await gateDriver(locale);

  if (!configured || !driver) {
    return (
      <DriverShell locale={locale} title={dict.driver.dashboard}>
        <p className="rounded-2xl border border-border/70 bg-white p-5 text-sm text-muted-foreground">
          {dict.driver.connectDb}
        </p>
        <LinkButton href={`/${locale}/driver/login`} className="mt-4 h-12 w-full">
          {dict.common.login}
        </LinkButton>
      </DriverShell>
    );
  }

  const orders = await getAssignedDriverOrders(driver.driverId);
  const stats = await getDriverDashboardStats(driver.driverId, orders);
  const active = orders.filter((o) => isActiveOrderStatus(o.status)).slice(0, 5);

  const tiles = [
    { label: dict.driver.todaysPickups, value: String(stats.todaysPickups) },
    {
      label: dict.driver.todaysDeliveries,
      value: String(stats.todaysDeliveries),
    },
    { label: dict.driver.completedJobs, value: String(stats.completedJobs) },
    {
      label: dict.driver.pendingCommission,
      value: formatOmr(stats.pendingCommissionOmr, locale),
    },
    {
      label: dict.driver.approvedCommission,
      value: formatOmr(stats.approvedCommissionOmr, locale),
    },
    {
      label: dict.driver.cashHeld,
      value: formatOmr(stats.cashHeld.heldOmr, locale),
    },
  ];

  return (
    <DriverShell locale={locale} title={dict.driver.dashboard}>
      <p className="mb-4 text-sm text-muted-foreground">
        {dict.driver.greeting},{" "}
        <span className="font-semibold text-foreground">{driver.fullName}</span>
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-border/70 bg-white p-3 shadow-sm"
          >
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className="mt-1 font-display text-xl font-bold text-primary">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{dict.driver.activeJobs}</h2>
        <LinkButton href={`/${locale}/driver/jobs`} variant="ghost" size="sm">
          {dict.common.viewAll}
        </LinkButton>
      </div>

      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-white/70 p-6 text-center text-sm text-muted-foreground">
          {dict.driver.noJobs}
        </p>
      ) : (
        <div className="space-y-3">
          {active.map((order) => (
            <DriverJobCard
              key={order.id}
              locale={locale}
              dict={dict}
              order={order}
              driverId={driver.driverId}
              compact
            />
          ))}
        </div>
      )}
    </DriverShell>
  );
}
