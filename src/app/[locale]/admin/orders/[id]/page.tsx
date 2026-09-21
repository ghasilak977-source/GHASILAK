import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminEmpty, AdminShell } from "@/components/admin/admin-shell";
import { OrderAdminActions } from "@/components/admin/order-admin-actions";
import { AnchorButton, LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { getAdminOrderDetail } from "@/lib/admin/queries";
import { listAdminDrivers } from "@/lib/admin/lists";
import { createClient } from "@/lib/supabase/server";
import { formatOmr } from "@/lib/money/omr";
import { statusLabel } from "@/lib/orders/status";
import { mapsUrl, whatsappCustomerUrl } from "@/lib/driver/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.orders };
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { admin, configured } = await gateAdmin(locale);

  if (!configured || !admin) {
    return (
      <AdminShell locale={locale} title={dict.admin.nav.orders}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const detail = await getAdminOrderDetail(id);
  if (!detail) {
    return (
      <AdminShell locale={locale} title={dict.admin.nav.orders}>
        <AdminEmpty text={dict.admin.noRows} />
        <LinkButton href={`/${locale}/admin/orders`} className="mt-4">
          {dict.common.back}
        </LinkButton>
      </AdminShell>
    );
  }

  const { order, items, history, address, photos } = detail;
  const drivers = await listAdminDrivers();
  const supabase = await createClient();
  const { data: partners } = await supabase
    .from("laundry_partners")
    .select("id, name_en, name_ar")
    .eq("status", "active");

  const lat = address?.latitude != null ? Number(address.latitude) : null;
  const lng = address?.longitude != null ? Number(address.longitude) : null;
  const wa = whatsappCustomerUrl(
    order.customer_phone ?? null,
    `${dict.brand} ${order.order_number}`,
  );

  return (
    <AdminShell locale={locale} title={order.order_number}>
      <div className="mb-4 flex flex-wrap gap-2">
        <LinkButton href={`/${locale}/admin/orders`} variant="outline">
          {dict.common.back}
        </LinkButton>
        <AnchorButton href={wa} target="_blank" rel="noopener noreferrer">
          {dict.admin.openWhatsapp}
        </AnchorButton>
        {(lat != null || address) && (
          <AnchorButton
            href={mapsUrl({
              latitude: lat,
              longitude: lng,
              label: String(address?.street || ""),
            })}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            Map
          </AnchorButton>
        )}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-border/80 bg-white p-4 lg:col-span-2">
          <h2 className="mb-2 font-display text-lg font-bold">{dict.admin.customer}</h2>
          <p className="font-semibold">{order.customer_name || "—"}</p>
          <p className="text-sm" dir="ltr">
            {order.customer_phone || "—"}
          </p>
          <p className="mt-2 text-sm">
            {dict.admin.address}:{" "}
            {[address?.building, address?.street, address?.area_name_en]
              .filter(Boolean)
              .join(", ") || "—"}
          </p>
          <p className="text-sm">
            {dict.admin.status}: {statusLabel(order.status, dict)} ·{" "}
            {order.payment_status}
          </p>
          {order.customer_notes ? (
            <p className="mt-2 rounded-xl bg-muted/50 p-2 text-sm">
              {order.customer_notes}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border/80 bg-white p-4">
          <h2 className="mb-2 font-display text-lg font-bold">
            {dict.admin.financeSnapshot}
          </h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>{dict.admin.revenue}</dt>
              <dd className="font-mono">{formatOmr(order.subtotal_omr, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{dict.admin.discount}</dt>
              <dd className="font-mono">{formatOmr(order.discount_omr, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{dict.admin.partnerCost}</dt>
              <dd className="font-mono">
                {formatOmr(order.partner_cost_total_omr, locale)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{dict.admin.pendingCommission}</dt>
              <dd className="font-mono">
                {formatOmr(order.driver_commission_omr, locale)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Packaging</dt>
              <dd className="font-mono">
                {formatOmr(order.packaging_cost_omr, locale)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{dict.admin.contribution}</dt>
              <dd className="font-mono font-semibold text-primary">
                {formatOmr(order.contribution_omr, locale)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{dict.admin.margin}</dt>
              <dd className="font-mono">{order.margin_percentage}%</dd>
            </div>
            <div className="flex justify-between border-t pt-1">
              <dt>{dict.admin.amount}</dt>
              <dd className="font-mono font-bold">
                {formatOmr(order.total_omr, locale)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mb-6 rounded-2xl border border-border/80 bg-white p-4">
        <h2 className="mb-2 font-display text-lg font-bold">{dict.admin.items}</h2>
        <ul className="space-y-1 text-sm">
          {(items as Record<string, unknown>[]).map((it) => (
            <li key={String(it.id)} className="flex justify-between gap-2">
              <span>
                {locale === "ar" ? String(it.service_name_ar) : String(it.service_name_en)} ×{" "}
                {String(it.quantity)}
              </span>
              <span className="font-mono">
                {formatOmr(String(it.line_total_omr), locale)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          {dict.admin.pieces}: {order.piece_count}
          {order.estimated_piece_count != null
            ? ` (est. ${order.estimated_piece_count})`
            : ""}
        </p>
        {photos.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Photos: {photos.length}
          </p>
        ) : null}
      </section>

      <section className="mb-6 rounded-2xl border border-border/80 bg-white p-4">
        <h2 className="mb-2 font-display text-lg font-bold">{dict.admin.timeline}</h2>
        <ol className="space-y-2 text-sm">
          {(history as Record<string, unknown>[]).map((h) => (
            <li key={String(h.id)} className="flex gap-3">
              <span className="text-xs text-muted-foreground">
                {new Date(String(h.created_at)).toLocaleString(locale)}
              </span>
              <span>
                {String(h.from_status || "—")} → {statusLabel(String(h.to_status), dict)}
                {h.note ? ` — ${String(h.note)}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <OrderAdminActions
        dict={dict}
        orderId={order.id}
        currentStatus={order.status}
        drivers={drivers.map((d) => ({
          id: d.id,
          label: `${d.full_name} (${d.phone || "—"})`,
        }))}
        partners={((partners ?? []) as { id: string; name_en: string; name_ar: string }[]).map(
          (p) => ({
            id: p.id,
            label: locale === "ar" ? p.name_ar : p.name_en,
          }),
        )}
      />
    </AdminShell>
  );
}
