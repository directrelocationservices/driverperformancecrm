// File: src/app/(admin)/admin/job-actions.ts
// (NEW file)

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  DuplicateJobNumberError,
  addJobDocuments,
  createJob,
  createPreDamage,
  getCarrier,
  getJob,
  getUserById,
  setJobDocumentDeleted,
  updateJobDetails,
} from "@/lib/data";
import {
  adminJobSchema,
  jobDocumentsSchema,
  officePreDamageServerSchema,
  toFieldErrors,
  type AdminJobInput,
} from "@/lib/validation/driver";
import { isEvidencePathFor } from "@/lib/evidence/paths";

type Result = {
  error?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

function refreshJob(jobId: string, driverId?: string) {
  revalidatePath(`/admin/jobs/${jobId}`);
  if (driverId) revalidatePath(`/admin/drivers/${driverId}`);
  revalidatePath("/admin", "layout");
  revalidatePath("/driver", "layout");
}

/** Admin logs a job for a driver (new), or edits a job's details */
export async function adminSaveJobAction(
  input: AdminJobInput,
): Promise<Result> {
  await requireRole("admin");
  const parsed = adminJobSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const driver = isUuid(d.driverId) ? await getUserById(d.driverId) : null;
  if (!driver || driver.role !== "driver")
    return { fieldErrors: { driverId: "Select the driver" } };

  // The driver is always on the crew
  const crewIds = Array.from(
    new Set([d.driverId, ...d.crewIds.filter(isUuid)]),
  );

  let carrierId: string | null = null;
  if (d.deliveredBy === "partner" && d.carrierId) {
    if (!(await getCarrier(d.carrierId)))
      return { fieldErrors: { carrierId: "Carrier not found" } };
    carrierId = d.carrierId;
  }

  const job = {
    jobNumber: d.jobNumber,
    date: d.date,
    originCity: d.originCity,
    originState: d.originState,
    destCity: d.destCity,
    destState: d.destState,
    driverId: d.driverId,
    crewIds,
    deliveredBy: d.deliveredBy,
    onTimePickup: d.onTimePickup,
    onTimeDelivery: d.onTimeDelivery,
    carrierId,
    customerName: d.customerName || null,
    deliveryDate: d.deliveryDate || null,
  };

  try {
    let id = d.id;
    if (id) {
      const before = isUuid(id) ? await getJob(id) : null;
      if (!before) return { error: "Job not found." };
      await updateJobDetails(id, job);
      if (before.driverId !== d.driverId)
        revalidatePath(`/admin/drivers/${before.driverId}`);
    } else {
      id = (await createJob(job)).id;
    }
    refreshJob(id, d.driverId);
    return { id };
  } catch (err) {
    if (err instanceof DuplicateJobNumberError)
      return { fieldErrors: { jobNumber: "This job number already exists" } };
    console.error(err);
    return { error: "Couldn't save the job. Please try again." };
  }
}

/** Pre-existing damage photos the driver sent later (marked office-entered) */
export async function adminAddPreDamageAction(input: unknown): Promise<Result> {
  await requireRole("admin");
  const parsed = officePreDamageServerSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const job = isUuid(d.jobId) ? await getJob(d.jobId) : null;
  if (!job) return { error: "Job not found." };
  if (!d.photos.every((p) => isEvidencePathFor(p, job.id, "pre_damage")))
    return { error: "Photos didn't upload correctly. Please try again." };

  try {
    await createPreDamage({
      jobId: job.id,
      item: d.item,
      location: d.location,
      description: d.description,
      notes: d.notes,
      photoPaths: d.photos,
      customerShown: d.customerShown,
      customerName: d.customerName,
      signaturePath: null,
      capturedAtDevice: null,
      syncedOffline: false,
      lat: null,
      lng: null,
      officeEntered: true,
    });
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
  refreshJob(job.id, job.driverId);
  return { id: job.id };
}

/** Photos and signed paperwork uploaded to a job after the fact */
export async function addJobDocumentsAction(input: unknown): Promise<Result> {
  await requireRole("admin");
  const parsed = jobDocumentsSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid files" };
  const d = parsed.data;
  const job = isUuid(d.jobId) ? await getJob(d.jobId) : null;
  if (!job) return { error: "Job not found." };
  if (!d.files.every((f) => isEvidencePathFor(f.path, job.id, "document")))
    return { error: "A file didn't upload correctly. Please try again." };
  try {
    await addJobDocuments(job.id, d.files);
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
  refreshJob(job.id);
  return { id: job.id };
}

export async function setJobDocumentDeletedAction(
  id: string,
  deleted: boolean,
): Promise<Result> {
  await requireRole("admin");
  if (!isUuid(id)) return { error: "File not found." };
  try {
    const jobId = await setJobDocumentDeleted(id, deleted);
    if (!jobId) return { error: "File not found." };
    refreshJob(jobId);
    return { id: jobId };
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
}
