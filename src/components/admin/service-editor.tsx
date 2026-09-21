"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminUpsertService } from "@/lib/admin/actions";
import { subOmr, normalizeOmr, formatOmr } from "@/lib/money/omr";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ServiceEditor({
  locale,
  dict,
  initial,
}: {
  locale: Locale;
  dict: Dictionary;
  initial?: {
    id: string;
    code: string;
    name_en: string;
    name_ar: string;
    default_customer_price_omr: string;
    default_partner_cost_omr: string;
    is_active: boolean;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    name_en: initial?.name_en ?? "",
    name_ar: initial?.name_ar ?? "",
    default_customer_price_omr: initial?.default_customer_price_omr ?? "0.400",
    default_partner_cost_omr: initial?.default_partner_cost_omr ?? "0.200",
    is_active: initial?.is_active ?? true,
  });

  let margin = "0.000";
  try {
    margin = subOmr(
      normalizeOmr(form.default_customer_price_omr),
      normalizeOmr(form.default_partner_cost_omr),
    );
  } catch {
    margin = "—";
  }

  return (
    <form
      className="grid gap-2 rounded-2xl border border-border/80 bg-white p-4 md:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await adminUpsertService({
            id: initial?.id,
            ...form,
          });
          if (!r.ok) {
            toast.error(r.error || dict.common.error);
            return;
          }
          toast.success(dict.common.save);
          router.refresh();
        });
      }}
    >
      <div>
        <Label>Code</Label>
        <Input
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>{dict.admin.name} EN</Label>
        <Input
          value={form.name_en}
          onChange={(e) => setForm({ ...form, name_en: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>{dict.admin.name} AR</Label>
        <Input
          value={form.name_ar}
          onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
          required
        />
      </div>
      <div>
        <Label>{dict.admin.customerPrice}</Label>
        <Input
          value={form.default_customer_price_omr}
          onChange={(e) =>
            setForm({ ...form, default_customer_price_omr: e.target.value })
          }
          className="font-mono"
          dir="ltr"
        />
      </div>
      <div>
        <Label>{dict.admin.partnerCost}</Label>
        <Input
          value={form.default_partner_cost_omr}
          onChange={(e) =>
            setForm({ ...form, default_partner_cost_omr: e.target.value })
          }
          className="font-mono"
          dir="ltr"
        />
      </div>
      <div>
        <Label>{dict.admin.margin}</Label>
        <p className="flex h-9 items-center font-mono text-sm text-primary">
          {margin === "—" ? "—" : formatOmr(margin, locale)}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
        />
        {dict.admin.active}
      </label>
      <Button type="submit" disabled={pending} className="md:col-span-2">
        {dict.admin.save}
      </Button>
    </form>
  );
}
