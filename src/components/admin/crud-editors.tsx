"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminUpsertZone, adminUpsertSlot, adminUpsertPromo } from "@/lib/admin/actions";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ZoneEditor({
  dict,
  partners,
  initial,
}: {
  dict: Dictionary;
  partners: Array<{ id: string; label: string }>;
  initial?: {
    id: string;
    code: string;
    name_en: string;
    name_ar: string;
    is_active: boolean;
    default_partner_id: string | null;
    min_order_omr: string | null;
    delivery_fee_omr: string;
    estimated_turnaround_hours: number | null;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    name_en: initial?.name_en ?? "",
    name_ar: initial?.name_ar ?? "",
    is_active: initial?.is_active ?? true,
    default_partner_id: initial?.default_partner_id ?? "",
    min_order_omr: initial?.min_order_omr ?? "",
    delivery_fee_omr: initial?.delivery_fee_omr ?? "0.000",
    estimated_turnaround_hours: initial?.estimated_turnaround_hours?.toString() ?? "24",
  });

  return (
    <form
      className="grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await adminUpsertZone({
            id: initial?.id,
            code: form.code,
            name_en: form.name_en,
            name_ar: form.name_ar,
            is_active: form.is_active,
            default_partner_id: form.default_partner_id || null,
            min_order_omr: form.min_order_omr || null,
            delivery_fee_omr: form.delivery_fee_omr,
            estimated_turnaround_hours: form.estimated_turnaround_hours
              ? Number(form.estimated_turnaround_hours)
              : null,
          });
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            router.refresh();
          }
        });
      }}
    >
      <Input placeholder="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      <Input placeholder="EN" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} required />
      <Input placeholder="AR" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} required />
      <select
        className="h-9 rounded-lg border px-2 text-sm"
        value={form.default_partner_id}
        onChange={(e) => setForm({ ...form, default_partner_id: e.target.value })}
      >
        <option value="">{dict.admin.defaultLaundry}</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      <Input placeholder={dict.admin.minOrder} value={form.min_order_omr} onChange={(e) => setForm({ ...form, min_order_omr: e.target.value })} className="font-mono" dir="ltr" />
      <Input placeholder={dict.admin.deliveryFee} value={form.delivery_fee_omr} onChange={(e) => setForm({ ...form, delivery_fee_omr: e.target.value })} className="font-mono" dir="ltr" />
      <Input placeholder={dict.admin.turnaroundHours} value={form.estimated_turnaround_hours} onChange={(e) => setForm({ ...form, estimated_turnaround_hours: e.target.value })} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
        {dict.admin.active}
      </label>
      <Button type="submit" disabled={pending}>{dict.admin.save}</Button>
    </form>
  );
}

export function SlotEditor({
  dict,
  initial,
}: {
  dict: Dictionary;
  initial?: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    capacity: number;
    is_active: boolean;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    day_of_week: initial?.day_of_week ?? 0,
    start_time: (initial?.start_time || "09:00").slice(0, 5),
    end_time: (initial?.end_time || "12:00").slice(0, 5),
    capacity: initial?.capacity ?? 20,
    is_active: initial?.is_active ?? true,
  });

  return (
    <form
      className="grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await adminUpsertSlot({ id: initial?.id, ...form });
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            router.refresh();
          }
        });
      }}
    >
      <select
        className="h-9 rounded-lg border px-2 text-sm"
        value={form.day_of_week}
        onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
      >
        {Object.entries(dict.admin.days).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
      <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
      <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
      <Button type="submit" disabled={pending}>{dict.admin.save}</Button>
    </form>
  );
}

export function PromoEditor({
  dict,
  initial,
}: {
  dict: Dictionary;
  initial?: {
    id: string;
    code: string;
    discount_type: "percent" | "fixed";
    discount_value: string;
    is_active: boolean;
    min_order_omr: string;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    discount_type: initial?.discount_type ?? ("percent" as "percent" | "fixed"),
    discount_value: initial?.discount_value ?? "10.000",
    is_active: initial?.is_active ?? true,
    min_order_omr: initial?.min_order_omr ?? "0.000",
  });

  return (
    <form
      className="grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await adminUpsertPromo({ id: initial?.id, ...form });
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            router.refresh();
          }
        });
      }}
    >
      <div>
        <Label>{dict.admin.promoCode}</Label>
        <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      </div>
      <select
        className="mt-6 h-9 rounded-lg border px-2 text-sm"
        value={form.discount_type}
        onChange={(e) =>
          setForm({
            ...form,
            discount_type: e.target.value as "percent" | "fixed",
          })
        }
      >
        <option value="percent">%</option>
        <option value="fixed">Fixed OMR</option>
      </select>
      <Input
        value={form.discount_value}
        onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
        className="mt-6 font-mono"
        dir="ltr"
      />
      <Button type="submit" disabled={pending} className="mt-6">
        {dict.admin.save}
      </Button>
    </form>
  );
}
