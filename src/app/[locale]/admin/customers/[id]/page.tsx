import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminEmpty, AdminShell, AdminTable } from "@/components/admin/admin-shell";
import { LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { getAdminCustomerDetail } from "@/lib/admin/lists";
import { formatOmr } from "@/lib/money/omr";
import { statusLabel } from "@/lib/orders/status";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.customers };
}

export default async function AdminCustomerDetailPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.customers}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const detail = await getAdminCustomerDetail(id);
  if (!detail) {
    return (
      <AdminShell locale={locale} title={dict.admin.nav.customers}>
        <AdminEmpty text={dict.admin.noRows} />
      </AdminShell>
    );
  }

  const profile = detail.profile as {
    full_name?: string;
    phone?: string;
    email?: string;
  } | null;

  return (
    <AdminShell locale={locale} title={profile?.full_name || dict.admin.customer}>
      <LinkButton href={`/${locale}/admin/customers`} variant="outline" className="mb-4">
        {dict.common.back}
      </LinkButton>

      <div className="mb-6 rounded-2xl border border-border/80 bg-white p-4">
        <p dir="ltr">{profile?.phone || "—"}</p>
        <p dir="ltr" className="text-sm text-muted-foreground">
          {profile?.email || "—"}
        </p>
      </div>

      <h2 className="mb-2 font-display font-bold">{dict.admin.address}</h2>
      <ul className="mb-6 space-y-2">
        {(detail.addresses as Record<string, unknown>[]).map((a) => (
          <li key={String(a.id)} className="rounded-xl border border-border/60 bg-white p-3 text-sm">
            {[a.building, a.street, a.area_name_en].filter(Boolean).join(", ")}
          </li>
        ))}
      </ul>

      <h2 className="mb-2 font-display font-bold">{dict.admin.orders}</h2>
      <AdminTable
        headers={[
          dict.admin.orderNumber,
          dict.admin.status,
          dict.admin.amount,
          dict.admin.createdAt,
        ]}
      >
        {(detail.orders as Record<string, unknown>[]).map((o) => (
          <tr key={String(o.id)} className="border-b border-border/50">
            <td className="px-3 py-2">
              <LinkButton
                href={`/${locale}/admin/orders/${String(o.id)}`}
                variant="link"
                className="h-auto px-0 font-mono"
              >
                {String(o.order_number)}
              </LinkButton>
            </td>
            <td className="px-3 py-2">{statusLabel(String(o.status), dict)}</td>
            <td className="px-3 py-2 font-mono">
              {formatOmr(String(o.total_omr), locale)}
            </td>
            <td className="px-3 py-2 text-xs">
              {new Date(String(o.created_at)).toLocaleString(locale)}
            </td>
          </tr>
        ))}
      </AdminTable>

      <h2 className="mb-2 mt-6 font-display font-bold">{dict.admin.nav.complaints}</h2>
      {(detail.complaints as unknown[]).length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <ul className="space-y-2 text-sm">
          {(detail.complaints as Record<string, unknown>[]).map((c) => (
            <li key={String(c.id)} className="rounded-xl border bg-white p-3">
              {String(c.subject)} · {String(c.status)}
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
