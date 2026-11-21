// File: src/app/(admin)/admin/sales/lead-costs/history/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  CornerDownRight,
  History,
} from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getCostHistory,
  getCostRangeChanges,
  getCostRanges,
  getUsers,
} from "@/lib/data";
import { formatCurrency, formatDate, formatDateTimeET } from "@/lib/format";
import {
  CostRangeDialog,
  DeleteCostRangeButton,
} from "@/components/sales/cost-range-dialog";
import type { CostRangeChange } from "@/types";
import { weekLabel } from "@/lib/weeks";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";

export const metadata = { title: "Lead Cost History" };

export default async function LeadCostHistoryPage() {
  await requireRole("admin");
  const [{ weeks, sources, cells }, ranges, changes, users] = await Promise.all(
    [getCostHistory(16), getCostRanges(), getCostRangeChanges(50), getUsers()],
  );
  const sourceName = Object.fromEntries(sources.map((s) => [s.id, s.name]));
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const pickable = sources
    .filter((s) => s.active || ranges.some((r) => r.sourceId === s.id))
    .map((s) => ({ id: s.id, name: s.name }));
  const dates = (a?: string, b?: string) =>
    a && b ? `${formatDate(a)} – ${formatDate(b)}` : "";
  const what = (x: CostRangeChange["after"]) =>
    x
      ? `${x.mode === "total" ? "Total spend" : "Cost per lead"} ${formatCurrency(Number(x.amount ?? 0))}, ${dates(x.start_date, x.end_date)}`
      : "";

  return (
    <div>
      <Link
        href="/admin/sales/lead-costs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Lead costs
      </Link>
      <PageHeader
        title="Lead Cost History"
        description="Date-range costs and weekly costs per lead for each source."
        actions={<CostRangeDialog sources={pickable} />}
      />

      {/* Date-range costs */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:text-xl">
          <CalendarRange className="h-5 w-5 text-primary" /> Date-range costs
        </h2>
        {ranges.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card p-5 text-center text-sm text-muted-foreground">
            None yet. Use &quot;Cost for a date range&quot; to set one cost for
            many weeks at once.
          </p>
        ) : (
          <div className="divide-y rounded-2xl border bg-card">
            {ranges.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {sourceName[r.sourceId] ?? "Unknown source"}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {dates(r.startDate, r.endDate)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {r.mode === "total"
                      ? `Total spend ${formatCurrency(r.amount)} ÷ ${r.leadCount} leads = ${formatCurrency(r.costPerLead)} per lead`
                      : `${formatCurrency(r.amount)} per lead · ${r.leadCount} leads`}
                    {r.note && ` · ${r.note}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Last changed by {names[r.updatedBy ?? ""] ?? "Unknown"},{" "}
                    {formatDateTimeET(r.updatedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <CostRangeDialog sources={pickable} range={r} />
                  <DeleteCostRangeButton id={r.id} />
                </div>
              </div>
            ))}
          </div>
        )}

        {changes.length > 0 && (
          <details className="group mt-3 rounded-2xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold">
              <History className="h-4 w-4 text-muted-foreground" />
              Change history ({changes.length})
              <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
                Show
              </span>
            </summary>
            <ol className="space-y-3 border-t px-5 py-4 text-sm">
              {changes.map((c) => (
                <li key={c.id}>
                  <p className="font-semibold">
                    {c.action === "create"
                      ? "Added"
                      : c.action === "update"
                        ? "Changed"
                        : "Deleted"}{" "}
                    {sourceName[c.sourceId] ?? "source"} by{" "}
                    {names[c.changedBy ?? ""] ?? "Unknown"}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {formatDateTimeET(c.changedAt)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {c.action === "update" ? (
                      <>
                        <span className="line-through">{what(c.before)}</span> →{" "}
                        <span className="text-foreground">{what(c.after)}</span>
                      </>
                    ) : (
                      what(c.after ?? c.before)
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>

      <h2 className="mb-3 text-lg font-bold sm:text-xl">Weekly costs</h2>
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">
        Inside a date range, the date-range cost is used instead of these. Click
        a week to edit it.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-foreground" /> Cost entered for
          that week
        </span>
        <span className="flex items-center gap-2">
          <CornerDownRight className="h-3.5 w-3.5 text-amber-600" /> Carried
          over from an earlier week
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-muted px-5 py-3 text-left">
                  Week
                </th>
                {sources.map((s) => (
                  <th
                    key={s.id}
                    className="whitespace-nowrap px-4 py-3 text-right"
                  >
                    {s.name}
                    {!s.active && (
                      <span className="ml-1 font-normal normal-case">
                        (inactive)
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {weeks.map((week, i) => (
                <tr key={week} className="transition hover:bg-muted/30">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-5 py-3">
                    <Link
                      href={`/admin/sales/lead-costs?week=${week}`}
                      className="font-semibold hover:text-primary"
                    >
                      {weekLabel(week)}
                    </Link>
                    {i === 0 && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        This week
                      </span>
                    )}
                  </td>
                  {sources.map((s) => {
                    const c = cells[week][s.id];
                    return (
                      <td
                        key={s.id}
                        className="whitespace-nowrap px-4 py-3 text-right"
                      >
                        {!c.set ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              c.carried ? "text-amber-700" : "font-semibold",
                            )}
                          >
                            {c.carried && (
                              <CornerDownRight className="h-3.5 w-3.5" />
                            )}
                            {formatCurrency(c.cost)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
