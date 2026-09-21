import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerShell } from "@/components/layout/customer-shell";
import { OrdersList } from "@/components/orders/orders-list";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).seo.ordersTitle };
}

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);

  let isLoggedIn = false;
  let orders: Order[] = [];

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
          const { data } = await supabase
            .from("customer_orders")
            .select(
              "id, order_number, status, piece_count, total_omr, payment_status, scheduled_pickup_at, created_at",
            )
            .order("created_at", { ascending: false });
          orders = (data as Order[]) ?? [];
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
          {dict.orders.title}
        </h1>
        <OrdersList
          locale={locale}
          dict={dict}
          orders={orders}
          isLoggedIn={isLoggedIn}
        />
      </main>
    </CustomerShell>
  );
}
