import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { requireDriver } from "@/lib/driver/session";
import { getSessionUser } from "@/lib/auth/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/** Gate helper: redirect non-drivers to login. Returns driver context or never. */
export async function gateDriver(locale: Locale) {
  if (!hasSupabaseEnv()) {
    return { driver: null as Awaited<ReturnType<typeof requireDriver>>, configured: false };
  }

  const session = await getSessionUser();
  if (!session) {
    redirect(`/${locale}/driver/login`);
  }
  if (session.role !== "driver") {
    redirect(`/${locale}/driver/login?error=unauthorized`);
  }

  const driver = await requireDriver();
  if (!driver) {
    redirect(`/${locale}/driver/login?error=unauthorized`);
  }

  return { driver, configured: true };
}
