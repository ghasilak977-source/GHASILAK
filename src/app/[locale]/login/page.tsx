import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { CustomerShell } from "@/components/layout/customer-shell";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).seo.loginTitle };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { next } = await searchParams;

  return (
    <CustomerShell locale={locale}>
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-display mb-4 text-3xl font-bold text-primary">
          {dict.auth.title}
        </h1>
        <AuthForm locale={locale} dict={dict} nextPath={next} />
      </main>
    </CustomerShell>
  );
}
