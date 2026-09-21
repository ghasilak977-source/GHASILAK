import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const dict = getDictionary(raw);
  return { title: dict.seo.faqTitle, description: dict.seo.faqDesc };
}

export default async function FaqPage({
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
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-primary">
          {dict.faqPage.title}
        </h1>
        <ul className="mt-8 space-y-4">
          {dict.faqPage.items.map((item) => (
            <li
              key={item.q}
              className="rounded-2xl border border-border/70 bg-white p-5"
            >
              <h2 className="font-display font-semibold">{item.q}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </li>
          ))}
        </ul>
      </main>
    </CustomerShell>
  );
}
