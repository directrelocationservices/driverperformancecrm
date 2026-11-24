// File: src/app/(admin)/admin/pre-trip/[id]/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getPreTrip, getTickets, getTruck, getUserById } from "@/lib/data";
import { InspectionDetail } from "@/components/fleet/inspection-detail";
import { HoldClear } from "@/components/fleet/hold-clear";

export default async function AdminPreTripDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const inspection = await getPreTrip(id);
  if (!inspection) notFound();

  const [truck, tickets, driver, clearedBy] = await Promise.all([
    getTruck(inspection.truckId),
    getTickets({ inspectionId: id }),
    getUserById(inspection.driverId),
    inspection.hold.clearedBy ? getUserById(inspection.hold.clearedBy) : null,
  ]);

  return (
    <div>
      <Link
        href={`/admin/trucks/${inspection.truckId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Unit {truck?.unitNumber ?? ""}
      </Link>
      <InspectionDetail
        inspection={inspection}
        truck={truck}
        driverName={driver?.name ?? "Unknown"}
        tickets={tickets}
        ticketHref="/admin/maintenance"
        clearedByName={clearedBy?.name}
        holdAction={<HoldClear preTripId={inspection.id} />}
      />
    </div>
  );
}
