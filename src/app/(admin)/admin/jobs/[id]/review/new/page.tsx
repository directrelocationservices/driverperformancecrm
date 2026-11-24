// File: src/app/(admin)/admin/jobs/[id]/review/new/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getJob, getRepForJobNumber, getReps, getUserById } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { AdminReviewForm } from "@/components/admin/admin-review-form";

export default async function AdminAddReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const job = /^[0-9a-f-]{36}$/i.test(id) ? await getJob(id) : null;
  if (!job) notFound();
  const [reps, driver, suggested] = await Promise.all([
    getReps(),
    getUserById(job.driverId),
    getRepForJobNumber(job.jobNumber),
  ]);
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
        title="Add review"
        description="A customer review for this job. Say whether it's about the sales rep, the driver, or both."
      />
      <AdminReviewForm
        jobId={job.id}
        reps={reps.map((r) => ({ id: r.id, name: r.name }))}
        driverName={driver?.name ?? "driver"}
        suggestedRepId={suggested}
        cancelHref={back}
      />
    </div>
  );
}
