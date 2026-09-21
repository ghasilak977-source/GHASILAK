import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminTable,
} from "@/components/admin/admin-shell";
import { FinanceSubnav } from "@/components/admin/finance-subnav";
import {
  GenerateSettlementForms,
  SettlementRowActions,
} from "@/components/admin/finance-forms";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { createClient } from "@/lib/supabase/server";
import { formatOmr, normalizeOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.settlements };
}

export default async function FinanceSettlementsPage({
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
      <AdminShell locale={locale} title={dict.admin.settlements}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  const [
    { data: laundry },
    { data: driversSettlements },
    { data: partners },
    { data: drivers },
  ] = await Promise.all([
    supabase
      .from("laundry_settlements")
      .select("id, settlement_number, partner_id, net_amount_omr, status, period_start, period_end")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("driver_settlements")
      .select("id, settlement_number, driver_id, net_amount_omr, status, period_start, period_end")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("laundry_partners").select("id, name_en, name_ar"),
    supabase.from("drivers").select("id, profile_id"),
  ]);

  const profileIds = ((drivers ?? []) as { profile_id: string }[]).map(
    (d) => d.profile_id,
  );
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  return (
    <AdminShell locale={locale} title={dict.admin.settlements}>
      <FinanceSubnav locale={locale} dict={dict} current="/settlements" />
      <GenerateSettlementForms
        dict={dict}
        partners={((partners ?? []) as { id: string; name_en: string; name_ar: string }[]).map(
          (p) => ({
            id: p.id,
            label: locale === "ar" ? p.name_ar : p.name_en,
          }),
        )}
        drivers={((drivers ?? []) as { id: string; profile_id: string }[]).map(
          (d) => ({
            id: d.id,
            label: profileMap.get(d.profile_id) || d.id.slice(0, 8),
          }),
        )}
      />

      <h2 className="mb-2 font-display font-bold">{dict.admin.nav.partners}</h2>
      <AdminTable
        headers={[
          dict.admin.orderNumber,
          dict.admin.periodStart,
          dict.admin.amount,
          dict.admin.status,
          dict.admin.actions,
        ]}
      >
        {((laundry ?? []) as Record<string, unknown>[]).map((s) => (
          <tr key={String(s.id)} className="border-b border-border/50">
            <td className="px-3 py-2 font-mono">{String(s.settlement_number)}</td>
            <td className="px-3 py-2 text-xs">
              {String(s.period_start)} → {String(s.period_end)}
            </td>
            <td className="px-3 py-2 font-mono">
              {formatOmr(normalizeOmr(String(s.net_amount_omr)), locale)}
            </td>
            <td className="px-3 py-2">{String(s.status)}</td>
            <td className="px-3 py-2">
              <SettlementRowActions
                dict={dict}
                kind="laundry"
                settlementId={String(s.id)}
                status={String(s.status)}
              />
            </td>
          </tr>
        ))}
      </AdminTable>

      <h2 className="mb-2 mt-8 font-display font-bold">{dict.admin.nav.drivers}</h2>
      <AdminTable
        headers={[
          dict.admin.orderNumber,
          dict.admin.periodStart,
          dict.admin.amount,
          dict.admin.status,
          dict.admin.actions,
        ]}
      >
        {((driversSettlements ?? []) as Record<string, unknown>[]).map((s) => (
          <tr key={String(s.id)} className="border-b border-border/50">
            <td className="px-3 py-2 font-mono">{String(s.settlement_number)}</td>
            <td className="px-3 py-2 text-xs">
              {String(s.period_start)} → {String(s.period_end)}
            </td>
            <td className="px-3 py-2 font-mono">
              {formatOmr(normalizeOmr(String(s.net_amount_omr)), locale)}
            </td>
            <td className="px-3 py-2">{String(s.status)}</td>
            <td className="px-3 py-2">
              <SettlementRowActions
                dict={dict}
                kind="driver"
                settlementId={String(s.id)}
                status={String(s.status)}
              />
            </td>
          </tr>
        ))}
      </AdminTable>
    </AdminShell>
  );
}
