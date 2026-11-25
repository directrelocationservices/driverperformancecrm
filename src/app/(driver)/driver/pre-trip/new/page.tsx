// File: src/app/(driver)/driver/pre-trip/new/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getChecklist,
  getTripBlocks,
  getTruckBlocks,
  getTrucks,
} from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { DriverFormLayout } from "@/components/driver/form-layout";
import { PreTripForm } from "@/components/fleet/pre-trip-form";
import { TripBlocks } from "@/components/fleet/trip-blocks";

export const metadata = { title: "New pre-trip" };

export default async function NewPreTripPage() {
  const user = await requireRole("driver");
  const [trucks, checklist, tripBlocks] = await Promise.all([
    getTrucks(false),
    getChecklist(),
    getTripBlocks(user.id),
  ]);
  const blockedTrucks = await getTruckBlocks(trucks.map((t) => t.id));
  // An expired medical card or license stops the pre-trip too
  const driverBlocks = tripBlocks.filter((b) => b.kind === "driver_doc");

  return (
    <div>
      <Link
        href="/driver/pre-trip"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pre-trip checks
      </Link>
      <PageHeader
        title="Pre-trip inspection"
        description="Walk around the truck before you drive."
      />
      {driverBlocks.length ? (
        <TripBlocks blocks={driverBlocks} />
      ) : (
        <DriverFormLayout
          tips={[
            "Take all 5 condition photos: front, rear, both sides and the cab.",
            "If the truck was washed since the last trip, add a photo of the clean truck.",
            "Answer Yes or No for every item, even if you drove this truck yesterday.",
            '"No" needs a note and a clear photo. Admin is alerted right away.',
            'Items marked "No puts the trip on hold" stop the trip until an admin clears it.',
            'Choose "Do not drive" if the truck is unsafe.',
            "Reporting a truck problem never lowers your score.",
          ]}
        >
          <PreTripForm
            trucks={trucks.map((t) => ({
              id: t.id,
              unitNumber: t.unitNumber,
              description: t.description,
              status: t.status,
            }))}
            items={checklist}
            blockedTrucks={blockedTrucks}
          />
        </DriverFormLayout>
      )}
    </div>
  );
}
