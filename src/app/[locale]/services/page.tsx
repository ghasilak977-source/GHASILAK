import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { getActiveServices } from "@/lib/catalog/queries";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { formatOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  return { title: dict.seo.servicesTitle, description: dict.seo.servicesDesc };
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const services = await getActiveServices();

  return (
    <CustomerShell locale={locale}>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-primary">
          {dict.servicesPage.title}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {dict.servicesPage.body}
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li
              key={service.id}
              className="rounded-2xl border border-border/70 bg-white p-4"
            >
              <p className="font-display font-semibold">
                {locale === "ar" ? service.name_ar : service.name_en}
              </p>
              <p className="mt-2 text-sm tabular-nums text-primary">
                {formatOmr(service.default_customer_price_omr, locale)}
              </p>
            </li>
          ))}
        </ul>
      </main>
    </CustomerShell>
  );
}
