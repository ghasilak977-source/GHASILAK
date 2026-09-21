import {
  addOmr,
  mulOmrByInt,
  normalizeOmr,
  percentOfOmr,
  subOmr,
} from "@/lib/money/omr";
import type { BusinessSettings } from "@/lib/settings/business-settings";
import type { CatalogService } from "@/lib/catalog/queries";

export type CartLine = {
  serviceId: string;
  code: string;
  name_en: string;
  name_ar: string;
  quantity: number;
  unitPriceOmr: string;
  partnerUnitCostOmr: string;
};

export function buildCartLines(
  services: CatalogService[],
  quantities: Record<string, number>,
): CartLine[] {
  return services
    .map((service) => {
      const quantity = quantities[service.id] ?? 0;
      if (quantity <= 0) return null;
      return {
        serviceId: service.id,
        code: service.code,
        name_en: service.name_en,
        name_ar: service.name_ar,
        quantity,
        unitPriceOmr: normalizeOmr(service.default_customer_price_omr),
        // Partner cost is never trusted from the client catalog — server place-order recalculates.
        partnerUnitCostOmr: normalizeOmr(
          service.default_partner_cost_omr ?? "0.000",
        ),
      } satisfies CartLine;
    })
    .filter(Boolean) as CartLine[];
}

function compareOmr(a: string, b: string): number {
  const left = normalizeOmr(a);
  const right = normalizeOmr(b);
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

export function summarizeCart(
  lines: CartLine[],
  settings: BusinessSettings,
  discountOmr = "0.000",
  deliveryFeeOmr = "0.000",
) {
  const pieceCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  let subtotal = "0.000";
  let partnerCost = "0.000";

  for (const line of lines) {
    subtotal = addOmr(subtotal, mulOmrByInt(line.unitPriceOmr, line.quantity));
    partnerCost = addOmr(
      partnerCost,
      mulOmrByInt(line.partnerUnitCostOmr, line.quantity),
    );
  }

  const discount = normalizeOmr(discountOmr);
  const delivery = normalizeOmr(deliveryFeeOmr);
  const netBeforeVat = subOmr(subtotal, discount);
  const vat = settings.vat_enabled
    ? percentOfOmr(netBeforeVat, normalizeOmr(String(settings.vat_rate)))
    : "0.000";
  const total = addOmr(addOmr(netBeforeVat, delivery), vat);

  return {
    pieceCount,
    subtotalOmr: subtotal,
    discountOmr: discount,
    deliveryFeeOmr: delivery,
    vatOmr: vat,
    totalOmr: total,
    partnerCostTotalOmr: partnerCost,
    meetsMinPieces: pieceCount >= settings.min_pieces,
    meetsMinAmount: compareOmr(total, settings.min_order_omr) >= 0,
  };
}

export function validateMinimum(
  pieceCount: number,
  totalOmr: string,
  settings: BusinessSettings,
): { ok: boolean; reason?: "pieces" | "amount" } {
  if (pieceCount < settings.min_pieces) {
    return { ok: false, reason: "pieces" };
  }
  if (compareOmr(totalOmr, settings.min_order_omr) < 0) {
    return { ok: false, reason: "amount" };
  }
  return { ok: true };
}

export function lineTotals(line: CartLine) {
  return {
    lineTotalOmr: mulOmrByInt(line.unitPriceOmr, line.quantity),
    partnerLineCostOmr: mulOmrByInt(line.partnerUnitCostOmr, line.quantity),
  };
}
