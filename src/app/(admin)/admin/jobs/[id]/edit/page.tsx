// File: src/app/(admin)/admin/jobs/[id]/edit/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getCarriers, getDrivers, getJob } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { AdminJobForm } from "@/components/admin/admin-job-form";

export default async function AdminEditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const job = /^[0-9a-f-]{36}$/i.test(id) ? await getJob(id) : null;
  if (!job) notFound();

  const [drivers, carriers] = await Promise.all([
    getDrivers(true),
    getCarriers(),
  ]);
  // Inactive drivers only show when they're already on this job
  const onJob = new Set([job.driverId, ...job.crewIds]);
  const driverOptions = drivers
    .filter((d) => d.active || onJob.has(d.id))
    .map((d) => ({
      id: d.id,
      name: d.active ? d.name : `${d.name} (inactive)`,
    }));
  const carrierOptions = carriers
    .filter((c) => c.active || c.id === job.carrierId)
    .map((c) => ({ id: c.id, name: c.companyName }));
  const back = `/admin/jobs/${job.id}`;

  return (
    <div className="max-w-3xl">
      <Link
        href={back}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Job {job.jobNumber}
      </Link>
      <PageHeader
        title="Edit job"
        description="Every change is saved in the job's record history with your name and the time."
      />
      <AdminJobForm
        drivers={driverOptions}
        carriers={carrierOptions}
        job={job}
        cancelHref={back}
      />
    </div>
  );
}
