// File: src/app/(driver)/driver/monthly-check/new/page.tsx
// (NEW file)

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getCurrentTruckId, getSettings, getTrucks } from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { DriverFormLayout } from "@/components/driver/form-layout";
import { MonthlyCheckForm } from "@/components/fleet/monthly-check-form";

export const metadata = { title: "Monthly truck check" };

export default async function NewMonthlyCheckPage() {
  const user = await requireRole("driver");
  const [trucks, truckId, usdot] = await Promise.all([
    getTrucks(false),
    getCurrentTruckId(user.id),
    // Drivers can't read Settings; the USDOT number is only a hint
    getSettings()
      .then((s) => s.company.usdot)
      .catch(() => undefined),
  ]);

  return (
    <div>
      <Link
        href="/driver/pre-trip"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pre-trip checks
      </Link>
      <PageHeader
        title="Monthly truck check"
        description="Once a month, check these 3 things and take a photo of each."
      />
      <DriverFormLayout
        tips={[
          "Do this once every month for your truck.",
          "Take a clear photo for each item, close enough to read.",
          'Answer "No" if anything is missing, damaged or hard to read. Admin is alerted.',
          "This check needs signal to upload the photos.",
        ]}
      >
        <MonthlyCheckForm
          trucks={trucks.map((t) => ({ id: t.id, unitNumber: t.unitNumber }))}
          defaultTruckId={truckId ?? undefined}
          usdot={usdot || "3000931"}
        />
      </DriverFormLayout>
    </div>
  );
}
