import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminStatCard,
  AdminTable,
} from "@/components/admin/admin-shell";
import { FinanceSubnav } from "@/components/admin/finance-subnav";
import { HandoverActions } from "@/components/admin/handover-actions";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { loadFinanceKpis, loadOwnerCapital } from "@/lib/finance/load";
import { createClient } from "@/lib/supabase/server";
import { formatOmr, normalizeOmr } from "@/lib/money/omr";
import { matchesTenPieceExample } from "@/lib/finance/kpis";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.finance };
}

export default async function AdminFinancePage({
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
      <AdminShell locale={locale} title={dict.admin.nav.finance}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const [kpis, capital] = await Promise.all([
    loadFinanceKpis(),
    loadOwnerCapital(),
  ]);

  const supabase = await createClient();
  const [{ data: handovers }, { data: sampleOrder }] = await Promise.all([
    supabase
      .from("cash_handovers")
      .select("id, driver_id, amount_omr, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("orders")
      .select(
        "order_number, subtotal_omr, partner_cost_total_omr, driver_commission_omr, packaging_cost_omr, contribution_omr, piece_count",
      )
      .eq("piece_count", 10)
      .limit(1)
      .maybeSingle(),
  ]);

  const exampleOk =
    sampleOrder &&
    matchesTenPieceExample({
      revenueOmr: String((sampleOrder as { subtotal_omr: string }).subtotal_omr),
      laundryOmr: String(
        (sampleOrder as { partner_cost_total_omr: string }).partner_cost_total_omr,
      ),
      driverOmr: String(
        (sampleOrder as { driver_commission_omr: string }).driver_commission_omr,
      ),
      packagingOmr: String(
        (sampleOrder as { packaging_cost_omr: string }).packaging_cost_omr ?? "0",
      ),
      contributionOmr: String(
        (sampleOrder as { contribution_omr: string }).contribution_omr ?? "0",
      ),
    });

  const tiles = kpis
    ? [
        [dict.admin.revenueToday, kpis.revenueTodayOmr],
        [dict.admin.revenueWeek, kpis.revenueWeekOmr],
        [dict.admin.revenueMonth, kpis.revenueMonthOmr],
        [dict.admin.grossContribution, kpis.grossContributionOmr],
        [dict.admin.netProfit, kpis.netProfitOmr],
        [dict.admin.laundryPayables, kpis.laundryPayablesOmr],
        [dict.admin.driverPayables, kpis.driverPayablesOmr],
        [dict.admin.cashHeldDrivers, kpis.cashHeldByDriversOmr],
        [dict.admin.outstandingPayments, kpis.outstandingCustomerPaymentsOmr],
        [dict.admin.refunds, kpis.refundsOmr],
        [dict.admin.discounts, kpis.discountsOmr],
        [dict.admin.marketingExpense, kpis.marketingExpenseOmr],
        [dict.admin.otherExpenses, kpis.otherBusinessExpensesOmr],
        [dict.admin.aov, kpis.averageOrderValueOmr],
        [dict.admin.avgPieces, kpis.averagePiecesPerOrder],
      ]
    : [];

  return (
    <AdminShell locale={locale} title={dict.admin.nav.finance}>
      <FinanceSubnav locale={locale} dict={dict} current="" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <AdminStatCard
            key={String(label)}
            label={String(label)}
            value={formatOmr(String(value), locale)}
          />
        ))}
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <AdminStatCard
          label={dict.admin.ownerContribution}
          value={formatOmr(capital.contributionsOmr, locale)}
        />
        <AdminStatCard
          label={dict.admin.ownerWithdrawal}
          value={formatOmr(capital.withdrawalsOmr, locale)}
        />
        <AdminStatCard
          label={dict.admin.ownerCapital}
          value={formatOmr(capital.netCapitalOmr, locale)}
        />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{dict.admin.ownerHint}</p>

      {exampleOk ? (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          10-piece snapshot check: 4.000 / 2.000 / 0.600 / 0.100 → 1.300 ✓
          {(sampleOrder as { order_number?: string })?.order_number
            ? ` (${(sampleOrder as { order_number: string }).order_number})`
            : ""}
        </p>
      ) : null}

      <h2 className="mb-2 font-display text-lg font-bold">
        {dict.admin.cashHandovers}
      </h2>
      {(handovers ?? []).length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <AdminTable
          headers={[
            dict.admin.amount,
            dict.admin.status,
            dict.admin.createdAt,
            dict.admin.actions,
          ]}
        >
          {((handovers ?? []) as {
            id: string;
            amount_omr: string;
            status: string;
            created_at: string;
          }[]).map((h) => (
            <tr key={h.id} className="border-b border-border/50">
              <td className="px-3 py-2 font-mono">
                {formatOmr(normalizeOmr(String(h.amount_omr)), locale)}
              </td>
              <td className="px-3 py-2">{h.status}</td>
              <td className="px-3 py-2 text-xs">
                {new Date(h.created_at).toLocaleString(locale)}
              </td>
              <td className="px-3 py-2">
                {h.status === "submitted" || h.status === "pending" ? (
                  <HandoverActions dict={dict} handoverId={h.id} />
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminShell>
  );
}
