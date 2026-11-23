// File: src/lib/services/driver.ts
// (REPLACE the whole file)

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  createDamage,
  createJob,
  createPreDamage,
  createReview,
  createUpsell,
  DuplicateJobNumberError,
  getDrivers,
  getJob,
  updateJob,
  createOffload,
  getCarrierChoices,
  getOffloadForms,
  setOffloadAddress,
} from "@/lib/data";
import {
  damageServerSchema,
  jobSchema,
  onTimeSchema,
  preDamageServerSchema,
  reviewServerSchema,
  toFieldErrors,
  upsellSchema,
  offloadServerSchema,
} from "@/lib/validation/driver";
import { isEvidencePathFor, type EvidenceKind } from "@/lib/evidence/paths";
import { sendDamageAlert, sendOffloadAlert } from "@/lib/email/alerts";
import { reverseGeocode } from "@/lib/services/geocode";
import { OFFLOAD_DESTINATION_LABELS, type User } from "@/types";

export type ServiceResult =
  | { ok: true; id: string; jobId: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

/** The job, if this driver owns it (database rules also enforce this) */
async function ownJob(jobId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const job = await getJob(jobId);
  return job && job.driverId === userId ? job : null;
}

/** Every file must be in this job's own folder */
const pathsOk = (paths: string[], jobId: string, kind: EvidenceKind) =>
  paths.every((p) => isEvidencePathFor(p, jobId, kind));

function refresh() {
  revalidatePath("/driver", "layout");
  revalidatePath("/admin", "layout");
}

function fail(err: unknown): ServiceResult {
  console.error(err);
  return { ok: false, error: "Couldn't save. Please try again." };
}

export async function createJobFor(
  user: User,
  raw: unknown,
): Promise<ServiceResult> {
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };

  const validIds = new Set((await getDrivers()).map((d) => d.id));
  const crewIds = Array.from(
    new Set([user.id, ...parsed.data.crewIds.filter((id) => validIds.has(id))]),
  );

  try {
    const job = await createJob({ ...parsed.data, driverId: user.id, crewIds });
    refresh();
    return { ok: true, id: job.id, jobId: job.id };
  } catch (err) {
    if (err instanceof DuplicateJobNumberError) {
      return {
        ok: false,
        fieldErrors: { jobNumber: "This job number already exists" },
      };
    }
    return fail(err);
  }
}

export async function createPreDamageFor(
  user: User,
  raw: unknown,
  opts: { offline?: boolean } = {},
): Promise<ServiceResult> {
  const parsed = preDamageServerSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const job = await ownJob(d.jobId, user.id);
  if (!job) return { ok: false, error: "Job not found." };
  if (!pathsOk([...d.photos, d.signature], job.id, "pre_damage")) {
    return {
      ok: false,
      error: "Photos didn't upload correctly. Please try again.",
    };
  }

  try {
    const rec = await createPreDamage({
      jobId: job.id,
      item: d.item,
      location: d.location,
      description: d.description,
      notes: d.notes || undefined,
      photoPaths: d.photos,
      customerShown: d.customerShown,
      customerName: d.customerName,
      signaturePath: d.signature,
      capturedAtDevice: d.capturedAtDevice,
      syncedOffline: !!opts.offline,
      lat: d.lat,
      lng: d.lng,
    });
    refresh();
    return { ok: true, id: rec.id, jobId: job.id };
  } catch (err) {
    return fail(err);
  }
}

export async function createDamageFor(
  user: User,
  raw: unknown,
): Promise<ServiceResult> {
  const parsed = damageServerSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const job = await ownJob(d.jobId, user.id);
  if (!job) return { ok: false, error: "Job not found." };
  if (!pathsOk(d.photos, job.id, "damage")) {
    return {
      ok: false,
      error: "Photos didn't upload correctly. Please try again.",
    };
  }

  try {
    const rec = await createDamage({
      jobId: job.id,
      item: d.item,
      description: d.description,
      photoPaths: d.photos,
      claimFiled: d.claimFiled,
      estimatedCost: d.estimatedCost,
    });
    // Email the admins after the response is sent (never slows down or fails the save)
    after(() =>
      sendDamageAlert({
        jobId: job.id,
        jobNumber: job.jobNumber,
        driverName: user.name,
        item: d.item,
        description: d.description,
        estimatedCost: d.estimatedCost ?? null,
        claimFiled: d.claimFiled,
        photoCount: d.photos.length,
      }),
    );
    refresh();
    return { ok: true, id: rec.id, jobId: job.id };
  } catch (err) {
    return fail(err);
  }
}

export async function createReviewFor(
  user: User,
  raw: unknown,
): Promise<ServiceResult> {
  const parsed = reviewServerSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const job = await ownJob(d.jobId, user.id);
  if (!job) return { ok: false, error: "Job not found." };
  if (d.screenshot && !pathsOk([d.screenshot], job.id, "review")) {
    return {
      ok: false,
      error: "The screenshot didn't upload correctly. Please try again.",
    };
  }

  try {
    const rec = await createReview({
      jobId: job.id,
      platform: d.platform,
      stars: d.stars,
      driverMentioned: d.driverMentioned,
      link: d.link || undefined,
      screenshotPath: d.screenshot || undefined,
    });
    refresh();
    return { ok: true, id: rec.id, jobId: job.id };
  } catch (err) {
    return fail(err);
  }
}

export async function createUpsellFor(
  user: User,
  raw: unknown,
): Promise<ServiceResult> {
  const parsed = upsellSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };

  const job = await ownJob(parsed.data.jobId, user.id);
  if (!job) return { ok: false, error: "Job not found." };

  try {
    const rec = await createUpsell({ ...parsed.data, jobId: job.id });
    refresh();
    return { ok: true, id: rec.id, jobId: job.id };
  } catch (err) {
    return fail(err);
  }
}

export async function setOnTimeFor(
  user: User,
  raw: unknown,
): Promise<ServiceResult> {
  const parsed = onTimeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const job = await ownJob(parsed.data.jobId, user.id);
  if (!job) return { ok: false, error: "Job not found." };

  const key =
    parsed.data.field === "pickup" ? "onTimePickup" : "onTimeDelivery";
  // Drivers can record it once. After that only an admin can change it (the database enforces this too).
  if (job[key] !== null) {
    return {
      ok: false,
      error: "Already recorded. Ask an admin if it needs changing.",
    };
  }

  try {
    await updateJob(job.id, { [key]: parsed.data.value });
    refresh();
    return { ok: true, id: job.id, jobId: job.id };
  } catch (err) {
    return fail(err);
  }
}

/** Driver offloads a job: photos, where, paperwork. Locked once saved; dispatch is emailed. */
export async function createOffloadFor(
  user: User,
  raw: unknown,
  opts: { offline?: boolean } = {},
): Promise<ServiceResult> {
  const parsed = offloadServerSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const job = await ownJob(d.jobId, user.id);
  if (!job) return { ok: false, error: "Job not found." };

  const pagePaths = d.forms.flatMap((f) => f.pages);
  if (!pathsOk([...d.photos, ...pagePaths], job.id, "offload")) {
    return {
      ok: false,
      error: "Photos or paperwork didn't upload correctly. Please try again.",
    };
  }

  // The forms list comes from Settings, never from the phone
  const list = await getOffloadForms();
  const forms = list.map((f) => ({
    formId: f.id,
    name: f.name,
    required: f.required,
    pages: d.forms.find((x) => x.formId === f.id)?.pages ?? [],
  }));
  const missingRequired = forms.filter((f) => f.required && !f.pages.length);
  if (missingRequired.length) {
    return {
      ok: false,
      fieldErrors: {
        forms: `Required: ${missingRequired.map((f) => f.name).join(", ")}`,
      },
    };
  }

  let carrierName: string | undefined;
  if (d.destination === "carrier") {
    const carrier = (await getCarrierChoices()).find(
      (c) => c.id === d.carrierId,
    );
    if (!carrier)
      return { ok: false, fieldErrors: { carrierId: "Choose the carrier" } };
    carrierName = carrier.name;
  }

  try {
    const rec = await createOffload({
      jobId: job.id,
      destination: d.destination,
      storageFacility: d.storageFacility,
      storageAddress: d.storageAddress,
      storageUnit: d.storageUnit,
      carrierId: d.carrierId,
      note: d.note,
      photoPaths: d.photos,
      forms,
      lat: d.lat,
      lng: d.lng,
      accuracy: d.accuracy,
      capturedAtDevice: d.capturedAtDevice,
      syncedOffline: !!opts.offline,
    });

    // After the reply: look up the address, then alert dispatch
    after(async () => {
      let address: string | null = null;
      if (d.lat != null && d.lng != null) {
        address = await reverseGeocode(d.lat, d.lng);
        if (address)
          await setOffloadAddress(rec.id, address).catch((e) =>
            console.error(e),
          );
      }
      const whereDetails =
        d.destination === "storage"
          ? `${d.storageFacility}, ${d.storageAddress}, unit ${d.storageUnit}`
          : d.destination === "carrier"
            ? carrierName
            : undefined;
      await sendOffloadAlert({
        jobId: job.id,
        jobNumber: job.jobNumber,
        driverName: user.name,
        where: OFFLOAD_DESTINATION_LABELS[d.destination],
        whereDetails,
        note: d.note,
        address,
        lat: d.lat,
        lng: d.lng,
        receivedAt: rec.receivedAtServer,
        capturedAt: d.capturedAtDevice,
        savedOffline: !!opts.offline,
        photoPaths: d.photos,
        forms,
      });
    });
    refresh();
    return { ok: true, id: rec.id, jobId: job.id };
  } catch (err) {
    return fail(err);
  }
}
