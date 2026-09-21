import type { OrderEngineSettings } from "@/lib/orders/finance";
import type { BusinessSettings } from "@/lib/settings/business-settings";
import { normalizeOmr } from "@/lib/money/omr";

export function toOrderEngineSettings(
  settings: BusinessSettings,
): OrderEngineSettings {
  return {
    default_customer_price_omr: normalizeOmr(
      settings.default_customer_price_omr,
    ),
    default_laundry_cost_omr: normalizeOmr(settings.default_laundry_cost_omr),
    default_driver_commission_percent: normalizeOmr(
      settings.default_driver_commission_percent,
    ),
    default_packaging_cost_omr: normalizeOmr(
      settings.default_packaging_cost_omr ?? "0.100",
    ),
    min_pieces: settings.min_pieces,
    min_order_omr: normalizeOmr(settings.min_order_omr),
    vat_enabled: settings.vat_enabled,
    vat_rate: settings.vat_rate,
  };
}
