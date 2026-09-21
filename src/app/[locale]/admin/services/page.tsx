import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminEmpty, AdminShell } from "@/components/admin/admin-shell";
import { ServiceEditor } from "@/components/admin/service-editor";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { createClient } from "@/lib/supabase/server";
import { formatOmr, subOmr, normalizeOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.services };
}

export default async function AdminServicesPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.services}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select(
      "id, code, name_en, name_ar, default_customer_price_omr, default_partner_cost_omr, is_active",
    )
    .order("sort_order");

  return (
    <AdminShell locale={locale} title={dict.admin.nav.services}>
      <div className="mb-6">
        <h2 className="mb-2 font-display font-bold">{dict.common.add}</h2>
        <ServiceEditor locale={locale} dict={dict} />
      </div>
      <div className="space-y-4">
        {((services ?? []) as {
          id: string;
          code: string;
          name_en: string;
          name_ar: string;
          default_customer_price_omr: string;
          default_partner_cost_omr: string;
          is_active: boolean;
        }[]).map((s) => {
          const margin = subOmr(
            normalizeOmr(String(s.default_customer_price_omr)),
            normalizeOmr(String(s.default_partner_cost_omr)),
          );
          return (
            <div key={s.id} className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {dict.admin.margin}: {formatOmr(margin, locale)} ·{" "}
                {s.is_active ? dict.admin.active : dict.admin.inactive}
              </p>
              <ServiceEditor
                locale={locale}
                dict={dict}
                initial={{
                  ...s,
                  default_customer_price_omr: normalizeOmr(
                    String(s.default_customer_price_omr),
                  ),
                  default_partner_cost_omr: normalizeOmr(
                    String(s.default_partner_cost_omr),
                  ),
                }}
              />
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
}
