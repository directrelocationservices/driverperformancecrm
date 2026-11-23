// File: src/app/(admin)/admin/offloads/page.tsx
// (NEW file)

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CloudOff,
  MapPin,
  PackageCheck,
} from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getRecentOffloads, getUsers } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { Pill } from "@/components/shared/pill";
import { offloadWhere } from "@/components/shared/offload-card";
import { formatDateTimeET } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OFFLOAD_DESTINATION_LABELS } from "@/types";

export const metadata = { title: "Offloads" };

export default async function OffloadsPage({
  searchParams,
}: {
  searchParams: Promise<{ missing?: string }>;
}) {
  await requireRole("admin");
  const { missing } = await searchParams;
  const onlyMissing = missing === "1";
  const [all, users] = await Promise.all([getRecentOffloads(), getUsers()]);
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const rows = onlyMissing
    ? all.filter((o) => o.forms.some((f) => !f.files.length))
    : all;

  const tab = (active: boolean) =>
    cn(
      "flex h-10 items-center rounded-lg px-4 text-sm font-semibold transition",
      active
        ? "bg-secondary text-white"
        : "border bg-white hover:border-foreground/30",
    );

  return (
    <div>
      <PageHeader
        title="Offloads"
        description="Every offload drivers submit, newest first: where, photos, location and paperwork."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/offloads" className={tab(!onlyMissing)}>
          All
        </Link>
        <Link href="/admin/offloads?missing=1" className={tab(onlyMissing)}>
          Missing paperwork
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-4 py-14 text-center">
          <PackageCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No offloads yet</p>
          <p className="text-sm text-muted-foreground">
            They appear here as soon as a driver submits one.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((o) => {
            const miss = o.forms.filter((f) => !f.files.length);
            const where = offloadWhere(o);
            return (
              <Link
                key={o.id}
                href={`/admin/jobs/${o.jobId}`}
                className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition hover:border-foreground/30 sm:flex-row sm:items-center"
              >
                {o.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.photos[0]}
                    alt=""
                    className="h-20 w-full shrink-0 rounded-lg object-cover sm:w-28"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">Job {o.jobNumber}</p>
                    <Pill tone="primary">
                      {OFFLOAD_DESTINATION_LABELS[o.destination]}
                    </Pill>
                    {o.syncedOffline && (
                      <Pill tone="warning">
                        <CloudOff className="h-3 w-3" /> Saved offline
                      </Pill>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {names[o.driverId] ?? "Driver"} ·{" "}
                    {formatDateTimeET(o.receivedAtServer)} · {o.photos.length}{" "}
                    photos
                  </p>
                  {where && <p className="truncate text-sm">{where}</p>}
                  {o.address && (
                    <p className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{o.address}</span>
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {o.forms.length === 0 ? null : miss.length ? (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-semibold",
                        miss.some((f) => f.required)
                          ? "text-destructive"
                          : "text-amber-700",
                      )}
                    >
                      <AlertCircle className="h-4 w-4" /> Missing:{" "}
                      {miss.map((f) => f.name).join(", ")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                      <CheckCircle2 className="h-4 w-4" /> Paperwork complete
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
