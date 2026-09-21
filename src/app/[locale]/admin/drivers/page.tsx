import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminEmpty, AdminShell } from "@/components/admin/admin-shell";
import { DriverCommissionOverride } from "@/components/admin/driver-commission-form";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateAdmin } from "@/lib/admin/gate";
import { listAdminDrivers } from "@/lib/admin/lists";
import { formatOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).admin.nav.drivers };
}

export default async function AdminDriversPage({
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
      <AdminShell locale={locale} title={dict.admin.nav.drivers}>
        <AdminEmpty text={dict.admin.connectDb} />
      </AdminShell>
    );
  }

  const rows = await listAdminDrivers();

  return (
    <AdminShell locale={locale} title={dict.admin.nav.drivers}>
      {rows.length === 0 ? (
        <AdminEmpty text={dict.admin.noRows} />
      ) : (
        <div className="space-y-4">
          {rows.map((d) => (
            <article
              key={d.id}
              className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold">{d.full_name}</h2>
                  <p className="text-sm" dir="ltr">
                    {d.phone || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.status}
                    {d.vehicle_type ? ` · ${d.vehicle_type}` : ""}
                    {d.vehicle_plate ? ` · ${d.vehicle_plate}` : ""}
                  </p>
                </div>
                <p className="font-mono text-sm">
                  {dict.admin.commissionRate}: {d.commission_percent}%
                </p>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {dict.admin.assignedJobs}
                  </p>
                  <p className="font-semibold">{d.assigned_jobs}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {dict.admin.completedJobs}
                  </p>
                  <p className="font-semibold">{d.completed_jobs}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {dict.admin.pendingCommission}
                  </p>
                  <p className="font-mono font-semibold">
                    {formatOmr(d.pending_commission_omr, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{dict.admin.cashHeld}</p>
                  <p className="font-mono font-semibold">
                    {formatOmr(d.cash_held_omr, locale)}
                  </p>
                </div>
              </div>
              <DriverCommissionOverride
                dict={dict}
                driverId={d.id}
                current={d.commission_percent}
              />
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
