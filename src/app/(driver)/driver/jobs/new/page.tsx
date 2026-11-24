// File: src/app/(driver)/driver/jobs/new/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getDrivers, getTripBlocks } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { NewJobForm } from "@/components/driver/new-job-form";
import { DriverFormLayout } from "@/components/driver/form-layout";
import { TripBlocks } from "@/components/fleet/trip-blocks";

export default async function NewJobPage() {
  const user = await requireRole("driver");
  const [drivers, blocks] = await Promise.all([
    getDrivers(),
    getTripBlocks(user.id),
  ]);

  return (
    <div>
      <Link
        href="/driver"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader
        title="New job"
        description="Enter the job details before loading."
      />
      {blocks.length ? (
        // Expired documents or a trip hold: no new trip until it's fixed
        <TripBlocks blocks={blocks} />
      ) : (
        <DriverFormLayout
          tips={[
            "Enter the job number exactly as it appears on the paperwork.",
            "Tap every crew member who worked this job with you.",
            "Pick Partner if a partner crew is doing the delivery.",
            "No signal? The job saves on this phone and uploads when you're back online.",
          ]}
        >
          <NewJobForm
            currentUserId={user.id}
            drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          />
        </DriverFormLayout>
      )}
    </div>
  );
}
