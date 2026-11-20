// File: src/app/(admin)/admin/carriers/page.tsx
// (NEW file)

import Link from "next/link";
import { after } from "next/server";
import { AlertTriangle, Building2, ChevronRight, Phone } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  flagCarrierInsurance,
  getCarrierScores,
  getCarriers,
} from "@/lib/data";
import { resolveFilters, type FilterParams } from "@/lib/periods";
import { insuranceStatus } from "@/lib/carriers";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pill } from "@/components/shared/pill";
import { CarrierDialogButton } from "@/components/carriers/carrier-dialog";
import { InsurancePill } from "@/components/carriers/insurance-pill";
import { ScorecardTable } from "@/components/carriers/scorecard-table";
import { FilterBar } from "@/components/admin/filter-bar";

export const metadata = { title: "Carriers" };

export default async function CarriersPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  await requireRole("admin");
  after(flagCarrierInsurance); // insurance expiry emails, after the page is sent
  const { range, label } = resolveFilters(await searchParams);
  const [carriers, scores] = await Promise.all([
    getCarriers(),
    getCarrierScores({ range }),
  ]);
  const active = carriers.filter((c) => c.active);
  const attention = active.filter((c) => {
    const k = insuranceStatus(c.insuranceExpires).kind;
    return k === "expired" || k === "expiring";
  }).length;

  return (
    <div>
      <PageHeader
        title="Carriers"
        description={`${active.length} active carrier${active.length === 1 ? "" : "s"} · partner companies that deliver jobs`}
        actions={<CarrierDialogButton />}
      />

      {attention > 0 && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {attention} carrier{attention === 1 ? "'s" : "s'"} insurance{" "}
          {attention === 1 ? "is" : "are"} expired or expiring in the next 30
          days.
        </p>
      )}

      {carriers.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold sm:text-xl">
            Carrier comparison
          </h2>
          <FilterBar showVerified={false} />
          <p className="-mt-3 mb-4 text-sm text-muted-foreground">
            Showing {label} · by job date · net cost = paid to customers minus
            charged back
          </p>
          <ScorecardTable rows={scores} />
        </section>
      )}

      {carriers.length > 0 && (
        <h2 className="mb-3 text-lg font-bold sm:text-xl">All carriers</h2>
      )}
      {carriers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No carriers yet"
          description="Add the partner companies that deliver your jobs, with their insurance certificate."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {carriers.map((c) => (
            <Link
              key={c.id}
              href={`/admin/carriers/${c.id}`}
              className={`group block rounded-xl border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm ${c.active ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold leading-tight">
                    {c.companyName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[
                      c.usdot && `USDOT ${c.usdot}`,
                      c.mcNumber &&
                        `MC ${c.mcNumber.replace(/^MC[-\s]*/i, "")}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No USDOT / MC"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.active ? (
                  <InsurancePill status={insuranceStatus(c.insuranceExpires)} />
                ) : (
                  <Pill>Inactive</Pill>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {c.contactName || c.contactPhone || "—"}
                    </span>
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Insurance expires
                  </p>
                  <p className="truncate font-semibold">
                    {c.insuranceExpires ? formatDate(c.insuranceExpires) : "—"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
