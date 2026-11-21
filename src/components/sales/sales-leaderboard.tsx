// File: src/components/sales/sales-leaderboard.tsx
// (NEW file)

import { BadgePercent, CalendarCheck, DollarSign, Target } from "lucide-react";
import { RankList } from "@/components/admin/rank-list";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/data";
import type { RankRow } from "@/lib/metrics";

const TOP = 10;
const row = (r: LeaderboardRow, value: string, sub?: string): RankRow => ({
  id: r.repId,
  name: r.repName,
  value,
  sub,
});

/** Bookings, revenue, close % (with a minimum of leads) and CPA (lowest first) */
export function SalesLeaderboard({
  rows,
  minLeads,
  hrefBase = "/admin/sales/reps/",
  highlightId,
}: {
  rows: LeaderboardRow[];
  minLeads: number;
  hrefBase?: string | null;
  highlightId?: string;
}) {
  const bookings = rows
    .filter((r) => r.booked > 0)
    .sort((a, b) => b.booked - a.booked || b.revenue - a.revenue)
    .slice(0, TOP)
    .map((r) => row(r, String(r.booked), `${r.leads} leads`));

  const revenue = rows
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, TOP)
    .map((r) => row(r, formatCurrency(r.revenue)));

  const close = rows
    .filter((r) => r.leads >= minLeads)
    .sort((a, b) => b.closingRatio - a.closingRatio || b.booked - a.booked)
    .slice(0, TOP)
    .map((r) =>
      row(r, formatPercent(r.closingRatio), `${r.booked} of ${r.leads} leads`),
    );

  // Reps with no lead cost recorded can't rank on CPA
  const cpa = rows
    .filter((r) => r.booked > 0 && r.totalLeadCost > 0)
    .sort((a, b) => a.cpa - b.cpa)
    .slice(0, TOP)
    .map((r) =>
      row(r, formatCurrency(Math.round(r.cpa)), `${r.booked} booked`),
    );

  const common = { hrefBase, highlightId };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RankList
        title="Bookings"
        icon={CalendarCheck}
        rows={bookings}
        {...common}
      />
      <RankList
        title="Booked revenue"
        icon={DollarSign}
        rows={revenue}
        note="Jobs booked in the period"
        {...common}
      />
      <RankList
        title="Close %"
        icon={Target}
        rows={close}
        note={`Reps with at least ${minLeads} leads`}
        emptyText={`No rep has ${minLeads} or more leads in this period.`}
        {...common}
      />
      <RankList
        title="Cost per acquisition"
        icon={BadgePercent}
        rows={cpa}
        note="Lowest first"
        {...common}
      />
    </div>
  );
}
