import {
  compareOmr,
  mulOmrByInt,
  normalizeOmr,
  percentOfOmr,
  subOmr,
} from "@/lib/money/omr";
import { applyPromoDiscountCap } from "@/lib/orders/finance";

export type PromoDiscountType = "percent" | "fixed";

export type PromoCodeRule = {
  id: string;
  code: string;
  discountType: PromoDiscountType;
  discountValue: string;
  maxDiscountOmr: string | null;
  minOrderOmr: string;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  customerRedemptionCount?: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export type PromoValidationResult =
  | {
      ok: true;
      discountOmr: string;
      warningUnprofitable?: boolean;
    }
  | {
      ok: false;
      reason:
        | "inactive"
        | "not_started"
        | "expired"
        | "min_order"
        | "usage_limit"
        | "customer_limit"
        | "invalid";
      message: string;
    };

export function validateAndComputePromo(params: {
  promo: PromoCodeRule | null | undefined;
  subtotalOmr: string;
  now?: Date;
}): PromoValidationResult {
  const { promo } = params;
  if (!promo) {
    return { ok: false, reason: "invalid", message: "Promo code not found" };
  }
  if (!promo.isActive) {
    return { ok: false, reason: "inactive", message: "Promo code is inactive" };
  }

  const now = params.now ?? new Date();
  if (promo.startsAt && new Date(promo.startsAt) > now) {
    return {
      ok: false,
      reason: "not_started",
      message: "Promo code is not active yet",
    };
  }
  if (promo.endsAt && new Date(promo.endsAt) < now) {
    return { ok: false, reason: "expired", message: "Promo code has expired" };
  }
  if (
    promo.usageLimit != null &&
    promo.usageCount >= promo.usageLimit
  ) {
    return {
      ok: false,
      reason: "usage_limit",
      message: "Promo code usage limit reached",
    };
  }
  if (
    promo.perCustomerLimit != null &&
    (promo.customerRedemptionCount ?? 0) >= promo.perCustomerLimit
  ) {
    return {
      ok: false,
      reason: "customer_limit",
      message: "You have already used this promo code",
    };
  }

  const subtotal = normalizeOmr(params.subtotalOmr);
  if (compareOmr(subtotal, promo.minOrderOmr) < 0) {
    return {
      ok: false,
      reason: "min_order",
      message: "Order subtotal is below promo minimum",
    };
  }

  let raw: string;
  if (promo.discountType === "percent") {
    raw = percentOfOmr(subtotal, promo.discountValue);
  } else if (promo.discountType === "fixed") {
    raw = normalizeOmr(promo.discountValue);
  } else {
    return { ok: false, reason: "invalid", message: "Invalid discount type" };
  }

  // Never discount more than subtotal
  if (compareOmr(raw, subtotal) > 0) {
    raw = subtotal;
  }
  const discountOmr = applyPromoDiscountCap(raw, promo.maxDiscountOmr);

  return { ok: true, discountOmr };
}

export function estimateContributionAfterPromo(params: {
  subtotalOmr: string;
  discountOmr: string;
  laundryCostTotalOmr: string;
  driverCommissionAmountOmr: string;
  packagingCostOmr: string;
  otherDirectCostOmr?: string;
}): string {
  const net = subOmr(params.subtotalOmr, params.discountOmr);
  return subOmr(
    subOmr(
      subOmr(
        subOmr(net, params.laundryCostTotalOmr),
        params.driverCommissionAmountOmr,
      ),
      params.packagingCostOmr,
    ),
    normalizeOmr(params.otherDirectCostOmr ?? "0.000"),
  );
}

/** Admin warning helper when a promo would make contribution negative. */
export function promoMakesUnprofitable(params: {
  subtotalOmr: string;
  discountOmr: string;
  laundryCostTotalOmr: string;
  driverCommissionPercent: string;
  packagingCostOmr: string;
}): boolean {
  const driver = percentOfOmr(
    params.subtotalOmr,
    params.driverCommissionPercent,
  );
  const contribution = estimateContributionAfterPromo({
    subtotalOmr: params.subtotalOmr,
    discountOmr: params.discountOmr,
    laundryCostTotalOmr: params.laundryCostTotalOmr,
    driverCommissionAmountOmr: driver,
    packagingCostOmr: params.packagingCostOmr,
  });
  return compareOmr(contribution, "0.000") < 0;
}

/** Convenience for building a simple uniform-piece cart subtotal. */
export function piecesSubtotal(
  pieceCount: number,
  unitPriceOmr: string,
): string {
  return mulOmrByInt(normalizeOmr(unitPriceOmr), pieceCount);
}
