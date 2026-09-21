import {
  getDefaultBusinessSettings,
  mergeBusinessSettings,
  type BusinessSettings,
} from "@/lib/settings/business-settings";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function getBusinessSettings(): Promise<BusinessSettings> {
  if (!hasSupabaseEnv()) {
    return getDefaultBusinessSettings();
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("business_settings").select("key, value");
    if (error || !data?.length) {
      return getDefaultBusinessSettings();
    }
    return mergeBusinessSettings(data as Array<{ key: string; value: unknown }>);
  } catch {
    return getDefaultBusinessSettings();
  }
}
