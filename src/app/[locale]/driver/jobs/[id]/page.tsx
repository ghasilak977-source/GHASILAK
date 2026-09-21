import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverShell } from "@/components/driver/driver-shell";
import { DriverJobActions } from "@/components/driver/driver-job-actions";
import { AnchorButton, LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateDriver } from "@/lib/driver/gate";
import { addressLine, getDriverOrderCard } from "@/lib/driver/session";
import {
  jobTypeForDriver,
  mapsUrl,
  whatsappCustomerUrl,
} from "@/lib/driver/types";
import { formatOmr } from "@/lib/money/omr";
import { statusLabel } from "@/lib/orders/status";
import { MapPin, MessageCircle, Phone } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).driver.assignedJobs };
}

export default async function DriverJobDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
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

  const order = await getDriverOrderCard(driver.driverId, id);
  if (!order) {
    return (
      <DriverShell locale={locale} title={dict.driver.assignedJobs}>
        <p className="rounded-2xl border border-border bg-white p-5 text-sm">
          {dict.driver.needAssignment}
        </p>
        <LinkButton href={`/${locale}/driver/jobs`} className="mt-4">
          {dict.common.back}
        </LinkButton>
      </DriverShell>
    );
  }

  const kind = jobTypeForDriver(order, driver.driverId);
  const kindLabel =
    kind === "pickup"
      ? dict.driver.pickup
      : kind === "delivery"
        ? dict.driver.delivery
        : dict.driver.both;
  const area =
    locale === "ar"
      ? order.area_name_ar || order.area_name_en
      : order.area_name_en || order.area_name_ar;
  const address = addressLine(order, locale);
  const mapHref = mapsUrl({
    latitude: order.latitude,
    longitude: order.longitude,
    label: address || area,
  });
  const waHref = whatsappCustomerUrl(
    order.customer_phone,
    `${dict.brand} ${order.order_number}`,
  );

  return (
    <DriverShell locale={locale} title={order.order_number}>
      <div className="mb-4 space-y-2 rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{kindLabel}</Badge>
          <Badge variant="outline">{statusLabel(order.status, dict)}</Badge>
        </div>
        <h2 className="font-display text-2xl font-bold">
          {order.customer_name || "—"}
        </h2>
        {order.customer_phone ? (
          <p className="text-sm text-muted-foreground" dir="ltr">
            {order.customer_phone}
          </p>
        ) : null}
        <p className="text-sm">
          <span className="font-medium">{dict.driver.area}: </span>
          {area || "—"}
        </p>
        <p className="text-sm text-muted-foreground">{address || "—"}</p>
        {order.landmark ? (
          <p className="text-sm">
            <span className="font-medium">{dict.driver.landmark}: </span>
            {order.landmark}
          </p>
        ) : null}
        {order.scheduled_pickup_at ? (
          <p className="text-sm">
            <span className="font-medium">{dict.driver.pickupWindow}: </span>
            {new Date(order.scheduled_pickup_at).toLocaleString(locale)}
          </p>
        ) : null}
        {order.estimated_piece_count != null ? (
          <p className="text-sm">
            <span className="font-medium">{dict.driver.estimatedQty}: </span>
            {order.estimated_piece_count}
          </p>
        ) : null}
        {order.customer_notes ? (
          <p className="rounded-xl bg-muted/60 p-2 text-sm">
            <span className="font-medium">
              {dict.driver.specialInstructions}:{" "}
            </span>
            {order.customer_notes}
          </p>
        ) : null}
        {order.driver_commission_omr && order.driver_commission_omr !== "0.000" ? (
          <p className="text-sm">
            <span className="font-medium">{dict.driver.commissionAmount}: </span>
            {formatOmr(order.driver_commission_omr, locale)}
            {order.driver_commission_percent
              ? ` (${order.driver_commission_percent}%)`
              : null}
          </p>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {order.customer_phone ? (
          <AnchorButton
            href={`tel:${order.customer_phone}`}
            variant="outline"
            className="h-14 flex-col gap-1 text-xs"
          >
            <Phone className="size-5" />
            {dict.driver.callCustomer}
          </AnchorButton>
        ) : (
          <span />
        )}
        <AnchorButton
          href={waHref}
          variant="outline"
          className="h-14 flex-col gap-1 text-xs"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="size-5" />
          {dict.driver.whatsappCustomer}
        </AnchorButton>
        <AnchorButton
          href={mapHref}
          variant="outline"
          className="h-14 flex-col gap-1 text-xs"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MapPin className="size-5" />
          {dict.driver.openMap}
        </AnchorButton>
      </div>

      <DriverJobActions
        locale={locale}
        dict={dict}
        order={order}
        driverId={driver.driverId}
      />
    </DriverShell>
  );
}
