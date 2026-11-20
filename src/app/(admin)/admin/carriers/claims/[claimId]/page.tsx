// File: src/app/(admin)/admin/carriers/claims/[claimId]/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getAuditLog,
  getCarrier,
  getCarrierClaimDetail,
  getUsers,
} from "@/lib/data";
import { ACTION_LABELS, diffLines } from "@/lib/audit";
import { formatDate, formatDateTimeET } from "@/lib/format";
import { Pill } from "@/components/shared/pill";
import { ClaimStatusPill } from "@/components/carriers/claim-status-pill";
import { ClaimView } from "@/components/carriers/claim-view";
import { ClaimEdit, ClaimDeleteButton } from "@/components/carriers/claim-edit";
import { ClaimNotes } from "@/components/carriers/claim-notes";

export default async function AdminClaimPage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  await requireRole("admin");
  const claim = await getCarrierClaimDetail((await params).claimId);
  if (!claim) notFound();
  const [carrier, users, audit] = await Promise.all([
    getCarrier(claim.carrierId),
    getUsers(),
    getAuditLog({ entityId: claim.id }),
  ]);
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const history = audit;

  return (
    <div className="space-y-5 sm:space-y-6">
      <Link
        href={`/admin/carriers/${claim.carrierId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {carrier?.companyName ?? "Carrier"}
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Damage claim · {carrier?.companyName}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            Job {claim.jobNumber}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ClaimStatusPill status={claim.status} />
            {claim.deletedAt && <Pill tone="danger">Deleted</Pill>}
            <span>
              Job date {claim.jobDate ? formatDate(claim.jobDate) : "—"}
            </span>
            <span>
              · Added by {names[claim.createdBy ?? ""] ?? "Unknown"},{" "}
              {formatDateTimeET(claim.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/jobs/${claim.jobId}`}
            className="flex h-11 items-center rounded-lg border bg-white px-4 text-sm font-semibold hover:border-foreground/30"
          >
            Open job
          </Link>
          <ClaimDeleteButton id={claim.id} deleted={!!claim.deletedAt} />
        </div>
      </div>

      <ClaimView claim={claim} />
      {!claim.deletedAt && <ClaimEdit claim={claim} />}
      <ClaimNotes
        claimId={claim.id}
        notes={claim.notes}
        names={names}
        mode="admin"
      />

      {history.length > 0 && (
        <details className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold">
            <History className="h-4 w-4 text-muted-foreground" />
            Claim history ({history.length})
            <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
              Show
            </span>
          </summary>
          <ol className="space-y-3 border-t px-5 py-4">
            {history.map((a) => (
              <li key={a.id} className="text-sm">
                <p className="font-semibold">
                  {ACTION_LABELS[a.action]} by {names[a.changedBy] ?? "Unknown"}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {formatDateTimeET(a.changedAt)}
                  </span>
                </p>
                {a.action !== "create" && (
                  <ul className="mt-1 space-y-0.5">
                    {diffLines(a.before, a.after).map((d) => (
                      <li key={d.field} className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {d.field}:
                        </span>{" "}
                        <span className="line-through">{d.from}</span> →{" "}
                        <span className="text-foreground">{d.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
