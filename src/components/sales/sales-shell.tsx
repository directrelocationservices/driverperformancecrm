// File: src/components/sales/sales-shell.tsx
// (REPLACE the whole file)

"use client";

import { PortalShell } from "@/components/shared/portal-shell";
import { SALES_LEADERBOARD_NAV, SALES_NAV_GROUPS } from "@/lib/nav";
import type { User } from "@/types";

export function SalesShell({
  user,
  showLeaderboard = false,
  children,
}: {
  user: User;
  showLeaderboard?: boolean;
  children: React.ReactNode;
}) {
  return (
    <PortalShell
      user={user}
      roleLabel="Sales Rep"
      homeHref="/sales"
      navGroups={
        showLeaderboard
          ? [...SALES_NAV_GROUPS, SALES_LEADERBOARD_NAV]
          : SALES_NAV_GROUPS
      }
    >
      {children}
    </PortalShell>
  );
}
