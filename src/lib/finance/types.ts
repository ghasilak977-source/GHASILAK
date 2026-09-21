import { addOmr, normalizeOmr, subOmr, compareOmr, percentOfOmr } from "@/lib/money/omr";

/** Phase 6 ledger vocabulary (maps onto DB financial_tx_type + aliases). */
export const LEDGER_TX_TYPES = [
  "customer_payment",
  "laundry_payable",
  "laundry_payment",
  "driver_commission",
  "driver_payment",
  "cash_collected",
  "cash_handover",
  "refund",
  "discount",
  "business_expense",
  "owner_contribution",
  "owner_withdrawal",
  "adjustment",
  // legacy aliases still accepted
  "order_payment",
  "expense",
  "promo_discount",
  "driver_settlement",
  "laundry_settlement",
  "other",
] as const;

export type LedgerTxType = (typeof LEDGER_TX_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "instagram_ads",
  "packaging",
  "hosting",
  "software",
  "phone",
  "refund",
  "compensation",
  "transportation",
  "registration",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const OWNER_TX_TYPES = [
  "owner_contribution",
  "owner_withdrawal",
] as const;

export function isOwnerCapitalTx(type: string): boolean {
  return (
    type === "owner_contribution" || type === "owner_withdrawal"
  );
}

export function isBusinessExpenseTx(type: string): boolean {
  return type === "business_expense" || type === "expense";
}

/** Owner withdrawals must never be classified as business expenses. */
export function assertOwnerWithdrawalNotExpense(params: {
  txType: string;
  asBusinessExpense?: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (
    params.txType === "owner_withdrawal" &&
    params.asBusinessExpense
  ) {
    return {
      ok: false,
      message:
        "Owner withdrawal is capital, not a business expense",
    };
  }
  if (
    params.asBusinessExpense &&
    isOwnerCapitalTx(params.txType)
  ) {
    return {
      ok: false,
      message: "Owner capital movements cannot be business expenses",
    };
  }
  return { ok: true };
}

export type LedgerEntryInput = {
  type: LedgerTxType;
  amountOmr: string;
  direction: "in" | "out";
  orderId?: string | null;
  customerId?: string | null;
  driverId?: string | null;
  laundryPartnerId?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  occurredAt?: string;
  reversesTxId?: string | null;
};

export function normalizeLedgerAmount(amount: string): string {
  return normalizeOmr(amount);
}

export function validateLedgerEntry(
  entry: LedgerEntryInput,
): { ok: true; amount: string } | { ok: false; message: string } {
  if (!LEDGER_TX_TYPES.includes(entry.type)) {
    return { ok: false, message: `Unknown ledger type: ${entry.type}` };
  }
  let amount: string;
  try {
    amount = normalizeOmr(entry.amountOmr);
  } catch {
    return { ok: false, message: "Invalid OMR amount" };
  }
  if (compareOmr(amount, "0.000") <= 0 && entry.type !== "adjustment") {
    return { ok: false, message: "Amount must be positive" };
  }
  const ownerCheck = assertOwnerWithdrawalNotExpense({
    txType: entry.type,
    asBusinessExpense: isBusinessExpenseTx(entry.type),
  });
  // owner_withdrawal typed correctly is fine; wrongly as expense blocked above
  if (entry.type === "owner_withdrawal" && entry.direction !== "out") {
    return { ok: false, message: "Owner withdrawal must be direction=out" };
  }
  if (entry.type === "owner_contribution" && entry.direction !== "in") {
    return { ok: false, message: "Owner contribution must be direction=in" };
  }
  void ownerCheck;
  return { ok: true, amount };
}

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "custom";

export type DateRange = { from: Date; to: Date };

export function resolveDateRange(
  preset: DateRangePreset,
  custom?: { from?: string; to?: string },
  now = new Date(),
): DateRange {
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  if (preset === "custom" && custom?.from && custom?.to) {
    return {
      from: startOfDay(new Date(custom.from)),
      to: endOfDay(new Date(custom.to)),
    };
  }

  const today = startOfDay(now);
  switch (preset) {
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: y, to: endOfDay(y) };
    }
    case "7d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfDay(now) };
    }
    case "30d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfDay(now) };
    }
    case "this_month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endOfDay(now),
      };
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case "today":
    default:
      return { from: today, to: endOfDay(now) };
  }
}

export function sumOmr(amounts: string[]): string {
  return amounts.reduce((s, a) => addOmr(s, normalizeOmr(a || "0")), "0.000");
}

export function averageOmr(amounts: string[]): string {
  if (amounts.length === 0) return "0.000";
  const total = sumOmr(amounts);
  // bigint division
  const THOUSAND = BigInt(1000);
  const [w, f = ""] = normalizeOmr(total).split(".");
  const scaled = BigInt(w) * THOUSAND + BigInt((f + "000").slice(0, 3));
  const avg = scaled / BigInt(amounts.length);
  const whole = avg / THOUSAND;
  const frac = (avg % THOUSAND).toString().padStart(3, "0");
  return `${whole}.${frac}`;
}

export { addOmr, subOmr, normalizeOmr, compareOmr, percentOfOmr };
