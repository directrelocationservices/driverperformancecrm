// File: src/app/(admin)/admin/carrier-actions.ts
// (NEW file)

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  addCarrierClaimNote,
  carrierNameExists,
  createCarrierClaim,
  createCarrierLogin,
  emailExists,
  getCarrier,
  getJob,
  saveCarrier,
  setCarrierClaimDeleted,
  updateCarrierClaim,
  updateJob,
} from "@/lib/data";
import { isClaimPathFor, isInsurancePath } from "@/lib/carriers";
import { passwordRule } from "@/lib/validation/password";
import { parseClaimNote, type ClaimNoteInput } from "@/lib/validation/carriers";

export type CarrierResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

const opt = (max: number) => z.string().trim().max(max).optional();

const carrierSchema = z.object({
  id: z.string().optional(),
  companyName: z.string().trim().min(1, "Enter the company name").max(160),
  usdot: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9]*$/, "USDOT is numbers only")
    .optional(),
  mcNumber: opt(20),
  contactName: opt(120),
  contactPhone: opt(40),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  insurancePath: z.string().nullable().optional(),
  insuranceFileName: z.string().max(200).nullable().optional(),
  insuranceExpires: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Select a date")
    .nullable()
    .optional()
    .or(z.literal("")),
  notes: opt(4000),
  active: z.boolean(),
});
export type CarrierFormInput = z.infer<typeof carrierSchema>;

function toFieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function saveCarrierAction(
  input: CarrierFormInput,
): Promise<CarrierResult> {
  await requireRole("admin");
  const parsed = carrierSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const { id, ...d } = parsed.data;

  if (id && !(await getCarrier(id))) return { error: "Carrier not found." };
  if (await carrierNameExists(d.companyName, id))
    return { fieldErrors: { companyName: "This carrier already exists" } };
  if (d.insurancePath && !isInsurancePath(d.insurancePath))
    return { error: "The file didn't upload correctly. Please try again." };
  if (d.insurancePath && !d.insuranceExpires)
    return {
      fieldErrors: { insuranceExpires: "Enter when the insurance expires" },
    };

  try {
    const saved = await saveCarrier(
      { ...d, insuranceExpires: d.insuranceExpires || null },
      id,
    );
    revalidatePath("/admin/carriers");
    revalidatePath(`/admin/carriers/${saved.id}`);
    return { id: saved.id };
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
}

/* =========================================================
   Carrier claims (damage on partner deliveries)
   ========================================================= */
const money = (label: string) =>
  z
    .number({ message: `Enter the ${label}` })
    .min(0, "Can't be negative")
    .max(1_000_000);

function refreshClaim(carrierId: string, claimId?: string, jobId?: string) {
  revalidatePath("/admin/carriers");
  revalidatePath(`/admin/carriers/${carrierId}`);
  if (claimId) revalidatePath(`/admin/carriers/claims/${claimId}`);
  if (jobId) revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/carrier", "layout");
}

const newClaimSchema = z.object({
  id: z.string().uuid(),
  carrierId: z.string().uuid(),
  jobId: z.string().min(1, "Select the job"),
  item: z.string().trim().min(1, "Item is required").max(120),
  description: z.string().trim().min(1, "Describe the damage").max(2000),
  photos: z.array(z.string()).max(10, "Maximum 10 photos"),
  claimAmount: money("claim amount"),
});

export async function createClaimAction(
  input: unknown,
): Promise<CarrierResult> {
  await requireRole("admin");
  const parsed = newClaimSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const carrier = await getCarrier(d.carrierId);
  if (!carrier) return { error: "Carrier not found." };
  const job = /^[0-9a-f-]{36}$/i.test(d.jobId) ? await getJob(d.jobId) : null;
  if (!job || job.deliveredBy !== "partner")
    return { fieldErrors: { jobId: "Select a partner-delivered job" } };
  if (job.carrierId && job.carrierId !== carrier.id)
    return { fieldErrors: { jobId: "This job belongs to another carrier" } };
  if (!d.photos.every((p) => isClaimPathFor(p, d.id)))
    return { error: "Photos didn't upload correctly. Please try again." };

  try {
    // The job is now known to be delivered by this carrier
    if (!job.carrierId) await updateJob(job.id, { carrierId: carrier.id });
    await createCarrierClaim({
      id: d.id,
      carrierId: carrier.id,
      jobId: job.id,
      item: d.item,
      description: d.description,
      photoPaths: d.photos,
      claimAmount: d.claimAmount,
    });
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
  refreshClaim(carrier.id, d.id, job.id);
  return { id: d.id };
}

const claimPatchSchema = z.object({
  id: z.string().uuid(),
  item: z.string().trim().min(1, "Item is required").max(120),
  description: z.string().trim().min(1, "Describe the damage").max(2000),
  claimAmount: money("claim amount"),
  paidAmount: money("amount paid"),
  chargedBackAmount: money("amount charged back"),
  status: z.enum(["open", "submitted", "paid", "closed"]),
});

export async function updateClaimAction(
  input: z.infer<typeof claimPatchSchema>,
): Promise<CarrierResult> {
  await requireRole("admin");
  const parsed = claimPatchSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const { id, ...patch } = parsed.data;
  try {
    const res = await updateCarrierClaim(id, patch);
    if (!res) return { error: "Claim not found." };
    refreshClaim(res.carrierId, id);
    return { id };
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
}

export async function setClaimDeletedAction(
  id: string,
  deleted: boolean,
): Promise<CarrierResult> {
  await requireRole("admin");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Claim not found." };
  try {
    const res = await setCarrierClaimDeleted(id, deleted);
    if (!res) return { error: "Claim not found." };
    refreshClaim(res.carrierId, id);
    return { id };
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
}

export async function addClaimNoteAction(
  input: ClaimNoteInput,
): Promise<CarrierResult> {
  await requireRole("admin");
  const p = parseClaimNote(input);
  if (!p.data) return { error: p.error };
  try {
    await addCarrierClaimNote({
      claimId: p.data.claimId,
      note: p.data.note,
      filePaths: p.data.files.map((f) => f.path),
      fileNames: p.data.files.map((f) => f.name),
      internal: p.data.internal,
    });
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
  revalidatePath(`/admin/carriers/claims/${p.data.claimId}`);
  revalidatePath(`/carrier/claims/${p.data.claimId}`);
  return {};
}

/* =========================================================
   Carrier portal login (turned on / off by admins)
   ========================================================= */
const loginSchema = z.object({
  carrierId: z.string().uuid(),
  name: z.string().trim().min(2, "Enter the full name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: passwordRule,
});

export async function createCarrierLoginAction(
  input: z.infer<typeof loginSchema>,
): Promise<CarrierResult> {
  await requireRole("admin");
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const { carrierId, password, ...profile } = parsed.data;
  if (!(await getCarrier(carrierId))) return { error: "Carrier not found." };
  if (await emailExists(profile.email))
    return { fieldErrors: { email: "A user with this email already exists" } };
  try {
    await createCarrierLogin(carrierId, profile, password);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Couldn't create the login.",
    };
  }
  revalidatePath(`/admin/carriers/${carrierId}`);
  return {};
}
