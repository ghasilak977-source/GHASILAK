"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  financeGenerateDriverSettlement,
  financeGenerateLaundrySettlement,
  financeTransitionSettlement,
  financeRecordOwnerCapital,
  financeAddBusinessExpense,
  financePostLedger,
} from "@/lib/finance/actions";
import { EXPENSE_CATEGORIES } from "@/lib/finance/types";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GenerateSettlementForms({
  dict,
  partners,
  drivers,
}: {
  dict: Dictionary;
  partners: Array<{ id: string; label: string }>;
  drivers: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <form
        className="space-y-2 rounded-2xl border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await financeGenerateLaundrySettlement({
              partnerId,
              periodStart: startDate,
              periodEnd: endDate,
            });
            if (!r.ok) toast.error(r.error || dict.common.error);
            else {
              toast.success(r.settlementNumber);
              router.refresh();
            }
          });
        }}
      >
        <h3 className="font-display font-bold">
          {dict.admin.generateLaundrySettlement}
        </h3>
        <select
          className="h-10 w-full rounded-lg border px-2 text-sm"
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
        >
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <Label>{dict.admin.periodStart}</Label>
        <Input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required />
        <Label>{dict.admin.periodEnd}</Label>
        <Input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required />
        <Button type="submit" disabled={pending} className="w-full">
          {dict.admin.generateLaundrySettlement}
        </Button>
      </form>

      <form
        className="space-y-2 rounded-2xl border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await financeGenerateDriverSettlement({
              driverId,
              periodStart: startDate,
              periodEnd: endDate,
            });
            if (!r.ok) toast.error(r.error || dict.common.error);
            else {
              toast.success(r.settlementNumber);
              router.refresh();
            }
          });
        }}
      >
        <h3 className="font-display font-bold">
          {dict.admin.generateDriverSettlement}
        </h3>
        <select
          className="h-10 w-full rounded-lg border px-2 text-sm"
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
        >
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <Label>{dict.admin.periodStart}</Label>
        <Input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required />
        <Label>{dict.admin.periodEnd}</Label>
        <Input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required />
        <Button type="submit" disabled={pending} className="w-full">
          {dict.admin.generateDriverSettlement}
        </Button>
      </form>
    </div>
  );
}

export function SettlementRowActions({
  dict,
  kind,
  settlementId,
  status,
}: {
  dict: Dictionary;
  kind: "driver" | "laundry";
  settlementId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ref, setRef] = useState("");

  function go(toStatus: "approved" | "paid") {
    start(async () => {
      const r = await financeTransitionSettlement({
        kind,
        settlementId,
        toStatus,
        paymentReference: ref || undefined,
      });
      if (!r.ok) toast.error(r.error || dict.common.error);
      else {
        toast.success(dict.common.save);
        router.refresh();
      }
    });
  }

  if (status === "paid") return <span className="text-xs text-muted-foreground">paid</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {(status === "draft" || status === "pending") && (
        <Button size="sm" disabled={pending} onClick={() => go("approved")}>
          {dict.admin.approve}
        </Button>
      )}
      {status === "approved" && (
        <>
          <Input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder={dict.admin.paymentRef}
            className="h-8 w-28"
          />
          <Button size="sm" disabled={pending} onClick={() => go("paid")}>
            {dict.admin.markPaid}
          </Button>
        </>
      )}
    </div>
  );
}

export function OwnerCapitalForm({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"owner_contribution" | "owner_withdrawal">(
    "owner_contribution",
  );
  const [amount, setAmount] = useState("");

  return (
    <form
      className="mb-6 flex flex-wrap items-end gap-2 rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await financeRecordOwnerCapital({ kind, amountOmr: amount });
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            setAmount("");
            router.refresh();
          }
        });
      }}
    >
      <div>
        <Label>{dict.admin.ownerCapital}</Label>
        <select
          className="flex h-10 rounded-lg border px-2 text-sm"
          value={kind}
          onChange={(e) =>
            setKind(e.target.value as "owner_contribution" | "owner_withdrawal")
          }
        >
          <option value="owner_contribution">{dict.admin.ownerContribution}</option>
          <option value="owner_withdrawal">{dict.admin.ownerWithdrawal}</option>
        </select>
      </div>
      <Input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="h-10 w-36 font-mono"
        placeholder="OMR"
        dir="ltr"
        required
      />
      <Button type="submit" disabled={pending}>
        {dict.admin.postEntry}
      </Button>
      <p className="w-full text-xs text-muted-foreground">{dict.admin.ownerHint}</p>
    </form>
  );
}

export function ExpenseCreateForm({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>("other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState("");

  return (
    <form
      className="mb-6 grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await financeAddBusinessExpense({
            category,
            description,
            amountOmr: amount,
            receiptPath: receipt || undefined,
          });
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            setDescription("");
            setAmount("");
            router.refresh();
          }
        });
      }}
    >
      <select
        className="h-10 rounded-lg border px-2 text-sm"
        value={category}
        onChange={(e) =>
          setCategory(e.target.value as (typeof EXPENSE_CATEGORIES)[number])
        }
      >
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <Input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="font-mono"
        placeholder="OMR"
        dir="ltr"
        required
      />
      <Input
        className="md:col-span-2"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={dict.admin.name}
        required
      />
      <Input
        className="md:col-span-2"
        value={receipt}
        onChange={(e) => setReceipt(e.target.value)}
        placeholder="receipt path / URL"
      />
      <Button type="submit" disabled={pending} className="md:col-span-2">
        {dict.admin.addExpense}
      </Button>
    </form>
  );
}

export function LedgerPostForm({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState("adjustment");
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      className="mb-6 grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await financePostLedger({
            type: type as never,
            amountOmr: amount,
            direction,
            notes,
          });
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            setAmount("");
            router.refresh();
          }
        });
      }}
    >
      <select
        className="h-10 rounded-lg border px-2 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        {[
          "customer_payment",
          "laundry_payment",
          "driver_payment",
          "cash_collected",
          "refund",
          "discount",
          "adjustment",
          "owner_contribution",
          "owner_withdrawal",
        ].map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        className="h-10 rounded-lg border px-2 text-sm"
        value={direction}
        onChange={(e) => setDirection(e.target.value as "in" | "out")}
      >
        <option value="in">in</option>
        <option value="out">out</option>
      </select>
      <Input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="font-mono"
        dir="ltr"
        required
      />
      <Button type="submit" disabled={pending}>
        {dict.admin.postEntry}
      </Button>
      <Input
        className="md:col-span-4"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={dict.admin.notes}
      />
    </form>
  );
}
