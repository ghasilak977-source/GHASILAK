"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import { formatOmr } from "@/lib/money/omr";
import {
  isActiveOrderStatus,
  isCancelledOrderStatus,
  isCompletedOrderStatus,
  statusLabel,
} from "@/lib/orders/status";
import type { Order } from "@/types/database";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinkButton } from "@/components/ui/link-button";

export function OrdersList({
  locale,
  dict,
  orders,
  isLoggedIn,
}: {
  locale: Locale;
  dict: Dictionary;
  orders: Order[];
  isLoggedIn: boolean;
}) {
  const [tab, setTab] = useState("active");

  const grouped = useMemo(() => {
    return {
      active: orders.filter((o) => isActiveOrderStatus(o.status)),
      completed: orders.filter((o) => isCompletedOrderStatus(o.status)),
      cancelled: orders.filter((o) => isCancelledOrderStatus(o.status)),
    };
  }, [orders]);

  if (!isLoggedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{dict.order.needLogin}</p>
        <LinkButton href={`/${locale}/login?next=/${locale}/orders`}>
          {dict.common.login}
        </LinkButton>
      </div>
    );
  }

  function renderList(list: Order[]) {
    if (!list.length) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {dict.orders.empty}
        </p>
      );
    }
    return (
      <ul className="space-y-3">
        {list.map((order) => (
          <li key={order.id}>
            <Link
              href={`/${locale}/orders/${order.id}`}
              className="block rounded-2xl border border-border/70 bg-white p-4 transition hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-primary">{order.order_number}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleString(
                      locale === "ar" ? "ar-OM" : "en-GB",
                    )}
                  </p>
                </div>
                <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-primary">
                  {statusLabel(order.status, dict)}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">{dict.orders.pieces}</dt>
                  <dd className="font-medium">{order.piece_count}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{dict.orders.amount}</dt>
                  <dd className="font-medium tabular-nums">
                    {formatOmr(String(order.total_omr), locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{dict.orders.status}</dt>
                  <dd className="font-medium">
                    {statusLabel(order.status, dict)}
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full">
        <TabsTrigger value="active">{dict.orders.active}</TabsTrigger>
        <TabsTrigger value="completed">{dict.orders.completed}</TabsTrigger>
        <TabsTrigger value="cancelled">{dict.orders.cancelled}</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="mt-4">
        {renderList(grouped.active)}
      </TabsContent>
      <TabsContent value="completed" className="mt-4">
        {renderList(grouped.completed)}
      </TabsContent>
      <TabsContent value="cancelled" className="mt-4">
        {renderList(grouped.cancelled)}
      </TabsContent>
    </Tabs>
  );
}
