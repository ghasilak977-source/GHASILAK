import {
  buildOrderFinancialSnapshot,
  recalculateWithConfirmedQuantities,
  type OrderEngineSettings,
  type OrderLineSnapshot,
} from "@/lib/orders/finance";
import { buildQuantityAuditEntry } from "@/lib/orders/quantity-audit";

export function planConfirmedQuantityRecalc(params: {
  orderId: string;
  actorId: string | null;
  reason: string;
  existingLines: OrderLineSnapshot[];
  confirmedQuantities: number[];
  settings: OrderEngineSettings;
  discountOmr?: string;
  deliveryFeeOmr?: string;
  packagingCostOmr?: string;
  otherDirectCostOmr?: string;
  driverCommissionPercent?: string;
  vatEnabled?: boolean;
  vatRate?: number;
}) {
  const snapshot = recalculateWithConfirmedQuantities(
    params.existingLines,
    params.confirmedQuantities,
    params.settings,
    {
      discountOmr: params.discountOmr,
      deliveryFeeOmr: params.deliveryFeeOmr,
      packagingCostOmr: params.packagingCostOmr,
      otherDirectCostOmr: params.otherDirectCostOmr,
      driverCommissionPercent: params.driverCommissionPercent,
      vatEnabled: params.vatEnabled,
      vatRate: params.vatRate,
    },
  );

  const audits = params.existingLines.map((line, index) =>
    buildQuantityAuditEntry({
      orderId: params.orderId,
      orderItemId: null,
      oldQuantity: line.quantity,
      newQuantity: params.confirmedQuantities[index],
      actorId: params.actorId,
      reason: params.reason,
    }),
  );

  return { snapshot, audits };
}

export function buildUniformPieceSnapshot(params: {
  pieces: number;
  settings: OrderEngineSettings;
  discountOmr?: string;
  vatEnabled?: boolean;
}) {
  return buildOrderFinancialSnapshot({
    lines: [
      {
        serviceCode: "mixed",
        serviceNameEn: "Mixed",
        serviceNameAr: "متنوع",
        quantity: params.pieces,
        estimatedQuantity: params.pieces,
        unitCustomerPriceOmr: params.settings.default_customer_price_omr,
        unitPartnerCostOmr: params.settings.default_laundry_cost_omr,
      },
    ],
    settings: params.settings,
    discountOmr: params.discountOmr,
    vatEnabled: params.vatEnabled,
  });
}
