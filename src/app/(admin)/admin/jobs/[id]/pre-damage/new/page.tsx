// File: src/app/(admin)/admin/jobs/[id]/pre-damage/new/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getJob } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { AdminPreDamageForm } from "@/components/admin/admin-pre-damage-form";

export default async function AdminPreDamagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const job = /^[0-9a-f-]{36}$/i.test(id) ? await getJob(id) : null;
  if (!job) notFound();
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
        title="Add pre-existing damage"
        description="For damage photos the driver sent by text or email."
      />
      <AdminPreDamageForm
        jobId={job.id}
        defaultCustomer={job.customerName}
        cancelHref={back}
      />
    </div>
  );
}
