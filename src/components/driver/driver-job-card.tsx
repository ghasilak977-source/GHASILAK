import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AnchorButton, LinkButton } from "@/components/ui/link-button";
import { addressLine } from "@/lib/driver/session";
import {
  jobTypeForDriver,
  mapsUrl,
  whatsappCustomerUrl,
  type DriverOrderCard,
} from "@/lib/driver/types";
import type { Locale } from "@/lib/i18n/config";
import { statusLabel } from "@/lib/orders/status";
import type { Dictionary } from "@/messages/en";
import { MapPin, MessageCircle, Phone } from "lucide-react";

function jobTypeLabel(
  order: DriverOrderCard,
  driverId: string,
  dict: Dictionary,
): string {
  const kind = jobTypeForDriver(order, driverId);
  if (kind === "pickup") return dict.driver.pickup;
  if (kind === "delivery") return dict.driver.delivery;
  if (kind === "both") return dict.driver.both;
  return "—";
}

export function DriverJobCard({
  locale,
  dict,
  order,
  driverId,
  compact = false,
}: {
  locale: Locale;
  dict: Dictionary;
  order: DriverOrderCard;
  driverId: string;
  compact?: boolean;
}) {
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
  const telHref = order.customer_phone
    ? `tel:${order.customer_phone}`
    : undefined;

  return (
    <article className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{jobTypeLabel(order, driverId, dict)}</Badge>
        <Badge variant="outline">{statusLabel(order.status, dict)}</Badge>
        <span className="ms-auto font-mono text-sm font-semibold text-primary">
          {order.order_number}
        </span>
      </div>

      <h3 className="font-display text-lg font-bold text-foreground">
        {order.customer_name || "—"}
      </h3>
      {order.customer_phone ? (
        <p className="text-sm text-muted-foreground" dir="ltr">
          {order.customer_phone}
        </p>
      ) : null}

      <p className="mt-2 text-sm text-foreground">
        <span className="font-medium">{dict.driver.area}: </span>
        {area || "—"}
      </p>
      <p className="text-sm text-muted-foreground">{address || "—"}</p>
      {order.landmark ? (
        <p className="mt-1 text-sm">
          <span className="font-medium">{dict.driver.landmark}: </span>
          {order.landmark}
        </p>
      ) : null}

      {!compact ? (
        <>
          {order.scheduled_pickup_at ? (
            <p className="mt-2 text-sm">
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
            <p className="mt-2 rounded-xl bg-muted/60 p-2 text-sm">
              <span className="font-medium">
                {dict.driver.specialInstructions}:{" "}
              </span>
              {order.customer_notes}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {telHref ? (
          <AnchorButton href={telHref} variant="outline" className="h-11 gap-1">
            <Phone className="size-4" />
            <span className="sr-only sm:not-sr-only">{dict.driver.callCustomer}</span>
          </AnchorButton>
        ) : (
          <span />
        )}
        <AnchorButton
          href={waHref}
          variant="outline"
          className="h-11 gap-1"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="size-4" />
          <span className="sr-only">{dict.driver.whatsappCustomer}</span>
        </AnchorButton>
        <AnchorButton
          href={mapHref}
          variant="outline"
          className="h-11 gap-1"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MapPin className="size-4" />
          <span className="sr-only">{dict.driver.openMap}</span>
        </AnchorButton>
      </div>

      <div className="mt-3 flex gap-2">
        <LinkButton
          href={`/${locale}/driver/jobs/${order.id}`}
          className="h-12 w-full text-base"
        >
          {dict.driver.viewJob}
        </LinkButton>
      </div>

      {!compact ? null : (
        <Link
          href={`/${locale}/driver/jobs/${order.id}`}
          className="sr-only"
        >
          {order.order_number}
        </Link>
      )}
    </article>
  );
}
