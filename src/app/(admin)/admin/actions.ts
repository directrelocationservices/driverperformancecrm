// File: src/app/(admin)/admin/actions.ts
// (REPLACE the whole file)

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import {
  createUser,
  emailExists,
  overrideLeadCost,
  restoreRecord,
  setUserActive,
  setUserPassword,
  setVerified,
  softDeleteRecord,
  updateJob,
  updatePreDamage,
  updateSettings,
  updateUser,
  upsertLeadCost,
  createLeadSource,
  leadSourceNameExists,
  renameLeadSource,
  setLeadSourceActive,
  removeLeadCost,
  addDamageNote,
  correctDamage,
  createDamage,
  getDamageJobId,
  getJob,
  getUserById,
  getCarrier,
} from "@/lib/data";
import {
  adminDamageServerSchema,
  damageCorrectionSchema,
  damageNoteServerSchema,
  toFieldErrors as driverFieldErrors,
  type DamageCorrectionInput,
} from "@/lib/validation/driver";
import { isEvidencePathFor } from "@/lib/evidence/paths";
import type { RecordKind } from "@/types";
import { passwordRule } from "@/lib/validation/password";

/** Turns a database error into a friendly message instead of an error page */
async function attempt<T>(
  fn: () => Promise<T>,
): Promise<{ value?: T; error?: string }> {
  try {
    return { value: await fn() };
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "";
    // Messages written for people come from our database rules
    if (
      /reason is required|not allowed|cannot be changed|already recorded/i.test(
        msg,
      )
    )
      return { error: msg };
    return { error: "Couldn't save. Please try again." };
  }
}

export type AdminResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | void;

function revalidateJob(jobId: string) {
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath(`/driver/jobs/${jobId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin", "layout");
}

function toFieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

const KINDS = ["pre_damage", "damage", "review", "upsell"] as const;

export async function toggleVerifiedAction(
  kind: "review" | "upsell",
  id: string,
  verified: boolean,
): Promise<AdminResult> {
  const admin = await requireRole("admin");
  const { value: rec, error } = await attempt(() =>
    setVerified(kind, id, verified, admin.id),
  );
  if (error) return { error };
  if (!rec) return { error: "Record not found." };
  revalidateJob(rec.jobId);
}

export async function deleteRecordAction(
  kind: RecordKind,
  id: string,
  reason: string,
): Promise<AdminResult> {
  const admin = await requireRole("admin");
  if (!KINDS.includes(kind)) return { error: "Invalid record type." };
  if (!reason || reason.trim().length < 3)
    return { error: "A reason is required to delete a record." };
  const { value: rec, error } = await attempt(() =>
    softDeleteRecord(kind, id, admin.id, reason.trim()),
  );
  if (error) return { error };
  if (!rec) return { error: "Record not found." };
  revalidateJob(rec.jobId);
}

export async function restoreRecordAction(
  kind: RecordKind,
  id: string,
): Promise<AdminResult> {
  const admin = await requireRole("admin");
  if (!KINDS.includes(kind)) return { error: "Invalid record type." };
  const { value: rec, error } = await attempt(() =>
    restoreRecord(kind, id, admin.id),
  );
  if (error) return { error };
  if (!rec) return { error: "Record not found." };
  revalidateJob(rec.jobId);
}

const correctionSchema = z.object({
  id: z.string().min(1),
  item: z.string().trim().min(1, "Item is required").max(120),
  location: z.string().trim().min(1, "Location is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(1000),
  notes: z.string().trim().max(1000),
  customerName: z.string().trim().min(2, "Customer name is required").max(120),
  reason: z
    .string()
    .trim()
    .min(3, "Give a reason for this correction")
    .max(500),
});

export type CorrectionInput = z.infer<typeof correctionSchema>;

export async function correctPreDamageAction(
  input: CorrectionInput,
): Promise<AdminResult> {
  const admin = await requireRole("admin");
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { id, reason, notes, ...fields } = parsed.data;
  const { value: rec, error } = await attempt(() =>
    updatePreDamage(
      id,
      { ...fields, notes: notes || undefined },
      admin.id,
      reason,
    ),
  );
  if (error) return { error };
  if (!rec) return { error: "Record not found." };
  revalidateJob(rec.jobId);
}

const jobPatchSchema = z.object({
  id: z.string().min(1),
  deliveredBy: z.enum(["drs", "partner"]),
  onTimePickup: z.boolean().nullable(),
  onTimeDelivery: z.boolean().nullable(),
  carrierId: z.string().uuid().nullable().optional(),
});

export async function updateJobAction(
  input: z.infer<typeof jobPatchSchema>,
): Promise<AdminResult> {
  const admin = await requireRole("admin");
  const parsed = jobPatchSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid job data." };

  const { id, ...patch } = parsed.data;
  const { value: job, error } = await attempt(() =>
    updateJob(id, patch, admin.id),
  );
  if (error) return { error };
  if (!job) return { error: "Job not found." };
  revalidateJob(job.id);
}

/* ---------- Sales ---------- */
function revalidateSales() {
  revalidatePath("/admin", "layout");
  revalidatePath("/sales", "layout");
}

const leadCostsSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  costs: z.array(
    z.object({
      sourceId: z.string().min(1),
      cost: z.number().min(0).max(100000).nullable(),
    }),
  ),
});

export async function saveLeadCostsAction(
  week: string,
  costs: { sourceId: string; cost: number | null }[],
): Promise<{ error?: string; affected?: number }> {
  await requireRole("admin");
  const parsed = leadCostsSchema.safeParse({ week, costs });
  if (!parsed.success) return { error: "Enter valid costs (0 or more)." };

  let affected = 0;
  try {
    for (const c of parsed.data.costs) {
      affected +=
        c.cost === null
          ? await removeLeadCost(c.sourceId, parsed.data.week)
          : await upsertLeadCost(c.sourceId, parsed.data.week, c.cost);
    }
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save the costs. Please try again." };
  }
  revalidateSales();
  return { affected };
}

export async function overrideLeadCostAction(
  leadId: string,
  cost: number | null,
): Promise<AdminResult> {
  await requireRole("admin");
  if (cost !== null && (!Number.isFinite(cost) || cost < 0 || cost > 100000)) {
    return { error: "Enter a valid cost." };
  }
  try {
    const lead = await overrideLeadCost(leadId, cost);
    if (!lead) return { error: "Lead not found." };
  } catch {
    return { error: "Couldn't save the cost. Please try again." };
  }
  revalidateSales();
}

const sourceNameSchema = z
  .string()
  .trim()
  .min(2, "Enter a source name")
  .max(60, "Keep it under 60 characters");

export async function createLeadSourceAction(
  name: string,
): Promise<AdminResult> {
  await requireRole("admin");
  const parsed = sourceNameSchema.safeParse(name);
  if (!parsed.success)
    return { fieldErrors: { name: parsed.error.issues[0].message } };
  if (await leadSourceNameExists(parsed.data))
    return { fieldErrors: { name: "This source already exists" } };

  try {
    await createLeadSource(parsed.data);
  } catch {
    return { error: "Couldn't add the source. Please try again." };
  }
  revalidateSales();
}

export async function renameLeadSourceAction(
  id: string,
  name: string,
): Promise<AdminResult> {
  await requireRole("admin");
  const parsed = sourceNameSchema.safeParse(name);
  if (!parsed.success)
    return { fieldErrors: { name: parsed.error.issues[0].message } };
  if (await leadSourceNameExists(parsed.data, id))
    return { fieldErrors: { name: "This source already exists" } };

  try {
    const row = await renameLeadSource(id, parsed.data);
    if (!row) return { error: "Source not found." };
  } catch {
    return { error: "Couldn't rename the source. Please try again." };
  }
  revalidateSales();
}

export async function setLeadSourceActiveAction(
  id: string,
  active: boolean,
): Promise<AdminResult> {
  await requireRole("admin");
  try {
    const row = await setLeadSourceActive(id, active);
    if (!row) return { error: "Source not found." };
  } catch {
    return { error: "Couldn't update the source. Please try again." };
  }
  revalidateSales();
}

/* ---------- Users ---------- */
const userBase = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: z.enum(["admin", "driver", "sales_rep"], { message: "Select a role" }),
});

const createUserSchema = userBase.extend({ password: passwordRule });
const updateUserSchema = userBase.extend({
  password: passwordRule.optional().or(z.literal("")),
});

export type UserInput = z.infer<typeof updateUserSchema>;

export async function createUserAction(
  input: UserInput,
): Promise<{ fieldErrors?: Record<string, string>; error?: string }> {
  await requireRole("admin");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  if (await emailExists(parsed.data.email)) {
    return { fieldErrors: { email: "A user with this email already exists" } };
  }

  const { password, ...profile } = parsed.data;
  try {
    await createUser(profile, password);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Couldn't create the user.",
    };
  }
  revalidatePath("/admin", "layout");
  return {};
}

export async function updateUserAction(
  id: string,
  input: UserInput,
): Promise<AdminResult> {
  const admin = await requireRole("admin");
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  if (await emailExists(parsed.data.email, id)) {
    return { fieldErrors: { email: "A user with this email already exists" } };
  }
  if (id === admin.id && parsed.data.role !== "admin") {
    return { fieldErrors: { role: "You can't change your own role" } };
  }

  const { password, ...profile } = parsed.data;
  try {
    const user = await updateUser(id, profile);
    if (!user) return { error: "User not found." };
    if (password) {
      const ok = await setUserPassword(id, password);
      if (!ok)
        return {
          error: "Details saved, but the new password couldn't be set.",
        };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Couldn't update the user.",
    };
  }
  revalidatePath("/admin", "layout");
}

export async function setUserActiveAction(
  id: string,
  active: boolean,
): Promise<AdminResult> {
  const admin = await requireRole("admin");
  if (id === admin.id && !active)
    return { error: "You can't deactivate your own account." };

  try {
    const user = await setUserActive(id, active);
    if (!user) return { error: "User not found." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Couldn't update the user.",
    };
  }
  revalidatePath("/admin", "layout");
}

export async function setPasswordAction(
  id: string,
  password: string,
): Promise<AdminResult> {
  await requireRole("admin");
  const parsed = passwordRule.safeParse(password);
  if (!parsed.success)
    return {
      fieldErrors: {
        password: parsed.error.issues[0]?.message ?? "Invalid password",
      },
    };

  const ok = await setUserPassword(id, parsed.data);
  if (!ok) return { error: "Couldn't set the password. Please try again." };
}

/* ---------- Settings ---------- */
const settingsSchema = z.object({
  company: z.object({
    name: z.string().trim().min(2, "Company name is required").max(120),
    usdot: z.string().trim().min(1, "USDOT # is required").max(20),
    mc: z.string().trim().min(1, "MC # is required").max(20),
    address: z.string().trim().min(3, "Address is required").max(200),
    phone: z.string().trim().min(7, "Phone is required").max(80),
    email: z.string().trim().email("Enter a valid email"),
  }),
  damageAlertEmails: z
    .array(z.string().trim().email("One of the alert emails is invalid"))
    .max(20),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export async function updateSettingsAction(
  input: SettingsInput,
): Promise<AdminResult> {
  await requireRole("admin");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const out: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const key = i.path.join(".");
      if (!out[key]) out[key] = i.message;
    }
    return { fieldErrors: out };
  }
  const { error } = await attempt(() =>
    updateSettings({
      ...parsed.data,
      damageAlertEmails: Array.from(
        new Set(parsed.data.damageAlertEmails.map((e) => e.toLowerCase())),
      ),
    }),
  );
  if (error) return { error };
  revalidatePath("/admin/settings");
}

/* =========================================================
   Admin damage reports
   ========================================================= */
const damagePathsOk = (paths: string[], jobId: string) =>
  paths.every((p) => isEvidencePathFor(p, jobId, "damage"));

/** Damage added by an admin (customer call, claim, inspection...) */
export async function adminCreateDamageAction(input: unknown): Promise<{
  error?: string;
  fieldErrors?: Record<string, string>;
  jobId?: string;
}> {
  await requireRole("admin");
  const parsed = adminDamageServerSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: driverFieldErrors(parsed.error) };
  const d = parsed.data;

  const job = /^[0-9a-f-]{36}$/i.test(d.jobId) ? await getJob(d.jobId) : null;
  if (!job) return { fieldErrors: { jobId: "Job not found" } };
  if (!damagePathsOk(d.photos, job.id))
    return { error: "Photos didn't upload correctly. Please try again." };

  // Reported by an admin; attributed to a crew member of this job or a carrier
  const reporter = await getUserById(d.reportedBy);
  if (!reporter || reporter.role !== "admin")
    return { fieldErrors: { reportedBy: "Select who took the report" } };
  if (d.attributedTo === "carrier") {
    if (!d.carrierId || !(await getCarrier(d.carrierId)))
      return { fieldErrors: { carrierId: "Choose the carrier" } };
  } else if (
    !d.attributedDriverId ||
    !Array.from(new Set([job.driverId, ...job.crewIds])).includes(
      d.attributedDriverId,
    )
  ) {
    return {
      fieldErrors: { attributedDriverId: "Choose a driver on this job" },
    };
  }

  const { error } = await attempt(() =>
    createDamage({
      jobId: job.id,
      item: d.item,
      description: d.description,
      photoPaths: d.photos,
      claimFiled: d.claimFiled,
      estimatedCost: d.estimatedCost,
      damageDate: d.damageDate,
      source: d.source,
      reportedOn: d.reportedOn,
      reportedBy: d.reportedBy,
      attributedTo: d.attributedTo,
      attributedDriverId: d.attributedDriverId ?? null,
      carrierId: d.carrierId ?? null,
    }),
  );
  if (error) return { error };
  revalidateJob(job.id);
  revalidatePath(`/admin/drivers/${job.driverId}`);
  if (d.attributedDriverId)
    revalidatePath(`/admin/drivers/${d.attributedDriverId}`);
  if (d.carrierId) revalidatePath(`/admin/carriers/${d.carrierId}`);
  return { jobId: job.id };
}

export async function correctDamageAction(
  input: DamageCorrectionInput,
): Promise<AdminResult> {
  await requireRole("admin");
  const parsed = damageCorrectionSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { id, reason, ...fields } = parsed.data;
  const { value: rec, error } = await attempt(() =>
    correctDamage(id, fields, reason),
  );
  if (error) return { error };
  if (!rec) return { error: "Record not found." };
  revalidateJob(rec.jobId);
}

export async function addDamageNoteAction(
  input: unknown,
): Promise<AdminResult> {
  await requireRole("admin");
  const parsed = damageNoteServerSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const jobId = await getDamageJobId(d.damageId);
  if (!jobId || jobId !== d.jobId) return { error: "Record not found." };
  if (!damagePathsOk(d.photos, jobId))
    return { error: "Photos didn't upload correctly. Please try again." };

  const { error } = await attempt(() =>
    addDamageNote({
      damageId: d.damageId,
      jobId,
      note: d.note,
      photoPaths: d.photos,
    }),
  );
  if (error) return { error };
  revalidateJob(jobId);
}
