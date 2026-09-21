import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { BrandMark } from "@/components/brand/brand-mark";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { getSessionUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.loginTitle };
}

export default async function AdminLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { error } = await searchParams;

  if (hasSupabaseEnv()) {
    const session = await getSessionUser();
    if (session && isStaffRole(session.role)) {
      redirect(`/${locale}/admin`);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-[linear-gradient(165deg,#0f2744_0%,#144078_45%,#eef5fb_45%,#f7fbff_100%)]">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center text-white">
          <BrandMark className="mx-auto mb-4 h-16 w-auto drop-shadow" priority />
          <h1 className="font-display text-3xl font-bold">
            {dict.brand} · {dict.admin.appName}
          </h1>
          <p className="mt-2 text-sm text-white/85">{dict.admin.loginHint}</p>
        </div>
        {error === "unauthorized" ? (
          <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {dict.admin.unauthorized}
          </p>
        ) : null}
        <AuthForm locale={locale} dict={dict} nextPath={`/${locale}/admin`} />
      </main>
    </div>
  );
}
