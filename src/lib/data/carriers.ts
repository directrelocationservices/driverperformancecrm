// File: src/lib/data/carriers.ts
// (REPLACE the whole file)

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARRIER_BUCKET, insuranceStatus } from "@/lib/carriers";
import { EVIDENCE_BUCKET } from "@/lib/evidence/paths";
import { sendInsuranceExpiryAlert } from "@/lib/email/alerts";
import { createUser } from "./users";
import type {
  Carrier,
  CarrierClaim,
  CarrierClaimDetail,
  CarrierScore,
  ClaimStatus,
  DateRange,
  User,
} from "@/types";
import type { Database } from "@/types/supabase";

type CarrierRow = Database["public"]["Tables"]["carriers"]["Row"];
type ClaimRow = Database["public"]["Tables"]["carrier_claims"]["Row"];

const toCarrier = (r: CarrierRow): Carrier => ({
  id: r.id,
  companyName: r.company_name,
  usdot: r.usdot,
  mcNumber: r.mc_number,
  contactName: r.contact_name,
  contactPhone: r.contact_phone,
  contactEmail: r.contact_email,
  insurancePath: r.insurance_path,
  insuranceFileName: r.insurance_file_name,
  insuranceExpires: r.insurance_expires,
  notes: r.notes,
  active: r.active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export async function getCarriers(includeInactive = true): Promise<Carrier[]> {
  const sb = await createClient();
  let q = sb.from("carriers").select("*");
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q.order("company_name");
  if (error) throw error;
  return (data ?? []).map(toCarrier);
}

export async function getCarrier(id: string): Promise<Carrier | null> {
  if (!isUuid(id)) return null;
  const sb = await createClient();
  const { data } = await sb
    .from("carriers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? toCarrier(data) : null;
}

export async function carrierNameExists(name: string, exceptId?: string) {
  const sb = await createClient();
  const { data, error } = await sb.from("carriers").select("id, company_name");
  if (error) throw error;
  const key = name.trim().toLowerCase();
  return (data ?? []).some(
    (c) => c.id !== exceptId && c.company_name.trim().toLowerCase() === key,
  );
}

export type CarrierInput = {
  companyName: string;
  usdot?: string;
  mcNumber?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  insurancePath?: string | null;
  insuranceFileName?: string | null;
  insuranceExpires?: string | null;
  notes?: string;
  active: boolean;
};

export async function saveCarrier(
  input: CarrierInput,
  id?: string,
): Promise<{ id: string }> {
  const sb = await createClient();
  const row = {
    company_name: input.companyName,
    usdot: input.usdot || null,
    mc_number: input.mcNumber || null,
    contact_name: input.contactName || null,
    contact_phone: input.contactPhone || null,
    contact_email: input.contactEmail || null,
    insurance_path: input.insurancePath || null,
    insurance_file_name: input.insuranceFileName || null,
    insurance_expires: input.insuranceExpires || null,
    notes: input.notes || null,
    active: input.active,
  };
  const q = id
    ? sb.from("carriers").update(row).eq("id", id)
    : sb.from("carriers").insert(row);
  const { data, error } = await q.select("id").single();
  if (error) throw error;
  return { id: data.id };
}

/** Short-lived link to open the insurance certificate */
export async function getCarrierFileUrl(path: string | null) {
  if (!path) return null;
  const sb = await createClient();
  const { data } = await sb.storage
    .from(CARRIER_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/**
 * Emails admins once per expiry date when a carrier's insurance is within
 * 30 days of expiring (or already expired). Safe to call often; never fails the page.
 * If the email can't be sent yet, it tries again on the next call.
 */
export async function flagCarrierInsurance() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("carriers")
      .select("id, company_name, insurance_expires, insurance_alert_sent_for")
      .eq("active", true)
      .not("insurance_expires", "is", null);
    if (error) throw error;

    for (const c of data ?? []) {
      if (!c.insurance_expires) continue;
      if (c.insurance_alert_sent_for === c.insurance_expires) continue;
      const st = insuranceStatus(c.insurance_expires);
      if (st.kind !== "expiring" && st.kind !== "expired") continue;

      const sent = await sendInsuranceExpiryAlert({
        carrierId: c.id,
        companyName: c.company_name,
        expires: c.insurance_expires,
        days: st.days,
        expired: st.kind === "expired",
      });
      if (sent)
        await sb
          .from("carriers")
          .update({ insurance_alert_sent_for: c.insurance_expires })
          .eq("id", c.id);
    }
  } catch (err) {
    console.error("flagCarrierInsurance failed", err);
  }
}

/* =========================================================
   Carrier claims (damage on partner deliveries)
   ========================================================= */
const CLAIM_COLS = "*, jobs(job_number, date)";
type ClaimWithJob = ClaimRow & {
  jobs: { job_number: string; date: string } | null;
};

const toClaim = (r: ClaimWithJob): CarrierClaim => ({
  id: r.id,
  carrierId: r.carrier_id,
  jobId: r.job_id,
  jobNumber: r.jobs?.job_number ?? "",
  jobDate: r.jobs?.date ?? "",
  item: r.item,
  description: r.description,
  claimAmount: Number(r.claim_amount),
  paidAmount: Number(r.paid_amount),
  chargedBackAmount: Number(r.charged_back_amount),
  status: r.status as ClaimStatus,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});

/** Claims the signed-in user may see (admins: all; carriers: their own) */
export async function getCarrierClaims(
  opts: { carrierId?: string; jobId?: string; includeDeleted?: boolean } = {},
): Promise<CarrierClaim[]> {
  const sb = await createClient();
  let q = sb.from("carrier_claims").select(CLAIM_COLS);
  if (opts.carrierId) q = q.eq("carrier_id", opts.carrierId);
  if (opts.jobId) q = q.eq("job_id", opts.jobId);
  if (!opts.includeDeleted) q = q.is("deleted_at", null);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ClaimWithJob[]).map(toClaim);
}

/** Short-lived links for private files (only after access was checked) */
async function signAll(bucket: string, paths: string[]) {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const out = new Map<string, string>();
  if (!unique.length) return out;
  const { data } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrls(unique, 60 * 60);
  for (const d of data ?? [])
    if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

/**
 * One claim with photos, notes and the job's pickup photos.
 * The first read uses the signed-in user's access rules, so a carrier
 * can only open its own claims and never sees internal notes.
 */
export async function getCarrierClaimDetail(
  id: string,
): Promise<CarrierClaimDetail | null> {
  if (!isUuid(id)) return null;
  const sb = await createClient();
  const { data } = await sb
    .from("carrier_claims")
    .select(CLAIM_COLS)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as ClaimWithJob;

  const { data: notes } = await sb
    .from("carrier_claim_notes")
    .select("*")
    .eq("claim_id", id)
    .order("created_at");

  // Pickup records of the job (access to the claim was checked above)
  const { data: pre } = await createAdminClient()
    .from("pre_damages")
    .select("item, location, description, photo_paths")
    .eq("job_id", row.job_id)
    .is("deleted_at", null)
    .order("received_at_server");

  const files = await signAll(CARRIER_BUCKET, [
    ...row.photo_paths,
    ...(notes ?? []).flatMap((n) => n.file_paths),
  ]);
  const evidence = await signAll(
    EVIDENCE_BUCKET,
    (pre ?? []).flatMap((p) => p.photo_paths),
  );
  const link = (m: Map<string, string>, p: string) => m.get(p) ?? "";

  return {
    ...toClaim(row),
    photos: row.photo_paths.map((p) => link(files, p)).filter(Boolean),
    notes: (notes ?? []).map((n) => ({
      id: n.id,
      note: n.note,
      internal: n.internal,
      createdBy: n.created_by,
      createdAt: n.created_at,
      files: n.file_paths
        .map((p, i) => ({
          name: n.file_names[i] || `File ${i + 1}`,
          url: link(files, p),
          isPdf: p.endsWith(".pdf"),
        }))
        .filter((f) => f.url),
    })),
    pickup: (pre ?? []).map((p) => ({
      item: p.item,
      location: p.location,
      description: p.description,
      photos: p.photo_paths.map((x) => link(evidence, x)).filter(Boolean),
    })),
  };
}

export async function createCarrierClaim(input: {
  id: string;
  carrierId: string;
  jobId: string;
  item: string;
  description: string;
  photoPaths: string[];
  claimAmount: number;
}) {
  const sb = await createClient();
  const { error } = await sb.from("carrier_claims").insert({
    id: input.id,
    carrier_id: input.carrierId,
    job_id: input.jobId,
    item: input.item,
    description: input.description,
    photo_paths: input.photoPaths,
    claim_amount: input.claimAmount,
  });
  if (error) throw error;
}

export async function updateCarrierClaim(
  id: string,
  patch: {
    item: string;
    description: string;
    claimAmount: number;
    paidAmount: number;
    chargedBackAmount: number;
    status: ClaimStatus;
  },
) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("carrier_claims")
    .update({
      item: patch.item,
      description: patch.description,
      claim_amount: patch.claimAmount,
      paid_amount: patch.paidAmount,
      charged_back_amount: patch.chargedBackAmount,
      status: patch.status,
    })
    .eq("id", id)
    .select("carrier_id")
    .maybeSingle();
  if (error) throw error;
  return data ? { carrierId: data.carrier_id } : null;
}

export async function setCarrierClaimDeleted(id: string, deleted: boolean) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("carrier_claims")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", id)
    .select("carrier_id")
    .maybeSingle();
  if (error) throw error;
  return data ? { carrierId: data.carrier_id } : null;
}

export async function addCarrierClaimNote(input: {
  claimId: string;
  note: string;
  filePaths: string[];
  fileNames: string[];
  internal: boolean;
}) {
  const sb = await createClient();
  const { error } = await sb.from("carrier_claim_notes").insert({
    claim_id: input.claimId,
    note: input.note,
    file_paths: input.filePaths,
    file_names: input.fileNames,
    internal: input.internal,
  });
  if (error) throw error;
}

/** Partner jobs this carrier delivered, plus partner jobs with no carrier yet */
export async function getPartnerJobsFor(carrierId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("jobs")
    .select("id, job_number, date, carrier_id, driver_id")
    .eq("delivered_by", "partner")
    .or(`carrier_id.eq.${carrierId},carrier_id.is.null`)
    .order("date", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((j) => ({
    id: j.id,
    jobNumber: j.job_number,
    date: j.date,
    carrierId: j.carrier_id,
    driverId: j.driver_id,
  }));
}

/* =========================================================
   Scorecards
   ========================================================= */
export async function getCarrierScores(
  opts: { range?: DateRange; carrierId?: string } = {},
): Promise<CarrierScore[]> {
  const sb = await createClient();
  let jq = sb
    .from("jobs")
    .select("id, carrier_id")
    .eq("delivered_by", "partner")
    .not("carrier_id", "is", null);
  if (opts.carrierId) jq = jq.eq("carrier_id", opts.carrierId);
  if (opts.range?.from) jq = jq.gte("date", opts.range.from);
  if (opts.range?.to) jq = jq.lte("date", opts.range.to);

  // Damage customer service attributed to a carrier
  let dq = sb
    .from("damage_incidents")
    .select("job_id, carrier_id, jobs!inner(date)")
    .eq("attributed_to", "carrier")
    .is("deleted_at", null);
  if (opts.carrierId) dq = dq.eq("carrier_id", opts.carrierId);
  if (opts.range?.from) dq = dq.gte("jobs.date", opts.range.from);
  if (opts.range?.to) dq = dq.lte("jobs.date", opts.range.to);

  const [carriers, jobsRes, claims, dmgRes] = await Promise.all([
    getCarriers(),
    jq.limit(10000),
    getCarrierClaims({ carrierId: opts.carrierId }),
    dq.limit(10000),
  ]);
  if (jobsRes.error) throw jobsRes.error;
  if (dmgRes.error) throw dmgRes.error;
  const inRange = (d: string) =>
    (!opts.range?.from || d >= opts.range.from) &&
    (!opts.range?.to || d <= opts.range.to);

  return carriers
    .filter((c) => !opts.carrierId || c.id === opts.carrierId)
    .map((c) => {
      const jobs = (jobsRes.data ?? []).filter((j) => j.carrier_id === c.id);
      const mine = claims.filter(
        (x) => x.carrierId === c.id && inRange(x.jobDate),
      );
      const damages = (dmgRes.data ?? []).filter((d) => d.carrier_id === c.id);
      // A job counts once whether it has a claim, a damage report, or both
      const jobsWithClaims = new Set([
        ...mine.map((x) => x.jobId),
        ...damages.map((d) => d.job_id),
      ]).size;
      const sum = (f: (x: CarrierClaim) => number) =>
        mine.reduce((s, x) => s + f(x), 0);
      const paid = sum((x) => x.paidAmount);
      const chargedBack = sum((x) => x.chargedBackAmount);
      return {
        carrierId: c.id,
        companyName: c.companyName,
        active: c.active,
        jobs: jobs.length,
        claims: mine.length,
        jobsWithClaims,
        claimRate: jobs.length ? jobsWithClaims / jobs.length : 0,
        claimed: sum((x) => x.claimAmount),
        paid,
        chargedBack,
        netCost: paid - chargedBack,
        openClaims: mine.filter(
          (x) => x.status === "open" || x.status === "submitted",
        ).length,
        damageReports: damages.length,
      };
    });
}

/* =========================================================
   Carrier portal logins
   ========================================================= */
export async function getCarrierLogins(carrierId: string): Promise<User[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("profiles")
    .select("id, name, email, phone, role, active, avatar_url")
    .eq("role", "carrier")
    .eq("carrier_id", carrierId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone ?? undefined,
    role: p.role,
    active: p.active,
    avatarUrl: p.avatar_url ?? undefined,
  }));
}

export async function createCarrierLogin(
  carrierId: string,
  input: { name: string; email: string },
  password: string,
) {
  const user = await createUser({ ...input, role: "carrier" }, password);
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ carrier_id: carrierId })
    .eq("id", user.id);
  if (error) throw error;
  return user;
}

/** The signed-in carrier's own company (the database only returns that one) */
export async function getMyCarrier(): Promise<Carrier | null> {
  const sb = await createClient();
  const { data } = await sb.from("carriers").select("*").limit(1).maybeSingle();
  return data ? toCarrier(data) : null;
}

/** True if the signed-in user may see this claim (admins, or its own carrier) */
export async function claimVisible(id: string) {
  if (!isUuid(id)) return false;
  const sb = await createClient();
  const { data } = await sb
    .from("carrier_claims")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return !!data;
}
