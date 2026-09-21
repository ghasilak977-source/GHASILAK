import { computeCashHeld, type CashHeldBreakdown } from "@/lib/driver/types";
import {
  averageOmr,
  normalizeOmr,
  resolveDateRange,
  sumOmr,
} from "@/lib/finance/types";
import { addOmr, subOmr } from "@/lib/money/omr";

export type FinanceKpis = {
  revenueTodayOmr: string;
  revenueWeekOmr: string;
  revenueMonthOmr: string;
  grossContributionOmr: string;
  netProfitOmr: string;
  laundryPayablesOmr: string;
  driverPayablesOmr: string;
  cashHeldByDriversOmr: string;
  outstandingCustomerPaymentsOmr: string;
  refundsOmr: string;
  discountsOmr: string;
  marketingExpenseOmr: string;
  otherBusinessExpensesOmr: string;
  averageOrderValueOmr: string;
  averagePiecesPerOrder: string;
};

export type OrderFinanceRow = {
  total_omr: string;
  contribution_omr: string;
  partner_cost_total_omr: string;
  driver_commission_omr: string;
  discount_omr: string;
  piece_count: number;
  payment_status: string;
  status: string;
  created_at: string;
};

export type ExpenseRow = {
  expense_category?: string;
  category?: string;
  amount_omr: string;
  status: string;
};

export type LedgerRow = {
  tx_type: string;
  amount_omr: string;
  direction: "in" | "out";
};

/**
 * Aggregate finance KPIs from already-fetched rows (testable, decimal-safe).
 * Net profit ≈ gross contribution − marketing − other business expenses
 * (owner withdrawals excluded).
 */
export function computeFinanceKpis(params: {
  orders: OrderFinanceRow[];
  expenses: ExpenseRow[];
  ledger?: LedgerRow[];
  cashHeldOmr: string;
  laundryPayablesOmr: string;
  driverPayablesOmr: string;
  now?: Date;
}): FinanceKpis {
  const now = params.now ?? new Date();
  const today = resolveDateRange("today", undefined, now);
  const week = resolveDateRange("7d", undefined, now);
  const month = resolveDateRange("this_month", undefined, now);

  const active = params.orders.filter((o) => o.status !== "cancelled");

  const inRange = (iso: string, from: Date, to: Date) => {
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };

  const rev = (rows: OrderFinanceRow[]) =>
    sumOmr(rows.map((o) => o.total_omr));

  const todayOrders = active.filter((o) =>
    inRange(o.created_at, today.from, today.to),
  );
  const weekOrders = active.filter((o) =>
    inRange(o.created_at, week.from, week.to),
  );
  const monthOrders = active.filter((o) =>
    inRange(o.created_at, month.from, month.to),
  );

  const grossContributionOmr = sumOmr(
    monthOrders.map((o) => o.contribution_omr),
  );

  const approvedExpenses = params.expenses.filter(
    (e) => e.status === "approved" || e.status === "paid",
  );
  const marketingExpenseOmr = sumOmr(
    approvedExpenses
      .filter(
        (e) =>
          (e.expense_category || e.category || "") === "instagram_ads" ||
          (e.category || "").toLowerCase().includes("instagram"),
      )
      .map((e) => e.amount_omr),
  );
  const otherBusinessExpensesOmr = sumOmr(
    approvedExpenses
      .filter(
        (e) =>
          (e.expense_category || e.category || "") !== "instagram_ads" &&
          !(e.category || "").toLowerCase().includes("instagram"),
      )
      .map((e) => e.amount_omr),
  );

  // Owner withdrawals from ledger must NOT reduce net profit as expense
  const ledgerRefunds = sumOmr(
    (params.ledger ?? [])
      .filter((t) => t.tx_type === "refund")
      .map((t) => t.amount_omr),
  );

  const discountsOmr = sumOmr(monthOrders.map((o) => o.discount_omr));
  const outstandingCustomerPaymentsOmr = sumOmr(
    active
      .filter(
        (o) =>
          o.payment_status === "pending" ||
          o.payment_status === "unpaid" ||
          o.payment_status === "awaiting",
      )
      .map((o) => o.total_omr),
  );

  const netProfitOmr = subOmr(
    subOmr(grossContributionOmr, marketingExpenseOmr),
    otherBusinessExpensesOmr,
  );

  const avgPieces =
    monthOrders.length === 0
      ? "0.000"
      : normalizeOmr(
          (
            monthOrders.reduce((s, o) => s + o.piece_count, 0) /
            monthOrders.length
          ).toFixed(3),
        );

  // Prefer bigint avg for AOV
  const aov = averageOmr(monthOrders.map((o) => o.total_omr));

  return {
    revenueTodayOmr: rev(todayOrders),
    revenueWeekOmr: rev(weekOrders),
    revenueMonthOmr: rev(monthOrders),
    grossContributionOmr,
    netProfitOmr,
    laundryPayablesOmr: normalizeOmr(params.laundryPayablesOmr),
    driverPayablesOmr: normalizeOmr(params.driverPayablesOmr),
    cashHeldByDriversOmr: normalizeOmr(params.cashHeldOmr),
    outstandingCustomerPaymentsOmr,
    refundsOmr: ledgerRefunds,
    discountsOmr,
    marketingExpenseOmr,
    otherBusinessExpensesOmr,
    averageOrderValueOmr: aov,
    averagePiecesPerOrder: avgPieces,
  };
}

/** Verify dashboard numbers match the canonical 10-piece order example. */
export function matchesTenPieceExample(detail: {
  revenueOmr: string;
  laundryOmr: string;
  driverOmr: string;
  packagingOmr: string;
  contributionOmr: string;
}): boolean {
  return (
    normalizeOmr(detail.revenueOmr) === "4.000" &&
    normalizeOmr(detail.laundryOmr) === "2.000" &&
    normalizeOmr(detail.driverOmr) === "0.600" &&
    normalizeOmr(detail.packagingOmr) === "0.100" &&
    normalizeOmr(detail.contributionOmr) === "1.300"
  );
}

export function cashHeldForDriver(
  collected: string[],
  confirmedHandovers: string[],
): CashHeldBreakdown {
  return computeCashHeld(collected, confirmedHandovers);
}

export function aggregateOwnerCapital(ledger: LedgerRow[]): {
  contributionsOmr: string;
  withdrawalsOmr: string;
  netCapitalOmr: string;
} {
  const contributionsOmr = sumOmr(
    ledger
      .filter((t) => t.tx_type === "owner_contribution")
      .map((t) => t.amount_omr),
  );
  const withdrawalsOmr = sumOmr(
    ledger
      .filter((t) => t.tx_type === "owner_withdrawal")
      .map((t) => t.amount_omr),
  );
  return {
    contributionsOmr,
    withdrawalsOmr,
    netCapitalOmr: subOmr(contributionsOmr, withdrawalsOmr),
  };
}

export { addOmr };
