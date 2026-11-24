// File: src/components/sales/rep-performance.tsx
// (REPLACE the whole file)

import Link from "next/link";
import {
  BadgePercent,
  CalendarCheck,
  DollarSign,
  Receipt,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import {
  getRepMetrics,
  getRepMonthlyTrend,
  getRepReviews,
  getSourceBreakdown,
} from "@/lib/data";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { REVIEW_PLATFORM_LABELS, type ReviewPlatform } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import { StatCard } from "@/components/shared/stat-card";
import { MetricChart } from "@/components/shared/metric-chart";
import { SourceBreakdown } from "./source-breakdown";
import type { DateRange, SalesView } from "@/types";

export async function RepPerformance({
  repId,
  range,
  sourceId,
  view = "granot",
  linkJobs = false,
}: {
  repId: string;
  range?: DateRange;
  sourceId?: string;
  view?: SalesView;
  /** Admins can open the job of each review */
  linkJobs?: boolean;
}) {
  const [m, breakdown, trend, reviews] = await Promise.all([
    getRepMetrics(repId, { range, sourceId, view }),
    getSourceBreakdown({ repId, range, view }),
    getRepMonthlyTrend(repId, 6),
    getRepReviews({ repId, range }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard
          label={view === "granot" ? "Total In" : "Leads received"}
          value={m.leads}
          icon={Users}
          tone="primary"
        />
        <StatCard label="Booked" value={m.booked} icon={CalendarCheck} />
        <StatCard
          label="Closing ratio"
          value={formatPercent(m.closingRatio)}
          icon={Target}
          tone="primary"
        />
        <StatCard
          label="Total lead cost"
          value={formatCurrency(m.totalLeadCost)}
          icon={DollarSign}
        />
        <StatCard
          label="Cost per acquisition"
          value={m.booked ? formatCurrency(Math.round(m.cpa)) : "—"}
          icon={BadgePercent}
        />
        <StatCard
          label="Revenue booked"
          value={formatCurrency(m.revenue)}
          icon={Receipt}
        />
        <StatCard
          label="Good reviews / booked"
          value={m.booked ? (m.positivePerBooked ?? 0).toFixed(2) : "—"}
          hint={`${m.positiveReviews ?? 0} reviews (4–5 stars)`}
          icon={ThumbsUp}
        />
        <StatCard
          label="Bad reviews / booked"
          value={m.booked ? (m.negativePerBooked ?? 0).toFixed(2) : "—"}
          hint={`${m.negativeReviews ?? 0} reviews (1–2 stars)`}
          icon={ThumbsDown}
        />
      </div>

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Star className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg font-bold">Reviews</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
            {reviews.length}
          </span>
        </div>
        {reviews.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No reviews attributed to this rep in this period.
          </p>
        ) : (
          <ul className="divide-y">
            {reviews.map((r) => {
              const tone = r.stars >= 4 ? "good" : r.stars <= 2 ? "bad" : "mid";
              const job = r.jobNumber ? `Job ${r.jobNumber}` : "Job";
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold",
                      tone === "good" && "bg-green-100 text-green-800",
                      tone === "bad" && "bg-red-100 text-red-700",
                      tone === "mid" && "bg-muted text-foreground/70",
                    )}
                  >
                    {r.stars} ★
                  </span>
                  <span className="text-sm font-semibold">
                    {REVIEW_PLATFORM_LABELS[r.platform as ReviewPlatform] ??
                      r.platform}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    {r.reason ?? (
                      <span className="text-muted-foreground">
                        No reason given
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(r.reviewDate)} ·{" "}
                    {linkJobs ? (
                      <Link
                        href={`/admin/jobs/${r.jobId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {job}
                      </Link>
                    ) : (
                      job
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <SourceBreakdown rows={breakdown} />
        <MetricChart
          title="Monthly trend"
          subtitle="Last 6 months"
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
  );
}
