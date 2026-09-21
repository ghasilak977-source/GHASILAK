"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  driverConfirmDelivery,
  driverConfirmPickup,
  driverMarkArrived,
  driverMarkOnTheWay,
  driverRecordCash,
  driverStartDelivery,
} from "@/lib/driver/actions";
import {
  canDriverTransition,
  jobTypeForDriver,
  type DriverOrderCard,
} from "@/lib/driver/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatOmr } from "@/lib/money/omr";

function errorMessage(code: string, dict: Dictionary): string {
  switch (code) {
    case "invalid_code":
      return dict.driver.invalidCode;
    case "invalid_qr":
      return dict.driver.invalidQr;
    case "unauthorized":
    case "not_assigned":
      return dict.driver.needAssignment;
    default:
      return dict.common.error;
  }
}

export function DriverJobActions({
  locale,
  dict,
  order,
  driverId,
}: {
  locale: Locale;
  dict: Dictionary;
  order: DriverOrderCard;
  driverId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qrToken, setQrToken] = useState("");
  const [notes, setNotes] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [cashAmount, setCashAmount] = useState(
    order.customer_total_omr || "",
  );

  const kind = jobTypeForDriver(order, driverId);
  const isPickupDriver = order.pickup_driver_id === driverId;
  const isDeliveryDriver = order.delivery_driver_id === driverId;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(errorMessage(result.error || "error", dict));
        return;
      }
      toast.success(dict.driver.actionSaved);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Pickup flow */}
      {isPickupDriver && canDriverTransition(order.status, "driver_on_way") ? (
        <Button
          className="h-14 w-full text-base"
          disabled={pending}
          onClick={() => run(() => driverMarkOnTheWay(order.id))}
        >
          {dict.driver.onTheWay}
        </Button>
      ) : null}

      {isPickupDriver &&
      order.status === "driver_on_way" &&
      !order.arrived_at_pickup_at ? (
        <Button
          className="h-14 w-full text-base"
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => driverMarkArrived(order.id, "pickup"))}
        >
          {dict.driver.arrived}
        </Button>
      ) : null}

      {isPickupDriver && canDriverTransition(order.status, "picked_up") ? (
        <div className="space-y-3 rounded-2xl border border-border/80 bg-white p-4">
          <p className="font-display text-base font-semibold">
            {dict.driver.confirmPickup}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="qr">{dict.driver.scanQr}</Label>
            <Input
              id="qr"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder={dict.driver.qrToken}
              className="h-12 font-mono"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="photo">{dict.driver.photoOptional}</Label>
            <Input
              id="photo"
              value={photoNote}
              onChange={(e) => setPhotoNote(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">{dict.driver.notesOptional}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            className="h-14 w-full text-base"
            disabled={pending}
            onClick={() =>
              run(() =>
                driverConfirmPickup({
                  orderId: order.id,
                  qrToken: qrToken || undefined,
                  notes: notes || undefined,
                  photoNote: photoNote || undefined,
                }),
              )
            }
          >
            {pending ? dict.driver.saving : dict.driver.confirmPickup}
          </Button>
        </div>
      ) : null}

      {/* Delivery flow */}
      {isDeliveryDriver &&
      canDriverTransition(order.status, "out_for_delivery") ? (
        <Button
          className="h-14 w-full text-base"
          disabled={pending}
          onClick={() => run(() => driverStartDelivery(order.id))}
        >
          {dict.driver.outForDelivery}
        </Button>
      ) : null}

      {isDeliveryDriver &&
      order.status === "out_for_delivery" &&
      !order.arrived_at_delivery_at ? (
        <Button
          className="h-14 w-full text-base"
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => driverMarkArrived(order.id, "delivery"))}
        >
          {dict.driver.arrived}
        </Button>
      ) : null}

      {isDeliveryDriver && canDriverTransition(order.status, "delivered") ? (
        <div className="space-y-3 rounded-2xl border border-border/80 bg-white p-4">
          <p className="font-display text-base font-semibold">
            {dict.driver.confirmDelivered}
          </p>
          <p className="text-sm text-muted-foreground">
            {dict.driver.deliveryCodeHint}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="code">{dict.driver.deliveryCode}</Label>
            <Input
              id="code"
              value={deliveryCode}
              onChange={(e) => setDeliveryCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              className="h-14 text-center font-mono text-2xl tracking-[0.3em]"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dnotes">{dict.driver.notesOptional}</Label>
            <Textarea
              id="dnotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            className="h-14 w-full text-base"
            disabled={pending || deliveryCode.trim().length < 4}
            onClick={() =>
              run(() =>
                driverConfirmDelivery({
                  orderId: order.id,
                  confirmationCode: deliveryCode,
                  notes: notes || undefined,
                }),
              )
            }
          >
            {pending ? dict.driver.saving : dict.driver.confirmDelivered}
          </Button>
        </div>
      ) : null}

      {/* Cash collection */}
      {order.payment_method === "cash" &&
      !order.cash_collected_at &&
      (kind === "delivery" ||
        kind === "both" ||
        order.status === "delivered" ||
        order.status === "out_for_delivery") ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="font-display text-base font-semibold">
            {dict.driver.recordCashFor}
          </p>
          <p className="text-sm text-muted-foreground">{dict.driver.cashHint}</p>
          <p className="text-sm">
            {dict.driver.cashAmount}:{" "}
            <strong>{formatOmr(order.customer_total_omr, locale)}</strong>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="cash">{dict.driver.cashAmount}</Label>
            <Input
              id="cash"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              inputMode="decimal"
              className="h-12 font-mono"
              dir="ltr"
            />
          </div>
          <Button
            className="h-14 w-full text-base"
            disabled={pending}
            onClick={() =>
              run(() =>
                driverRecordCash({
                  orderId: order.id,
                  amountOmr: cashAmount,
                }),
              )
            }
          >
            {dict.driver.cashCollect}
          </Button>
        </div>
      ) : null}

      {order.cash_collected_at ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {dict.driver.collectedCash}:{" "}
          {formatOmr(order.cash_collected_omr, locale)}
        </p>
      ) : null}
    </div>
  );
}
