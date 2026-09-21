import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/orders/print-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { formatOmr } from "@/lib/money/omr";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Address, Order, OrderItem, Profile } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return {
    title:
      raw === "ar"
        ? "فاتورة | غسيلك"
        : "Invoice | GHASILAK",
  };
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto max-w-3xl p-8 text-sm text-muted-foreground">
        Connect Supabase to view invoices.
      </main>
    );
  }

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("customer_orders")
    .select(
      "id, order_number, invoice_number, status, customer_id, piece_count, estimated_piece_count, subtotal_omr, discount_omr, delivery_fee_omr, vat_omr, vat_rate, total_omr, payment_method, payment_status, pickup_address_id, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  const typed = order as Order & {
    vat_rate?: string;
    invoice_number?: string | null;
    estimated_piece_count?: number;
  };

  const [{ data: items }, { data: address }, { data: customer }] =
    await Promise.all([
      supabase
        .from("customer_order_items")
        .select(
          "id, service_name_en, service_name_ar, quantity, unit_price_omr, line_total_omr",
        )
        .eq("order_id", id),
      typed.pickup_address_id
        ? supabase
            .from("addresses")
            .select(
              "id, area_name_en, area_name_ar, street, building, unit, landmark",
            )
            .eq("id", typed.pickup_address_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("customers")
        .select("id, profile_id")
        .eq("id", typed.customer_id)
        .maybeSingle(),
    ]);

  let profile: Profile | null = null;
  if (customer) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", (customer as { profile_id: string }).profile_id)
      .maybeSingle();
    profile = (profileRow as Profile | null) ?? null;
  }

  const typedAddress = address as Address | null;
  const typedItems = (items as OrderItem[]) ?? [];
  const invoiceNo =
    typed.invoice_number || typed.order_number.replace("GH-", "INV-");
  const vatEnabled = Number(typed.vat_omr) > 0;

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-foreground print:max-w-none">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/ghasilak-logo.png"
            alt="GHASILAK"
            width={72}
            height={63}
            className="h-14 w-auto"
          />
          <div>
            <p className="font-display text-xl font-bold text-primary">
              {locale === "ar" ? "غسيلك" : "GHASILAK"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "ar" ? "GHASILAK" : "غسيلك"}
            </p>
          </div>
        </div>
        <PrintButton label={locale === "ar" ? "طباعة" : "Print"} />
      </div>

      <header className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">Invoice #</p>
          <p className="font-semibold">{invoiceNo}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{dict.order.orderNumber}</p>
          <p className="font-semibold">{typed.order_number}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{dict.orders.date}</p>
          <p>
            {new Date(typed.created_at).toLocaleString(
              locale === "ar" ? "ar-OM" : "en-GB",
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Customer</p>
          <p>{profile?.full_name || profile?.phone || profile?.email || "—"}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-muted-foreground">{dict.orders.area}</p>
          <p>
            {typedAddress
              ? locale === "ar"
                ? typedAddress.area_name_ar
                : typedAddress.area_name_en
              : "—"}
          </p>
        </div>
      </header>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-start">
            <th className="py-2 font-medium">Service</th>
            <th className="py-2 font-medium">Qty</th>
            <th className="py-2 font-medium">Unit</th>
            <th className="py-2 font-medium">Line</th>
          </tr>
        </thead>
        <tbody>
          {typedItems.map((item) => (
            <tr key={item.id} className="border-b border-border/60">
              <td className="py-2">
                {locale === "ar" ? item.service_name_ar : item.service_name_en}
              </td>
              <td className="py-2 tabular-nums">{item.quantity}</td>
              <td className="py-2 tabular-nums">
                {formatOmr(String(item.unit_price_omr), locale)}
              </td>
              <td className="py-2 tabular-nums">
                {formatOmr(String(item.line_total_omr), locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-6 ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt>{dict.order.subtotal}</dt>
          <dd className="tabular-nums">
            {formatOmr(String(typed.subtotal_omr), locale)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{dict.order.discount}</dt>
          <dd className="tabular-nums">
            {formatOmr(String(typed.discount_omr), locale)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{dict.order.deliveryFee}</dt>
          <dd className="tabular-nums">
            {formatOmr(String(typed.delivery_fee_omr), locale)}
          </dd>
        </div>
        {vatEnabled ? (
          <div className="flex justify-between gap-4">
            <dt>
              {dict.order.vat}
              {typed.vat_rate ? ` (${typed.vat_rate}%)` : ""}
            </dt>
            <dd className="tabular-nums">
              {formatOmr(String(typed.vat_omr), locale)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold text-primary">
          <dt>{dict.order.total}</dt>
          <dd className="tabular-nums">
            {formatOmr(String(typed.total_omr), locale)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 pt-2">
          <dt>{dict.order.paymentTitle}</dt>
          <dd>
            {typed.payment_method ?? "—"} / {typed.payment_status}
          </dd>
        </div>
      </dl>
    </main>
  );
}
