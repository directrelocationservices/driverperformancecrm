// File: src/app/(driver)/driver/jobs/[id]/offload/new/page.tsx
// (NEW file)

import {
  DriverFormPage,
  getDriverOwnedJob,
} from "@/components/driver/form-page";
import { OffloadForm } from "@/components/driver/offload-form";
import { getCarrierChoices, getOffloadForms } from "@/lib/data";

export default async function NewOffloadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const job = await getDriverOwnedJob((await params).id);
  const [carriers, forms] = await Promise.all([
    getCarrierChoices(),
    getOffloadForms(),
  ]);
  return (
    <DriverFormPage
      job={job}
      title="Offload"
      description="Record where this job's goods were offloaded."
      tips={[
        "Take at least 2 clear photos of the offloaded goods.",
        "Add every page of each form. Red forms are required.",
        "Your location, address and the time are recorded automatically.",
        "Dispatch gets an alert as soon as you submit. No need to text photos.",
        "No signal? It saves on this phone and uploads when signal returns.",
      ]}
    >
      <OffloadForm
        jobId={job.id}
        carriers={carriers.map((c) => ({ id: c.id, name: c.name }))}
        forms={forms.map((f) => ({
          id: f.id,
          name: f.name,
          required: f.required,
        }))}
      />
    </DriverFormPage>
  );
}
