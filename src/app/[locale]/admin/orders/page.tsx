import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminTable,
} from "@/components/admin/admin-shell";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { listAdminOrders } from "@/lib/admin/queries";
import { formatOmr } from "@/lib/money/omr";
import { statusLabel } from "@/lib/orders/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.orders };
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { admin, configured } = await gateAdmin(locale);
  const sp = await searchParams;

  if (!configured || !admin) {
    return (
      <AdminShell locale={locale} title={dict.admin.nav.orders}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const orders = await listAdminOrders({
    status: sp.status,
    orderNumber: sp.q,
    paymentStatus: sp.payment,
    dateFrom: sp.from,
    dateTo: sp.to,
    driverId: sp.driver,
    partnerId: sp.laundry,
    zoneId: sp.area,
    limit: 150,
  });

  return (
    <AdminShell locale={locale} title={dict.admin.nav.orders}>
      <form className="mb-4 grid gap-2 rounded-2xl border border-border/70 bg-white p-4 md:grid-cols-6">
        <Input name="q" placeholder={dict.admin.orderNumber} defaultValue={sp.q} />
        <Input name="status" placeholder={dict.admin.status} defaultValue={sp.status} />
        <Input name="payment" placeholder={dict.admin.payment} defaultValue={sp.payment} />
        <Input name="from" type="date" defaultValue={sp.from} />
        <Input name="to" type="date" defaultValue={sp.to} />
        <Button type="submit">{dict.admin.apply}</Button>
      </form>

      {orders.length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <AdminTable
          headers={[
            dict.admin.orderNumber,
            dict.admin.customer,
            dict.admin.area,
            dict.admin.pieces,
            dict.admin.amount,
            dict.admin.laundry,
            dict.admin.driver,
            dict.admin.status,
            dict.admin.payment,
            dict.admin.createdAt,
          ]}
        >
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30">
              <td className="px-3 py-2">
                <Link
                  href={`/${locale}/admin/orders/${o.id}`}
                  className="font-mono text-primary hover:underline"
                >
                  {o.order_number}
                </Link>
              </td>
              <td className="px-3 py-2">{o.customer_name || "—"}</td>
              <td className="px-3 py-2">
                {locale === "ar" ? o.area_name_ar || o.area_name_en : o.area_name_en || o.area_name_ar || "—"}
              </td>
              <td className="px-3 py-2">{o.piece_count}</td>
              <td className="px-3 py-2 font-mono">{formatOmr(o.total_omr, locale)}</td>
              <td className="px-3 py-2">{o.partner_name || "—"}</td>
              <td className="px-3 py-2">{o.driver_name || "—"}</td>
              <td className="px-3 py-2">{statusLabel(o.status, dict)}</td>
              <td className="px-3 py-2">{o.payment_status}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {new Date(o.created_at).toLocaleString(locale)}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminShell>
  );
}
