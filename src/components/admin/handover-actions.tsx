"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminConfirmCashHandover } from "@/lib/admin/actions";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";

export function HandoverActions({
  dict,
  handoverId,
}: {
  dict: Dictionary;
  handoverId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(confirm: boolean) {
    start(async () => {
      const r = await adminConfirmCashHandover({ handoverId, confirm });
      if (!r.ok) toast.error(r.error || dict.common.error);
      else {
        toast.success(dict.common.save);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(true)}>
        {dict.admin.confirmHandover}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => run(false)}
      >
        {dict.admin.rejectHandover}
      </Button>
    </div>
  );
}
