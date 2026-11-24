// File: src/components/fleet/trip-blocks.tsx
// (NEW file)

import Link from "next/link";
import { Ban, FileWarning } from "lucide-react";
import type { DocStatus, TripBlock } from "@/types";
import { expiryText } from "@/lib/readiness";

/** Red card: why the driver can't start a trip right now */
export function TripBlocks({ blocks }: { blocks: TripBlock[] }) {
  if (!blocks.length) return null;
  return (
    <section className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 sm:p-5">
      <p className="flex items-center gap-2 text-lg font-bold text-red-800">
        <Ban className="h-5 w-5" /> You can&apos;t start a trip yet
      </p>
      <ul className="mt-2 space-y-1.5 text-[15px] text-red-900">
        {blocks.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden>•</span>
            <span>
              {b.message}{" "}
              {b.kind === "driver_doc" && (
                <Link
                  href="/driver/documents"
                  className="font-semibold underline"
                >
                  Upload now
                </Link>
              )}
              {b.kind === "hold" && b.preTripId && (
                <Link
                  href={`/driver/pre-trip/${b.preTripId}`}
                  className="font-semibold underline"
                >
                  View check
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Amber card: documents that expire soon or are missing */
export function DocReminders({
  statuses,
  href,
}: {
  statuses: DocStatus[];
  href: string;
}) {
  const due = statuses.filter(
    (s) => s.state === "expiring" || s.state === "missing",
  );
  if (!due.length) return null;
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 transition hover:border-amber-300 sm:p-5"
    >
      <FileWarning className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-bold">Your documents</p>
        <ul className="mt-1 text-sm">
          {due.map((s) => (
            <li key={s.docType}>
              {s.label}: {expiryText(s)}
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}
