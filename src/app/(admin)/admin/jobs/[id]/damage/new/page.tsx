// File: src/app/(admin)/admin/jobs/[id]/damage/new/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getJob, getUserById } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { AdminDamageForm } from "@/components/admin/admin-damage-form";

export default async function AdminJobDamagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const job = /^[0-9a-f-]{36}$/i.test(id) ? await getJob(id) : null;
  if (!job) notFound();
  const driver = await getUserById(job.driverId);

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/jobs/${job.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Job {job.jobNumber}
      </Link>
      <PageHeader
        title="Add damage"
        description={`Damage reported by a customer, a claim or an inspection. It counts in ${driver?.name ?? "the driver"}'s stats and score.`}
      />
      <AdminDamageForm
        jobs={[
          {
            id: job.id,
            jobNumber: job.jobNumber,
            date: job.date,
            partner: job.deliveredBy === "partner",
          },
        ]}
        fixedJobId={job.id}
        cancelHref={`/admin/jobs/${job.id}`}
      />
    </div>
  );
}
