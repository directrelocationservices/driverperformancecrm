// File: src/components/carriers/scorecard-table.tsx
// (NEW file)

import Link from "next/link";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CarrierScore } from "@/types";

/** All carriers side by side (lowest claim rate first) */
export function ScorecardTable({ rows }: { rows: CarrierScore[] }) {
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.jobs > 0) - Number(a.jobs > 0) ||
      a.claimRate - b.claimRate ||
      b.jobs - a.jobs,
  );
  const cols: [string, (r: CarrierScore) => string, boolean?][] = [
    ["Jobs", (r) => String(r.jobs)],
    ["Claims", (r) => String(r.claims)],
    ["Claim rate", (r) => (r.jobs ? formatPercent(r.claimRate) : "—"), true],
    ["Claimed", (r) => formatCurrency(r.claimed)],
    ["Paid", (r) => formatCurrency(r.paid)],
    ["Charged back", (r) => formatCurrency(r.chargedBack)],
    ["Net cost", (r) => formatCurrency(r.netCost), true],
    ["Open", (r) => String(r.openClaims)],
  ];

  return (
    <>
      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {sorted.map((r) => (
          <Link
            key={r.carrierId}
            href={`/admin/carriers/${r.carrierId}`}
            className={cn(
              "block rounded-xl border bg-card p-4",
              !r.active && "opacity-60",
            )}
          >
            <p className="truncate font-semibold">{r.companyName}</p>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {cols.map(([label, f]) => (
                <div key={label} className="rounded-lg bg-muted/50 px-1 py-2">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {label}
                  </p>
                  <p className="truncate text-xs font-bold">{f(r)}</p>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Carrier</th>
              {cols.map(([label]) => (
                <th
                  key={label}
                  className="whitespace-nowrap px-3 py-3 text-right"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((r) => (
              <tr
                key={r.carrierId}
                className={cn("hover:bg-muted/40", !r.active && "opacity-60")}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/carriers/${r.carrierId}`}
                    className="font-semibold hover:text-primary"
                  >
                    {r.companyName}
                  </Link>
                </td>
                {cols.map(([label, f, bold]) => (
                  <td
                    key={label}
                    className={cn(
                      "whitespace-nowrap px-3 py-3 text-right",
                      bold && "font-semibold",
                    )}
                  >
                    {f(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
