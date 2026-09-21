import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsAppFabFromDict } from "@/components/layout/whatsapp-fab";
import { getDictionary, type Locale } from "@/lib/i18n/config";
import { getBusinessSettings } from "@/lib/settings/load-settings";

export async function CustomerShell({
  locale,
  children,
  orderNumber,
}: {
  locale: Locale;
  children: React.ReactNode;
  orderNumber?: string;
}) {
  const dict = getDictionary(locale);
  const settings = await getBusinessSettings();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader locale={locale} dict={dict} />
      <div className="flex-1">{children}</div>
      <SiteFooter locale={locale} dict={dict} />
      <BottomNav locale={locale} dict={dict} />
      <WhatsAppFabFromDict
        phone={settings.support_whatsapp}
        dict={dict}
        orderNumber={orderNumber}
      />
    </div>
  );
}
