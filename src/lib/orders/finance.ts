import {
  addOmr,
  compareOmr,
  minOmr,
  mulOmrByInt,
  normalizeOmr,
  percentOfOmr,
  percentRatio,
  subOmr,
} from "@/lib/money/omr";

/** Engine settings — always supplied from DB/business_settings, never hardcoded at call sites in UI. */
export type OrderEngineSettings = {
  default_customer_price_omr: string;
  default_laundry_cost_omr: string;
  default_driver_commission_percent: string;
  default_packaging_cost_omr: string;
  min_pieces: number;
  min_order_omr: string;
  vat_enabled: boolean;
  vat_rate: number;
};

export type OrderLineInput = {
  serviceId?: string | null;
  serviceCode: string;
  serviceNameEn: string;
  serviceNameAr: string;
  /** Effective quantity used for money (confirmed if set, else estimated). */
  quantity: number;
  unitCustomerPriceOmr: string;
  unitPartnerCostOmr: string;
  estimatedQuantity?: number;
  confirmedQuantity?: number | null;
};

export type OrderLineSnapshot = {
  serviceId: string | null;
  serviceCode: string;
  serviceNameEn: string;
  serviceNameAr: string;
  quantity: number;
  estimatedQuantity: number;
  confirmedQuantity: number | null;
  unitCustomerPriceOmr: string;
  unitPartnerCostOmr: string;
  lineCustomerTotalOmr: string;
  linePartnerTotalOmr: string;
};

export type OrderFinancialSnapshot = {
  lines: OrderLineSnapshot[];
  pieceCount: number;
  estimatedPieceCount: number;
  confirmedPieceCount: number | null;
  subtotalOmr: string;
  discountOmr: string;
  deliveryFeeOmr: string;
  vatRate: string;
  vatAmountOmr: string;
  totalOmr: string;
  laundryCostTotalOmr: string;
  driverCommissionRate: string;
  driverCommissionAmountOmr: string;
  packagingCostOmr: string;
  otherDirectCostOmr: string;
  contributionOmr: string;
  marginPercentage: string;
  meetsMinPieces: boolean;
  meetsMinAmount: boolean;
};

export type BuildSnapshotInput = {
  lines: OrderLineInput[];
  settings: OrderEngineSettings;
  discountOmr?: string;
  deliveryFeeOmr?: string;
  packagingCostOmr?: string;
  otherDirectCostOmr?: string;
  driverCommissionPercent?: string;
  /** Override VAT enable for this snapshot (defaults to settings). */
  vatEnabled?: boolean;
  vatRate?: number;
};

export function buildLineSnapshot(line: OrderLineInput): OrderLineSnapshot {
  const quantity = line.quantity;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Line quantity must be a positive integer");
  }
  const unitCustomerPriceOmr = normalizeOmr(line.unitCustomerPriceOmr);
  const unitPartnerCostOmr = normalizeOmr(line.unitPartnerCostOmr);
  return {
    serviceId: line.serviceId ?? null,
    serviceCode: line.serviceCode,
    serviceNameEn: line.serviceNameEn,
    serviceNameAr: line.serviceNameAr,
    quantity,
    estimatedQuantity: line.estimatedQuantity ?? quantity,
    confirmedQuantity: line.confirmedQuantity ?? null,
    unitCustomerPriceOmr,
    unitPartnerCostOmr,
    lineCustomerTotalOmr: mulOmrByInt(unitCustomerPriceOmr, quantity),
    linePartnerTotalOmr: mulOmrByInt(unitPartnerCostOmr, quantity),
  };
}

/**
 * Build a frozen financial snapshot for order confirm / quantity recalc.
 * All money math uses string/bigint OMR helpers — never JS floats.
 */
export function buildOrderFinancialSnapshot(
  input: BuildSnapshotInput,
): OrderFinancialSnapshot {
  const settings = input.settings;
  const lines = input.lines.map(buildLineSnapshot);
  const pieceCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const estimatedPieceCount = lines.reduce(
    (sum, l) => sum + l.estimatedQuantity,
    0,
  );
  const allConfirmed = lines.every((l) => l.confirmedQuantity != null);
  const confirmedPieceCount = allConfirmed
    ? lines.reduce((sum, l) => sum + (l.confirmedQuantity as number), 0)
    : null;

  let subtotal = "0.000";
  let laundry = "0.000";
  for (const line of lines) {
    subtotal = addOmr(subtotal, line.lineCustomerTotalOmr);
    laundry = addOmr(laundry, line.linePartnerTotalOmr);
  }

  const discount = normalizeOmr(input.discountOmr ?? "0.000");
  if (compareOmr(discount, subtotal) > 0) {
    throw new Error("Discount cannot exceed subtotal");
  }

  const delivery = normalizeOmr(input.deliveryFeeOmr ?? "0.000");
  const packaging = normalizeOmr(
    input.packagingCostOmr ?? settings.default_packaging_cost_omr,
  );
  const otherDirect = normalizeOmr(input.otherDirectCostOmr ?? "0.000");
  const driverRate = normalizeOmr(
    input.driverCommissionPercent ??
      settings.default_driver_commission_percent,
  );

  const netRevenue = subOmr(subtotal, discount);
  // Driver commission on gross piece revenue (subtotal), matching business example.
  const driverAmount = percentOfOmr(subtotal, driverRate);

  const vatEnabled = input.vatEnabled ?? settings.vat_enabled;
  const vatRateNum = input.vatRate ?? settings.vat_rate;
  const vatRate = normalizeOmr(String(vatRateNum));
  const vatBase = addOmr(netRevenue, delivery);
  const vatAmount = vatEnabled ? percentOfOmr(vatBase, vatRate) : "0.000";
  const total = addOmr(vatBase, vatAmount);

  // contribution = net revenue - laundry - driver - packaging - other
  const contribution = subOmr(
    subOmr(subOmr(subOmr(netRevenue, laundry), driverAmount), packaging),
    otherDirect,
  );
  const marginPercentage = percentRatio(contribution, netRevenue);

  return {
    lines,
    pieceCount,
    estimatedPieceCount,
    confirmedPieceCount,
    subtotalOmr: subtotal,
    discountOmr: discount,
    deliveryFeeOmr: delivery,
    vatRate: vatEnabled ? vatRate : "0.000",
    vatAmountOmr: vatAmount,
    totalOmr: total,
    laundryCostTotalOmr: laundry,
    driverCommissionRate: driverRate,
    driverCommissionAmountOmr: driverAmount,
    packagingCostOmr: packaging,
    otherDirectCostOmr: otherDirect,
    contributionOmr: contribution,
    marginPercentage,
    meetsMinPieces: pieceCount >= settings.min_pieces,
    meetsMinAmount: compareOmr(total, settings.min_order_omr) >= 0,
  };
}

export function validateOrderMinimums(
  snapshot: OrderFinancialSnapshot,
  settings: OrderEngineSettings,
): { ok: boolean; reason?: "pieces" | "amount" } {
  if (snapshot.pieceCount < settings.min_pieces) {
    return { ok: false, reason: "pieces" };
  }
  if (compareOmr(snapshot.totalOmr, settings.min_order_omr) < 0) {
    return { ok: false, reason: "amount" };
  }
  return { ok: true };
}

/**
 * Recalculate snapshot after admin confirms quantities.
 * Preserves unit price snapshots from existing lines (historical prices).
 */
export function recalculateWithConfirmedQuantities(
  existingLines: OrderLineSnapshot[],
  confirmedByItemIndex: number[],
  settings: OrderEngineSettings,
  opts?: {
    discountOmr?: string;
    deliveryFeeOmr?: string;
    packagingCostOmr?: string;
    otherDirectCostOmr?: string;
    driverCommissionPercent?: string;
    vatEnabled?: boolean;
    vatRate?: number;
  },
): OrderFinancialSnapshot {
  if (confirmedByItemIndex.length !== existingLines.length) {
    throw new Error("Confirmed quantities length must match line count");
  }
  const lines: OrderLineInput[] = existingLines.map((line, i) => ({
    serviceId: line.serviceId,
    serviceCode: line.serviceCode,
    serviceNameEn: line.serviceNameEn,
    serviceNameAr: line.serviceNameAr,
    quantity: confirmedByItemIndex[i],
    estimatedQuantity: line.estimatedQuantity,
    confirmedQuantity: confirmedByItemIndex[i],
    unitCustomerPriceOmr: line.unitCustomerPriceOmr,
    unitPartnerCostOmr: line.unitPartnerCostOmr,
  }));
  return buildOrderFinancialSnapshot({
    lines,
    settings,
    discountOmr: opts?.discountOmr,
    deliveryFeeOmr: opts?.deliveryFeeOmr,
    packagingCostOmr: opts?.packagingCostOmr,
    otherDirectCostOmr: opts?.otherDirectCostOmr,
    driverCommissionPercent: opts?.driverCommissionPercent,
    vatEnabled: opts?.vatEnabled,
    vatRate: opts?.vatRate,
  });
}

export function isOrderUnprofitable(snapshot: OrderFinancialSnapshot): boolean {
  return compareOmr(snapshot.contributionOmr, "0.000") < 0;
}

export function applyPromoDiscountCap(
  computedDiscount: string,
  maxDiscountOmr: string | null | undefined,
): string {
  if (!maxDiscountOmr) return normalizeOmr(computedDiscount);
  return minOmr(computedDiscount, maxDiscountOmr);
}
