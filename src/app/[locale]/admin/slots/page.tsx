import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminEmpty, AdminShell } from "@/components/admin/admin-shell";
import { SlotEditor } from "@/components/admin/crud-editors";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.slots };
}

export default async function AdminSlotsPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.slots}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  const { data: slots } = await supabase
    .from("pickup_slots")
    .select("*")
    .order("day_of_week")
    .order("start_time");

  return (
    <AdminShell locale={locale} title={dict.admin.nav.slots}>
      <div className="mb-6">
        <SlotEditor dict={dict} />
      </div>
      <div className="space-y-3">
        {((slots ?? []) as {
          id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          capacity: number;
          is_active: boolean;
        }[]).map((s) => (
          <div key={s.id}>
            <p className="mb-1 text-xs text-muted-foreground">
              {dict.admin.days[String(s.day_of_week) as keyof typeof dict.admin.days]} ·{" "}
              {s.is_active ? dict.admin.active : dict.admin.inactive}
            </p>
            <SlotEditor dict={dict} initial={s} />
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
