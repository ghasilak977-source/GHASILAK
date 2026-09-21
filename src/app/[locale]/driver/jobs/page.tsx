import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverShell } from "@/components/driver/driver-shell";
import { DriverJobCard } from "@/components/driver/driver-job-card";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateDriver } from "@/lib/driver/gate";
import { getAssignedDriverOrders } from "@/lib/driver/session";
import { isActiveOrderStatus } from "@/lib/orders/status";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).driver.assignedJobs };
}

export default async function DriverJobsPage({
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
      <DriverShell locale={locale} title={dict.driver.assignedJobs}>
        <p className="text-sm text-muted-foreground">{dict.driver.connectDb}</p>
      </DriverShell>
    );
  }

  const orders = await getAssignedDriverOrders(driver.driverId);
  const active = orders.filter((o) => isActiveOrderStatus(o.status));
  const done = orders.filter((o) => !isActiveOrderStatus(o.status));

  return (
    <DriverShell locale={locale} title={dict.driver.assignedJobs}>
      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-white/70 p-6 text-center text-sm text-muted-foreground">
          {dict.driver.noJobs}
        </p>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            {active.map((order) => (
              <DriverJobCard
                key={order.id}
                locale={locale}
                dict={dict}
                order={order}
                driverId={driver.driverId}
              />
            ))}
          </section>
          {done.length > 0 ? (
            <section className="space-y-3 opacity-80">
              <h2 className="font-display text-base font-bold">
                {dict.driver.completedJobs}
              </h2>
              {done.map((order) => (
                <DriverJobCard
                  key={order.id}
                  locale={locale}
                  dict={dict}
                  order={order}
                  driverId={driver.driverId}
                  compact
                />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </DriverShell>
  );
}
