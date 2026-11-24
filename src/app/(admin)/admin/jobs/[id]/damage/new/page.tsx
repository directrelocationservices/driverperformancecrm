// File: src/app/(admin)/admin/jobs/[id]/damage/new/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getAdmins, getCarriers, getDrivers, getJob } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { AdminDamageForm } from "@/components/admin/admin-damage-form";

export default async function AdminJobDamagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireRole("admin");
  const { id } = await params;
  const job = /^[0-9a-f-]{36}$/i.test(id) ? await getJob(id) : null;
  if (!job) notFound();
  const [drivers, admins, carriers] = await Promise.all([
    getDrivers(true),
    getAdmins(),
    getCarriers(),
  ]);
  const name = new Map(drivers.map((d) => [d.id, d.name]));
  const crewIds = Array.from(new Set([job.driverId, ...job.crewIds]));

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
        description="For damage a customer reports after the move (a call, a claim or an inspection). It counts against the driver or partner carrier you attribute it to."
      />
      <AdminDamageForm
        jobs={[
          {
            id: job.id,
            jobNumber: job.jobNumber,
            date: job.date,
            partner: job.deliveredBy === "partner",
            crew: crewIds.map((cid) => ({
              id: cid,
              name: name.get(cid) ?? "Driver",
            })),
            carrierId: job.carrierId,
          },
        ]}
        fixedJobId={job.id}
        cancelHref={`/admin/jobs/${job.id}`}
        admins={admins.map((a) => ({ id: a.id, name: a.name }))}
        currentAdminId={me.id}
        carriers={carriers
          .filter((c) => c.active || c.id === job.carrierId)
          .map((c) => ({ id: c.id, name: c.companyName }))}
      />
    </div>
  );
}
