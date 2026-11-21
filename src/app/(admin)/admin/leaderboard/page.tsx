// File: src/app/(admin)/admin/leaderboard/page.tsx
// (REPLACE the whole file)

import { ShieldCheck, Star, Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getAllDriverMetrics,
  getSalesLeaderboard,
  getSalesSettings,
} from "@/lib/data";
import { lowestDamage, topReviews, topUpsells } from "@/lib/metrics";
import { resolveFilters, type FilterParams } from "@/lib/periods";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { RankList } from "@/components/admin/rank-list";
import { ParamPills } from "@/components/shared/param-pills";
import { SalesLeaderboard } from "@/components/sales/sales-leaderboard";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams & { tab?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const { range, verifiedOnly, label } = resolveFilters(sp);
  const tabs = (
    <ParamPills
      param="tab"
      options={[{ value: "sales", label: "Sales" }]}
      allLabel="Drivers"
      className="mb-4"
    />
  );

  if (sp.tab === "sales") {
    const [rows, settings] = await Promise.all([
      getSalesLeaderboard(range),
      getSalesSettings(),
    ]);
    return (
      <div>
        <PageHeader
          title="Leaderboard"
          description={`Top sales reps · ${label}`}
        />
        {tabs}
        <FilterBar showVerified={false} />
        <SalesLeaderboard rows={rows} minLeads={settings.leaderboardMinLeads} />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Counted like Granot&apos;s Salesmen Performance. Active sales reps
          only. Close % needs at least {settings.leaderboardMinLeads} leads
          (change it in Settings).
        </p>
      </div>
    );
  }

  const rows = await getAllDriverMetrics({ range, verifiedOnly });

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        description={`Top drivers · ${label}${verifiedOnly ? " · Verified only" : ""}`}
      />
      {tabs}
      <FilterBar />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RankList
          title="Most reviews"
          icon={Star}
          rows={topReviews(rows, 10)}
        />
        <RankList
          title="Top upsells"
          icon={Trophy}
          rows={topUpsells(rows, 10, formatCurrency)}
        />
        <RankList
          title="Lowest damage rate"
          icon={ShieldCheck}
          rows={lowestDamage(rows, 10)}
          className="md:col-span-2 xl:col-span-1"
        />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Damage on partner-delivered jobs is excluded from damage rate.
      </p>
    </div>
  );
}
