// File: src/components/admin/rank-list.tsx
// (REPLACE the whole file)

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { RankRow } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const RANK_STYLE = [
  "bg-primary text-white",
  "bg-secondary text-white",
  "bg-foreground/15 text-foreground",
];

function RowWrap({
  href,
  className,
  children,
}: {
  href: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function RankList({
  title,
  icon: Icon,
  rows,
  emptyText = "No data for this period.",
  className,
  hrefBase = "/admin/drivers/",
  highlightId,
  note,
}: {
  title: string;
  icon: LucideIcon;
  rows: RankRow[];
  emptyText?: string;
  className?: string;
  /** Link for each row (id is added); null = no links */
  hrefBase?: string | null;
  /** Row to highlight (e.g. the signed-in rep) */
  highlightId?: string;
  /** Small line under the title */
  note?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card", className)}>
      <div className="flex items-center gap-2.5 border-b px-4 py-3.5 sm:px-5">
        <Icon className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <h3 className="text-base font-bold">{title}</h3>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ol className="divide-y">
          {rows.map((r, i) => (
            <li key={r.id}>
              <RowWrap
                href={hrefBase === null ? null : `${hrefBase}${r.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition sm:px-5",
                  hrefBase !== null && "hover:bg-muted/50",
                  r.id === highlightId && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    RANK_STYLE[i] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {r.name}
                </span>
                <span className="text-right">
                  <span className="block font-heading text-lg font-bold leading-tight">
                    {r.value}
                  </span>
                  {r.sub && (
                    <span className="block text-xs text-muted-foreground">
                      {r.sub}
                    </span>
                  )}
                </span>
              </RowWrap>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
