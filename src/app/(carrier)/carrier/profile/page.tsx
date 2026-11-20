// File: src/app/(carrier)/carrier/profile/page.tsx
// (NEW file)

import { requireRole } from "@/lib/auth/session";
import { AccountView } from "@/components/account/account-view";

export const metadata = { title: "My profile" };

export default async function CarrierProfilePage() {
  const user = await requireRole("carrier");
  return <AccountView user={user} />;
}
