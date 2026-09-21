"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  ClipboardList,
  FileWarning,
  LayoutDashboard,
  MapPinned,
  Megaphone,
  Settings,
  Shirt,
  Store,
  Tags,
  Timer,
  UserRound,
  Users,
  ScrollText,
  ChartColumn,
} from "lucide-react";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const items = [
  { key: "dashboard", href: "", icon: LayoutDashboard },
  { key: "orders", href: "/orders", icon: ClipboardList },
  { key: "customers", href: "/customers", icon: Users },
  { key: "drivers", href: "/drivers", icon: UserRound },
  { key: "partners", href: "/partners", icon: Store },
  { key: "services", href: "/services", icon: Shirt },
  { key: "areas", href: "/areas", icon: MapPinned },
  { key: "slots", href: "/slots", icon: Timer },
  { key: "finance", href: "/finance", icon: Banknote },
  { key: "promotions", href: "/promotions", icon: Tags },
  { key: "complaints", href: "/complaints", icon: FileWarning },
  { key: "reports", href: "/reports", icon: ChartColumn },
  { key: "users", href: "/users", icon: Users },
  { key: "settings", href: "/settings", icon: Settings },
  { key: "audit", href: "/audit", icon: ScrollText },
] as const;

export function AdminSidebar({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const pathname = usePathname();
  const base = `/${locale}/admin`;

  return (
    <aside className="hidden w-60 shrink-0 border-e border-border/80 bg-white md:block">
      <nav className="sticky top-0 flex max-h-screen flex-col gap-0.5 overflow-y-auto p-3 pb-8">
        {items.map((item) => {
          const href = `${base}${item.href}`;
          const active =
            item.href === ""
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{dict.admin.nav[item.key]}</span>
            </Link>
          );
        })}
        <Link
          href={`/${locale}/admin/promotions`}
          className="sr-only"
          aria-hidden
        >
          <Megaphone />
        </Link>
      </nav>
    </aside>
  );
}

export function AdminMobileNav({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const pathname = usePathname();
  const base = `/${locale}/admin`;
  const compact = items.filter((i) =>
    ["dashboard", "orders", "finance", "customers", "settings"].includes(i.key),
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {compact.map((item) => {
          const href = `${base}${item.href}`;
          const active =
            item.href === ""
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(href);
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                <span className="truncate">{dict.admin.nav[item.key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
