import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { LinkButton } from "@/components/ui/link-button";
import { getActiveServices } from "@/lib/catalog/queries";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { formatOmr } from "@/lib/money/omr";
import { getBusinessSettings } from "@/lib/settings/load-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  return { title: dict.seo.pricingTitle, description: dict.seo.pricingDesc };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const [services, settings] = await Promise.all([
    getActiveServices(),
    getBusinessSettings(),
  ]);

  return (
    <CustomerShell locale={locale}>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-primary">
          {dict.pricingPage.title}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {dict.pricingPage.body}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-md bg-secondary px-3 py-1.5">
            {dict.pricingPage.minPieces}: {settings.min_pieces}
          </span>
          <span className="rounded-md bg-secondary px-3 py-1.5">
            {dict.pricingPage.minOrder}:{" "}
            {formatOmr(settings.min_order_omr, locale)}
          </span>
        </div>
        <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-start">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.servicesPage.title}</th>
                <th className="px-4 py-3 font-medium">{dict.pricingPage.perPiece}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    {locale === "ar" ? service.name_ar : service.name_en}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-primary">
                    {formatOmr(service.default_customer_price_omr, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6">
          <LinkButton href={`/${locale}/order`} size="lg">
            {dict.home.ctaOrder}
          </LinkButton>
        </div>
      </main>
    </CustomerShell>
  );
}
