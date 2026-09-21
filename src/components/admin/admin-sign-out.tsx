"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export function AdminSignOutButton({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  if (!hasSupabaseEnv()) return null;
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push(`/${locale}/admin/login`);
        router.refresh();
      }}
    >
      {dict.common.logout}
    </Button>
  );
}
