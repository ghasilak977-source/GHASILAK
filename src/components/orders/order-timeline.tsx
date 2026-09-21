"use client";

import type { Dictionary } from "@/messages/en";
import {
  TRACKING_STEPS,
  normalizeTrackingStatus,
  statusRank,
} from "@/lib/orders/status";
import { cn } from "@/lib/utils";

export function OrderTimeline({
  dict,
  status,
}: {
  dict: Dictionary;
  status: string;
}) {
  const normalized = normalizeTrackingStatus(status);
  const currentRank = statusRank(normalized);
  const cancelled = normalized === "cancelled" || status === "failed";

  if (cancelled) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {dict.tracking.statuses.cancelled}
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {TRACKING_STEPS.map((step, index) => {
        const done = index <= currentRank;
        const current = normalizeTrackingStatus(status) === step ||
          (statusRank(status) === index && statusRank(step) === index);
        return (
          <li key={step} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                done
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
                current && "ring-2 ring-brand-light ring-offset-2",
              )}
            >
              {index + 1}
            </span>
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  done ? "text-primary" : "text-muted-foreground",
                )}
              >
                {dict.tracking.statuses[step]}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
