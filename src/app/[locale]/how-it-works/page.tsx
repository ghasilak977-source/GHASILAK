import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HowItWorksSection } from "@/components/home/sections";
import { CustomerShell } from "@/components/layout/customer-shell";
import { LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  return { title: dict.seo.howTitle, description: dict.seo.howDesc };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  return (
    <CustomerShell locale={locale}>
      <main className="pb-6">
        <div className="mx-auto max-w-6xl px-4 pt-10">
          <h1 className="font-display text-3xl font-bold text-primary">
            {dict.howPage.title}
          </h1>
        </div>
        <HowItWorksSection dict={dict} />
        <div className="mx-auto max-w-6xl px-4">
          <LinkButton href={`/${locale}/order`} size="lg">
            {dict.home.ctaOrder}
          </LinkButton>
        </div>
      </main>
    </CustomerShell>
  );
}
