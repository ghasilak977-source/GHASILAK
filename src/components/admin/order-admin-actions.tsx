"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  adminAddExpense,
  adminAssignDriver,
  adminAssignLaundry,
  adminChangeOrderStatus,
  adminConfirmPieceCount,
  adminIssueRefund,
} from "@/lib/admin/actions";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CANONICAL_FLOW } from "@/lib/orders/transitions";

export function OrderAdminActions({
  dict,
  orderId,
  drivers,
  partners,
  currentStatus,
}: {
  dict: Dictionary;
  orderId: string;
  drivers: Array<{ id: string; label: string }>;
  partners: Array<{ id: string; label: string }>;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [pieces, setPieces] = useState("");
  const [amount, setAmount] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error || dict.common.error);
        return;
      }
      toast.success(dict.common.save);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2 rounded-2xl border border-border/80 bg-white p-4">
        <h3 className="font-display font-bold">{dict.admin.assignDriver}</h3>
        <select
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
        >
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <Button
          className="h-11 w-full"
          disabled={pending || !driverId}
          onClick={() =>
            run(() =>
              adminAssignDriver({ orderId, driverId, role: "both" }),
            )
          }
        >
          {dict.admin.assignDriver}
        </Button>
      </div>

      <div className="space-y-2 rounded-2xl border border-border/80 bg-white p-4">
        <h3 className="font-display font-bold">{dict.admin.assignLaundry}</h3>
        <select
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
        >
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <Button
          className="h-11 w-full"
          disabled={pending || !partnerId}
          onClick={() =>
            run(() => adminAssignLaundry({ orderId, partnerId }))
          }
        >
          {dict.admin.assignLaundry}
        </Button>
      </div>

      <div className="space-y-2 rounded-2xl border border-border/80 bg-white p-4">
        <h3 className="font-display font-bold">{dict.admin.changeStatus}</h3>
        <select
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {[...CANONICAL_FLOW, "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Label>{dict.admin.reason}</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button
          className="h-11 w-full"
          disabled={pending || !reason.trim()}
          onClick={() =>
            run(() =>
              adminChangeOrderStatus({
                orderId,
                toStatus: status,
                reason,
                adminOverride: true,
              }),
            )
          }
        >
          {dict.admin.changeStatus}
        </Button>
      </div>

      <div className="space-y-2 rounded-2xl border border-border/80 bg-white p-4">
        <h3 className="font-display font-bold">{dict.admin.confirmPieces}</h3>
        <Input
          value={pieces}
          onChange={(e) => setPieces(e.target.value)}
          inputMode="numeric"
          className="h-11"
        />
        <Label>{dict.admin.reason}</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button
          className="h-11 w-full"
          disabled={pending || !pieces || !reason.trim()}
          onClick={() =>
            run(() =>
              adminConfirmPieceCount({
                orderId,
                confirmedCount: Number(pieces),
                reason,
              }),
            )
          }
        >
          {dict.admin.confirmPieces}
        </Button>
      </div>

      <div className="space-y-2 rounded-2xl border border-border/80 bg-white p-4">
        <h3 className="font-display font-bold">{dict.admin.addExpense}</h3>
        <Input
          placeholder="OMR"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-11 font-mono"
          dir="ltr"
        />
        <Button
          className="h-11 w-full"
          disabled={pending || !amount}
          onClick={() =>
            run(() =>
              adminAddExpense({
                orderId,
                category: "order",
                description: `Expense for order`,
                amountOmr: amount,
              }),
            )
          }
        >
          {dict.admin.addExpense}
        </Button>
      </div>

      <div className="space-y-2 rounded-2xl border border-border/80 bg-white p-4">
        <h3 className="font-display font-bold">{dict.admin.issueRefund}</h3>
        <Input
          placeholder="OMR"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-11 font-mono"
          dir="ltr"
        />
        <Label>{dict.admin.reason}</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button
          variant="destructive"
          className="h-11 w-full"
          disabled={pending || !amount || !reason.trim()}
          onClick={() =>
            run(() =>
              adminIssueRefund({ orderId, amountOmr: amount, reason }),
            )
          }
        >
          {dict.admin.issueRefund}
        </Button>
      </div>
    </div>
  );
}
