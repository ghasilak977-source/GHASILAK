import { describe, expect, it } from "vitest";
import {
  buildOrderFinancialSnapshot,
  isOrderUnprofitable,
  recalculateWithConfirmedQuantities,
  validateOrderMinimums,
  type OrderEngineSettings,
  type OrderLineInput,
} from "@/lib/orders/finance";
import {
  promoMakesUnprofitable,
  validateAndComputePromo,
  type PromoCodeRule,
} from "@/lib/orders/promo";
import {
  assertCanonicalFlowMatchesTracking,
  expectedNextStatuses,
  validateStatusTransition,
} from "@/lib/orders/transitions";
import {
  resolvePartnerAssignment,
  suggestPartnerCodeForArea,
} from "@/lib/orders/laundry-assignment";
import { buildQuantityAuditEntry } from "@/lib/orders/quantity-audit";
import {
  buildOrderQrPayload,
  generateQrToken,
  isValidQrTokenFormat,
} from "@/lib/orders/qr";
import { normalizeOmr } from "@/lib/money/omr";
import {
  TEN_PIECE_EXAMPLE,
  projectFinanceForRole,
} from "@/lib/orders/visibility";

const settings: OrderEngineSettings = {
  default_customer_price_omr: "0.400",
  default_laundry_cost_omr: "0.200",
  default_driver_commission_percent: "15.000",
  default_packaging_cost_omr: "0.100",
  min_pieces: 8,
  min_order_omr: "3.200",
  vat_enabled: false,
  vat_rate: 5,
};

function uniformLines(qty: number): OrderLineInput[] {
  return [
    {
      serviceCode: "mixed",
      serviceNameEn: "Mixed",
      serviceNameAr: "متنوع",
      quantity: qty,
      estimatedQuantity: qty,
      unitCustomerPriceOmr: settings.default_customer_price_omr,
      unitPartnerCostOmr: settings.default_laundry_cost_omr,
    },
  ];
}

describe("order financial snapshots", () => {
  it("matches the 10-piece business example", () => {
    const snap = buildOrderFinancialSnapshot({
      lines: uniformLines(10),
      settings,
    });

    expect(snap.subtotalOmr).toBe("4.000");
    expect(snap.laundryCostTotalOmr).toBe("2.000");
    expect(snap.driverCommissionAmountOmr).toBe("0.600");
    expect(snap.packagingCostOmr).toBe("0.100");
    expect(snap.contributionOmr).toBe("1.300");
    expect(snap.marginPercentage).toBe("32.500");
    expect(snap.totalOmr).toBe("4.000");
    expect(snap.vatAmountOmr).toBe("0.000");
  });

  it("matches the 20-piece scale-up (8.000 / 4.000 / 1.200 / 0.100 → 2.700)", () => {
    const snap = buildOrderFinancialSnapshot({
      lines: uniformLines(20),
      settings,
    });

    expect(snap.subtotalOmr).toBe("8.000");
    expect(snap.laundryCostTotalOmr).toBe("4.000");
    expect(snap.driverCommissionAmountOmr).toBe("1.200");
    expect(snap.packagingCostOmr).toBe("0.100");
    expect(snap.contributionOmr).toBe("2.700");
    expect(snap.totalOmr).toBe("8.000");
  });

  it("enforces 8-piece minimum", () => {
    const under = buildOrderFinancialSnapshot({
      lines: uniformLines(7),
      settings,
    });
    expect(validateOrderMinimums(under, settings)).toEqual({
      ok: false,
      reason: "pieces",
    });

    const ok = buildOrderFinancialSnapshot({
      lines: uniformLines(8),
      settings,
    });
    expect(ok.subtotalOmr).toBe("3.200");
    expect(validateOrderMinimums(ok, settings)).toEqual({ ok: true });
  });

  it("applies discounts without float drift", () => {
    const snap = buildOrderFinancialSnapshot({
      lines: uniformLines(10),
      settings,
      discountOmr: "0.400",
    });
    expect(snap.subtotalOmr).toBe("4.000");
    expect(snap.discountOmr).toBe("0.400");
    expect(snap.totalOmr).toBe("3.600");
    // contribution on net 3.600 - 2.000 - 0.600 - 0.100
    expect(snap.contributionOmr).toBe("0.900");
  });

  it("calculates driver commission at configured percent", () => {
    const snap = buildOrderFinancialSnapshot({
      lines: uniformLines(10),
      settings,
      driverCommissionPercent: "10.000",
    });
    expect(snap.driverCommissionRate).toBe("10.000");
    expect(snap.driverCommissionAmountOmr).toBe("0.400");
  });

  it("snapshots partner laundry cost", () => {
    const snap = buildOrderFinancialSnapshot({
      lines: [
        {
          serviceCode: "dishdasha",
          serviceNameEn: "Dishdasha",
          serviceNameAr: "دشداشة",
          quantity: 5,
          unitCustomerPriceOmr: "0.400",
          unitPartnerCostOmr: "0.200",
        },
        {
          serviceCode: "abaya",
          serviceNameEn: "Abaya",
          serviceNameAr: "عباية",
          quantity: 5,
          unitCustomerPriceOmr: "0.400",
          unitPartnerCostOmr: "0.250",
        },
      ],
      settings,
    });
    expect(snap.laundryCostTotalOmr).toBe("2.250");
    expect(snap.lines[0].linePartnerTotalOmr).toBe("1.000");
    expect(snap.lines[1].linePartnerTotalOmr).toBe("1.250");
  });

  it("calculates VAT only when enabled", () => {
    const off = buildOrderFinancialSnapshot({
      lines: uniformLines(10),
      settings,
    });
    expect(off.vatAmountOmr).toBe("0.000");
    expect(off.totalOmr).toBe("4.000");

    const on = buildOrderFinancialSnapshot({
      lines: uniformLines(10),
      settings,
      vatEnabled: true,
      vatRate: 5,
    });
    // VAT on 4.000 @ 5% = 0.200
    expect(on.vatRate).toBe("5.000");
    expect(on.vatAmountOmr).toBe("0.200");
    expect(on.totalOmr).toBe("4.200");
  });

  it("recalculates finals when confirmed quantity changes", () => {
    const initial = buildOrderFinancialSnapshot({
      lines: uniformLines(10),
      settings,
    });
    expect(initial.pieceCount).toBe(10);

    const recalc = recalculateWithConfirmedQuantities(
      initial.lines,
      [12],
      settings,
      {
        packagingCostOmr: initial.packagingCostOmr,
        driverCommissionPercent: initial.driverCommissionRate,
      },
    );

    expect(recalc.pieceCount).toBe(12);
    expect(recalc.confirmedPieceCount).toBe(12);
    expect(recalc.estimatedPieceCount).toBe(10);
    expect(recalc.subtotalOmr).toBe("4.800");
    expect(recalc.laundryCostTotalOmr).toBe("2.400");
    expect(recalc.driverCommissionAmountOmr).toBe("0.720");
    // preserves historical unit prices
    expect(recalc.lines[0].unitCustomerPriceOmr).toBe("0.400");
    expect(recalc.lines[0].unitPartnerCostOmr).toBe("0.200");
  });

  it("computes margin percentage safely", () => {
    const snap = buildOrderFinancialSnapshot({
      lines: uniformLines(10),
      settings,
    });
    expect(snap.marginPercentage).toBe("32.500");
    expect(isOrderUnprofitable(snap)).toBe(false);

    const loss = buildOrderFinancialSnapshot({
      lines: uniformLines(10),
      settings,
      discountOmr: "3.500",
      packagingCostOmr: "0.100",
    });
    expect(isOrderUnprofitable(loss)).toBe(true);
  });
});

describe("promo validation", () => {
  const basePromo: PromoCodeRule = {
    id: "p1",
    code: "SAVE10",
    discountType: "percent",
    discountValue: "10.000",
    maxDiscountOmr: null,
    minOrderOmr: "3.200",
    usageLimit: 100,
    usageCount: 0,
    perCustomerLimit: 1,
    customerRedemptionCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
  };

  it("accepts a valid percent promo", () => {
    const result = validateAndComputePromo({
      promo: basePromo,
      subtotalOmr: "4.000",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.discountOmr).toBe("0.400");
  });

  it("accepts fixed promo with max cap", () => {
    const result = validateAndComputePromo({
      promo: {
        ...basePromo,
        discountType: "fixed",
        discountValue: "1.000",
        maxDiscountOmr: "0.500",
      },
      subtotalOmr: "4.000",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.discountOmr).toBe("0.500");
  });

  it("rejects expired / inactive / min-order / usage limits", () => {
    expect(
      validateAndComputePromo({
        promo: { ...basePromo, isActive: false },
        subtotalOmr: "4.000",
      }).ok,
    ).toBe(false);

    expect(
      validateAndComputePromo({
        promo: {
          ...basePromo,
          endsAt: "2020-01-01T00:00:00.000Z",
        },
        subtotalOmr: "4.000",
        now: new Date("2026-01-01"),
      }).ok,
    ).toBe(false);

    expect(
      validateAndComputePromo({
        promo: basePromo,
        subtotalOmr: "1.000",
      }).ok,
    ).toBe(false);

    expect(
      validateAndComputePromo({
        promo: { ...basePromo, usageLimit: 5, usageCount: 5 },
        subtotalOmr: "4.000",
      }).ok,
    ).toBe(false);

    expect(
      validateAndComputePromo({
        promo: {
          ...basePromo,
          perCustomerLimit: 1,
          customerRedemptionCount: 1,
        },
        subtotalOmr: "4.000",
      }).ok,
    ).toBe(false);
  });

  it("warns when promo makes order unprofitable", () => {
    expect(
      promoMakesUnprofitable({
        subtotalOmr: "4.000",
        discountOmr: "3.500",
        laundryCostTotalOmr: "2.000",
        driverCommissionPercent: "15.000",
        packagingCostOmr: "0.100",
      }),
    ).toBe(true);
  });
});

describe("status transitions", () => {
  it("allows the canonical happy path and blocks arbitrary jumps", () => {
    expect(assertCanonicalFlowMatchesTracking()).toBe(true);

    expect(
      validateStatusTransition({ from: "pending", to: "confirmed" }).ok,
    ).toBe(true);
    expect(
      validateStatusTransition({
        from: "pending",
        to: "delivered",
      }).ok,
    ).toBe(false);
    expect(
      validateStatusTransition({
        from: "washing",
        to: "ironing",
      }).ok,
    ).toBe(true);
    expect(expectedNextStatuses("confirmed")).toContain("driver_assigned");
  });

  it("allows cancel where appropriate and requires reason for admin override", () => {
    expect(
      validateStatusTransition({ from: "picked_up", to: "cancelled" }).ok,
    ).toBe(true);

    const missing = validateStatusTransition({
      from: "pending",
      to: "delivered",
      adminOverride: true,
    });
    expect(missing.ok).toBe(false);

    const ok = validateStatusTransition({
      from: "pending",
      to: "delivered",
      adminOverride: true,
      reason: "Customer VIP exception",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.requiresAudit).toBe(true);
  });
});

describe("laundry assignment", () => {
  it("suggests Ansab vs Amerat by area", () => {
    expect(suggestPartnerCodeForArea("ghala")).toBe("ANSAB");
    expect(suggestPartnerCodeForArea("al_amerat")).toBe("AMERAT");
    expect(suggestPartnerCodeForArea("unknown")).toBeNull();

    const override = resolvePartnerAssignment({
      areaCode: "ghala",
      overridePartnerCode: "AMERAT",
    });
    expect(override.partnerCode).toBe("AMERAT");
    expect(override.wasOverride).toBe(true);
    expect(override.suggestedCode).toBe("ANSAB");
  });
});

describe("quantity audit", () => {
  it("requires reason and records old/new quantities", () => {
    expect(() =>
      buildQuantityAuditEntry({
        orderId: "o1",
        oldQuantity: 10,
        newQuantity: 12,
        actorId: "admin",
        reason: "   ",
      }),
    ).toThrow(/reason/i);

    const entry = buildQuantityAuditEntry({
      orderId: "o1",
      orderItemId: "i1",
      oldQuantity: 10,
      newQuantity: 12,
      actorId: "admin",
      reason: "Customer added 2 pieces at pickup",
    });
    expect(entry.oldQuantity).toBe(10);
    expect(entry.newQuantity).toBe(12);
    expect(entry.reason).toContain("pickup");
  });
});

describe("QR tokens", () => {
  it("generates opaque secure identifiers without PII", () => {
    const token = generateQrToken();
    expect(isValidQrTokenFormat(token)).toBe(true);
    const payload = buildOrderQrPayload(token);
    expect(payload).toBe(`ghasilak:order:${token}`);
    expect(payload.includes("+968")).toBe(false);
    expect(payload.toLowerCase().includes("omr")).toBe(false);
  });
});

describe("money helpers used by engine", () => {
  it("normalizes OMR to 3 decimals", () => {
    expect(normalizeOmr("0.4")).toBe("0.400");
    expect(normalizeOmr("4")).toBe("4.000");
  });
});

describe("MVP end-to-end financial workflow (unit)", () => {
  it("10-piece cash order produces finance dashboard line items", () => {
    const snap = buildOrderFinancialSnapshot({
      lines: uniformLines(10),
      settings,
    });
    // Customer sees 4.000
    expect(snap.totalOmr).toBe("4.000");
    // After delivery finance:
    expect(snap.driverCommissionAmountOmr).toBe("0.600");
    expect(snap.laundryCostTotalOmr).toBe("2.000");
    expect(snap.packagingCostOmr).toBe("0.100");
    expect(snap.contributionOmr).toBe("1.300");
  });

  it("hides laundry/profit from customer and driver projections", () => {
    const customerView = projectFinanceForRole("customer", TEN_PIECE_EXAMPLE);
    expect(customerView).toEqual({ totalOmr: "4.000" });
    expect(customerView.laundryCostOmr).toBeUndefined();
    expect(customerView.contributionOmr).toBeUndefined();

    const driverView = projectFinanceForRole("driver", TEN_PIECE_EXAMPLE);
    expect(driverView.driverCommissionOmr).toBe("0.600");
    expect(driverView.totalOmr).toBe("4.000");
    expect(driverView.laundryCostOmr).toBeUndefined();
    expect(driverView.contributionOmr).toBeUndefined();

    const staffView = projectFinanceForRole("staff", TEN_PIECE_EXAMPLE);
    expect(staffView.laundryCostOmr).toBe("2.000");
    expect(staffView.packagingOmr).toBe("0.100");
    expect(staffView.contributionOmr).toBe("1.300");
  });
});
