import { z } from "zod";
import { normalizeOmr } from "@/lib/money/omr";

export const businessSettingsDefaults = {
  brand_name_ar: "غسيلك",
  brand_name_en: "GHASILAK",
  currency_code: "OMR",
  currency_decimals: 3,
  min_pieces: 8,
  min_order_omr: normalizeOmr("3.200"),
  default_customer_price_omr: normalizeOmr("0.400"),
  default_laundry_cost_omr: normalizeOmr("0.200"),
  default_driver_commission_percent: normalizeOmr("15.000"),
  default_packaging_cost_omr: normalizeOmr("0.100"),
  vat_enabled: false,
  vat_rate: 5,
  support_phone: "+96800000000",
  support_whatsapp: "+96800000000",
  support_email: "support@ghasilak.om",
  instagram_url: "https://instagram.com/ghasilak",
  logo_url: "/brand/ghasilak-logo.png",
  packaging_notes_en: "Items returned on hangers where applicable.",
  packaging_notes_ar: "تُعاد القطع على علاقات عند الحاجة.",
  terms_url: "/terms",
  privacy_url: "/privacy",
  support_hours_en: "Daily 8:00 – 22:00",
  support_hours_ar: "يومياً ٨:٠٠ – ٢٢:٠٠",
} as const;

export type BusinessSettings = {
  brand_name_ar: string;
  brand_name_en: string;
  currency_code: "OMR";
  currency_decimals: 3;
  min_pieces: number;
  min_order_omr: string;
  default_customer_price_omr: string;
  default_laundry_cost_omr: string;
  default_driver_commission_percent: string;
  default_packaging_cost_omr: string;
  vat_enabled: boolean;
  vat_rate: number;
  support_phone: string;
  support_whatsapp: string;
  support_email: string;
  instagram_url: string;
  logo_url: string;
  packaging_notes_en: string;
  packaging_notes_ar: string;
  terms_url: string;
  privacy_url: string;
  support_hours_en: string;
  support_hours_ar: string;
};

export const businessSettingsSchema = z.object({
  brand_name_ar: z.string().min(1),
  brand_name_en: z.string().min(1),
  currency_code: z.literal("OMR"),
  currency_decimals: z.literal(3),
  min_pieces: z.number().int().positive(),
  min_order_omr: z.string(),
  default_customer_price_omr: z.string(),
  default_laundry_cost_omr: z.string(),
  default_driver_commission_percent: z.string(),
  default_packaging_cost_omr: z.string(),
  vat_enabled: z.boolean(),
  vat_rate: z.number().nonnegative(),
  support_phone: z.string(),
  support_whatsapp: z.string(),
  support_email: z.string().email(),
  instagram_url: z.string().url(),
  logo_url: z.string(),
  packaging_notes_en: z.string(),
  packaging_notes_ar: z.string(),
  terms_url: z.string(),
  privacy_url: z.string(),
  support_hours_en: z.string(),
  support_hours_ar: z.string(),
});

export function getDefaultBusinessSettings(): BusinessSettings {
  const defaults: BusinessSettings = { ...businessSettingsDefaults };
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim();
  if (wa) {
    defaults.support_whatsapp = wa;
    if (!process.env.NEXT_PUBLIC_SUPPORT_PHONE) {
      defaults.support_phone = wa;
    }
  }
  return defaults;
}

export function mergeBusinessSettings(
  rows: Array<{ key: string; value: unknown }>,
): BusinessSettings {
  const merged: BusinessSettings = { ...businessSettingsDefaults };
  for (const row of rows) {
    if (!(row.key in merged)) continue;
    const key = row.key as keyof BusinessSettings;
    const current = merged[key];
    const next = row.value;
    // JSONB strings arrive already decoded by supabase-js; seed stores JSON literals.
    if (typeof current === "string" && typeof next === "string") {
      merged[key] = next as never;
    } else if (typeof current === "number" && typeof next === "number") {
      merged[key] = next as never;
    } else if (typeof current === "boolean" && typeof next === "boolean") {
      merged[key] = next as never;
    } else if (typeof current === "number" && typeof next === "string") {
      merged[key] = Number(next) as never;
    } else if (typeof current === "boolean" && typeof next === "string") {
      merged[key] = (next === "true") as never;
    } else if (typeof current === "string") {
      merged[key] = String(next) as never;
    }
  }
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim();
  if (wa) {
    merged.support_whatsapp = wa;
  }
  return businessSettingsSchema.parse(merged);
}

export const SERVICE_ZONE_SEEDS = [
  { code: "al_ansab", name_en: "Al Ansab", name_ar: "الأنصب" },
  { code: "ghala", name_en: "Ghala", name_ar: "غلا" },
  { code: "bausher", name_en: "Bausher", name_ar: "بوشر" },
  { code: "al_khuwair", name_en: "Al Khuwair", name_ar: "الخوير" },
  { code: "al_ghubrah", name_en: "Al Ghubrah", name_ar: "الغبرة" },
  { code: "azaiba", name_en: "Azaiba", name_ar: "العذيبة" },
  { code: "al_amerat", name_en: "Al Amerat", name_ar: "العامرات" },
] as const;

export const SERVICE_SEEDS = [
  { code: "dishdasha", name_en: "Dishdasha", name_ar: "دشداشة" },
  { code: "shirt", name_en: "Shirt", name_ar: "قميص" },
  { code: "t_shirt", name_en: "T-Shirt", name_ar: "تي شيرت" },
  { code: "trousers", name_en: "Trousers", name_ar: "بنطلون" },
  { code: "jeans", name_en: "Jeans", name_ar: "جينز" },
  { code: "wizar", name_en: "Wizar", name_ar: "وزار" },
  { code: "kumma", name_en: "Kumma", name_ar: "كمة" },
  { code: "abaya", name_en: "Abaya", name_ar: "عباية" },
] as const;
