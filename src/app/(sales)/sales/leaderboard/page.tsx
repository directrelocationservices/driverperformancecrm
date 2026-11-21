// File: src/app/(sales)/sales/leaderboard/page.tsx
// (NEW file)

import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getSalesLeaderboard, getSalesSettings } from "@/lib/data";
import { resolveFilters, type FilterParams } from "@/lib/periods";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { SalesLeaderboard } from "@/components/sales/sales-leaderboard";

export const metadata = { title: "Leaderboard" };

/** Only when an admin turns "Reps can see the leaderboard" on in Settings */
export default async function RepLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const user = await requireRole("sales_rep");
  const settings = await getSalesSettings();
  if (!settings.repsSeeLeaderboard) notFound();
  const { range, label } = resolveFilters(await searchParams);
  const rows = await getSalesLeaderboard(range);

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        description={`Top sales reps · ${label}`}
      />
      <FilterBar showVerified={false} />
      <SalesLeaderboard
        rows={rows}
        minLeads={settings.leaderboardMinLeads}
        hrefBase={null}
        highlightId={user.id}
      />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Close % needs at least {settings.leaderboardMinLeads} leads in the
        period.
      </p>
    </div>
  );
}
