// File: src/app/(driver)/driver/documents/page.tsx
// (NEW file)

import Link from "next/link";
import { Container, FileText, IdCard } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getCurrentTruckId,
  getDocuments,
  getDriverDocStatus,
  getTruckDocStatus,
  getTrucks,
} from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { DocList } from "@/components/fleet/doc-list";
import { DocUpload } from "@/components/fleet/doc-upload";
import { DRIVER_DOC_TYPES } from "@/types";

export const metadata = { title: "My documents" };

export default async function DriverDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ truck?: string }>;
}) {
  const user = await requireRole("driver");
  const [trucks, currentTruckId, myStatus] = await Promise.all([
    getTrucks(false),
    getCurrentTruckId(user.id),
    getDriverDocStatus(user.id),
  ]);
  const { truck: picked } = await searchParams;
  const truck =
    trucks.find((t) => t.id === picked) ??
    trucks.find((t) => t.id === currentTruckId) ??
    null;
  const truckDocs = truck ? await getDocuments({ truckId: truck.id }) : [];
  const truckStatus = truck ? await getTruckDocStatus(truck.id, truckDocs) : [];
  const others = truckDocs.filter((d) => d.docType === "other");

  return (
    <div className="space-y-8">
      <PageHeader
        title="My documents"
        description="Everything an officer may ask for at a roadside inspection."
      />

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
              <IdCard className="h-5 w-5 text-primary" /> My medical card and
              license
            </h2>
            <p className="text-sm text-muted-foreground">
              Upload a photo of the front and back and the expiry date. Once one
              expires, you can&apos;t start a trip until you upload the new one.
            </p>
          </div>
          <DocUpload
            owner="driver"
            ownerId={user.id}
            types={DRIVER_DOC_TYPES}
            as="driver"
          />
        </div>
        <DocList statuses={myStatus} />
      </section>

      <section>
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            <Container className="h-5 w-5 text-primary" />
            {truck
              ? `Truck documents · Unit ${truck.unitNumber}`
              : "Truck documents"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Registration, insurance, inspection report and ELD instructions.
            Your admin keeps these up to date.
          </p>
        </div>
        {trucks.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {trucks.map((t) => (
              <Link
                key={t.id}
                href={`/driver/documents?truck=${t.id}`}
                className={
                  t.id === truck?.id
                    ? "rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-full border bg-white px-3 py-1.5 text-sm font-semibold hover:border-foreground/30"
                }
              >
                Unit {t.unitNumber}
              </Link>
            ))}
          </div>
        )}
        {truck ? (
          <DocList statuses={truckStatus} others={others} />
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
            <FileText className="h-5 w-5" /> Choose a truck above, or do a
            pre-trip check first.
          </p>
        )}
      </section>
    </div>
  );
}
