// File: src/app/(carrier)/carrier/page.tsx
// (NEW file)

import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getCarrierClaims, getMyCarrier } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ClaimStatusPill } from "@/components/carriers/claim-status-pill";

export const metadata = { title: "Damage claims" };

export default async function CarrierHome() {
  await requireRole("carrier");
  // The database returns only this carrier's own company and claims
  const [carrier, claims] = await Promise.all([
    getMyCarrier(),
    getCarrierClaims(),
  ]);
  const open = claims.filter(
    (c) => c.status === "open" || c.status === "submitted",
  ).length;

  return (
    <div>
      <PageHeader
        title="Damage claims"
        description={`${carrier?.companyName ?? "Your company"} · ${open} open claim${open === 1 ? "" : "s"}`}
      />
      {claims.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No claims"
          description="Damage claims from Direct Relocation Services will show here."
        />
      ) : (
        <div className="divide-y rounded-2xl border bg-card">
          {claims.map((c) => (
            <Link
              key={c.id}
              href={`/carrier/claims/${c.id}`}
              className="group flex items-center gap-3 px-4 py-4 hover:bg-muted/40 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  Job {c.jobNumber}
                  <span className="font-normal text-muted-foreground">
                    · {c.item}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {c.jobDate ? formatDate(c.jobDate) : ""} · Claim{" "}
                  {formatCurrency(c.claimAmount)}
                  {c.chargedBackAmount > 0 &&
                    ` · Charged back ${formatCurrency(c.chargedBackAmount)}`}
                </p>
              </div>
              <ClaimStatusPill status={c.status} />
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
