// File: src/app/(admin)/admin/sales/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import {
  BadgePercent,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  Download,
  Receipt,
  Target,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getAllRepMetrics,
  getLeadSources,
  getRepMonthlyTrend,
  getReps,
  getSourceBreakdown,
} from "@/lib/data";
import { repTotals } from "@/lib/metrics";
import {
  filtersToQuery,
  resolveFilters,
  type FilterParams,
} from "@/lib/periods";
import { resolveSourceId, sourceNameMap, sourceOptions } from "@/lib/sales";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { FilterBar } from "@/components/admin/filter-bar";
import { ParamPills } from "@/components/shared/param-pills";
import { MetricChart } from "@/components/shared/metric-chart";
import { RepsTable, type RepRow } from "@/components/sales/reps-table";
import { SourceBreakdown } from "@/components/sales/source-breakdown";

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams & { source?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const { range, label } = resolveFilters(sp);
  const sources = await getLeadSources(true);
  const sourceId = resolveSourceId(sp.source, sources);
  const names = sourceNameMap(sources);

  const [metrics, reps, breakdown, trend] = await Promise.all([
    getAllRepMetrics({ range, sourceId }),
    getReps(true),
    getSourceBreakdown({ range }),
    getRepMonthlyTrend(undefined, 6),
  ]);

  const active = Object.fromEntries(reps.map((r) => [r.id, r.active]));
  // Admins' own leads: in the totals, listed by name, not in the rep comparison
  const adminRows = metrics.filter((m) => m.kind === "admin");
  const rows: RepRow[] = metrics
    .filter((m) => m.kind !== "admin")
    .map((m) => ({
      ...m,
      active: active[m.repId] ?? true, // "Unmatched" row isn't a person
    }));
  const t = repTotals(metrics);
  const exportQuery = `${filtersToQuery(sp)}${sourceId ? `&source=${sourceId}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Sales Reps"
        description={`${label}${sourceId ? ` · ${names[sourceId]}` : ""}`}
        actions={
          <a
            href={`/admin/sales/export?${exportQuery}`}
            className="flex h-11 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold transition hover:border-foreground/30"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        }
      />
      <FilterBar showVerified={false} />
      <ParamPills
        param="source"
        options={sourceOptions(sources)}
        allLabel="All sources"
        label="Source"
        className="-mt-2 mb-6"
      />

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-bold sm:text-xl">Company totals</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-5">
            <StatCard
              label="Leads"
              value={t.leads}
              hint={`${t.booked} booked`}
              icon={Users}
              tone="primary"
            />
            <StatCard
              label="Closing ratio"
              value={formatPercent(t.closingRatio)}
              icon={Target}
              tone="primary"
            />
            <StatCard
              label="Total lead cost"
              value={formatCurrency(t.totalLeadCost)}
              icon={DollarSign}
            />
            <StatCard
              label="Cost per acquisition"
              value={t.booked ? formatCurrency(Math.round(t.cpa)) : "—"}
              icon={BadgePercent}
            />
            <StatCard
              label="Revenue booked"
              value={formatCurrency(t.revenue)}
              icon={Receipt}
              className="col-span-2 md:col-span-1"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold sm:text-xl">Rep comparison</h2>
          <RepsTable rows={rows} />
        </section>

        {adminRows.length > 0 && (
          <section>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold sm:text-xl">
              <ShieldCheck className="h-5 w-5 text-primary" /> Admin leads
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Leads worked by admins in Granot. They count in the company and
              lead source totals, but not in the rep comparison.
            </p>
            <div className="divide-y rounded-xl border bg-card">
              {adminRows.map((r) => (
                <Link
                  key={r.repId}
                  href={`/admin/sales/reps/${r.repId}`}
                  className="group flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 hover:bg-muted/40 sm:px-5"
                >
                  <span className="min-w-[160px] flex-1 font-semibold">
                    {r.repName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {r.leads} leads · {r.booked} booked ·{" "}
                    {formatPercent(r.closingRatio)} ·{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(r.revenue)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
          <SourceBreakdown rows={breakdown} title="Company by lead source" />
          <MetricChart
            title="Company trend"
            subtitle="Last 6 months, all reps"
            data={trend as unknown as Record<string, string | number>[]}
            xKey="month"
            metrics={[
              { key: "leads", label: "Leads", format: "number" },
              { key: "booked", label: "Booked", format: "number" },
              { key: "closingRatio", label: "Close %", format: "percent" },
              { key: "cpa", label: "CPA", format: "currency" },
              { key: "revenue", label: "Revenue", format: "currency" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
