// File: src/app/(admin)/admin/jobs/new/page.tsx
// (NEW file)

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getCarriers, getDrivers } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { AdminJobForm } from "@/components/admin/admin-job-form";

export default async function AdminNewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ driver?: string }>;
}) {
  await requireRole("admin");
  const { driver } = await searchParams;
  const [drivers, carriers] = await Promise.all([
    getDrivers(),
    getCarriers(false),
  ]);
  const fromDriver = drivers.find((d) => d.id === driver);
  const back = fromDriver
    ? `/admin/drivers/${fromDriver.id}`
    : "/admin/drivers";

  return (
    <div className="max-w-3xl">
      <Link
        href={back}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {fromDriver?.name ?? "Drivers"}
      </Link>
      <PageHeader
        title="Add job"
        description="For a job the driver didn't enter. It's labeled as entered by the office, with your name and the time, and counts in the driver's stats."
      />
      <AdminJobForm
        drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
        carriers={carriers.map((c) => ({ id: c.id, name: c.companyName }))}
        defaultDriverId={fromDriver?.id}
        cancelHref={back}
      />
    </div>
  );
}
