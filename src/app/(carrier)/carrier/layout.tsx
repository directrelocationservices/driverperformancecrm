// File: src/app/(carrier)/carrier/layout.tsx
// (NEW file)

import { requireRole } from "@/lib/auth/session";
import { CarrierShell } from "@/components/carriers/carrier-shell";

export default async function CarrierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("carrier");
  return <CarrierShell user={user}>{children}</CarrierShell>;
}
