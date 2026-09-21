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
  return { title: getDictionary(raw).seo.privacyTitle };
}

export default async function PrivacyPage({
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
          {dict.legal.privacyTitle}
        </h1>
        <p className="mt-4 leading-relaxed text-foreground/80">
          {dict.legal.privacyBody}
        </p>
      </main>
    </CustomerShell>
  );
}
