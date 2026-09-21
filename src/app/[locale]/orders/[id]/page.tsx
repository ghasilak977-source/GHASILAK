import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { AnchorButton, LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, t, type Locale } from "@/lib/i18n/config";
import { formatOmr } from "@/lib/money/omr";
import { formatSlotLabel, statusLabel } from "@/lib/orders/status";
import { getBusinessSettings } from "@/lib/settings/load-settings";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { buildWhatsAppUrl } from "@/lib/whatsapp/link";
import type { Address, Order, OrderItem, PickupSlot } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).tracking.title };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const settings = await getBusinessSettings();

  if (!hasSupabaseEnv()) {
    return (
      <CustomerShell locale={locale}>
        <main className="mx-auto max-w-xl px-4 py-10 text-sm text-muted-foreground">
          Connect Supabase to track orders.
        </main>
      </CustomerShell>
    );
  }

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("customer_orders")
    .select(
      "id, order_number, status, piece_count, total_omr, subtotal_omr, discount_omr, delivery_fee_omr, vat_omr, payment_method, payment_status, scheduled_pickup_at, pickup_address_id, pickup_slot_id, customer_notes, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();
  const typedOrder = order as Order;

  const [{ data: items }, { data: address }, { data: slot }] = await Promise.all([
    supabase
      .from("customer_order_items")
      .select(
        "id, service_name_en, service_name_ar, quantity, unit_price_omr, line_total_omr",
      )
      .eq("order_id", id),
    typedOrder.pickup_address_id
      ? supabase
          .from("addresses")
          .select(
            "id, area_code, area_name_en, area_name_ar, street, building, unit, landmark",
          )
          .eq("id", typedOrder.pickup_address_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    typedOrder.pickup_slot_id
      ? supabase
          .from("pickup_slots")
          .select("id, start_time, end_time, day_of_week")
          .eq("id", typedOrder.pickup_slot_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const wa = buildWhatsAppUrl(
    settings.support_whatsapp,
    t(dict.whatsapp.supportOrder, { orderNumber: typedOrder.order_number }),
  );

  const typedAddress = address as Address | null;
  const typedSlot = slot as PickupSlot | null;

  return (
    <CustomerShell locale={locale} orderNumber={typedOrder.order_number}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <div>
          <p className="text-sm text-muted-foreground">{dict.order.orderNumber}</p>
          <h1 className="font-display text-2xl font-bold text-primary">
            {typedOrder.order_number}
          </h1>
          <p className="mt-1 text-sm">
            {statusLabel(typedOrder.status, dict)}
          </p>
        </div>

        <section className="rounded-2xl border border-border/70 bg-white p-4">
          <h2 className="font-display mb-3 font-semibold">
            {dict.tracking.timeline}
          </h2>
          <OrderTimeline dict={dict} status={typedOrder.status} />
        </section>

        <section className="space-y-2 rounded-2xl border border-border/70 bg-white p-4 text-sm">
          <p>
            <span className="text-muted-foreground">{dict.orders.area}: </span>
            {typedAddress
              ? locale === "ar"
                ? typedAddress.area_name_ar
                : typedAddress.area_name_en
              : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">{dict.order.stepPickup}: </span>
            {typedOrder.scheduled_pickup_at
              ? new Date(typedOrder.scheduled_pickup_at).toLocaleString(
                  locale === "ar" ? "ar-OM" : "en-GB",
                )
              : "—"}
            {typedSlot
              ? ` · ${formatSlotLabel(typedSlot.start_time, typedSlot.end_time)}`
              : ""}
          </p>
          <p>
            <span className="text-muted-foreground">{dict.orders.pieces}: </span>
            {typedOrder.piece_count}
          </p>
          <p>
            <span className="text-muted-foreground">{dict.orders.amount}: </span>
            <span className="tabular-nums">
              {formatOmr(String(typedOrder.total_omr), locale)}
            </span>
          </p>
          <ul className="mt-3 space-y-1 border-t border-border/60 pt-3">
            {((items as OrderItem[]) ?? []).map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span>
                  {locale === "ar" ? item.service_name_ar : item.service_name_en}{" "}
                  × {item.quantity}
                </span>
                <span className="tabular-nums">
                  {formatOmr(String(item.line_total_omr), locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-2">
          <AnchorButton href={wa} target="_blank" rel="noopener noreferrer">
            {dict.common.whatsapp}
          </AnchorButton>
          <LinkButton href={`/${locale}/orders/${id}/invoice`} variant="outline">
            {locale === "ar" ? "الفاتورة" : "Invoice"}
          </LinkButton>
          <LinkButton href={`/${locale}/orders`} variant="outline">
            {dict.nav.myOrders}
          </LinkButton>
        </div>
      </main>
    </CustomerShell>
  );
}
