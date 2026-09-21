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
import { listAdminCustomers } from "@/lib/admin/lists";
import { formatOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.customers };
}

export default async function AdminCustomersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { admin, configured } = await gateAdmin(locale);
  if (!configured || !admin) {
    return (
      <AdminShell locale={locale} title={dict.admin.nav.customers}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const rows = await listAdminCustomers();

  return (
    <AdminShell locale={locale} title={dict.admin.nav.customers}>
      {rows.length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <AdminTable
          headers={[
            dict.admin.name,
            dict.admin.phone,
            dict.admin.area,
            dict.admin.orders,
            dict.admin.pieces,
            dict.admin.totalSpend,
            dict.admin.averageOrder,
            dict.admin.lastOrder,
            dict.admin.status,
          ]}
        >
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-border/50">
              <td className="px-3 py-2">
                <Link
                  href={`/${locale}/admin/customers/${c.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {c.full_name}
                </Link>
              </td>
              <td className="px-3 py-2" dir="ltr">
                {c.phone || "—"}
              </td>
              <td className="px-3 py-2">{c.area || "—"}</td>
              <td className="px-3 py-2">{c.orders_count}</td>
              <td className="px-3 py-2">{c.pieces}</td>
              <td className="px-3 py-2 font-mono">
                {formatOmr(c.total_spend_omr, locale)}
              </td>
              <td className="px-3 py-2 font-mono">
                {formatOmr(c.average_order_omr, locale)}
              </td>
              <td className="px-3 py-2 text-xs">
                {c.last_order_at
                  ? new Date(c.last_order_at).toLocaleDateString(locale)
                  : "—"}
              </td>
              <td className="px-3 py-2">{c.status}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminShell>
  );
}
