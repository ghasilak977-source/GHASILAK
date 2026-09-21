import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { DriverBottomNav } from "@/components/driver/driver-bottom-nav";
import { getDictionary, type Locale } from "@/lib/i18n/config";

export function DriverShell({
  locale,
  children,
  title,
}: {
  locale: Locale;
  children: React.ReactNode;
  title?: string;
}) {
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-full flex-col bg-[linear-gradient(180deg,#eef5fb_0%,#f7fbff_40%,#f7fbff_100%)]">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link href={`/${locale}/driver`} className="shrink-0">
            <BrandMark className="h-9 w-auto" priority />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold tracking-wide text-brand-mid uppercase">
              {dict.brand} · {dict.driver.appName}
            </p>
            {title ? (
              <h1 className="truncate font-display text-lg font-bold text-primary">
                {title}
              </h1>
            ) : null}
          </div>
          <Link
            href={`/${locale === "ar" ? "en" : "ar"}/driver`}
            className="rounded-lg px-2 py-1 text-xs font-medium text-primary"
          >
            {locale === "ar" ? dict.common.english : dict.common.arabic}
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-4">
        {children}
      </div>
      <DriverBottomNav locale={locale} dict={dict} />
    </div>
  );
}
