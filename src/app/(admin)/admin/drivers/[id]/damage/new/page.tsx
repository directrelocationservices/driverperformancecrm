// File: src/app/(admin)/admin/drivers/[id]/damage/new/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getAllJobSummaries, getUserById } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { AdminDamageForm } from "@/components/admin/admin-damage-form";

export default async function AdminDriverDamagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const driver = await getUserById(id);
  if (!driver || driver.role !== "driver") notFound();
  const jobs = await getAllJobSummaries({ driverId: id });

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/drivers/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {driver.name}
      </Link>
      <PageHeader
        title="Add damage"
        description={`Damage reported by a customer, a claim or an inspection. It counts in ${driver.name}'s stats and score.`}
      />
      <AdminDamageForm
        jobs={jobs.map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          date: j.date,
          partner: j.deliveredBy === "partner",
        }))}
        cancelHref={`/admin/drivers/${id}`}
      />
    </div>
  );
}
