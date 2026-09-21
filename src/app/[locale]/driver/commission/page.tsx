import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverShell } from "@/components/driver/driver-shell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateDriver } from "@/lib/driver/gate";
import { getDriverCommissions } from "@/lib/driver/session";
import { addOmr, formatOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).driver.commissionTitle };
}

function statusLabel(status: string, dict: ReturnType<typeof getDictionary>) {
  if (status === "approved") return dict.driver.commissionApproved;
  if (status === "settled") return dict.driver.commissionSettled;
  return dict.driver.commissionPending;
}

export default async function DriverCommissionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const dict = getDictionary(locale);
  const { driver, configured } = await gateDriver(locale);

  if (!configured || !driver) {
    return (
      <DriverShell locale={locale} title={dict.driver.commissionTitle}>
        <p className="text-sm text-muted-foreground">{dict.driver.connectDb}</p>
      </DriverShell>
    );
  }

  const rows = await getDriverCommissions(driver.driverId);
  const pending = rows
    .filter((r) => r.status === "pending")
    .reduce((s, r) => addOmr(s, r.commission_omr), "0.000");
  const approved = rows
    .filter((r) => r.status === "approved")
    .reduce((s, r) => addOmr(s, r.commission_omr), "0.000");
  const settled = rows
    .filter((r) => r.status === "settled")
    .reduce((s, r) => addOmr(s, r.commission_omr), "0.000");

  return (
    <DriverShell locale={locale} title={dict.driver.commissionTitle}>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/80 bg-white p-3">
          <p className="text-xs text-muted-foreground">
            {dict.driver.pendingCommission}
          </p>
          <p className="font-display text-xl font-bold text-primary">
            {formatOmr(pending, locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-white p-3">
          <p className="text-xs text-muted-foreground">
            {dict.driver.approvedCommission}
          </p>
          <p className="font-display text-xl font-bold text-primary">
            {formatOmr(approved, locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-white p-3">
          <p className="text-xs text-muted-foreground">
            {dict.driver.commissionSettled}
          </p>
          <p className="font-display text-xl font-bold text-primary">
            {formatOmr(settled, locale)}
          </p>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        {dict.driver.eligibleRevenue} × {dict.driver.commissionRate}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-white/70 p-6 text-center text-sm text-muted-foreground">
          {dict.driver.noCommissions}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-border/80 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  {row.order_number ? (
                    <LinkButton
                      href={`/${locale}/driver/jobs/${row.order_id}`}
                      variant="link"
                      className="h-auto px-0 font-mono"
                    >
                      {row.order_number}
                    </LinkButton>
                  ) : (
                    <span className="font-mono text-sm">{row.order_id.slice(0, 8)}</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {dict.driver.eligibleRevenue}:{" "}
                    {formatOmr(row.base_amount_omr, locale)} ·{" "}
                    {row.commission_percent}%
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-display text-lg font-bold text-primary">
                    {formatOmr(row.commission_omr, locale)}
                  </p>
                  <Badge variant="outline">{statusLabel(row.status, dict)}</Badge>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DriverShell>
  );
}
