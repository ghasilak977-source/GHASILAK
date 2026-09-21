"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireDriver } from "@/lib/driver/session";
import { canDriverTransition } from "@/lib/driver/types";
import { normalizeOmr, compareOmr, subOmr } from "@/lib/money/omr";
import { isValidQrTokenFormat } from "@/lib/orders/qr";

async function assertAssigned(
  driverId: string,
  orderId: string,
): Promise<{
  id: string;
  status: string;
  pickup_driver_id: string | null;
  delivery_driver_id: string | null;
  qr_token: string | null;
  delivery_confirmation_code: string | null;
  payment_method: string | null;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, pickup_driver_id, delivery_driver_id, qr_token, delivery_confirmation_code, payment_method",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!data) return null;
  const order = data as {
    id: string;
    status: string;
    pickup_driver_id: string | null;
    delivery_driver_id: string | null;
    qr_token: string | null;
    delivery_confirmation_code: string | null;
    payment_method: string | null;
  };
  if (
    order.pickup_driver_id !== driverId &&
    order.delivery_driver_id !== driverId
  ) {
    return null;
  }
  return order;
}

export async function driverMarkOnTheWay(orderId: string) {
  const driver = await requireDriver();
  if (!driver) return { ok: false as const, error: "unauthorized" };
  const order = await assertAssigned(driver.driverId, orderId);
  if (!order) return { ok: false as const, error: "not_assigned" };
  if (!canDriverTransition(order.status, "driver_on_way")) {
    return { ok: false as const, error: "invalid_transition" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "driver_on_way" })
    .eq("id", orderId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("order_status_history").insert({
    order_id: orderId,
    from_status: order.status,
    to_status: "driver_on_way",
    changed_by: driver.profileId,
    note: "Driver marked on the way",
  });

  revalidatePath("/[locale]/driver", "layout");
  return { ok: true as const };
}

export async function driverMarkArrived(
  orderId: string,
  kind: "pickup" | "delivery",
) {
  const driver = await requireDriver();
  if (!driver) return { ok: false as const, error: "unauthorized" };
  const order = await assertAssigned(driver.driverId, orderId);
  if (!order) return { ok: false as const, error: "not_assigned" };

  const patch =
    kind === "pickup"
      ? { arrived_at_pickup_at: new Date().toISOString() }
      : { arrived_at_delivery_at: new Date().toISOString() };

  const supabase = await createClient();
  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/[locale]/driver", "layout");
  return { ok: true as const };
}

export async function driverConfirmPickup(params: {
  orderId: string;
  qrToken?: string;
  notes?: string;
  photoNote?: string;
}) {
  const driver = await requireDriver();
  if (!driver) return { ok: false as const, error: "unauthorized" };
  const order = await assertAssigned(driver.driverId, params.orderId);
  if (!order) return { ok: false as const, error: "not_assigned" };
  if (order.pickup_driver_id !== driver.driverId) {
    return { ok: false as const, error: "not_pickup_driver" };
  }
  if (!canDriverTransition(order.status, "picked_up")) {
    return { ok: false as const, error: "invalid_transition" };
  }

  if (params.qrToken && order.qr_token) {
    if (
      !isValidQrTokenFormat(params.qrToken) ||
      params.qrToken !== order.qr_token
    ) {
      return { ok: false as const, error: "invalid_qr" };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
      pickup_notes: params.notes || null,
      pickup_photo_path: params.photoNote || null,
      qr_scanned_at_pickup: params.qrToken ? new Date().toISOString() : null,
    })
    .eq("id", params.orderId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("order_status_history").insert({
    order_id: params.orderId,
    from_status: order.status,
    to_status: "picked_up",
    changed_by: driver.profileId,
    note: params.notes || "Driver confirmed pickup",
  });

  // Ensure commission row exists from order snapshot (immutable rate/amount)
  const { data: full } = await supabase
    .from("orders")
    .select("driver_commission_percent, driver_commission_omr, subtotal_omr, discount_omr")
    .eq("id", params.orderId)
    .maybeSingle();

  if (full) {
    const amount = normalizeOmr(
      String((full as { driver_commission_omr: string }).driver_commission_omr ?? "0"),
    );
    const percent = normalizeOmr(
      String(
        (full as { driver_commission_percent: string | null })
          .driver_commission_percent ?? "15",
      ),
    );
    const base = subOmr(
      normalizeOmr(String((full as { subtotal_omr: string }).subtotal_omr ?? "0")),
      normalizeOmr(String((full as { discount_omr: string }).discount_omr ?? "0")),
    );
    // Insert-only: drivers cannot update commission rows (finance owns approval).
    // Snapshot amounts come from the order; ignore conflict if already present.
    await supabase.from("driver_commissions").insert({
      order_id: params.orderId,
      driver_id: driver.driverId,
      commission_percent: percent,
      base_amount_omr: base,
      commission_omr: amount,
      status: "pending",
    });
  }

  revalidatePath("/[locale]/driver", "layout");
  return { ok: true as const };
}

export async function driverStartDelivery(orderId: string) {
  const driver = await requireDriver();
  if (!driver) return { ok: false as const, error: "unauthorized" };
  const order = await assertAssigned(driver.driverId, orderId);
  if (!order) return { ok: false as const, error: "not_assigned" };
  if (order.delivery_driver_id !== driver.driverId) {
    return { ok: false as const, error: "not_delivery_driver" };
  }
  if (!canDriverTransition(order.status, "out_for_delivery")) {
    return { ok: false as const, error: "invalid_transition" };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "out_for_delivery",
      delivery_confirmation_code: order.delivery_confirmation_code || code,
    })
    .eq("id", orderId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("order_status_history").insert({
    order_id: orderId,
    from_status: order.status,
    to_status: "out_for_delivery",
    changed_by: driver.profileId,
    note: "Driver started delivery",
  });

  revalidatePath("/[locale]/driver", "layout");
  return { ok: true as const };
}

export async function driverConfirmDelivery(params: {
  orderId: string;
  confirmationCode: string;
  notes?: string;
}) {
  const driver = await requireDriver();
  if (!driver) return { ok: false as const, error: "unauthorized" };
  const order = await assertAssigned(driver.driverId, params.orderId);
  if (!order) return { ok: false as const, error: "not_assigned" };
  if (order.delivery_driver_id !== driver.driverId) {
    return { ok: false as const, error: "not_delivery_driver" };
  }
  if (!canDriverTransition(order.status, "delivered")) {
    return { ok: false as const, error: "invalid_transition" };
  }

  const expected = order.delivery_confirmation_code;
  if (!expected || params.confirmationCode.trim() !== expected) {
    return { ok: false as const, error: "invalid_code" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      delivery_notes: params.notes || null,
    })
    .eq("id", params.orderId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("order_status_history").insert({
    order_id: params.orderId,
    from_status: order.status,
    to_status: "delivered",
    changed_by: driver.profileId,
    note: params.notes || "Driver confirmed delivery with customer code",
  });

  revalidatePath("/[locale]/driver", "layout");
  return { ok: true as const };
}

export async function driverRecordCash(params: {
  orderId: string;
  amountOmr: string;
}) {
  const driver = await requireDriver();
  if (!driver) return { ok: false as const, error: "unauthorized" };
  const order = await assertAssigned(driver.driverId, params.orderId);
  if (!order) return { ok: false as const, error: "not_assigned" };
  if (order.payment_method !== "cash") {
    return { ok: false as const, error: "not_cash" };
  }

  let amount: string;
  try {
    amount = normalizeOmr(params.amountOmr);
  } catch {
    return { ok: false as const, error: "invalid_amount" };
  }
  if (compareOmr(amount, "0.000") <= 0) {
    return { ok: false as const, error: "invalid_amount" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      cash_collected_omr: amount,
      cash_collected_at: new Date().toISOString(),
      cash_collected_by_driver_id: driver.driverId,
      payment_status: "paid",
    })
    .eq("id", params.orderId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("payments").insert({
    order_id: params.orderId,
    amount_omr: amount,
    currency_code: "OMR",
    method: "cash",
    status: "paid",
    collected_by_driver_id: driver.driverId,
    collected_by_profile_id: driver.profileId,
    paid_at: new Date().toISOString(),
    notes: "Cash collected by driver — full amount held for office handover",
  });

  revalidatePath("/[locale]/driver", "layout");
  return { ok: true as const };
}

export async function driverSubmitCashHandover(params: {
  amountOmr: string;
  notes?: string;
}) {
  const driver = await requireDriver();
  if (!driver) return { ok: false as const, error: "unauthorized" };

  let amount: string;
  try {
    amount = normalizeOmr(params.amountOmr);
  } catch {
    return { ok: false as const, error: "invalid_amount" };
  }
  if (compareOmr(amount, "0.000") <= 0) {
    return { ok: false as const, error: "invalid_amount" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cash_handovers").insert({
    driver_id: driver.driverId,
    amount_omr: amount,
    currency_code: "OMR",
    status: "submitted",
    submitted_at: new Date().toISOString(),
    handed_over_at: new Date().toISOString(),
    notes: params.notes || null,
  });
  if (error) {
    // Fallback if 'submitted' enum not migrated yet
    const retry = await supabase.from("cash_handovers").insert({
      driver_id: driver.driverId,
      amount_omr: amount,
      currency_code: "OMR",
      status: "pending",
      handed_over_at: new Date().toISOString(),
      notes: params.notes || "Driver submitted handover",
    });
    if (retry.error) return { ok: false as const, error: retry.error.message };
  }

  revalidatePath("/[locale]/driver", "layout");
  return { ok: true as const };
}
