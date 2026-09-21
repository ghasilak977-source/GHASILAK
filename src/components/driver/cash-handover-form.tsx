"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { driverSubmitCashHandover } from "@/lib/driver/actions";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CashHandoverForm({
  dict,
  defaultAmount,
}: {
  dict: Dictionary;
  defaultAmount: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(defaultAmount);
  const [notes, setNotes] = useState("");

  return (
    <form
      className="space-y-3 rounded-2xl border border-border/80 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await driverSubmitCashHandover({
            amountOmr: amount,
            notes: notes || undefined,
          });
          if (!result.ok) {
            toast.error(dict.common.error);
            return;
          }
          toast.success(dict.driver.actionSaved);
          setNotes("");
          router.refresh();
        });
      }}
    >
      <p className="text-sm text-muted-foreground">{dict.driver.cashHint}</p>
      <div className="space-y-1.5">
        <Label htmlFor="handover-amount">{dict.driver.submitAmount}</Label>
        <Input
          id="handover-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="h-12 font-mono"
          dir="ltr"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="handover-notes">{dict.driver.handoverNotes}</Label>
        <Textarea
          id="handover-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      <Button type="submit" className="h-14 w-full text-base" disabled={pending}>
        {pending ? dict.driver.saving : dict.driver.submitHandover}
      </Button>
    </form>
  );
}
