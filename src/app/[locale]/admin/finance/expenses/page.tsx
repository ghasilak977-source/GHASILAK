import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminTable,
} from "@/components/admin/admin-shell";
import { FinanceSubnav } from "@/components/admin/finance-subnav";
import {
  ExpenseCreateForm,
  OwnerCapitalForm,
} from "@/components/admin/finance-forms";
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
  return { title: getDictionary(raw).admin.expenses };
}

export default async function FinanceExpensesPage({
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
      <AdminShell locale={locale} title={dict.admin.expenses}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("business_expenses")
    .select(
      "id, category, expense_category, description, amount_omr, status, incurred_on, receipt_path",
    )
    .order("incurred_on", { ascending: false })
    .limit(100);

  return (
    <AdminShell locale={locale} title={dict.admin.expenses}>
      <FinanceSubnav locale={locale} dict={dict} current="/expenses" />
      <OwnerCapitalForm dict={dict} />
      <ExpenseCreateForm dict={dict} />
      {(expenses ?? []).length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <AdminTable
          headers={[
            dict.admin.name,
            dict.admin.amount,
            dict.admin.status,
            dict.admin.createdAt,
          ]}
        >
          {((expenses ?? []) as Record<string, unknown>[]).map((e) => (
            <tr key={String(e.id)} className="border-b border-border/50">
              <td className="px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {String(e.expense_category || e.category)}
                </span>
                <br />
                {String(e.description)}
                {e.receipt_path ? (
                  <span className="ms-2 text-xs text-primary">receipt</span>
                ) : null}
              </td>
              <td className="px-3 py-2 font-mono">
                {formatOmr(normalizeOmr(String(e.amount_omr)), locale)}
              </td>
              <td className="px-3 py-2">{String(e.status)}</td>
              <td className="px-3 py-2 text-xs">{String(e.incurred_on)}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminShell>
  );
}
