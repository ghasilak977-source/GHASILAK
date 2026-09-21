import {
  buildCartLines,
  type CartLine,
} from "@/lib/orders/cart";
import {
  buildOrderFinancialSnapshot,
  validateOrderMinimums,
  type OrderEngineSettings,
  type OrderFinancialSnapshot,
} from "@/lib/orders/finance";
import type { CatalogService } from "@/lib/catalog/queries";
import type { BusinessSettings } from "@/lib/settings/business-settings";
import { toOrderEngineSettings } from "@/lib/orders/settings";

export function cartToFinancialSnapshot(params: {
  services: CatalogService[];
  quantities: Record<string, number>;
  settings: BusinessSettings;
  discountOmr?: string;
  deliveryFeeOmr?: string;
}): OrderFinancialSnapshot {
  const engineSettings = toOrderEngineSettings(params.settings);
  const lines = buildCartLines(params.services, params.quantities).map(
    (line: CartLine) => ({
      serviceId: line.serviceId,
      serviceCode: line.code,
      serviceNameEn: line.name_en,
      serviceNameAr: line.name_ar,
      quantity: line.quantity,
      estimatedQuantity: line.quantity,
      unitCustomerPriceOmr: line.unitPriceOmr,
      unitPartnerCostOmr: line.partnerUnitCostOmr,
    }),
  );
  return buildOrderFinancialSnapshot({
    lines,
    settings: engineSettings,
    discountOmr: params.discountOmr,
    deliveryFeeOmr: params.deliveryFeeOmr,
  });
}

export function validateCartMinimums(
  snapshot: OrderFinancialSnapshot,
  settings: BusinessSettings,
) {
  return validateOrderMinimums(snapshot, toOrderEngineSettings(settings));
}

export type { OrderEngineSettings, OrderFinancialSnapshot };
