"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminSetDriverCommission } from "@/lib/admin/actions";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DriverCommissionOverride({
  dict,
  driverId,
  current,
}: {
  dict: Dictionary;
  driverId: string;
  current: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pct, setPct] = useState(current);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await adminSetDriverCommission({
            driverId,
            commissionPercent: pct,
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
      <Input
        value={pct}
        onChange={(e) => setPct(e.target.value)}
        className="h-10 w-28 font-mono"
        dir="ltr"
      />
      <Button type="submit" disabled={pending} className="h-10">
        {dict.admin.overrideCommission}
      </Button>
    </form>
  );
}
