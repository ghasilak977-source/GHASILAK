"use server";

import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getBusinessSettings } from "@/lib/settings/load-settings";
import { buildOrderFinancialSnapshot } from "@/lib/orders/finance";
import { validateOrderMinimums } from "@/lib/orders/finance";
import { toOrderEngineSettings } from "@/lib/orders/settings";
import { snapshotToOrderPayload } from "@/lib/orders/confirm";
import { suggestPartnerCodeForArea } from "@/lib/orders/laundry-assignment";
import { normalizeOmr } from "@/lib/money/omr";
import type { Locale } from "@/lib/i18n/config";

export type PlaceOrderInput = {
  locale: Locale;
  addressId: string;
  pickupSlotId: string | null;
  pickupDate: string;
  slotStartTime: string;
  quantities: Record<string, number>;
  paymentMethod: "cash" | "bank_transfer";
  customerNotes?: string | null;
  /** Client-visible total for mismatch detection (must match server recalc). */
  expectedTotalOmr?: string;
};

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: string; totalOmr: string }
  | { ok: false; error: string; code?: string };

/**
 * Trusted place-order path: recalculates money from catalog + settings on the server.
 * Uses service role for writes after session/customer verification so clients cannot
 * forge laundry cost, commission, contribution, or margin.
 */
export async function placeCustomerOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  if (!hasSupabaseEnv()) {
    return { ok: false, error: "supabase_not_configured", code: "config" };
  }

  const session = await getSessionUser();
  if (!session || session.role !== "customer") {
    return { ok: false, error: "unauthorized", code: "auth" };
  }

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("profile_id", session.id)
    .maybeSingle();

  const customerId = (customer as { id: string } | null)?.id;
  if (!customerId) {
    return { ok: false, error: "customer_profile_missing", code: "auth" };
  }

  const { data: address } = await supabase
    .from("addresses")
    .select("id, area_code, customer_id")
    .eq("id", input.addressId)
    .maybeSingle();

  const addr = address as {
    id: string;
    area_code: string | null;
    customer_id: string;
  } | null;

  if (!addr || addr.customer_id !== customerId) {
    return { ok: false, error: "invalid_address", code: "validation" };
  }

  const qtyEntries = Object.entries(input.quantities).filter(
    ([, q]) => typeof q === "number" && q > 0,
  );
  if (qtyEntries.length === 0) {
    return { ok: false, error: "empty_cart", code: "validation" };
  }

  const serviceIds = qtyEntries.map(([id]) => id).filter((id) => !id.startsWith("local-"));
  if (serviceIds.length === 0) {
    return { ok: false, error: "catalog_required", code: "config" };
  }

  // Load trusted catalog prices (including partner cost) server-side only.
  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select(
      "id, code, name_en, name_ar, default_customer_price_omr, default_partner_cost_omr, is_active",
    )
    .in("id", serviceIds)
    .eq("is_active", true);

  if (servicesError || !services?.length) {
    return { ok: false, error: "catalog_unavailable", code: "config" };
  }

  const serviceMap = new Map(
    (
      services as {
        id: string;
        code: string;
        name_en: string;
        name_ar: string;
        default_customer_price_omr: string;
        default_partner_cost_omr: string;
      }[]
    ).map((s) => [s.id, s]),
  );

  const settings = await getBusinessSettings();
  const engineSettings = toOrderEngineSettings(settings);

  const lines = qtyEntries.flatMap(([serviceId, quantity]) => {
    const s = serviceMap.get(serviceId);
    if (!s) return [];
    return [
      {
        serviceId: s.id,
        serviceCode: s.code,
        serviceNameEn: s.name_en,
        serviceNameAr: s.name_ar,
        quantity,
        estimatedQuantity: quantity,
        unitCustomerPriceOmr: normalizeOmr(String(s.default_customer_price_omr)),
        unitPartnerCostOmr: normalizeOmr(String(s.default_partner_cost_omr)),
      },
    ];
  });

  if (lines.length === 0) {
    return { ok: false, error: "invalid_services", code: "validation" };
  }

  const snapshot = buildOrderFinancialSnapshot({
    lines,
    settings: engineSettings,
  });

  const minimums = validateOrderMinimums(snapshot, engineSettings);
  if (!minimums.ok) {
    return {
      ok: false,
      error: minimums.reason === "pieces" ? "min_pieces" : "min_order",
      code: "validation",
    };
  }

  if (input.expectedTotalOmr) {
    try {
      if (
        normalizeOmr(input.expectedTotalOmr) !== normalizeOmr(snapshot.totalOmr)
      ) {
        return { ok: false, error: "total_mismatch", code: "validation" };
      }
    } catch {
      return { ok: false, error: "total_mismatch", code: "validation" };
    }
  }

  let partnerId: string | null = null;
  const suggested = suggestPartnerCodeForArea(addr.area_code);
  if (suggested) {
    const { data: partner } = await supabase
      .from("laundry_partners")
      .select("id")
      .eq("code", suggested)
      .maybeSingle();
    partnerId = (partner as { id: string } | null)?.id ?? null;
  }

  const scheduledPickupAt = `${input.pickupDate}T${input.slotStartTime}`;
  const { order: orderPayload, items } = snapshotToOrderPayload({
    snapshot,
    customerId,
    pickupAddressId: addr.id,
    deliveryAddressId: addr.id,
    pickupSlotId: input.pickupSlotId,
    partnerId,
    areaCode: addr.area_code,
    preferredLanguage: input.locale,
    scheduledPickupAt,
    paymentMethod: input.paymentMethod,
    customerNotes: input.customerNotes ?? null,
    createdBy: session.id,
  });

  // Privileged write after authz — bypasses client-forgeable inserts.
  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return {
      ok: false,
      error: "service_role_required",
      code: "config",
    };
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert(orderPayload as never)
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    return {
      ok: false,
      error: orderError?.message || "order_insert_failed",
      code: "db",
    };
  }

  const orderId = (order as { id: string; order_number: string }).id;
  const orderNumber = (order as { id: string; order_number: string }).order_number;

  const itemRows = items.map((item) => ({
    ...item,
    order_id: orderId,
    service_id:
      typeof item.service_id === "string" && item.service_id.startsWith("local-")
        ? null
        : item.service_id,
  }));

  const { error: itemsError } = await admin
    .from("order_items")
    .insert(itemRows as never);
  if (itemsError) {
    await admin.from("orders").delete().eq("id", orderId);
    return { ok: false, error: itemsError.message, code: "db" };
  }

  await admin.from("order_status_history").insert({
    order_id: orderId,
    from_status: null,
    to_status: "pending",
    note: "Customer placed order",
    changed_by: session.id,
  } as never);

  await admin.from("payments").insert({
    order_id: orderId,
    amount_omr: snapshot.totalOmr,
    currency_code: "OMR",
    method: input.paymentMethod,
    status: "unpaid",
  } as never);

  return {
    ok: true,
    orderId,
    orderNumber,
    totalOmr: snapshot.totalOmr,
  };
}
