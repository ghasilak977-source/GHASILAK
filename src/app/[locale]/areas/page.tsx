import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { getActiveZones } from "@/lib/catalog/queries";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  return { title: dict.seo.areasTitle, description: dict.seo.areasDesc };
}

export default async function AreasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const zones = await getActiveZones();

  return (
    <CustomerShell locale={locale}>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-primary">
          {dict.areasPage.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{dict.areasPage.body}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => (
            <li
              key={zone.id}
              className="rounded-2xl border border-border/70 bg-white p-5"
            >
              <p className="font-display text-lg font-semibold text-primary">
                {locale === "ar" ? zone.name_ar : zone.name_en}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "ar" ? zone.name_en : zone.name_ar}
              </p>
            </li>
          ))}
        </ul>
      </main>
    </CustomerShell>
  );
}
