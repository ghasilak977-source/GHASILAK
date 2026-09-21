import type { OrderFinancialSnapshot } from "@/lib/orders/finance";
import { generateQrToken } from "@/lib/orders/qr";
import { suggestPartnerCodeForArea } from "@/lib/orders/laundry-assignment";

export type ConfirmOrderDbPayload = {
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  qrToken: string;
};

/**
 * Map a financial snapshot to order + item insert/update payloads.
 * Snapshots are frozen at confirm time — later catalog price changes must not rewrite these.
 */
export function snapshotToOrderPayload(params: {
  snapshot: OrderFinancialSnapshot;
  customerId: string;
  pickupAddressId: string;
  deliveryAddressId?: string | null;
  pickupSlotId?: string | null;
  zoneId?: string | null;
  partnerId?: string | null;
  areaCode?: string | null;
  preferredLanguage: "ar" | "en";
  scheduledPickupAt?: string | null;
  paymentMethod: "cash" | "bank_transfer";
  promoCodeId?: string | null;
  customerNotes?: string | null;
  createdBy?: string | null;
}): ConfirmOrderDbPayload {
  const { snapshot } = params;
  const qrToken = generateQrToken();

  // Partner suggestion is informational here; caller may override partnerId.
  void suggestPartnerCodeForArea(params.areaCode);

  const order = {
    customer_id: params.customerId,
    partner_id: params.partnerId ?? null,
    pickup_address_id: params.pickupAddressId,
    delivery_address_id: params.deliveryAddressId ?? params.pickupAddressId,
    pickup_slot_id: params.pickupSlotId ?? null,
    zone_id: params.zoneId ?? null,
    status: "pending",
    preferred_language: params.preferredLanguage,
    scheduled_pickup_at: params.scheduledPickupAt ?? null,
    piece_count: snapshot.pieceCount,
    estimated_piece_count: snapshot.estimatedPieceCount,
    confirmed_piece_count: snapshot.confirmedPieceCount,
    subtotal_omr: snapshot.subtotalOmr,
    discount_omr: snapshot.discountOmr,
    delivery_fee_omr: snapshot.deliveryFeeOmr,
    vat_rate: snapshot.vatRate,
    vat_omr: snapshot.vatAmountOmr,
    total_omr: snapshot.totalOmr,
    partner_cost_total_omr: snapshot.laundryCostTotalOmr,
    driver_commission_percent: snapshot.driverCommissionRate,
    driver_commission_omr: snapshot.driverCommissionAmountOmr,
    packaging_cost_omr: snapshot.packagingCostOmr,
    other_direct_cost_omr: snapshot.otherDirectCostOmr,
    contribution_omr: snapshot.contributionOmr,
    margin_percentage: snapshot.marginPercentage,
    currency_code: "OMR",
    promo_code_id: params.promoCodeId ?? null,
    payment_method: params.paymentMethod,
    payment_status: "unpaid",
    customer_notes: params.customerNotes ?? null,
    created_by: params.createdBy ?? null,
    qr_token: qrToken,
  };

  const items = snapshot.lines.map((line) => ({
    service_id: line.serviceId,
    service_code: line.serviceCode,
    service_name_en: line.serviceNameEn,
    service_name_ar: line.serviceNameAr,
    quantity: line.quantity,
    estimated_quantity: line.estimatedQuantity,
    confirmed_quantity: line.confirmedQuantity,
    unit_price_omr: line.unitCustomerPriceOmr,
    partner_unit_cost_omr: line.unitPartnerCostOmr,
    line_total_omr: line.lineCustomerTotalOmr,
    partner_line_cost_omr: line.linePartnerTotalOmr,
  }));

  return { order, items, qrToken };
}
