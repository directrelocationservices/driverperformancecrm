// File: src/components/carriers/claim-view.tsx
// (NEW file)

import { Camera, PackageX } from "lucide-react";
import { PhotoThumb } from "@/components/shared/photo-thumb";
import { formatCurrency } from "@/lib/format";
import type { CarrierClaimDetail } from "@/types";

function Column({
  title,
  hint,
  icon: Icon,
  children,
}: {
  title: string;
  hint: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="border-b px-4 py-3.5 sm:px-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon className="h-5 w-5 text-primary" /> {title}
        </h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

const Photos = ({ list, alt }: { list: string[]; alt: string }) =>
  list.length ? (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {list.map((src, i) => (
        <PhotoThumb key={src + i} src={src} alt={`${alt} ${i + 1}`} />
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">No photos.</p>
  );

/** Amount tiles + pickup photos next to the delivery damage */
export function ClaimView({ claim }: { claim: CarrierClaimDetail }) {
  const tiles: [string, number][] = [
    ["Claim amount", claim.claimAmount],
    ["Paid to customer", claim.paidAmount],
    ["Charged back", claim.chargedBackAmount],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {tiles.map(([label, v]) => (
          <div key={label} className="rounded-xl border bg-card p-3 sm:p-4">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">
              {label}
            </p>
            <p className="mt-1 font-heading text-lg font-bold sm:text-2xl">
              {formatCurrency(v)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Column
          title="At pickup"
          hint="Pre-existing damage the DRS crew recorded, signed by the customer."
          icon={Camera}
        >
          {claim.pickup.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pre-existing damage was recorded on this job.
            </p>
          ) : (
            claim.pickup.map((p, i) => (
              <div key={i} className="rounded-xl border p-3">
                <p className="font-semibold">{p.item}</p>
                <p className="text-sm text-muted-foreground">{p.location}</p>
                <p className="mt-1 text-sm">{p.description}</p>
                <div className="mt-2">
                  <Photos list={p.photos} alt={`${p.item} at pickup`} />
                </div>
              </div>
            ))
          )}
        </Column>

        <Column
          title="At delivery"
          hint="The damage claimed after the carrier delivered."
          icon={PackageX}
        >
          <div className="rounded-xl border p-3">
            <p className="font-semibold">{claim.item}</p>
            <p className="mt-1 whitespace-pre-line text-sm">
              {claim.description}
            </p>
            <div className="mt-2">
              <Photos list={claim.photos} alt={`${claim.item} at delivery`} />
            </div>
          </div>
        </Column>
      </div>
    </div>
  );
}
