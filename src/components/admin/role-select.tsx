"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminUpdateUserRole } from "@/lib/admin/actions";
import { APP_ROLES } from "@/lib/auth/roles";
import type { Dictionary } from "@/messages/en";
import { Button } from "@/components/ui/button";

export function RoleSelect({
  dict,
  profileId,
  role,
}: {
  dict: Dictionary;
  profileId: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const next = String(fd.get("role"));
        start(async () => {
          const r = await adminUpdateUserRole({ profileId, role: next });
          if (!r.ok) toast.error(r.error || dict.common.error);
          else {
            toast.success(dict.common.save);
            router.refresh();
          }
        });
      }}
    >
      <select
        name="role"
        defaultValue={role}
        className="h-9 rounded-lg border px-2 text-sm"
      >
        {APP_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {dict.admin.save}
      </Button>
    </form>
  );
}
