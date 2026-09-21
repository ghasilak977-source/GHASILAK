import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AdminEmpty,
  AdminShell,
  AdminTable,
} from "@/components/admin/admin-shell";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.audit };
}

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; action?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { admin, configured } = await gateAdmin(locale);
  const sp = await searchParams;

  if (!configured || !admin) {
    return (
      <AdminShell locale={locale} title={dict.admin.nav.audit}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  let q = supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  if (sp.action) q = q.ilike("action", `%${sp.action}%`);
  if (sp.q) q = q.or(`entity_type.ilike.%${sp.q}%,action.ilike.%${sp.q}%`);

  const { data: logs } = await q;

  const actorIds = [
    ...new Set(
      ((logs ?? []) as { actor_id: string | null }[])
        .map((l) => l.actor_id)
        .filter(Boolean) as string[],
    ),
  ];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorMap = new Map(
    ((actors ?? []) as { id: string; full_name: string }[]).map((a) => [
      a.id,
      a.full_name,
    ]),
  );

  return (
    <AdminShell locale={locale} title={dict.admin.nav.audit}>
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" placeholder={dict.admin.search} defaultValue={sp.q} className="max-w-xs" />
        <Input
          name="action"
          placeholder={dict.admin.auditAction}
          defaultValue={sp.action}
          className="max-w-xs"
        />
        <Button type="submit">{dict.admin.apply}</Button>
      </form>

      {(logs ?? []).length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <AdminTable
          headers={[
            dict.admin.createdAt,
            dict.admin.actor,
            dict.admin.auditAction,
            dict.admin.entity,
            dict.admin.after,
          ]}
        >
          {((logs ?? []) as {
            id: string;
            actor_id: string | null;
            action: string;
            entity_type: string;
            entity_id: string | null;
            after_data: unknown;
            created_at: string;
          }[]).map((l) => (
            <tr key={l.id} className="border-b border-border/50 align-top">
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {new Date(l.created_at).toLocaleString(locale)}
              </td>
              <td className="px-3 py-2 text-sm">
                {(l.actor_id && actorMap.get(l.actor_id)) || "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
              <td className="px-3 py-2 text-xs">
                {l.entity_type}
                {l.entity_id ? `:${l.entity_id.slice(0, 8)}` : ""}
              </td>
              <td className="max-w-xs px-3 py-2 font-mono text-[10px] break-all text-muted-foreground">
                {l.after_data ? JSON.stringify(l.after_data).slice(0, 160) : "—"}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminShell>
  );
}
