import {
  SERVICE_SEEDS,
  SERVICE_ZONE_SEEDS,
  getDefaultBusinessSettings,
} from "@/lib/settings/business-settings";
import { normalizeOmr } from "@/lib/money/omr";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { Service, ServiceZone, PickupSlot } from "@/types/database";

export type CatalogService = Pick<
  Service,
  | "id"
  | "code"
  | "name_en"
  | "name_ar"
  | "default_customer_price_omr"
  | "sort_order"
  | "is_active"
> & {
  /** Server-only; omitted from public catalog payloads. */
  default_partner_cost_omr?: string;
};

export type CatalogZone = Pick<
  ServiceZone,
  "id" | "code" | "name_en" | "name_ar" | "sort_order" | "is_active" | "default_partner_id"
>;

const fallbackServices = (): CatalogService[] => {
  const price = getDefaultBusinessSettings().default_customer_price_omr;
  return SERVICE_SEEDS.map((s, index) => ({
    id: `local-${s.code}`,
    code: s.code,
    name_en: s.name_en,
    name_ar: s.name_ar,
    default_customer_price_omr: price,
    sort_order: index + 1,
    is_active: true,
  }));
};

const fallbackZones = (): CatalogZone[] =>
  SERVICE_ZONE_SEEDS.map((z, index) => ({
    id: `local-${z.code}`,
    code: z.code,
    name_en: z.name_en,
    name_ar: z.name_ar,
    sort_order: index + 1,
    is_active: true,
    default_partner_id: null,
  }));

export async function getActiveServices(): Promise<CatalogService[]> {
  if (!hasSupabaseEnv()) return fallbackServices();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("services")
      .select(
        "id, code, name_en, name_ar, default_customer_price_omr, sort_order, is_active",
      )
      .eq("is_active", true)
      .order("sort_order");
    if (error || !data?.length) return fallbackServices();
    return (data as CatalogService[]).map((row) => ({
      ...row,
      default_customer_price_omr: normalizeOmr(
        String(row.default_customer_price_omr),
      ),
    }));
  } catch {
    return fallbackServices();
  }
}

export async function getActiveZones(): Promise<CatalogZone[]> {
  if (!hasSupabaseEnv()) return fallbackZones();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_zones")
      .select(
        "id, code, name_en, name_ar, sort_order, is_active, default_partner_id",
      )
      .eq("is_active", true)
      .order("sort_order");
    if (error || !data?.length) return fallbackZones();
    return data as CatalogZone[];
  } catch {
    return fallbackZones();
  }
}

export async function getPickupSlotsForDay(
  dayOfWeek: number,
  zoneId?: string | null,
): Promise<PickupSlot[]> {
  if (!hasSupabaseEnv()) {
    return [
      {
        id: "local-afternoon",
        zone_id: zoneId ?? null,
        day_of_week: dayOfWeek,
        start_time: "14:00:00",
        end_time: "17:00:00",
        capacity: 30,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "local-evening",
        zone_id: zoneId ?? null,
        day_of_week: dayOfWeek,
        start_time: "18:00:00",
        end_time: "21:00:00",
        capacity: 30,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  try {
    const supabase = await createClient();
    let query = supabase
      .from("pickup_slots")
      .select("*")
      .eq("is_active", true)
      .eq("day_of_week", dayOfWeek)
      .order("start_time");

    if (zoneId && !zoneId.startsWith("local-")) {
      query = query.or(`zone_id.eq.${zoneId},zone_id.is.null`);
    }

    const { data, error } = await query;
    if (error || !data?.length) {
      return [
        {
          id: "local-afternoon",
          zone_id: zoneId ?? null,
          day_of_week: dayOfWeek,
          start_time: "14:00:00",
          end_time: "17:00:00",
          capacity: 30,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "local-evening",
          zone_id: zoneId ?? null,
          day_of_week: dayOfWeek,
          start_time: "18:00:00",
          end_time: "21:00:00",
          capacity: 30,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    }
    return data as PickupSlot[];
  } catch {
    return [
      {
        id: "local-afternoon",
        zone_id: zoneId ?? null,
        day_of_week: dayOfWeek,
        start_time: "14:00:00",
        end_time: "17:00:00",
        capacity: 30,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "local-evening",
        zone_id: zoneId ?? null,
        day_of_week: dayOfWeek,
        start_time: "18:00:00",
        end_time: "21:00:00",
        capacity: 30,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }
}
