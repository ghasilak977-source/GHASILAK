import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverShell } from "@/components/driver/driver-shell";
import { Badge } from "@/components/ui/badge";
import { AnchorButton, LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateDriver } from "@/lib/driver/gate";
import {
  addressLine,
  getAssignedDriverOrders,
  groupOrdersForRoute,
} from "@/lib/driver/session";
import { mapsUrl } from "@/lib/driver/types";
import { MapPin } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).driver.routesTitle };
}

export default async function DriverRoutesPage({
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
      <DriverShell locale={locale} title={dict.driver.routesTitle}>
        <p className="text-sm text-muted-foreground">{dict.driver.connectDb}</p>
      </DriverShell>
    );
  }

  const orders = await getAssignedDriverOrders(driver.driverId);
  const groups = groupOrdersForRoute(orders, driver.driverId, locale);

  return (
    <DriverShell locale={locale} title={dict.driver.routesTitle}>
      <p className="mb-4 text-sm text-muted-foreground">{dict.driver.routesHint}</p>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-white/70 p-6 text-center text-sm text-muted-foreground">
          {dict.driver.noJobs}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group, gi) => (
            <section key={group.key} className="space-y-2">
              <h2 className="font-display text-lg font-bold text-primary">
                {gi + 1}. {group.areaLabel}
              </h2>
              <ol className="space-y-2">
                {group.jobs.map((job, ji) => {
                  const address = addressLine(job.order, locale);
                  const slot =
                    job.kind === "pickup"
                      ? job.order.scheduled_pickup_at
                      : job.order.scheduled_delivery_at;
                  return (
                    <li
                      key={`${job.order.id}-${job.kind}`}
                      className="rounded-2xl border border-border/80 bg-white p-3 shadow-sm"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {ji + 1}
                        </span>
                        <Badge variant="secondary">
                          {job.kind === "pickup"
                            ? dict.driver.pickup
                            : dict.driver.delivery}
                        </Badge>
                        <span className="font-mono text-sm font-semibold">
                          {job.order.order_number}
                        </span>
                      </div>
                      <p className="font-medium">
                        {job.order.customer_name || "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {address || "—"}
                      </p>
                      {slot ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(slot).toLocaleString(locale)}
                        </p>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        <AnchorButton
                          href={mapsUrl({
                            latitude: job.order.latitude,
                            longitude: job.order.longitude,
                            label: address,
                          })}
                          variant="outline"
                          size="sm"
                          className="h-10 gap-1"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="size-4" />
                          {dict.driver.openMap}
                        </AnchorButton>
                        <LinkButton
                          href={`/${locale}/driver/jobs/${job.order.id}`}
                          size="sm"
                          className="h-10"
                        >
                          {dict.driver.viewJob}
                        </LinkButton>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </DriverShell>
  );
}
