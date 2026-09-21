import Link from "next/link";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";

export function SiteFooter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const year = new Date().getFullYear();
  const links = [
    { href: `/${locale}/services`, label: dict.footer.services },
    { href: `/${locale}/pricing`, label: dict.footer.pricing },
    { href: `/${locale}/areas`, label: dict.footer.areas },
    { href: `/${locale}/how-it-works`, label: dict.footer.how },
    { href: `/${locale}/faq`, label: dict.footer.faq },
    { href: `/${locale}/contact`, label: dict.footer.contact },
    { href: `/${locale}/privacy`, label: dict.footer.privacy },
    { href: `/${locale}/terms`, label: dict.footer.terms },
  ];

  return (
    <footer className="mt-auto border-t border-border/60 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 pb-24 md:pb-8">
        <p className="font-display text-lg font-semibold text-primary">
          {dict.brand}
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-primary">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          © {year} {dict.brand}. {dict.home.footerRights}
        </p>
      </div>
    </footer>
  );
}
