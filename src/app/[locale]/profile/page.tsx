import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { ProfileClient } from "@/components/profile/profile-client";
import { getActiveZones } from "@/lib/catalog/queries";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Address, Profile } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).seo.profileTitle };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const zones = await getActiveZones();

  let profile: Profile | null = null;
  let addresses: Address[] = [];

  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        profile = (profileRow as Profile | null) ?? null;

        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (customer) {
          const { data: addressRows } = await supabase
            .from("addresses")
            .select("*")
            .eq("customer_id", (customer as { id: string }).id)
            .order("created_at", { ascending: false });
          addresses = (addressRows as Address[]) ?? [];
        }
      }
    } catch {
      // leave empty
    }
  }

  return (
    <CustomerShell locale={locale}>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display mb-6 text-3xl font-bold text-primary">
          {dict.profile.title}
        </h1>
        <ProfileClient
          locale={locale}
          dict={dict}
          initialProfile={profile}
          initialAddresses={addresses}
          zones={zones.map((z) => ({
            code: z.code,
            name_en: z.name_en,
            name_ar: z.name_ar,
          }))}
        />
      </main>
    </CustomerShell>
  );
}
