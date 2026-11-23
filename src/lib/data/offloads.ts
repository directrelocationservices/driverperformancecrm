// File: src/lib/data/offloads.ts
// (NEW file)

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EVIDENCE_BUCKET } from "@/lib/evidence/paths";
import type { Json, Tables } from "@/types/supabase";
import type {
  Offload,
  OffloadDestination,
  OffloadForm,
  OffloadFormPages,
} from "@/types";

const SIGNED_URL_SECONDS = 60 * 60;

/* =========================================================
   Forms list (Admin → Settings)
   ========================================================= */
export async function getOffloadForms(
  includeInactive = false,
): Promise<OffloadForm[]> {
  const sb = await createClient();
  let q = sb
    .from("offload_forms")
    .select("id, name, required, active, sort")
    .order("sort")
    .order("created_at");
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Replaces the forms list. Removed forms are turned off (old offloads keep their name). */
export async function saveOffloadForms(
  forms: { id?: string; name: string; required: boolean; active: boolean }[],
) {
  const sb = await createClient();
  const existing = await getOffloadForms(true);
  const keep = new Set(forms.map((f) => f.id).filter(Boolean));

  for (const [i, f] of forms.entries()) {
    const row = {
      name: f.name,
      required: f.required,
      active: f.active,
      sort: i + 1,
    };
    const { error } =
      f.id && existing.some((e) => e.id === f.id)
        ? await sb.from("offload_forms").update(row).eq("id", f.id)
        : await sb.from("offload_forms").insert(row);
    if (error) throw error;
  }
  const removed = existing.filter((e) => !keep.has(e.id) && e.active);
  if (removed.length) {
    const { error } = await sb
      .from("offload_forms")
      .update({ active: false, required: false })
      .in(
        "id",
        removed.map((r) => r.id),
      );
    if (error) throw error;
  }
}

export async function getOffloadAlertEmails(): Promise<string[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("settings")
    .select("offload_alert_emails")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data.offload_alert_emails ?? [];
}

export async function updateOffloadAlertEmails(emails: string[]) {
  const sb = await createClient();
  const { error } = await sb
    .from("settings")
    .update({ offload_alert_emails: emails })
    .eq("id", 1);
  if (error) throw error;
}

/** Carrier names to choose from (drivers can't read the carriers table) */
export async function getCarrierChoices(
  includeInactive = false,
): Promise<{ id: string; name: string; active: boolean }[]> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("carrier_choices");
  if (error) throw error;
  return (data ?? [])
    .filter((c) => includeInactive || c.active)
    .map((c) => ({ id: c.id, name: c.company_name, active: c.active }));
}

/* =========================================================
   Offloads
   ========================================================= */
type Row = Tables<"offloads">;
const COLS =
  "id, job_id, destination, storage_facility, storage_address, storage_unit, carrier_id, note, photo_paths, forms, lat, lng, accuracy, address, captured_at_device, received_at_server, synced_offline, locked, created_by, deleted_at";

const readForms = (v: Json): OffloadFormPages[] =>
  Array.isArray(v) ? (v as unknown as OffloadFormPages[]) : [];

async function toOffloads(rows: Row[]): Promise<Offload[]> {
  if (!rows.length) return [];
  const sb = await createClient();

  const paths = rows.flatMap((r) => [
    ...r.photo_paths,
    ...readForms(r.forms).flatMap((f) => f.pages ?? []),
  ]);
  const signed = new Map<string, string>();
  const unique = Array.from(new Set(paths));
  if (unique.length) {
    const { data } = await sb.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrls(unique, SIGNED_URL_SECONDS);
    (data ?? []).forEach(
      (d) => d.path && d.signedUrl && signed.set(d.path, d.signedUrl),
    );
  }

  const carrierIds = Array.from(
    new Set(rows.map((r) => r.carrier_id).filter(Boolean)),
  ) as string[];
  const carriers = new Map<string, string>();
  if (carrierIds.length) {
    (await getCarrierChoices(true))
      .filter((c) => carrierIds.includes(c.id))
      .forEach((c) => carriers.set(c.id, c.name));
  }

  return rows.map((r) => ({
    id: r.id,
    jobId: r.job_id,
    destination: r.destination as OffloadDestination,
    storageFacility: r.storage_facility ?? undefined,
    storageAddress: r.storage_address ?? undefined,
    storageUnit: r.storage_unit ?? undefined,
    carrierId: r.carrier_id ?? undefined,
    carrierName: r.carrier_id ? carriers.get(r.carrier_id) : undefined,
    note: r.note ?? undefined,
    photos: r.photo_paths.map((p) => signed.get(p) ?? ""),
    forms: readForms(r.forms).map((f) => ({
      ...f,
      pages: f.pages ?? [],
      files: (f.pages ?? []).map((p) => ({
        path: p,
        url: signed.get(p) ?? "",
        isPdf: p.endsWith(".pdf"),
      })),
    })),
    lat: r.lat,
    lng: r.lng,
    accuracy: r.accuracy,
    address: r.address ?? undefined,
    capturedAtDevice: r.captured_at_device,
    receivedAtServer: r.received_at_server,
    syncedOffline: r.synced_offline,
    locked: r.locked,
    createdBy: r.created_by ?? undefined,
    deletedAt: r.deleted_at ?? undefined,
  }));
}

export async function getJobOffloads(
  jobId: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<Offload[]> {
  const sb = await createClient();
  let q = sb
    .from("offloads")
    .select(COLS)
    .eq("job_id", jobId)
    .order("received_at_server");
  if (!opts.includeDeleted) q = q.is("deleted_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return toOffloads(data);
}

export async function getOffload(id: string): Promise<Offload | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("offloads")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? (await toOffloads([data]))[0] : null;
}

/** Latest offloads for the admin list */
export async function getRecentOffloads(range?: {
  from?: string;
  to?: string;
}) {
  const sb = await createClient();
  let q = sb
    .from("offloads")
    .select(`${COLS}, jobs!inner(job_number, driver_id)`)
    .is("deleted_at", null)
    .order("received_at_server", { ascending: false })
    .limit(200);
  if (range?.from) q = q.gte("received_at_server", `${range.from}T00:00:00`);
  if (range?.to) q = q.lte("received_at_server", `${range.to}T23:59:59.999`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data as unknown as (Row & {
    jobs: { job_number: string; driver_id: string };
  })[];
  const offloads = await toOffloads(rows);
  return offloads.map((o, i) => ({
    ...o,
    jobNumber: rows[i].jobs.job_number,
    driverId: rows[i].jobs.driver_id,
  }));
}

export async function createOffload(input: {
  jobId: string;
  destination: OffloadDestination;
  storageFacility?: string;
  storageAddress?: string;
  storageUnit?: string;
  carrierId?: string;
  note?: string;
  photoPaths: string[];
  forms: OffloadFormPages[];
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  capturedAtDevice: string;
  syncedOffline: boolean;
}): Promise<{ id: string; receivedAtServer: string }> {
  const sb = await createClient();
  const storage = input.destination === "storage";
  const { data, error } = await sb
    .from("offloads")
    .insert({
      job_id: input.jobId,
      destination: input.destination,
      storage_facility: storage ? input.storageFacility || null : null,
      storage_address: storage ? input.storageAddress || null : null,
      storage_unit: storage ? input.storageUnit || null : null,
      carrier_id:
        input.destination === "carrier" ? input.carrierId || null : null,
      note: input.note || null,
      photo_paths: input.photoPaths,
      forms: input.forms as unknown as Json,
      lat: input.lat,
      lng: input.lng,
      accuracy: input.accuracy,
      captured_at_device: input.capturedAtDevice,
      synced_offline: input.syncedOffline,
    })
    .select("id, received_at_server")
    .single();
  if (error) throw error;
  return { id: data.id, receivedAtServer: data.received_at_server };
}

/** Filled in by the server once, from the GPS (not logged as a change) */
export async function setOffloadAddress(id: string, address: string) {
  const { error } = await createAdminClient()
    .from("offloads")
    .update({ address: address.slice(0, 300) })
    .eq("id", id)
    .is("address", null);
  if (error) throw error;
}

export async function correctOffload(
  id: string,
  patch: {
    destination: OffloadDestination;
    storageFacility?: string;
    storageAddress?: string;
    storageUnit?: string;
    carrierId?: string;
    note?: string;
    forms?: OffloadFormPages[];
  },
  reason: string,
): Promise<{ jobId: string } | null> {
  const sb = await createClient();
  const storage = patch.destination === "storage";
  const { data, error } = await sb.rpc("admin_correct_offload", {
    p_id: id,
    p_destination: patch.destination,
    p_storage_facility: storage ? (patch.storageFacility ?? "") : "",
    p_storage_address: storage ? (patch.storageAddress ?? "") : "",
    p_storage_unit: storage ? (patch.storageUnit ?? "") : "",
    p_carrier_id: (patch.destination === "carrier"
      ? (patch.carrierId ?? null)
      : null) as unknown as string,
    p_note: patch.note ?? "",
    p_forms: (patch.forms ?? null) as unknown as Json,
    p_reason: reason,
  });
  if (error) {
    if (/not found/i.test(error.message)) return null;
    throw error;
  }
  return { jobId: data };
}

export async function setOffloadDeleted(
  id: string,
  deleted: boolean,
  reason?: string,
): Promise<{ jobId: string } | null> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_set_offload_deleted", {
    p_id: id,
    p_deleted: deleted,
    p_reason: reason ?? "",
  });
  if (error) {
    if (/not found/i.test(error.message)) return null;
    throw error;
  }
  return { jobId: data };
}

/** The raw forms list of an offload (storage paths), for adding pages */
export async function getOffloadFormsRaw(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("offloads")
    .select(
      "id, job_id, destination, storage_facility, storage_address, storage_unit, carrier_id, note, forms",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, forms: readForms(data.forms) } : null;
}
