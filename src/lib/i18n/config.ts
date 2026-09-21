import { ar } from "@/messages/ar";
import { en, type Dictionary } from "@/messages/en";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function directionForLocale(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getDictionary(locale: Locale): Dictionary {
  return (locale === "ar" ? ar : en) as Dictionary;
}

/** Simple {token} interpolator for dictionary strings. */
export function t(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export const LOCALE_COOKIE = "ghasilak_locale";
