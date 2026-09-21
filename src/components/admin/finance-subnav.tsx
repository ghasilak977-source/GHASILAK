import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/messages/en";
import { cn } from "@/lib/utils";

const links = [
  { href: "", labelKey: "financeHub" as const },
  { href: "/settlements", labelKey: "settlements" as const },
  { href: "/cash", labelKey: "cashHeld" as const },
  { href: "/expenses", labelKey: "expenses" as const },
  { href: "/ledger", labelKey: "ledger" as const },
  { href: "/reports", labelKey: "reportSales" as const },
] as const;

export function FinanceSubnav({
  locale,
  dict,
  current,
}: {
  locale: Locale;
  dict: Dictionary;
  current: string;
}) {
  const base = `/${locale}/admin/finance`;
  return (
    <nav className="mb-5 flex flex-wrap gap-2">
      {links.map((l) => {
        const href = `${base}${l.href}`;
        const active =
          l.href === ""
            ? current === "" || current === "/"
            : current.startsWith(l.href);
        const label =
          l.labelKey === "financeHub"
            ? dict.admin.financeHub
            : l.labelKey === "settlements"
              ? dict.admin.settlements
              : l.labelKey === "cashHeld"
                ? dict.admin.cashHeld
                : l.labelKey === "expenses"
                  ? dict.admin.expenses
                  : l.labelKey === "ledger"
                    ? dict.admin.ledger
                    : dict.admin.nav.reports;
        return (
          <Link
            key={l.href || "home"}
            href={href}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-foreground hover:bg-muted",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
