import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminTable,
} from "@/components/admin/admin-shell";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { listAdminPartners } from "@/lib/admin/lists";
import { formatOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.partners };
}

export default async function AdminPartnersPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.partners}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const rows = await listAdminPartners();

  return (
    <AdminShell locale={locale} title={dict.admin.nav.partners}>
      {rows.length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <AdminTable
          headers={[
            dict.admin.name,
            dict.admin.orders,
            dict.admin.pieces,
            dict.admin.payable,
            dict.admin.paid,
            dict.admin.outstanding,
            dict.admin.turnaround,
            dict.admin.partnerCost,
            dict.admin.status,
          ]}
        >
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border/50">
              <td className="px-3 py-2 font-medium">
                {locale === "ar" ? p.name_ar : p.name_en}
                <span className="ms-2 text-xs text-muted-foreground">{p.code}</span>
              </td>
              <td className="px-3 py-2">{p.orders_count}</td>
              <td className="px-3 py-2">{p.pieces}</td>
              <td className="px-3 py-2 font-mono">
                {formatOmr(p.amount_payable_omr, locale)}
              </td>
              <td className="px-3 py-2 font-mono">{formatOmr(p.paid_omr, locale)}</td>
              <td className="px-3 py-2 font-mono">
                {formatOmr(p.outstanding_omr, locale)}
              </td>
              <td className="px-3 py-2">
                {p.avg_turnaround_hours != null ? p.avg_turnaround_hours : "—"}
              </td>
              <td className="px-3 py-2 font-mono">
                {formatOmr(p.default_cost_per_piece_omr, locale)}
              </td>
              <td className="px-3 py-2">{p.status}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminShell>
  );
}
