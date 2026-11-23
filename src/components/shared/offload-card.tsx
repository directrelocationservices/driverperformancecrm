// File: src/components/shared/offload-card.tsx
// (NEW file)

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CloudOff,
  ExternalLink,
  FileText,
  Lock,
  MapPin,
  User as UserIcon,
} from "lucide-react";
import { Pill } from "@/components/shared/pill";
import { PhotoThumb } from "@/components/shared/photo-thumb";
import { formatDateTimeET } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OFFLOAD_DESTINATION_LABELS, type Offload } from "@/types";

/** Where it went, in one line */
export function offloadWhere(o: Offload) {
  if (o.destination === "storage")
    return `${o.storageFacility ?? ""}, ${o.storageAddress ?? ""} · Unit ${o.storageUnit ?? ""}`;
  if (o.destination === "carrier") return o.carrierName ?? "Partner carrier";
  return "";
}

/** An offload record (driver and admin job pages) */
export function OffloadCard({
  offload: o,
  byName,
  actions,
  children,
}: {
  offload: Offload;
  /** Who submitted it (admin view) */
  byName?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const where = offloadWhere(o);
  const missing = o.forms.filter((f) => !f.files.length);

  return (
    <article
      className={cn("rounded-xl border p-4", o.deletedAt && "opacity-60")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {OFFLOAD_DESTINATION_LABELS[o.destination]}
          </p>
          {where && <p className="text-sm text-muted-foreground">{where}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {o.deletedAt && <Pill tone="danger">Deleted</Pill>}
          {o.locked && (
            <Pill tone="dark">
              <Lock className="h-3 w-3" /> Locked
            </Pill>
          )}
          {o.syncedOffline && (
            <Pill tone="warning">
              <CloudOff className="h-3 w-3" /> Saved offline
            </Pill>
          )}
          {missing.length > 0 ? (
            <Pill tone={missing.some((f) => f.required) ? "danger" : "warning"}>
              {missing.length} form{missing.length > 1 ? "s" : ""} missing
            </Pill>
          ) : (
            o.forms.length > 0 && <Pill tone="success">Paperwork complete</Pill>
          )}
          {actions}
        </div>
      </div>

      {o.note && <p className="mt-2 text-[15px]">{o.note}</p>}

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {o.photos.map((src, i) => (
          <PhotoThumb key={src + i} src={src} alt={`Offload photo ${i + 1}`} />
        ))}
      </div>

      {o.forms.length > 0 && (
        <div className="mt-4 rounded-lg border">
          <p className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Paperwork
          </p>
          <ul className="divide-y">
            {o.forms.map((f) => (
              <li
                key={f.formId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  {f.files.length ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <AlertCircle
                      className={cn(
                        "h-4 w-4 shrink-0",
                        f.required ? "text-destructive" : "text-amber-500",
                      )}
                    />
                  )}
                  <span className="truncate">{f.name}</span>
                </span>
                {f.files.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {f.files.map((p, i) => (
                      <a
                        key={p.path}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 items-center gap-1 rounded-md border bg-white px-2 text-xs font-semibold hover:border-foreground/30"
                      >
                        {p.isPdf && <FileText className="h-3.5 w-3.5" />}
                        Page {i + 1}
                      </a>
                    ))}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-xs font-bold",
                      f.required ? "text-destructive" : "text-amber-700",
                    )}
                  >
                    Missing{f.required ? " (required)" : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Record
        </p>
        {byName && (
          <p className="flex items-center gap-1.5">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" /> Submitted
            by {byName}
          </p>
        )}
        <p className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Server time:{" "}
          {formatDateTimeET(o.receivedAtServer)}
        </p>
        {o.syncedOffline && (
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Saved on
            phone: {formatDateTimeET(o.capturedAtDevice)}
          </p>
        )}
        {o.address && (
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {o.address}
          </p>
        )}
        {o.lat !== null && o.lng !== null ? (
          <a
            href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <MapPin className="h-3.5 w-3.5" />
            {o.lat.toFixed(5)}, {o.lng.toFixed(5)}
            {o.accuracy != null && ` (±${o.accuracy}m)`}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="text-muted-foreground">GPS not captured</p>
        )}
      </div>

      {children}
    </article>
  );
}
