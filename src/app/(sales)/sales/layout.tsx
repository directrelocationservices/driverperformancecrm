// File: src/app/(sales)/sales/layout.tsx
// (REPLACE the whole file)

import { requireRole } from "@/lib/auth/session";
import { getSalesSettings } from "@/lib/data";
import { SalesShell } from "@/components/sales/sales-shell";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("sales_rep");
  const { repsSeeLeaderboard } = await getSalesSettings();
  return (
    <SalesShell user={user} showLeaderboard={repsSeeLeaderboard}>
      {children}
    </SalesShell>
  );
}
