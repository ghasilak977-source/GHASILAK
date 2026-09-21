import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminEmpty, AdminShell } from "@/components/admin/admin-shell";
import { PromoEditor } from "@/components/admin/crud-editors";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { createClient } from "@/lib/supabase/server";
import { normalizeOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.promotions };
}

export default async function AdminPromotionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { admin, configured } = await gateAdmin(locale);
  if (!configured || !admin) {
    return (
      <AdminShell locale={locale} title={dict.admin.nav.promotions}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  const { data: promos } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <AdminShell locale={locale} title={dict.admin.nav.promotions}>
      <div className="mb-6">
        <PromoEditor dict={dict} />
      </div>
      <div className="space-y-3">
        {((promos ?? []) as {
          id: string;
          code: string;
          discount_type: "percent" | "fixed";
          discount_value: string;
          is_active: boolean;
          min_order_omr: string;
        }[]).map((p) => (
          <PromoEditor
            key={p.id}
            dict={dict}
            initial={{
              ...p,
              discount_value: normalizeOmr(String(p.discount_value)),
              min_order_omr: normalizeOmr(String(p.min_order_omr ?? "0")),
            }}
          />
        ))}
      </div>
    </AdminShell>
  );
}
