// File: src/app/(driver)/driver/monthly-check/[id]/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getMonthlyCheck, getTruck } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { MonthlyCheckList } from "@/components/fleet/monthly-check-list";

export const metadata = { title: "Monthly truck check" };

export default async function MonthlyCheckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("driver");
  const { id } = await params;
  const check = await getMonthlyCheck(id);
  if (!check || check.driverId !== user.id) notFound();
  const truck = await getTruck(check.truckId);

  return (
    <div className="space-y-5">
      <Link
        href="/driver/pre-trip"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pre-trip checks
      </Link>
      <PageHeader title="Monthly truck check" />
      <p className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
        <CheckCircle2 className="h-5 w-5 shrink-0" /> Saved. Thank you!
      </p>
      <MonthlyCheckList
        checks={[check]}
        units={truck ? { [truck.id]: truck.unitNumber } : {}}
      />
    </div>
  );
}
