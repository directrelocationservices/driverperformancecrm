// File: src/app/(admin)/admin/readiness/page.tsx
// (NEW file)

import Link from "next/link";
import { after } from "next/server";
import { Ban, CalendarCheck, CheckCircle2, FileWarning } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getLastMonthlyChecks,
  getOpenHolds,
  getReadinessOverview,
  getTrucks,
  getUsers,
  runExpiryAlerts,
} from "@/lib/data";
import { monthlyCheckDue } from "@/lib/readiness";
import { formatDate, formatDateTimeET } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ExpiryPill } from "@/components/fleet/doc-list";
import { HoldClear } from "@/components/fleet/hold-clear";

export const metadata = { title: "Roadside readiness" };

export default async function ReadinessPage() {
  await requireRole("admin");
  // Backup for the daily email job: sends any expiry alert that is due
  after(() =>
    runExpiryAlerts().catch((err) =>
      console.error("runExpiryAlerts failed", err),
    ),
  );

  const [rows, holds, trucks, users, lastMonthly] = await Promise.all([
    getReadinessOverview(),
    getOpenHolds(),
    getTrucks(false),
    getUsers(),
    getLastMonthlyChecks(),
  ]);
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const units = Object.fromEntries(trucks.map((t) => [t.id, t.unitNumber]));
  const dated = rows.filter(
    (r) => r.state === "expired" || r.state === "expiring",
  );
  const missing = rows.filter((r) => r.state === "missing");
  const monthlyDue = trucks.filter((t) => monthlyCheckDue(lastMonthly[t.id]));
  const href = (r: (typeof rows)[number]) =>
    r.owner === "truck"
      ? `/admin/trucks/${r.ownerId}`
      : `/admin/drivers/${r.ownerId}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Roadside readiness"
        description="Trip holds, documents that are expired or expire in the next 30 days, and monthly truck checks."
      />

      {/* Holds */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:text-xl">
          <Ban className="h-5 w-5 text-primary" /> Trips on hold
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
            {holds.length}
          </span>
        </h2>
        {holds.length ? (
          <div className="space-y-3">
            {holds.map((h) => (
              <div
                key={h.preTripId}
                className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5"
              >
                <p className="font-semibold">
                  {names[h.driverId] ?? "Driver"} · Unit{" "}
                  {units[h.truckId] ?? "—"}
                </p>
                <p className="text-sm text-foreground/80">
                  &quot;No&quot; on{" "}
                  {h.items
                    .map((i) => (i.notes ? `${i.label} (${i.notes})` : i.label))
                    .join(", ")}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatDateTimeET(h.at)} ·{" "}
                  <Link
                    href={`/admin/pre-trip/${h.preTripId}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    View pre-trip
                  </Link>
                </p>
                <HoldClear preTripId={h.preTripId} />
              </div>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-600" /> No trips on
            hold.
          </p>
        )}
      </section>

      {/* Expiring documents */}
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold sm:text-xl">
          <FileWarning className="h-5 w-5 text-primary" /> Expired or expiring
          in 30 days
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
            {dated.length}
          </span>
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          The driver and all admins get an email 30 days before, 7 days before
          and on the day it expires. Expired documents block the trip.
        </p>
        {dated.length ? (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Truck / driver</th>
                  <th className="px-3 py-3 text-left">Document</th>
                  <th className="px-3 py-3 text-left">Expires</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dated.map((r) => (
                  <tr key={`${r.ownerId}-${r.docType}`}>
                    <td className="px-5 py-3 font-semibold">
                      <Link
                        href={href(r)}
                        className="hover:text-primary hover:underline"
                      >
                        {r.ownerName}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{r.label}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {r.doc?.expiresOn ? formatDate(r.doc.expiresOn) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ExpiryPill status={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-600" /> Nothing expires
            in the next 30 days.
          </p>
        )}
      </section>

      {/* Missing documents */}
      {missing.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold sm:text-xl">
            Not uploaded yet{" "}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
              {missing.length}
            </span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {missing.map((r) => (
              <Link
                key={`${r.ownerId}-${r.docType}`}
                href={href(r)}
                className="rounded-xl border bg-card px-4 py-3 text-sm transition hover:border-primary/40"
              >
                <p className="font-semibold">{r.ownerName}</p>
                <p className="text-muted-foreground">{r.label}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Monthly checks */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold sm:text-xl">
          <CalendarCheck className="h-5 w-5 text-primary" /> Monthly truck check
          due
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
            {monthlyDue.length}
          </span>
        </h2>
        {monthlyDue.length ? (
          <div className="flex flex-wrap gap-2">
            {monthlyDue.map((t) => (
              <Link
                key={t.id}
                href={`/admin/trucks/${t.id}#monthly`}
                className="rounded-full border bg-card px-3 py-1.5 text-sm font-semibold hover:border-primary/40"
              >
                Unit {t.unitNumber}
                {t.assignedDriverId && names[t.assignedDriverId]
                  ? ` · ${names[t.assignedDriverId]}`
                  : ""}
              </Link>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-600" /> Every truck has
            its check for this month.
          </p>
        )}
      </section>
    </div>
  );
}
