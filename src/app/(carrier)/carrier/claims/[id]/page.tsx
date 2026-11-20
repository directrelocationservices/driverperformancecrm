// File: src/app/(carrier)/carrier/claims/[id]/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getCarrierClaimDetail } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { ClaimStatusPill } from "@/components/carriers/claim-status-pill";
import { ClaimView } from "@/components/carriers/claim-view";
import { ClaimNotes } from "@/components/carriers/claim-notes";

export default async function CarrierClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireRole("carrier");
  // Returns nothing for another carrier's claim; internal notes are never included
  const claim = await getCarrierClaimDetail((await params).id);
  if (!claim || claim.deletedAt) notFound();

  return (
    <div className="space-y-5 sm:space-y-6">
      <Link
        href="/carrier"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All claims
      </Link>

      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Damage claim
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          Job {claim.jobNumber}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <ClaimStatusPill status={claim.status} />
          <span>
            Job date {claim.jobDate ? formatDate(claim.jobDate) : "—"}
          </span>
        </div>
      </div>

      <ClaimView claim={claim} />
      <ClaimNotes
        claimId={claim.id}
        notes={claim.notes}
        names={{ [me.id]: me.name }}
        otherName="Direct Relocation Services"
        mode="carrier"
      />
    </div>
  );
}
