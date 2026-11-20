// File: src/app/(admin)/admin/carriers/[id]/claims/new/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getCarrier, getPartnerJobsFor, getUsers } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ClaimForm } from "@/components/carriers/claim-form";

export default async function NewClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  await requireRole("admin");
  const carrier = await getCarrier((await params).id);
  if (!carrier) notFound();
  const [jobs, users] = await Promise.all([
    getPartnerJobsFor(carrier.id),
    getUsers(),
  ]);
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const { job } = await searchParams;

  return (
    <div className="max-w-3xl">
      <Link
        href={`/admin/carriers/${carrier.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {carrier.companyName}
      </Link>
      <PageHeader
        title="Add damage claim"
        description={`Damage on a job ${carrier.companyName} delivered. Pickup photos from the job show next to it.`}
      />
      {jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          No partner-delivered jobs yet. On the job page, set &quot;Delivered
          by&quot; to Partner first.
        </p>
      ) : (
        <ClaimForm
          carrierId={carrier.id}
          defaultJobId={jobs.some((j) => j.id === job) ? job : undefined}
          jobs={jobs.map((j) => ({
            id: j.id,
            label: `${j.jobNumber} · ${formatDate(j.date)} · ${names[j.driverId] ?? "Driver"}${j.carrierId ? "" : " · no carrier yet"}`,
          }))}
        />
      )}
    </div>
  );
}
