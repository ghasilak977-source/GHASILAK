import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminTable,
} from "@/components/admin/admin-shell";
import { FinanceSubnav } from "@/components/admin/finance-subnav";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { loadDriverCashHeldRows } from "@/lib/finance/load";
import { formatOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.cashHeld };
}

export default async function FinanceCashPage({
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
      <AdminShell locale={locale} title={dict.admin.cashHeld}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const rows = await loadDriverCashHeldRows();

  return (
    <AdminShell locale={locale} title={dict.admin.cashHeld}>
      <FinanceSubnav locale={locale} dict={dict} current="/cash" />
      {rows.length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <AdminTable
          headers={[
            dict.admin.driver,
            dict.admin.cashCollected,
            dict.admin.cashHandedOver,
            dict.admin.cashOutstanding,
          ]}
        >
          {rows.map((r) => (
            <tr key={r.driverId} className="border-b border-border/50">
              <td className="px-3 py-2 font-medium">{r.driverName}</td>
              <td className="px-3 py-2 font-mono">
                {formatOmr(r.collectedOmr, locale)}
              </td>
              <td className="px-3 py-2 font-mono">
                {formatOmr(r.handedOverOmr, locale)}
              </td>
              <td className="px-3 py-2 font-mono font-semibold text-primary">
                {formatOmr(r.outstandingOmr, locale)}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminShell>
  );
}
