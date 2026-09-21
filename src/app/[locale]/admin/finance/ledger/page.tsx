import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminTable,
} from "@/components/admin/admin-shell";
import { FinanceSubnav } from "@/components/admin/finance-subnav";
import { LedgerPostForm } from "@/components/admin/finance-forms";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { createClient } from "@/lib/supabase/server";
import { formatOmr, normalizeOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.ledger };
}

export default async function FinanceLedgerPage({
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
      <AdminShell locale={locale} title={dict.admin.ledger}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("financial_transactions")
    .select(
      "id, tx_type, amount_omr, direction, reference, notes, description, occurred_at, order_id",
    )
    .order("occurred_at", { ascending: false })
    .limit(150);

  return (
    <AdminShell locale={locale} title={dict.admin.ledger}>
      <FinanceSubnav locale={locale} dict={dict} current="/ledger" />
      <LedgerPostForm dict={dict} />
      {(rows ?? []).length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <AdminTable
          headers={[
            dict.admin.createdAt,
            dict.admin.auditAction,
            dict.admin.amount,
            "dir",
            dict.admin.notes,
          ]}
        >
          {((rows ?? []) as Record<string, unknown>[]).map((r) => (
            <tr key={String(r.id)} className="border-b border-border/50">
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {new Date(String(r.occurred_at)).toLocaleString(locale)}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{String(r.tx_type)}</td>
              <td className="px-3 py-2 font-mono">
                {formatOmr(normalizeOmr(String(r.amount_omr)), locale)}
              </td>
              <td className="px-3 py-2">{String(r.direction)}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {String(r.notes || r.description || r.reference || "—")}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminShell>
  );
}
