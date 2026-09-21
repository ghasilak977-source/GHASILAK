"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminSaveSettings } from "@/lib/admin/actions";
import type { BusinessSettings } from "@/lib/settings/business-settings";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({
  dict,
  initial,
  canEdit,
}: {
  dict: Dictionary;
  initial: BusinessSettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(initial);

  function set<K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">{dict.admin.unauthorized}</p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await adminSaveSettings(form);
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            router.refresh();
          }
        });
      }}
    >
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {dict.admin.settingsHint}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {(
          [
            ["brand_name_en", "Brand EN"],
            ["brand_name_ar", "Brand AR"],
            ["support_phone", dict.admin.phone],
            ["support_whatsapp", "WhatsApp"],
            ["support_email", dict.admin.email],
            ["instagram_url", "Instagram"],
            ["logo_url", "Logo URL"],
            ["min_order_omr", dict.admin.minOrder],
            ["default_customer_price_omr", dict.admin.customerPrice],
            ["default_laundry_cost_omr", dict.admin.partnerCost],
            ["default_driver_commission_percent", dict.admin.commissionRate],
            ["default_packaging_cost_omr", "Packaging"],
            ["terms_url", "Terms URL"],
            ["privacy_url", "Privacy URL"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label>{label}</Label>
            <Input
              value={String(form[key])}
              onChange={(e) => set(key, e.target.value as never)}
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label>Min pieces</Label>
          <Input
            type="number"
            value={form.min_pieces}
            onChange={(e) => set("min_pieces", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label>VAT rate %</Label>
          <Input
            type="number"
            value={form.vat_rate}
            onChange={(e) => set("vat_rate", Number(e.target.value))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.vat_enabled}
            onChange={(e) => set("vat_enabled", e.target.checked)}
          />
          VAT enabled
        </label>
      </div>
      <Button type="submit" disabled={pending} className="h-11">
        {dict.admin.save}
      </Button>
    </form>
  );
}
