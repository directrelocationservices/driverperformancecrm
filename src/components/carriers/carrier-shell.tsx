// File: src/components/carriers/carrier-shell.tsx
// (NEW file)

"use client";

import { PortalShell } from "@/components/shared/portal-shell";
import { CARRIER_NAV_GROUPS } from "@/lib/nav";
import type { User } from "@/types";

export function CarrierShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  return (
    <PortalShell
      user={user}
      roleLabel="Carrier"
      homeHref="/carrier"
      navGroups={CARRIER_NAV_GROUPS}
    >
      {children}
    </PortalShell>
  );
}
