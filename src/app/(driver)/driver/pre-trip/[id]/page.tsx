// File: src/app/(driver)/driver/pre-trip/[id]/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getPreTrip, getTickets, getTruck, getUserById } from "@/lib/data";
import { InspectionDetail } from "@/components/fleet/inspection-detail";

export default async function DriverPreTripDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("driver");
  const { id } = await params;
  const inspection = await getPreTrip(id);
  if (!inspection || inspection.driverId !== user.id) notFound();

  const [truck, tickets, clearedBy] = await Promise.all([
    getTruck(inspection.truckId),
    getTickets({ inspectionId: id }),
    inspection.hold.clearedBy ? getUserById(inspection.hold.clearedBy) : null,
  ]);

  return (
    <div>
      <Link
        href="/driver/pre-trip"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pre-trip checks
      </Link>
      <InspectionDetail
        inspection={inspection}
        truck={truck}
        driverName={user.name}
        tickets={tickets}
        clearedByName={clearedBy?.name}
      />
    </div>
  );
}
