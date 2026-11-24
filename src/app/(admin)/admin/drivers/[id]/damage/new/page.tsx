// File: src/app/(admin)/admin/drivers/[id]/damage/new/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getAdmins,
  getAllJobSummaries,
  getCarriers,
  getDrivers,
  getUserById,
} from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { AdminDamageForm } from "@/components/admin/admin-damage-form";

export default async function AdminDriverDamagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireRole("admin");
  const { id } = await params;
  const driver = await getUserById(id);
  if (!driver || driver.role !== "driver") notFound();
  const [jobs, drivers, admins, carriers] = await Promise.all([
    getAllJobSummaries({ driverId: id }),
    getDrivers(true),
    getAdmins(),
    getCarriers(),
  ]);
  const name = new Map(drivers.map((d) => [d.id, d.name]));

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
        description="For damage a customer reports after the move (a call, a claim or an inspection). It counts against the driver or partner carrier you attribute it to."
      />
      <AdminDamageForm
        jobs={jobs.map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          date: j.date,
          partner: j.deliveredBy === "partner",
          crew: Array.from(new Set([j.driverId, ...j.crewIds])).map((cid) => ({
            id: cid,
            name: name.get(cid) ?? "Driver",
          })),
          carrierId: j.carrierId,
        }))}
        cancelHref={`/admin/drivers/${id}`}
        admins={admins.map((a) => ({ id: a.id, name: a.name }))}
        currentAdminId={me.id}
        carriers={carriers
          .filter((c) => c.active)
          .map((c) => ({ id: c.id, name: c.companyName }))}
      />
    </div>
  );
}
