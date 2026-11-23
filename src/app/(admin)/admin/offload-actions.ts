// File: src/app/(admin)/admin/offload-actions.ts
// (NEW file)

"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  correctOffload,
  getCarrierChoices,
  getOffloadFormsRaw,
  saveOffloadForms,
  setOffloadDeleted,
  updateOffloadAlertEmails,
} from "@/lib/data";
import {
  offloadCorrectionSchema,
  offloadFormsSettingsSchema,
  offloadPagesSchema,
  toFieldErrors,
  type OffloadCorrectionInput,
} from "@/lib/validation/driver";
import { isEvidencePathFor } from "@/lib/evidence/paths";
import type { OffloadDestination } from "@/types";

type Result = { error?: string; fieldErrors?: Record<string, string> };

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

function friendly(err: unknown): Result {
  console.error(err);
  const msg = err instanceof Error ? err.message : "";
  if (/reason is required|not allowed|cannot be changed/i.test(msg))
    return { error: msg };
  return { error: "Couldn't save. Please try again." };
}

function refresh(jobId: string) {
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/offloads");
  revalidatePath("/driver", "layout");
}

/** Correct where it was offloaded (photos, GPS and times can't change) */
export async function correctOffloadAction(
  input: OffloadCorrectionInput,
): Promise<Result> {
  await requireRole("admin");
  const parsed = offloadCorrectionSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const { id, reason, ...d } = parsed.data;
  if (!isUuid(id)) return { error: "Record not found." };

  if (d.destination === "carrier") {
    const ok = (await getCarrierChoices(true)).some(
      (c) => c.id === d.carrierId,
    );
    if (!ok) return { fieldErrors: { carrierId: "Choose the carrier" } };
  }
  try {
    const rec = await correctOffload(
      id,
      { ...d, destination: d.destination as OffloadDestination },
      reason,
    );
    if (!rec) return { error: "Record not found." };
    refresh(rec.jobId);
    return {};
  } catch (err) {
    return friendly(err);
  }
}

/** Add pages the driver didn't upload (e.g. paperwork sent in later) */
export async function addOffloadPagesAction(input: unknown): Promise<Result> {
  await requireRole("admin");
  const parsed = offloadPagesSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;
  if (!isUuid(d.id)) return { error: "Record not found." };

  try {
    const raw = await getOffloadFormsRaw(d.id);
    if (!raw) return { error: "Record not found." };
    if (!d.pages.every((p) => isEvidencePathFor(p, raw.job_id, "offload")))
      return { error: "A file didn't upload correctly. Please try again." };
    if (!raw.forms.some((f) => f.formId === d.formId))
      return { error: "Form not found on this offload." };

    const forms = raw.forms.map((f) =>
      f.formId === d.formId
        ? { ...f, pages: [...(f.pages ?? []), ...d.pages] }
        : f,
    );
    const rec = await correctOffload(
      d.id,
      {
        destination: raw.destination as OffloadDestination,
        storageFacility: raw.storage_facility ?? undefined,
        storageAddress: raw.storage_address ?? undefined,
        storageUnit: raw.storage_unit ?? undefined,
        carrierId: raw.carrier_id ?? undefined,
        note: raw.note ?? undefined,
        forms,
      },
      d.reason,
    );
    if (!rec) return { error: "Record not found." };
    refresh(rec.jobId);
    return {};
  } catch (err) {
    return friendly(err);
  }
}

export async function setOffloadDeletedAction(
  id: string,
  deleted: boolean,
  reason?: string,
): Promise<Result> {
  await requireRole("admin");
  if (!isUuid(id)) return { error: "Record not found." };
  if (deleted && (reason ?? "").trim().length < 3)
    return { fieldErrors: { reason: "Give a reason" } };
  try {
    const rec = await setOffloadDeleted(id, deleted, reason);
    if (!rec) return { error: "Record not found." };
    refresh(rec.jobId);
    return {};
  } catch (err) {
    return friendly(err);
  }
}

/** Admin → Settings: offload forms list and alert emails */
export async function saveOffloadSettingsAction(
  input: unknown,
): Promise<Result> {
  await requireRole("admin");
  const parsed = offloadFormsSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Please check the forms." };
  }
  const names = parsed.data.forms.map((f) => f.name.toLowerCase());
  if (new Set(names).size !== names.length)
    return { error: "Two forms have the same name." };
  try {
    await saveOffloadForms(parsed.data.forms);
    await updateOffloadAlertEmails(
      Array.from(new Set(parsed.data.alertEmails.map((e) => e.toLowerCase()))),
    );
    revalidatePath("/admin/settings");
    revalidatePath("/driver", "layout");
    return {};
  } catch (err) {
    return friendly(err);
  }
}
