import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminEmpty, AdminShell } from "@/components/admin/admin-shell";
import { ZoneEditor } from "@/components/admin/crud-editors";
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
  return { title: getDictionary(raw).admin.nav.areas };
}

export default async function AdminAreasPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.areas}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  const [{ data: zones }, { data: partners }] = await Promise.all([
    supabase.from("service_zones").select("*").order("sort_order"),
    supabase.from("laundry_partners").select("id, name_en, name_ar"),
  ]);

  const partnerOpts = ((partners ?? []) as { id: string; name_en: string; name_ar: string }[]).map(
    (p) => ({
      id: p.id,
      label: locale === "ar" ? p.name_ar : p.name_en,
    }),
  );

  return (
    <AdminShell locale={locale} title={dict.admin.nav.areas}>
      <div className="mb-6">
        <ZoneEditor dict={dict} partners={partnerOpts} />
      </div>
      <div className="space-y-4">
        {((zones ?? []) as Record<string, unknown>[]).map((z) => (
          <ZoneEditor
            key={String(z.id)}
            dict={dict}
            partners={partnerOpts}
            initial={{
              id: String(z.id),
              code: String(z.code),
              name_en: String(z.name_en),
              name_ar: String(z.name_ar),
              is_active: Boolean(z.is_active),
              default_partner_id: (z.default_partner_id as string) ?? null,
              min_order_omr: z.min_order_omr
                ? normalizeOmr(String(z.min_order_omr))
                : null,
              delivery_fee_omr: normalizeOmr(String(z.delivery_fee_omr ?? "0")),
              estimated_turnaround_hours:
                (z.estimated_turnaround_hours as number | null) ?? null,
            }}
          />
        ))}
      </div>
    </AdminShell>
  );
}
