// File: src/app/(admin)/admin/carriers/[id]/page.tsx
// (NEW file)

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  Percent,
  Plus,
  Receipt,
  Truck,
  Hash,
  Mail,
  Phone,
  ShieldCheck,
  StickyNote,
  UserRound,
} from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getCarrier,
  getCarrierClaims,
  getCarrierFileUrl,
  getCarrierLogins,
  getCarrierScores,
} from "@/lib/data";
import { insuranceStatus } from "@/lib/carriers";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { resolveFilters, type FilterParams } from "@/lib/periods";
import { StatCard } from "@/components/shared/stat-card";
import { FilterBar } from "@/components/admin/filter-bar";
import { ClaimStatusPill } from "@/components/carriers/claim-status-pill";
import { CarrierLogins } from "@/components/carriers/carrier-logins";
import { Pill } from "@/components/shared/pill";
import { CarrierDialogButton } from "@/components/carriers/carrier-dialog";
import { InsurancePill } from "@/components/carriers/insurance-pill";

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 break-words font-medium">{children}</div>
      </div>
    </div>
  );
}

export default async function CarrierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FilterParams>;
}) {
  await requireRole("admin");
  const carrier = await getCarrier((await params).id);
  if (!carrier) notFound();
  const { range, label } = resolveFilters(await searchParams);
  const [fileUrl, claims, [score], logins] = await Promise.all([
    getCarrierFileUrl(carrier.insurancePath),
    getCarrierClaims({ carrierId: carrier.id }),
    getCarrierScores({ range, carrierId: carrier.id }),
    getCarrierLogins(carrier.id),
  ]);
  const status = insuranceStatus(carrier.insuranceExpires);

  return (
    <div className="space-y-5 sm:space-y-6">
      <Link
        href="/admin/carriers"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All carriers
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {carrier.companyName}
            </h1>
            {carrier.active ? (
              <Pill tone="success">Active</Pill>
            ) : (
              <Pill>Inactive</Pill>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <InsurancePill status={status} />
          </div>
        </div>
        <CarrierDialogButton carrier={carrier} />
      </div>

      {/* Scorecard */}
      <section>
        <h2 className="mb-3 text-lg font-bold sm:text-xl">Scorecard</h2>
        <FilterBar showVerified={false} />
        <p className="-mt-3 mb-4 text-sm text-muted-foreground">
          Showing {label} · by job date
        </p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            label="Partner jobs"
            value={score?.jobs ?? 0}
            icon={Truck}
            tone="primary"
          />
          <StatCard
            label="Claims"
            value={score?.claims ?? 0}
            hint={score?.openClaims ? `${score.openClaims} open` : undefined}
            icon={AlertTriangle}
          />
          <StatCard
            label="Claim rate"
            value={score?.jobs ? formatPercent(score.claimRate) : "—"}
            hint="Jobs with a claim"
            icon={Percent}
          />
          <StatCard
            label="Net damage cost"
            value={formatCurrency(score?.netCost ?? 0)}
            hint="Paid minus charged back"
            icon={DollarSign}
          />
          <StatCard
            label="Claimed"
            value={formatCurrency(score?.claimed ?? 0)}
            icon={ClipboardList}
          />
          <StatCard
            label="Paid to customers"
            value={formatCurrency(score?.paid ?? 0)}
            icon={Receipt}
          />
          <StatCard
            label="Charged back"
            value={formatCurrency(score?.chargedBack ?? 0)}
            icon={DollarSign}
          />
        </div>
      </section>

      {/* Claims */}
      <section className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3.5 sm:px-5">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Damage claims</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
            {claims.length}
          </span>
          <Link
            href={`/admin/carriers/${carrier.id}/claims/new`}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold transition hover:border-foreground/30"
          >
            <Plus className="h-4 w-4" /> Add claim
          </Link>
        </div>
        {claims.length === 0 ? (
          <p className="p-5 text-center text-sm text-muted-foreground">
            No claims. Add one when a partner delivery has damage.
          </p>
        ) : (
          <div className="divide-y">
            {claims.map((c) => (
              <Link
                key={c.id}
                href={`/admin/carriers/claims/${c.id}`}
                className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 sm:px-5"
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
                    {formatCurrency(c.claimAmount)} · Paid{" "}
                    {formatCurrency(c.paidAmount)} · Charged back{" "}
                    {formatCurrency(c.chargedBackAmount)}
                  </p>
                </div>
                <ClaimStatusPill status={c.status} />
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-bold">Company</h2>
          <div className="divide-y">
            <Row icon={Hash} label="USDOT">
              {carrier.usdot || "—"}
            </Row>
            <Row icon={Hash} label="MC number">
              {carrier.mcNumber || "—"}
            </Row>
            <Row icon={UserRound} label="Contact">
              {carrier.contactName || "—"}
            </Row>
            <Row icon={Phone} label="Phone">
              {carrier.contactPhone ? (
                <a
                  href={`tel:${carrier.contactPhone}`}
                  className="text-primary hover:underline"
                >
                  {carrier.contactPhone}
                </a>
              ) : (
                "—"
              )}
            </Row>
            <Row icon={Mail} label="Email">
              {carrier.contactEmail ? (
                <a
                  href={`mailto:${carrier.contactEmail}`}
                  className="text-primary hover:underline"
                >
                  {carrier.contactEmail}
                </a>
              ) : (
                "—"
              )}
            </Row>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-4 text-lg font-bold">Insurance</h2>
            <div className="divide-y">
              <Row icon={ShieldCheck} label="Expires">
                {carrier.insuranceExpires
                  ? formatDate(carrier.insuranceExpires)
                  : "—"}
              </Row>
              <Row icon={FileText} label="Certificate">
                {fileUrl ? (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {carrier.insuranceFileName ?? "Open certificate"}
                  </a>
                ) : (
                  "Not uploaded"
                )}
              </Row>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Admins get an email 30 days before the insurance expires.
            </p>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <StickyNote className="h-5 w-5 text-primary" /> Notes
            </h2>
            <p className="whitespace-pre-line text-[15px]">
              {carrier.notes || (
                <span className="text-muted-foreground">No notes.</span>
              )}
            </p>
          </section>
        </div>
      </div>

      <CarrierLogins carrierId={carrier.id} logins={logins} />
    </div>
  );
}
