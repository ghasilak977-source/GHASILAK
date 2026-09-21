import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";

export function SiteHeader({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const other: Locale = locale === "ar" ? "en" : "ar";
  const otherLabel = other === "ar" ? dict.common.arabic : dict.common.english;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <BrandMark className="h-9 w-auto" priority />
          <span className="font-display text-base font-semibold tracking-tight text-primary">
            {dict.brand}
          </span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-foreground/80 md:flex">
          <Link href={`/${locale}/order`} className="hover:text-primary">
            {dict.nav.order}
          </Link>
          <Link href={`/${locale}/orders`} className="hover:text-primary">
            {dict.nav.myOrders}
          </Link>
          <Link href={`/${locale}/pricing`} className="hover:text-primary">
            {dict.nav.prices}
          </Link>
          <Link href={`/${locale}/profile`} className="hover:text-primary">
            {dict.nav.profile}
          </Link>
        </nav>
        <Link
          href={`/${other}`}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground/80 hover:bg-muted"
        >
          {otherLabel}
        </Link>
      </div>
    </header>
  );
}
