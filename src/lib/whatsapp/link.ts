import { formatOmr } from "@/lib/money/omr";
import { businessSettingsDefaults } from "@/lib/settings/business-settings";

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
): string {
  const digits = (phone || businessSettingsDefaults.support_whatsapp).replace(
    /\D/g,
    "",
  );
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function formatPriceLabel(
  amount: string,
  locale: "ar" | "en",
): string {
  return formatOmr(amount, locale);
}
