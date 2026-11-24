// File: src/components/fleet/doc-list.tsx
// (NEW file)

import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { Pill } from "@/components/shared/pill";
import { expiryText } from "@/lib/readiness";
import { formatDate } from "@/lib/format";
import type { DocStatus, FleetDocument } from "@/types";
import { DocDeleteButton } from "./doc-delete-button";
import { cn } from "@/lib/utils";

export function ExpiryPill({
  status,
}: {
  status: Pick<DocStatus, "state" | "days">;
}) {
  if (status.state === "expired")
    return (
      <Pill tone="danger">
        <ShieldAlert className="h-3.5 w-3.5" /> {expiryText(status)}
      </Pill>
    );
  if (status.state === "expiring")
    return (
      <Pill tone="warning">
        <Clock className="h-3.5 w-3.5" /> {expiryText(status)}
      </Pill>
    );
  if (status.state === "missing")
    return (
      <Pill>
        <CircleDashed className="h-3.5 w-3.5" /> Not uploaded
      </Pill>
    );
  return (
    <Pill tone="success">
      <CheckCircle2 className="h-3.5 w-3.5" />{" "}
      {status.days == null ? "On file" : "Valid"}
    </Pill>
  );
}

function FileLinks({ doc }: { doc: FleetDocument }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {doc.files.map((f, i) =>
        f.url ? (
          <a
            key={f.path}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold hover:border-primary/40"
          >
            {f.isPdf ? (
              <FileText className="h-4 w-4 shrink-0 text-primary" />
            ) : null}
            <span className="truncate">
              {doc.driverId ? (i === 0 ? "Front" : "Back") : f.name || "Open"}
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        ) : null,
      )}
    </div>
  );
}

/** Required documents with their expiry, plus any other documents */
export function DocList({
  statuses,
  others = [],
  names = {},
  canDelete = false,
}: {
  statuses: DocStatus[];
  others?: FleetDocument[];
  /** User id → name (who uploaded) */
  names?: Record<string, string>;
  canDelete?: boolean;
}) {
  const by = (d: FleetDocument) =>
    `Uploaded ${formatDate(d.createdAt)}${d.uploadedBy && names[d.uploadedBy] ? ` by ${names[d.uploadedBy]}` : ""}`;

  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {statuses.map((s) => (
        <li
          key={s.docType}
          className={cn(
            "px-4 py-4 sm:px-5",
            s.state === "expired" && "bg-red-50/50",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{s.label}</p>
              {s.doc ? (
                <p className="text-sm text-muted-foreground">
                  {s.doc.expiresOn
                    ? `Expires ${formatDate(s.doc.expiresOn)} · `
                    : ""}
                  {by(s.doc)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No file yet</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ExpiryPill status={s} />
              {canDelete && s.doc && (
                <DocDeleteButton id={s.doc.id} label={s.label} />
              )}
            </div>
          </div>
          {s.doc && <FileLinks doc={s.doc} />}
        </li>
      ))}
      {others.map((d) => (
        <li key={d.id} className="px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{d.title ?? "Other document"}</p>
              <p className="text-sm text-muted-foreground">{by(d)}</p>
            </div>
            {canDelete && (
              <DocDeleteButton id={d.id} label={d.title ?? "document"} />
            )}
          </div>
          <FileLinks doc={d} />
        </li>
      ))}
    </ul>
  );
}
