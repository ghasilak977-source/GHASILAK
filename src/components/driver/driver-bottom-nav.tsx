"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CircleUserRound,
  ClipboardList,
  Home,
  Route,
} from "lucide-react";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const items = [
  { key: "home", href: "", icon: Home },
  { key: "jobs", href: "/jobs", icon: ClipboardList },
  { key: "routes", href: "/routes", icon: Route },
  { key: "cash", href: "/cash", icon: Banknote },
  { key: "profile", href: "/profile", icon: CircleUserRound },
] as const;

export function DriverBottomNav({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const pathname = usePathname();
  const base = `/${locale}/driver`;

  return (
    <nav
      aria-label="Driver"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const href = `${base}${item.href}`;
          const active =
            item.href === ""
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(href);
          const Icon = item.icon;
          const label = dict.driver.nav[item.key];
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-6 transition-transform",
                    active && "scale-110",
                  )}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
