"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";

export function DriverSignOutButton({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      className="h-12 w-full"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push(`/${locale}/driver/login`);
        router.refresh();
      }}
    >
      {dict.common.logout}
    </Button>
  );
}
