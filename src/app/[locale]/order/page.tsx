import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { OrderWizard } from "@/components/order/order-wizard";
import { getActiveServices } from "@/lib/catalog/queries";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { getBusinessSettings } from "@/lib/settings/load-settings";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).seo.orderTitle };
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const [settings, services] = await Promise.all([
    getBusinessSettings(),
    getActiveServices(),
  ]);

  let isLoggedIn = false;
  let customerId: string | null = null;
  let addresses: Address[] = [];

  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        isLoggedIn = true;
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (customer) {
          customerId = (customer as { id: string }).id;
          const { data: addressRows } = await supabase
            .from("addresses")
            .select("*")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false });
          addresses = (addressRows as Address[]) ?? [];
        }
      }
    } catch {
      // ignore
    }
  }

  return (
    <CustomerShell locale={locale}>
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="font-display mb-5 text-3xl font-bold text-primary">
          {dict.order.title}
        </h1>
        <OrderWizard
          locale={locale}
          dict={dict}
          settings={settings}
          services={services}
          addresses={addresses}
          isLoggedIn={isLoggedIn}
          customerId={customerId}
        />
      </main>
    </CustomerShell>
  );
}
