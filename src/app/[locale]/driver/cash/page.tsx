import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverShell } from "@/components/driver/driver-shell";
import { CashHandoverForm } from "@/components/driver/cash-handover-form";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n/config";
import { gateDriver } from "@/lib/driver/gate";
import {
  getAssignedDriverOrders,
  getDriverCashHeld,
  getDriverCashHandovers,
} from "@/lib/driver/session";
import { formatOmr } from "@/lib/money/omr";
import { compareOmr } from "@/lib/money/omr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return { title: getDictionary(raw).driver.cashTitle };
}

function handoverLabel(status: string, dict: ReturnType<typeof getDictionary>) {
  switch (status) {
    case "confirmed":
      return dict.driver.handoverConfirmed;
    case "submitted":
      return dict.driver.handoverSubmitted;
    case "rejected":
      return dict.driver.handoverRejected;
    default:
      return dict.driver.handoverPending;
  }
}

export default async function DriverCashPage({
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
      <DriverShell locale={locale} title={dict.driver.cashTitle}>
        <p className="text-sm text-muted-foreground">{dict.driver.connectDb}</p>
      </DriverShell>
    );
  }

  const [held, handovers, orders] = await Promise.all([
    getDriverCashHeld(driver.driverId),
    getDriverCashHandovers(driver.driverId),
    getAssignedDriverOrders(driver.driverId),
  ]);

  const cashOrders = orders.filter(
    (o) =>
      o.payment_method === "cash" &&
      o.cash_collected_by_driver_id === driver.driverId,
  );

  const canSubmit = compareOmr(held.heldOmr, "0.000") > 0;

  return (
    <DriverShell locale={locale} title={dict.driver.cashTitle}>
      <div className="mb-4 grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{dict.driver.cashHeld}</p>
          <p className="font-display text-3xl font-bold text-primary">
            {formatOmr(held.heldOmr, locale)}
          </p>
          <div className="mt-2 flex justify-between text-sm text-muted-foreground">
            <span>
              {dict.driver.collectedCash}: {formatOmr(held.collectedOmr, locale)}
            </span>
            <span>
              {dict.driver.handedOverCash}:{" "}
              {formatOmr(held.handedOverOmr, locale)}
            </span>
          </div>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">{dict.driver.cashHint}</p>

      {canSubmit ? (
        <CashHandoverForm dict={dict} defaultAmount={held.heldOmr} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-white/70 p-5 text-center text-sm text-muted-foreground">
          {dict.driver.noCash}
        </p>
      )}

      {cashOrders.length > 0 ? (
        <section className="mt-6 space-y-2">
          <h2 className="font-display text-base font-bold">
            {dict.driver.collectedCash}
          </h2>
          {cashOrders.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-white px-3 py-2 text-sm"
            >
              <LinkButton
                href={`/${locale}/driver/jobs/${o.id}`}
                variant="link"
                className="h-auto px-0"
              >
                {o.order_number}
              </LinkButton>
              <span className="font-mono">
                {formatOmr(o.cash_collected_omr, locale)}
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {handovers.length > 0 ? (
        <section className="mt-6 space-y-2">
          <h2 className="font-display text-base font-bold">
            {dict.driver.handoverPending}
          </h2>
          {handovers.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-white px-3 py-3 text-sm"
            >
              <div>
                <p className="font-mono font-semibold">
                  {formatOmr(h.amount_omr, locale)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString(locale)}
                </p>
              </div>
              <Badge variant="outline">{handoverLabel(h.status, dict)}</Badge>
            </div>
          ))}
        </section>
      ) : null}
    </DriverShell>
  );
}
