import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverShell } from "@/components/driver/driver-shell";
import { DriverSignOutButton } from "@/components/driver/driver-sign-out";
import { LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateDriver } from "@/lib/driver/gate";
import {
  getAssignedDriverOrders,
  getDriverCommissions,
  getDriverDashboardStats,
} from "@/lib/driver/session";
import { formatOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).driver.profileTitle };
}

export default async function DriverProfilePage({
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
      <DriverShell locale={locale} title={dict.driver.profileTitle}>
        <p className="text-sm text-muted-foreground">{dict.driver.connectDb}</p>
        <LinkButton href={`/${locale}/driver/login`} className="mt-4 h-12 w-full">
          {dict.common.login}
        </LinkButton>
      </DriverShell>
    );
  }

  const orders = await getAssignedDriverOrders(driver.driverId);
  const stats = await getDriverDashboardStats(driver.driverId, orders);
  const commissions = await getDriverCommissions(driver.driverId);
  const rate =
    commissions[0]?.commission_percent ||
    orders.find((o) => o.driver_commission_percent)?.driver_commission_percent ||
    "15.000";

  const vehicle = [driver.vehicleType, driver.vehiclePlate]
    .filter(Boolean)
    .join(" · ");

  return (
    <DriverShell locale={locale} title={dict.driver.profileTitle}>
      <div className="mb-5 rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
        <h2 className="font-display text-2xl font-bold text-primary">
          {driver.fullName || dict.driver.appName}
        </h2>
        {driver.phone ? (
          <p className="mt-1 text-sm" dir="ltr">
            <span className="text-muted-foreground">{dict.driver.phone}: </span>
            {driver.phone}
          </p>
        ) : null}
        {driver.email ? (
          <p className="text-sm" dir="ltr">
            <span className="text-muted-foreground">{dict.driver.email}: </span>
            {driver.email}
          </p>
        ) : null}
        {vehicle ? (
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">{dict.driver.vehicle}: </span>
            {vehicle}
          </p>
        ) : null}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/70 bg-white p-3">
          <p className="text-xs text-muted-foreground">
            {dict.driver.commissionRate}
          </p>
          <p className="font-display text-xl font-bold">{rate}%</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-white p-3">
          <p className="text-xs text-muted-foreground">
            {dict.driver.completedJobsCount}
          </p>
          <p className="font-display text-xl font-bold">
            {stats.completedJobs}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-white p-3">
          <p className="text-xs text-muted-foreground">
            {dict.driver.pendingCommission}
          </p>
          <p className="font-display text-lg font-bold text-primary">
            {formatOmr(stats.pendingCommissionOmr, locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-white p-3">
          <p className="text-xs text-muted-foreground">
            {dict.driver.commissionSettled}
          </p>
          <p className="font-display text-lg font-bold text-primary">
            {formatOmr(stats.settledCommissionOmr, locale)}
          </p>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <LinkButton
          href={`/${locale}/driver/commission`}
          variant="outline"
          className="h-12 w-full"
        >
          {dict.driver.commissionNav}
        </LinkButton>
        <LinkButton
          href={`/${locale}/driver/cash`}
          variant="outline"
          className="h-12 w-full"
        >
          {dict.driver.cashTitle}
        </LinkButton>
      </div>

      <DriverSignOutButton locale={locale} dict={dict} />
    </DriverShell>
  );
}
