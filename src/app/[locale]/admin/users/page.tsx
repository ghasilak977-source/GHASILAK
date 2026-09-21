import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminTable,
} from "@/components/admin/admin-shell";
import { RoleSelect } from "@/components/admin/role-select";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin, canManageUsers } from "@/lib/admin/gate";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.users };
}

export default async function AdminUsersPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.users}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone, email, role, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const canEdit = canManageUsers(admin.role);

  return (
    <AdminShell locale={locale} title={dict.admin.nav.users}>
      {(profiles ?? []).length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <AdminTable
          headers={[
            dict.admin.name,
            dict.admin.phone,
            dict.admin.email,
            dict.admin.role,
            dict.admin.actions,
          ]}
        >
          {((profiles ?? []) as {
            id: string;
            full_name: string;
            phone: string | null;
            email: string | null;
            role: string;
          }[]).map((p) => (
            <tr key={p.id} className="border-b border-border/50">
              <td className="px-3 py-2">{p.full_name}</td>
              <td className="px-3 py-2" dir="ltr">
                {p.phone || "—"}
              </td>
              <td className="px-3 py-2" dir="ltr">
                {p.email || "—"}
              </td>
              <td className="px-3 py-2">{p.role}</td>
              <td className="px-3 py-2">
                {canEdit ? (
                  <RoleSelect dict={dict} profileId={p.id} role={p.role} />
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminShell>
  );
}
