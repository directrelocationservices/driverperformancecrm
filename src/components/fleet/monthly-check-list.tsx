// File: src/components/fleet/monthly-check-list.tsx
// (NEW file)

import { AlertTriangle, CalendarCheck, CheckCircle2 } from "lucide-react";
import { PhotoThumb } from "@/components/shared/photo-thumb";
import { formatDateTimeET } from "@/lib/format";
import type { MonthlyCheck } from "@/types";
import { cn } from "@/lib/utils";

/** Monthly truck checks with each item's answer and photo */
export function MonthlyCheckList({
  checks,
  units = {},
  names = {},
  emptyText = "No monthly checks yet.",
}: {
  checks: MonthlyCheck[];
  units?: Record<string, string>;
  names?: Record<string, string>;
  emptyText?: string;
}) {
  if (!checks.length)
    return (
      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );

  return (
    <div className="space-y-3">
      {checks.map((c) => {
        const no = c.items.filter((i) => i.status === "attention").length;
        return (
          <section key={c.id} className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-bold">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  {units[c.truckId]
                    ? `Unit ${units[c.truckId]}`
                    : "Monthly check"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTimeET(c.receivedAtServer)}
                  {names[c.driverId] ? ` · ${names[c.driverId]}` : ""}
                </p>
              </div>
              {no ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> {no} &quot;No&quot;
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> All Yes
                </span>
              )}
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {c.items.map((i) => (
                <li key={i.key} className="min-w-0">
                  {i.photoUrl ? (
                    <PhotoThumb src={i.photoUrl} alt={i.label} />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                      Photo unavailable
                    </div>
                  )}
                  <p className="mt-1.5 text-sm font-medium leading-snug">
                    {i.label}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      i.status === "ok" ? "text-green-700" : "text-amber-700",
                    )}
                  >
                    {i.status === "ok" ? "Yes" : "No"}
                    {i.notes && (
                      <span className="font-normal text-foreground/80">
                        {" "}
                        · {i.notes}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            {c.notes && (
              <p className="mt-3 text-sm text-muted-foreground">{c.notes}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
