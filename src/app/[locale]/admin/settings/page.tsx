import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminEmpty, AdminShell } from "@/components/admin/admin-shell";
import { SettingsForm } from "@/components/admin/settings-form";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin, canWriteSettings } from "@/lib/admin/gate";
import { getBusinessSettings } from "@/lib/settings/load-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.settings };
}

export default async function AdminSettingsPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.settings}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const settings = await getBusinessSettings();

  return (
    <AdminShell locale={locale} title={dict.admin.nav.settings}>
      <div className="max-w-3xl rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
        <SettingsForm
          dict={dict}
          initial={settings}
          canEdit={canWriteSettings(admin.role)}
        />
      </div>
    </AdminShell>
  );
}
