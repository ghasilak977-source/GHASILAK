import { describe, expect, it } from "vitest";
import { buildOrderFinancialSnapshot } from "@/lib/orders/finance";
import {
  assertOwnerWithdrawalNotExpense,
  averageOmr,
  isOwnerCapitalTx,
  resolveDateRange,
  sumOmr,
  validateLedgerEntry,
} from "@/lib/finance/types";
import {
  assertNoDuplicateCommissionIds,
  canDeleteSettlement,
  canTransitionSettlement,
  computeDriverSettlementFromEligible,
  planDriverSettlement,
  planLaundrySettlement,
} from "@/lib/finance/settlements";
import {
  aggregateOwnerCapital,
  computeFinanceKpis,
  matchesTenPieceExample,
} from "@/lib/finance/kpis";
import { toCsvUtf8, buildAreaPerformance } from "@/lib/finance/reports";
import { normalizeOmr } from "@/lib/money/omr";

const settings = {
  default_customer_price_omr: "0.400",
  default_laundry_cost_omr: "0.200",
  default_driver_commission_percent: "15.000",
  default_packaging_cost_omr: "0.100",
  min_pieces: 8,
  min_order_omr: "3.200",
  vat_enabled: false,
  vat_rate: 5,
};

describe("finance example integrity", () => {
  it("10-piece order: 4.000 / 2.000 / 0.600 / 0.100 → contribution 1.300", () => {
    const snap = buildOrderFinancialSnapshot({
      lines: [
        {
          serviceCode: "mixed",
          serviceNameEn: "Mixed",
          serviceNameAr: "متنوع",
          quantity: 10,
          unitCustomerPriceOmr: "0.400",
          unitPartnerCostOmr: "0.200",
        },
      ],
      settings,
    });
    expect(
      matchesTenPieceExample({
        revenueOmr: snap.subtotalOmr,
        laundryOmr: snap.laundryCostTotalOmr,
        driverOmr: snap.driverCommissionAmountOmr,
        packagingOmr: snap.packagingCostOmr,
        contributionOmr: snap.contributionOmr,
      }),
    ).toBe(true);
  });

  it("laundry weekly settlement: 500 × 0.200 = 100.000", () => {
    const orders = Array.from({ length: 10 }, (_, i) => ({
      orderId: `ord-${i}`,
      pieceCount: 50,
    }));
    const planned = planLaundrySettlement({
      partnerId: "ansab",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
      unitCostOmr: "0.200",
      orders,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.plan.pieceCount).toBe(500);
    expect(planned.plan.grossCostOmr).toBe("100.000");
    expect(planned.plan.netAmountOmr).toBe("100.000");
  });

  it("driver weekly: eligible 250.000 × 15% = 37.500", () => {
    expect(computeDriverSettlementFromEligible("250.000", "15.000")).toBe(
      "37.500",
    );
    const planned = planDriverSettlement({
      driverId: "drv-1",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
      expectedEligibleRevenueOmr: "250.000",
      expectedRatePercent: "15.000",
      commissions: [
        {
          commissionId: "c1",
          orderId: "o1",
          baseAmountOmr: "100.000",
          commissionPercent: "15.000",
          commissionOmr: "15.000",
        },
        {
          commissionId: "c2",
          orderId: "o2",
          baseAmountOmr: "150.000",
          commissionPercent: "15.000",
          commissionOmr: "22.500",
        },
      ],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.plan.eligibleRevenueOmr).toBe("250.000");
    expect(planned.plan.grossCommissionOmr).toBe("37.500");
    expect(planned.plan.netAmountOmr).toBe("37.500");
  });
});

describe("settlement integrity", () => {
  it("rejects duplicate commission ids in one plan", () => {
    const planned = planDriverSettlement({
      driverId: "d1",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
      commissions: [
        {
          commissionId: "dup",
          orderId: "o1",
          baseAmountOmr: "10.000",
          commissionPercent: "15.000",
          commissionOmr: "1.500",
        },
        {
          commissionId: "dup",
          orderId: "o2",
          baseAmountOmr: "10.000",
          commissionPercent: "15.000",
          commissionOmr: "1.500",
        },
      ],
    });
    expect(planned.ok).toBe(false);
  });

  it("rejects orders already settled for laundry", () => {
    const planned = planLaundrySettlement({
      partnerId: "p1",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
      unitCostOmr: "0.200",
      alreadySettledOrderIds: new Set(["ord-1"]),
      orders: [{ orderId: "ord-1", pieceCount: 10 }],
    });
    expect(planned.ok).toBe(false);
  });

  it("paid settlements cannot be deleted", () => {
    expect(canDeleteSettlement("paid")).toBe(false);
    expect(canDeleteSettlement("draft")).toBe(true);
    expect(canDeleteSettlement("approved")).toBe(true);
  });

  it("blocks downgrade from paid status", () => {
    expect(canTransitionSettlement("paid", "draft").ok).toBe(false);
    expect(canTransitionSettlement("approved", "paid").ok).toBe(true);
    expect(canTransitionSettlement("draft", "approved").ok).toBe(true);
  });

  it("assertNoDuplicateCommissionIds", () => {
    expect(assertNoDuplicateCommissionIds(["a", "b"]).ok).toBe(true);
    expect(assertNoDuplicateCommissionIds(["a", "a"]).ok).toBe(false);
  });
});

describe("owner capital vs expenses", () => {
  it("owner withdrawal is capital, not business expense", () => {
    expect(isOwnerCapitalTx("owner_withdrawal")).toBe(true);
    const bad = assertOwnerWithdrawalNotExpense({
      txType: "owner_withdrawal",
      asBusinessExpense: true,
    });
    expect(bad.ok).toBe(false);

    const good = assertOwnerWithdrawalNotExpense({
      txType: "owner_withdrawal",
      asBusinessExpense: false,
    });
    expect(good.ok).toBe(true);
  });

  it("owner withdrawals do not reduce net profit as expenses", () => {
    const kpis = computeFinanceKpis({
      orders: [
        {
          total_omr: "4.000",
          contribution_omr: "1.300",
          partner_cost_total_omr: "2.000",
          driver_commission_omr: "0.600",
          discount_omr: "0.000",
          piece_count: 10,
          payment_status: "paid",
          status: "delivered",
          created_at: new Date().toISOString(),
        },
      ],
      expenses: [],
      ledger: [
        {
          tx_type: "owner_withdrawal",
          amount_omr: "5.000",
          direction: "out",
        },
      ],
      cashHeldOmr: "0.000",
      laundryPayablesOmr: "2.000",
      driverPayablesOmr: "0.600",
    });
    // Contribution intact; withdrawal ignored in expense lines
    expect(kpis.grossContributionOmr).toBe("1.300");
    expect(kpis.netProfitOmr).toBe("1.300");
    expect(kpis.otherBusinessExpensesOmr).toBe("0.000");

    const capital = aggregateOwnerCapital([
      {
        tx_type: "owner_contribution",
        amount_omr: "100.000",
        direction: "in",
      },
      {
        tx_type: "owner_withdrawal",
        amount_omr: "5.000",
        direction: "out",
      },
    ]);
    expect(capital.contributionsOmr).toBe("100.000");
    expect(capital.withdrawalsOmr).toBe("5.000");
    expect(capital.netCapitalOmr).toBe("95.000");
  });

  it("validates owner withdrawal direction", () => {
    const bad = validateLedgerEntry({
      type: "owner_withdrawal",
      amountOmr: "1.000",
      direction: "in",
    });
    expect(bad.ok).toBe(false);
    const ok = validateLedgerEntry({
      type: "owner_withdrawal",
      amountOmr: "1.000",
      direction: "out",
    });
    expect(ok.ok).toBe(true);
  });
});

describe("decimal-safe finance helpers", () => {
  it("sums and averages without float drift", () => {
    expect(sumOmr(["0.100", "0.200", "0.300"])).toBe("0.600");
    expect(averageOmr(["4.000", "4.000"])).toBe("4.000");
    expect(normalizeOmr("0.1")).toBe("0.100");
  });

  it("date presets resolve", () => {
    const now = new Date("2026-09-20T12:00:00Z");
    const today = resolveDateRange("today", undefined, now);
    expect(today.from.getDate()).toBe(20);
    const last = resolveDateRange("last_month", undefined, now);
    expect(last.from.getMonth()).toBe(7); // August (0-indexed)
  });

  it("CSV UTF-8 BOM supports Arabic headers", () => {
    const csv = toCsvUtf8(
      ["المنطقة", "الإيراد"],
      [["الأنصب", "4.000"]],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("الأنصب");
    expect(csv).toContain("4.000");
  });

  it("area performance aggregates AOV and repeat customers", () => {
    const rows = buildAreaPerformance([
      {
        areaCode: "al_ansab",
        areaName: "Al Ansab",
        customerId: "c1",
        pieces: 10,
        revenueOmr: "4.000",
        contributionOmr: "1.300",
      },
      {
        areaCode: "al_ansab",
        areaName: "Al Ansab",
        customerId: "c1",
        pieces: 8,
        revenueOmr: "3.200",
        contributionOmr: "1.000",
      },
      {
        areaCode: "al_ansab",
        areaName: "Al Ansab",
        customerId: "c2",
        pieces: 10,
        revenueOmr: "4.000",
        contributionOmr: "1.300",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].orders).toBe(3);
    expect(rows[0].pieces).toBe(28);
    expect(rows[0].revenueOmr).toBe("11.200");
    expect(rows[0].repeatCustomers).toBe(1);
  });
});
