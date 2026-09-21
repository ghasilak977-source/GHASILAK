import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  AdminMobileNav,
  AdminSidebar,
} from "@/components/admin/admin-sidebar";
import { getDictionary, type Locale } from "@/lib/i18n/config";

export function AdminShell({
  locale,
  children,
  title,
  subtitle,
}: {
  locale: Locale;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-full flex-col bg-[linear-gradient(180deg,#e8f2fa_0%,#f7fbff_28%,#f7fbff_100%)]">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3">
          <Link href={`/${locale}/admin`} className="shrink-0">
            <BrandMark className="h-9 w-auto" priority />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-brand-mid uppercase">
              {dict.brand} · {dict.admin.appName}
            </p>
            {title ? (
              <h1 className="truncate font-display text-xl font-bold text-primary">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <Link
            href={`/${locale === "ar" ? "en" : "ar"}/admin`}
            className="rounded-lg px-2 py-1 text-xs font-medium text-primary"
          >
            {locale === "ar" ? dict.common.english : dict.common.arabic}
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1">
        <AdminSidebar locale={locale} dict={dict} />
        <main className="min-w-0 flex-1 px-4 py-5 pb-24 md:pb-8">{children}</main>
      </div>
      <AdminMobileNav locale={locale} dict={dict} />
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

export function AdminEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border bg-white/70 p-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

export function AdminTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/80 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-start text-sm">
        <thead className="border-b border-border/70 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
