import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { AnchorButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { getBusinessSettings } from "@/lib/settings/load-settings";
import { buildWhatsAppUrl } from "@/lib/whatsapp/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  return { title: dict.seo.contactTitle, description: dict.seo.contactDesc };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const settings = await getBusinessSettings();
  const wa = buildWhatsAppUrl(
    settings.support_whatsapp,
    dict.whatsapp.supportGeneric,
  );

  return (
    <CustomerShell locale={locale}>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-primary">
          {dict.contactPage.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{dict.contactPage.body}</p>
        <dl className="mt-8 space-y-4 rounded-2xl border border-border/70 bg-white p-5 text-sm">
          <div>
            <dt className="text-muted-foreground">WhatsApp</dt>
            <dd className="mt-1 font-medium">{settings.support_whatsapp}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="mt-1 font-medium">{settings.support_phone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="mt-1 font-medium">{settings.support_email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{dict.contactPage.hours}</dt>
            <dd className="mt-1 font-medium">
              {locale === "ar"
                ? settings.support_hours_ar
                : settings.support_hours_en}
            </dd>
          </div>
        </dl>
        <div className="mt-6">
          <AnchorButton href={wa} target="_blank" rel="noopener noreferrer" size="lg">
            {dict.common.whatsapp}
          </AnchorButton>
        </div>
      </main>
    </CustomerShell>
  );
}
