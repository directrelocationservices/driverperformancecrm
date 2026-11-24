// File: src/app/(admin)/admin/sales/reps/[id]/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getLeadSources, getLeads, getUserById, toSalesView } from "@/lib/data";
import { resolveFilters, type FilterParams } from "@/lib/periods";
import {
  SALES_VIEW_NOTE,
  SALES_VIEW_OPTIONS,
  STATUS_OPTIONS,
  resolveSourceId,
  resolveStatus,
  sourceNameMap,
  sourceOptions,
} from "@/lib/sales";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Pill } from "@/components/shared/pill";
import { FilterBar } from "@/components/admin/filter-bar";
import { ParamPills } from "@/components/shared/param-pills";
import { RepPerformance } from "@/components/sales/rep-performance";
import { LeadsTable } from "@/components/sales/leads-table";

export default async function AdminRepProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<
    FilterParams & { source?: string; status?: string; view?: string }
  >;
}) {
  await requireRole("admin");
  const { id } = await params;
  const rep = await getUserById(id);
  // Admins with a Granot name have their own leads page too
  if (!rep || (rep.role !== "sales_rep" && rep.role !== "admin")) notFound();

  const sp = await searchParams;
  const { range, label } = resolveFilters(sp);
  const sources = await getLeadSources(true);
  const sourceId = resolveSourceId(sp.source, sources);
  const view = toSalesView(sp.view);
  const leads = await getLeads({
    repId: id,
    range,
    sourceId,
    status: resolveStatus(sp.status),
  });

  return (
    <div>
      <Link
        href="/admin/sales"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Sales reps
      </Link>

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
        <UserAvatar name={rep.name} src={rep.avatarUrl} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">{rep.name}</h1>
            {rep.active ? (
              <Pill tone="success">Active</Pill>
            ) : (
              <Pill>Inactive</Pill>
            )}
          </div>
          <a
            href={`mailto:${rep.email}`}
            className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-4 w-4" /> {rep.email}
          </a>
        </div>
      </div>

      <FilterBar showVerified={false} />
      <ParamPills
        param="source"
        options={sourceOptions(sources)}
        allLabel="All sources"
        label="Source"
        className="-mt-2 mb-6"
      />
      <ParamPills
        param="view"
        options={SALES_VIEW_OPTIONS}
        allLabel="Granot report"
        label="Count"
        className="-mt-3 mb-1"
      />
      <p className="mb-5 text-xs text-muted-foreground">
        Showing {label} · {SALES_VIEW_NOTE[view]}
      </p>

      <RepPerformance
        linkJobs
        repId={id}
        range={range}
        sourceId={sourceId}
        view={view}
      />

      <section className="mt-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold sm:text-xl">Leads</h2>
            <p className="text-sm text-muted-foreground">
              Click the pencil to override a single lead&apos;s cost.
            </p>
          </div>
          <ParamPills param="status" options={STATUS_OPTIONS} allLabel="All" />
        </div>
        <LeadsTable
          leads={leads}
          sourceNames={sourceNameMap(sources)}
          editableCost
        />
      </section>
    </div>
  );
}
