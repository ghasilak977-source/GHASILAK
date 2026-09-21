"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import { t } from "@/lib/i18n/config";
import { formatOmr } from "@/lib/money/omr";
import type { BusinessSettings } from "@/lib/settings/business-settings";
import type { CatalogService } from "@/lib/catalog/queries";
import { buildCartLines, lineTotals } from "@/lib/orders/cart";
import { cartToFinancialSnapshot, validateCartMinimums } from "@/lib/orders/checkout";
import { formatSlotLabel } from "@/lib/orders/status";
import { placeCustomerOrder } from "@/lib/orders/place-order";
import type { Address, PickupSlot } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LinkButton } from "@/components/ui/link-button";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type Step = "address" | "pickup" | "items" | "review" | "payment" | "confirm";

const STEPS: Step[] = [
  "address",
  "pickup",
  "items",
  "review",
  "payment",
  "confirm",
];

export function OrderWizard({
  locale,
  dict,
  settings,
  services,
  addresses,
  isLoggedIn,
  customerId,
}: {
  locale: Locale;
  dict: Dictionary;
  settings: BusinessSettings;
  services: CatalogService[];
  addresses: Address[];
  isLoggedIn: boolean;
  customerId: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("address");
  const [addressId, setAddressId] = useState<string>(
    addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? "",
  );
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [slotId, setSlotId] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [instructions, setInstructions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer">(
    "cash",
  );
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lines = useMemo(
    () => buildCartLines(services, quantities),
    [services, quantities],
  );
  const snapshot = useMemo(
    () =>
      cartToFinancialSnapshot({
        services,
        quantities,
        settings,
      }),
    [services, quantities, settings],
  );
  const summary = {
    pieceCount: snapshot.pieceCount,
    subtotalOmr: snapshot.subtotalOmr,
    discountOmr: snapshot.discountOmr,
    deliveryFeeOmr: snapshot.deliveryFeeOmr,
    vatOmr: snapshot.vatAmountOmr,
    totalOmr: snapshot.totalOmr,
  };

  const selectedAddress = addresses.find((a) => a.id === addressId);
  const selectedSlot = slots.find((s) => s.id === slotId);

  async function loadSlots(date: string) {
    const day = new Date(`${date}T12:00:00`).getDay();
    const zoneCode = selectedAddress?.area_code;
    const res = await fetch(
      `/api/pickup-slots?day=${day}&zoneCode=${encodeURIComponent(zoneCode ?? "")}`,
    );
    const json = (await res.json()) as { slots: PickupSlot[] };
    setSlots(json.slots ?? []);
    setSlotId(json.slots?.[0]?.id ?? "");
  }

  async function goNext() {
    setError(null);
    if (step === "address") {
      if (!isLoggedIn || !customerId) {
        router.push(`/${locale}/login?next=/${locale}/order`);
        return;
      }
      if (!addressId) {
        setError(dict.order.selectAddress);
        return;
      }
      await loadSlots(pickupDate);
      setStep("pickup");
      return;
    }
    if (step === "pickup") {
      if (!slotId) {
        setError(dict.order.selectSlot);
        return;
      }
      setStep("items");
      return;
    }
    if (step === "items") {
      const validation = validateCartMinimums(snapshot, settings);
      if (!validation.ok) {
        setError(
          validation.reason === "pieces"
            ? t(dict.order.minPiecesError, { count: settings.min_pieces })
            : t(dict.order.minAmountError, {
                amount: formatOmr(settings.min_order_omr, locale),
              }),
        );
        return;
      }
      setStep("review");
      return;
    }
    if (step === "review") {
      setStep("payment");
      return;
    }
    if (step === "payment") {
      await submitOrder();
    }
  }

  function goBack() {
    const index = STEPS.indexOf(step);
    if (index > 0 && step !== "confirm") {
      setStep(STEPS[index - 1]);
    }
  }

  async function submitOrder() {
    if (!hasSupabaseEnv()) {
      setError(dict.common.error);
      return;
    }
    startTransition(async () => {
      try {
        const slot = selectedSlot;
        const address = selectedAddress;
        if (!customerId || !address || !slot) {
          throw new Error(dict.common.error);
        }

        const result = await placeCustomerOrder({
          locale,
          addressId: address.id,
          pickupSlotId: slot.id.startsWith("local-") ? null : slot.id,
          pickupDate,
          slotStartTime: slot.start_time,
          quantities,
          paymentMethod,
          customerNotes: instructions || null,
          expectedTotalOmr: snapshot.totalOmr,
        });

        if (!result.ok) {
          if (result.error === "min_pieces") {
            throw new Error(
              t(dict.order.minPiecesError, { count: settings.min_pieces }),
            );
          }
          if (result.error === "min_order") {
            throw new Error(
              t(dict.order.minAmountError, {
                amount: formatOmr(settings.min_order_omr, locale),
              }),
            );
          }
          throw new Error(result.error || dict.common.error);
        }

        setOrderId(result.orderId);
        setOrderNumber(result.orderNumber);
        setStep("confirm");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : dict.common.error);
      }
    });
  }

  const stepLabel: Record<Step, string> = {
    address: dict.order.stepAddress,
    pickup: dict.order.stepPickup,
    items: dict.order.stepItems,
    review: dict.order.stepReview,
    payment: dict.order.stepPayment,
    confirm: dict.order.stepConfirm,
  };

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.filter((s) => s !== "confirm" || step === "confirm").map((s) => (
          <li
            key={s}
            className={`rounded-full px-2.5 py-1 ${
              s === step
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {stepLabel[s]}
          </li>
        ))}
      </ol>

      {step === "address" ? (
        <section className="space-y-3 rounded-2xl border border-border/70 bg-white p-4">
          <h2 className="font-display font-semibold">{dict.order.selectAddress}</h2>
          {!isLoggedIn ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{dict.order.needLogin}</p>
              <LinkButton href={`/${locale}/login?next=/${locale}/order`}>
                {dict.common.login}
              </LinkButton>
            </div>
          ) : addresses.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {dict.profile.noAddresses}
              </p>
              <LinkButton href={`/${locale}/profile`}>
                {dict.order.addNewAddress}
              </LinkButton>
            </div>
          ) : (
            <ul className="space-y-2">
              {addresses.map((address) => (
                <li key={address.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-3 has-[:checked]:border-primary has-[:checked]:bg-secondary/40">
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === address.id}
                      onChange={() => setAddressId(address.id)}
                    />
                    <span className="text-sm">
                      <span className="block font-medium">
                        {address.label ||
                          (locale === "ar"
                            ? address.area_name_ar
                            : address.area_name_en)}
                      </span>
                      <span className="text-muted-foreground">
                        {[
                          locale === "ar"
                            ? address.area_name_ar
                            : address.area_name_en,
                          address.street,
                          address.building,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {isLoggedIn ? (
            <LinkButton href={`/${locale}/profile`} variant="outline" size="sm">
              {dict.order.addNewAddress}
            </LinkButton>
          ) : null}
        </section>
      ) : null}

      {step === "pickup" ? (
        <section className="space-y-3 rounded-2xl border border-border/70 bg-white p-4">
          <div className="space-y-1.5">
            <Label>{dict.order.pickupDate}</Label>
            <Input
              type="date"
              value={pickupDate}
              onChange={async (e) => {
                setPickupDate(e.target.value);
                await loadSlots(e.target.value);
              }}
            />
          </div>
          <h2 className="font-display font-semibold">{dict.order.selectSlot}</h2>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.order.noSlots}</p>
          ) : (
            <ul className="space-y-2">
              {slots.map((slot) => (
                <li key={slot.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 has-[:checked]:border-primary has-[:checked]:bg-secondary/40">
                    <input
                      type="radio"
                      name="slot"
                      checked={slotId === slot.id}
                      onChange={() => setSlotId(slot.id)}
                    />
                    <span className="text-sm font-medium tabular-nums">
                      {formatSlotLabel(slot.start_time, slot.end_time)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {step === "items" ? (
        <section className="space-y-3 rounded-2xl border border-border/70 bg-white p-4">
          <h2 className="font-display font-semibold">{dict.order.itemsTitle}</h2>
          <ul className="space-y-3">
            {services.map((service) => {
              const qty = quantities[service.id] ?? 0;
              return (
                <li
                  key={service.id}
                  className="flex items-center justify-between gap-3 border-b border-border/50 pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {locale === "ar" ? service.name_ar : service.name_en}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatOmr(service.default_customer_price_omr, locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        setQuantities((q) => ({
                          ...q,
                          [service.id]: Math.max(0, (q[service.id] ?? 0) - 1),
                        }))
                      }
                    >
                      −
                    </Button>
                    <span className="w-6 text-center tabular-nums">{qty}</span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        setQuantities((q) => ({
                          ...q,
                          [service.id]: (q[service.id] ?? 0) + 1,
                        }))
                      }
                    >
                      +
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between border-t border-border/60 pt-3 text-sm font-semibold">
            <span>{dict.order.subtotal}</span>
            <span className="tabular-nums">
              {formatOmr(summary.subtotalOmr, locale)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.pieceCount} {dict.common.pieces}
          </p>
        </section>
      ) : null}

      {step === "review" ? (
        <section className="space-y-3 rounded-2xl border border-border/70 bg-white p-4 text-sm">
          <h2 className="font-display text-base font-semibold">
            {dict.order.stepReview}
          </h2>
          <p>
            <span className="text-muted-foreground">{dict.order.stepAddress}: </span>
            {selectedAddress
              ? locale === "ar"
                ? selectedAddress.area_name_ar
                : selectedAddress.area_name_en
              : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">{dict.order.stepPickup}: </span>
            {pickupDate}
            {selectedSlot
              ? ` · ${formatSlotLabel(selectedSlot.start_time, selectedSlot.end_time)}`
              : ""}
          </p>
          <ul className="space-y-1">
            {lines.map((line) => (
              <li key={line.serviceId} className="flex justify-between gap-2">
                <span>
                  {locale === "ar" ? line.name_ar : line.name_en} × {line.quantity}
                </span>
                <span className="tabular-nums">
                  {formatOmr(lineTotals(line).lineTotalOmr, locale)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-border/60 pt-3">
            <div className="flex justify-between">
              <dt>{dict.order.subtotal}</dt>
              <dd className="tabular-nums">
                {formatOmr(summary.subtotalOmr, locale)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{dict.order.discount}</dt>
              <dd className="tabular-nums">
                {formatOmr(summary.discountOmr, locale)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{dict.order.deliveryFee}</dt>
              <dd className="tabular-nums">
                {formatOmr(summary.deliveryFeeOmr, locale)}
              </dd>
            </div>
            {settings.vat_enabled ? (
              <div className="flex justify-between">
                <dt>{dict.order.vat}</dt>
                <dd className="tabular-nums">
                  {formatOmr(summary.vatOmr, locale)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between font-semibold text-primary">
              <dt>{dict.order.total}</dt>
              <dd className="tabular-nums">
                {formatOmr(summary.totalOmr, locale)}
              </dd>
            </div>
          </dl>
          <div className="space-y-1.5">
            <Label>{dict.order.instructions}</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={dict.common.optional}
            />
          </div>
          <p className="text-xs text-muted-foreground">{dict.order.uploadPhoto}</p>
        </section>
      ) : null}

      {step === "payment" ? (
        <section className="space-y-3 rounded-2xl border border-border/70 bg-white p-4">
          <h2 className="font-display font-semibold">{dict.order.paymentTitle}</h2>
          <label className="flex items-center gap-3 rounded-xl border border-border/70 p-3 has-[:checked]:border-primary">
            <input
              type="radio"
              name="pay"
              checked={paymentMethod === "cash"}
              onChange={() => setPaymentMethod("cash")}
            />
            <span>{dict.order.cash}</span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border/70 p-3 has-[:checked]:border-primary">
            <input
              type="radio"
              name="pay"
              checked={paymentMethod === "bank_transfer"}
              onChange={() => setPaymentMethod("bank_transfer")}
            />
            <span>{dict.order.bankTransfer}</span>
          </label>
          <p className="text-xs text-muted-foreground">{dict.order.cardsLater}</p>
          <p className="text-sm font-semibold tabular-nums text-primary">
            {dict.order.total}: {formatOmr(summary.totalOmr, locale)}
          </p>
        </section>
      ) : null}

      {step === "confirm" && orderNumber ? (
        <section className="space-y-4 rounded-2xl border border-border/70 bg-white p-5">
          <h2 className="font-display text-xl font-semibold text-primary">
            {dict.order.successTitle}
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{dict.order.orderNumber}</dt>
              <dd className="font-semibold">{orderNumber}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{dict.order.stepPickup}</dt>
              <dd>
                {pickupDate}
                {selectedSlot
                  ? ` · ${formatSlotLabel(selectedSlot.start_time, selectedSlot.end_time)}`
                  : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{dict.order.estimatedPieces}</dt>
              <dd>{summary.pieceCount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{dict.order.estimatedAmount}</dt>
              <dd className="tabular-nums">
                {formatOmr(summary.totalOmr, locale)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{dict.order.paymentTitle}</dt>
              <dd>
                {paymentMethod === "cash"
                  ? dict.order.cash
                  : dict.order.bankTransfer}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href={`/${locale}/orders/${orderId}`}
              size="lg"
            >
              {dict.common.trackOrder}
            </LinkButton>
            <LinkButton
              href={`/${locale}/orders/${orderId}/invoice`}
              size="lg"
              variant="outline"
            >
              {locale === "ar" ? "الفاتورة" : "Invoice"}
            </LinkButton>
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {step !== "confirm" ? (
        <div className="flex gap-2">
          {step !== "address" ? (
            <Button type="button" variant="outline" onClick={goBack}>
              {dict.common.back}
            </Button>
          ) : null}
          <Button
            type="button"
            className="flex-1"
            onClick={goNext}
            disabled={pending}
          >
            {step === "payment"
              ? pending
                ? dict.order.submitting
                : dict.order.placeOrder
              : dict.common.continue}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
