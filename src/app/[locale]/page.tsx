import type { Metadata } from "next";
import { CustomerShell } from "@/components/layout/customer-shell";
import {
  AreasSection,
  ContactTeaser,
  FaqTeaser,
  HomeHero,
  HowItWorksSection,
  PricingHighlight,
  PromoSection,
  WhySection,
} from "@/components/home/sections";
import { getActiveZones } from "@/lib/catalog/queries";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { getBusinessSettings } from "@/lib/settings/load-settings";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  return {
    title: dict.seo.homeTitle,
    description: dict.seo.homeDesc,
    alternates: {
      languages: { ar: "/ar", en: "/en" },
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const [settings, zones] = await Promise.all([
    getBusinessSettings(),
    getActiveZones(),
  ]);

  return (
    <CustomerShell locale={locale}>
      <main>
        <HomeHero locale={locale} dict={dict} settings={settings} />
        <HowItWorksSection dict={dict} />
        <PricingHighlight locale={locale} dict={dict} settings={settings} />
        <AreasSection locale={locale} dict={dict} zones={zones} />
        <WhySection dict={dict} />
        <PromoSection dict={dict} />
        <FaqTeaser locale={locale} dict={dict} />
        <ContactTeaser locale={locale} dict={dict} settings={settings} />
      </main>
    </CustomerShell>
  );
}
