import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminEmpty, AdminShell } from "@/components/admin/admin-shell";
import {
  ComplaintCreateForm,
  ComplaintStatusForm,
} from "@/components/admin/complaint-forms";
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
  return { title: getDictionary(raw).admin.nav.complaints };
}

export default async function AdminComplaintsPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.complaints}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const supabase = await createClient();
  const { data: complaints } = await supabase
    .from("complaints")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell locale={locale} title={dict.admin.nav.complaints}>
      <ComplaintCreateForm dict={dict} />
      {(complaints ?? []).length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <div className="space-y-3">
          {((complaints ?? []) as Record<string, unknown>[]).map((c) => {
            const type = String(c.complaint_type || "other");
            const status = String(c.status);
            return (
              <article
                key={String(c.id)}
                className="rounded-2xl border border-border/80 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display font-bold">{String(c.subject)}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {dict.admin.complaintTypes[
                      type as keyof typeof dict.admin.complaintTypes
                    ] || type}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {dict.admin.complaintStatuses[
                      status as keyof typeof dict.admin.complaintStatuses
                    ] || status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {String(c.description)}
                </p>
                <ComplaintStatusForm
                  dict={dict}
                  id={String(c.id)}
                  status={status}
                />
              </article>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
