// File: src/lib/data/readiness.ts
// (NEW file)

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FLEET_BUCKET } from "@/lib/evidence/paths";
import { todayEastern } from "@/lib/carriers";
import {
  alertStage,
  daysUntil,
  docStatuses,
  latestByType,
  REQUIRED_DRIVER_DOCS,
  REQUIRED_TRUCK_DOCS,
} from "@/lib/readiness";
import { sendDocExpiryAlert } from "@/lib/email/alerts";
import {
  DEFAULT_CHECKLIST,
  DOC_TYPE_LABELS,
  EXPIRING_DOC_TYPES,
  type ChecklistItem,
  type CheckStatus,
  type DocStatus,
  type DocType,
  type FleetDocument,
  type MonthlyCheck,
  type TripBlock,
} from "@/types";
import type { Database, Json } from "@/types/supabase";

type DocRow = Database["public"]["Tables"]["fleet_documents"]["Row"];
type MonthlyRow = Database["public"]["Tables"]["truck_monthly_checks"]["Row"];

const SIGNED_URL_SECONDS = 60 * 60;
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

async function signFleet(paths: string[]) {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const sb = await createClient();
  const { data } = await sb.storage
    .from(FLEET_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_SECONDS);
  (data ?? []).forEach(
    (d) => d.path && d.signedUrl && map.set(d.path, d.signedUrl),
  );
  return map;
}

/* =========================================================
   Daily pre-trip checklist (Admin → Settings)
   ========================================================= */
export async function getChecklist(): Promise<ChecklistItem[]> {
  const sb = await createClient();
  const { data } = await sb.rpc("get_pre_trip_items");
  const list = Array.isArray(data)
    ? (data as unknown as Partial<ChecklistItem>[])
    : [];
  const items = list
    .filter(
      (i) => i && typeof i.key === "string" && typeof i.label === "string",
    )
    .map((i) => ({
      key: i.key!,
      label: i.label!,
      hint: i.hint || undefined,
      blocksTrip: !!i.blocksTrip,
      ticket: i.ticket !== false,
      scored: !!i.scored,
    }));
  return items.length ? items : DEFAULT_CHECKLIST;
}

export async function saveChecklist(items: ChecklistItem[]) {
  const sb = await createClient();
  const { error } = await sb
    .from("settings")
    .update({ pre_trip_items: items as unknown as Json })
    .eq("id", 1);
  if (error) throw error;
}

/* =========================================================
   Documents
   ========================================================= */
async function toDocs(rows: DocRow[]): Promise<FleetDocument[]> {
  const signed = await signFleet(rows.flatMap((r) => r.file_paths));
  return rows.map((r) => ({
    id: r.id,
    truckId: r.truck_id,
    driverId: r.driver_id,
    docType: r.doc_type as DocType,
    title: r.title ?? undefined,
    files: r.file_paths.map((p, i) => ({
      path: p,
      name:
        r.file_names[i] ||
        (r.driver_id ? (i === 0 ? "Front" : "Back") : "Document"),
      url: signed.get(p) ?? "",
      isPdf: p.endsWith(".pdf"),
    })),
    expiresOn: r.expires_on,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  }));
}

/** Documents of one truck or one driver (newest first, deleted ones left out) */
export async function getDocuments(opts: {
  truckId?: string;
  driverId?: string;
}) {
  const sb = await createClient();
  let q = sb.from("fleet_documents").select("*").is("deleted_at", null);
  if (opts.truckId) q = q.eq("truck_id", opts.truckId);
  if (opts.driverId) q = q.eq("driver_id", opts.driverId);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return toDocs(data ?? []);
}

export async function getDocument(id: string) {
  if (!isUuid(id)) return null;
  const sb = await createClient();
  const { data } = await sb
    .from("fleet_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? (await toDocs([data]))[0] : null;
}

export async function createDocument(input: {
  truckId?: string;
  driverId?: string;
  docType: DocType;
  title?: string;
  files: { path: string; name: string }[];
  expiresOn?: string;
}) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("fleet_documents")
    .insert({
      truck_id: input.truckId ?? null,
      driver_id: input.driverId ?? null,
      doc_type: input.docType,
      title: input.docType === "other" ? input.title || null : null,
      file_paths: input.files.map((f) => f.path),
      file_names: input.files.map((f) => f.name.slice(0, 200)),
      expires_on: EXPIRING_DOC_TYPES.includes(input.docType)
        ? input.expiresOn || null
        : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  // A new upload can clear an old alert history: alerts are per document
  return { id: data.id };
}

/** Admin: remove a document (kept in the database, hidden everywhere) */
export async function deleteDocument(id: string) {
  if (!isUuid(id)) return null;
  const sb = await createClient();
  const { data, error } = await sb
    .from("fleet_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, truck_id, driver_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTruckDocStatus(
  truckId: string,
  docs?: FleetDocument[],
) {
  return docStatuses(
    docs ?? (await getDocuments({ truckId })),
    REQUIRED_TRUCK_DOCS,
  );
}

export async function getDriverDocStatus(
  driverId: string,
  docs?: FleetDocument[],
) {
  return docStatuses(
    docs ?? (await getDocuments({ driverId })),
    REQUIRED_DRIVER_DOCS,
  );
}

/** Every active truck and driver document that is expired or expires in the next 30 days, plus missing ones */
export async function getReadinessOverview() {
  const sb = await createClient();
  const [docsRes, trucksRes, driversRes] = await Promise.all([
    sb
      .from("fleet_documents")
      .select("*")
      .is("deleted_at", null)
      .neq("doc_type", "other"),
    sb.from("trucks").select("id, unit_number").eq("active", true),
    sb
      .from("profiles")
      .select("id, name")
      .eq("role", "driver")
      .eq("active", true),
  ]);
  if (docsRes.error) throw docsRes.error;
  const docs = await toDocs(docsRes.data ?? []);
  const today = todayEastern();

  type Row = DocStatus & {
    owner: "truck" | "driver";
    ownerId: string;
    ownerName: string;
  };
  const rows: Row[] = [];
  for (const t of trucksRes.data ?? []) {
    const mine = docs.filter((d) => d.truckId === t.id);
    for (const s of docStatuses(mine, REQUIRED_TRUCK_DOCS, today))
      rows.push({
        ...s,
        owner: "truck",
        ownerId: t.id,
        ownerName: `Unit ${t.unit_number}`,
      });
  }
  for (const d of driversRes.data ?? []) {
    const mine = docs.filter((x) => x.driverId === d.id);
    for (const s of docStatuses(mine, REQUIRED_DRIVER_DOCS, today))
      rows.push({ ...s, owner: "driver", ownerId: d.id, ownerName: d.name });
  }
  const order = { expired: 0, expiring: 1, missing: 2, ok: 3 } as const;
  rows.sort(
    (a, b) =>
      order[a.state] - order[b.state] ||
      (a.days ?? 9999) - (b.days ?? 9999) ||
      a.ownerName.localeCompare(b.ownerName, undefined, { numeric: true }),
  );
  return rows.filter((r) => r.state !== "ok");
}

/* =========================================================
   Trip holds ("No" on a blocking pre-trip item)
   ========================================================= */
export type OpenHold = {
  preTripId: string;
  truckId: string;
  driverId: string;
  at: string;
  items: { label: string; notes?: string }[];
};

/**
 * Trip holds not cleared yet. `everyone` reads all drivers' holds on the server
 * (a driver must see that a truck is on hold even if another driver put it there).
 */
export async function getOpenHolds(
  opts: { driverId?: string; truckId?: string; everyone?: boolean } = {},
) {
  const sb = opts.everyone ? createAdminClient() : await createClient();
  let q = sb
    .from("pre_trips")
    .select("id, truck_id, driver_id, received_at_server, items")
    .eq("blocked", true)
    .is("cleared_at", null);
  if (opts.driverId && opts.truckId)
    q = q.or(`driver_id.eq.${opts.driverId},truck_id.eq.${opts.truckId}`);
  else if (opts.driverId) q = q.eq("driver_id", opts.driverId);
  else if (opts.truckId) q = q.eq("truck_id", opts.truckId);
  const { data, error } = await q
    .order("received_at_server", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r): OpenHold => ({
    preTripId: r.id,
    truckId: r.truck_id,
    driverId: r.driver_id,
    at: r.received_at_server,
    items: (
      (r.items as unknown as {
        label?: string;
        key: string;
        status: string;
        blocks?: boolean;
        notes?: string;
      }[]) ?? []
    )
      .filter((i) => i.status === "attention" && i.blocks)
      .map((i) => ({ label: i.label || i.key, notes: i.notes || undefined })),
  }));
}

export async function clearHold(preTripId: string, note: string) {
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_clear_pre_trip_hold", {
    p_id: preTripId,
    p_note: note,
  });
  if (error) {
    if (/not found/i.test(error.message)) return null;
    throw error;
  }
  return data;
}

/* =========================================================
   Can the driver start a trip?
   ========================================================= */
/** The truck a driver is on: today's pre-trip truck, else the assigned truck */
export async function getCurrentTruckId(
  driverId: string,
): Promise<string | null> {
  const sb = await createClient();
  const since = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
  const [{ data: pt }, { data: assigned }] = await Promise.all([
    sb
      .from("pre_trips")
      .select("truck_id")
      .eq("driver_id", driverId)
      .gte("received_at_server", since)
      .order("received_at_server", { ascending: false })
      .limit(1),
    sb
      .from("trucks")
      .select("id")
      .eq("assigned_driver_id", driverId)
      .eq("active", true)
      .limit(1),
  ]);
  return pt?.[0]?.truck_id ?? assigned?.[0]?.id ?? null;
}

/** Expired truck documents and open holds, per truck (for the pre-trip truck list) */
export async function getTruckBlocks(
  truckIds: string[],
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  if (!truckIds.length) return out;
  const sb = await createClient();
  const [docsRes, holds] = await Promise.all([
    sb
      .from("fleet_documents")
      .select("*")
      .in("truck_id", truckIds)
      .is("deleted_at", null)
      .in("doc_type", ["registration", "insurance", "annual_inspection"]),
    getOpenHolds({ everyone: true }),
  ]);
  if (docsRes.error) throw docsRes.error;
  const today = todayEastern();
  for (const id of truckIds) {
    const latest = latestByType(
      (docsRes.data ?? [])
        .filter((r) => r.truck_id === id)
        .map((r) => ({
          id: r.id,
          truckId: r.truck_id,
          driverId: null,
          docType: r.doc_type as DocType,
          files: [],
          expiresOn: r.expires_on,
          uploadedBy: r.uploaded_by,
          createdAt: r.created_at,
        })),
    );
    const reasons: string[] = [];
    latest.forEach((d) => {
      if (d.expiresOn && daysUntil(d.expiresOn, today) < 0)
        reasons.push(`${DOC_TYPE_LABELS[d.docType]} expired`);
    });
    if (holds.some((h) => h.truckId === id))
      reasons.push("On hold after a pre-trip. An admin must clear it.");
    if (reasons.length) out[id] = reasons;
  }
  return out;
}

/** Everything stopping this driver from starting a trip right now */
export async function getTripBlocks(driverId: string): Promise<TripBlock[]> {
  const [driverDocs, truckId] = await Promise.all([
    getDocuments({ driverId }),
    getCurrentTruckId(driverId),
  ]);
  const blocks: TripBlock[] = [];

  for (const s of docStatuses(driverDocs, REQUIRED_DRIVER_DOCS)) {
    if (s.state === "expired")
      blocks.push({
        kind: "driver_doc",
        message: `Your ${s.label} expired. Upload the new one.`,
      });
  }

  if (truckId) {
    const truckDocs = await getDocuments({ truckId });
    for (const s of docStatuses(truckDocs, REQUIRED_TRUCK_DOCS)) {
      if (s.state === "expired")
        blocks.push({
          kind: "truck_doc",
          message: `The truck's ${s.label} expired. Ask your admin to upload the new one.`,
        });
    }
  }

  const holds = await getOpenHolds({
    driverId,
    truckId: truckId ?? undefined,
    everyone: true,
  });
  for (const h of holds) {
    blocks.push({
      kind: "hold",
      preTripId: h.preTripId,
      message: `Trip on hold: you answered "No" to ${h.items.map((i) => i.label).join(", ") || "a required item"}. An admin must clear it.`,
    });
  }
  return blocks;
}

/* =========================================================
   Monthly truck check
   ========================================================= */
type StoredMonthlyItem = {
  key: string;
  label: string;
  status: CheckStatus;
  notes?: string | null;
  photo: string;
};

async function toMonthly(rows: MonthlyRow[]): Promise<MonthlyCheck[]> {
  const itemsOf = (r: MonthlyRow) =>
    (r.items as unknown as StoredMonthlyItem[]) ?? [];
  const signed = await signFleet(
    rows.flatMap((r) => itemsOf(r).map((i) => i.photo)),
  );
  return rows.map((r) => ({
    id: r.id,
    truckId: r.truck_id,
    driverId: r.driver_id,
    items: itemsOf(r).map((i) => ({
      key: i.key,
      label: i.label,
      status: i.status,
      notes: i.notes ?? undefined,
      photoUrl: signed.get(i.photo) ?? "",
    })),
    notes: r.notes ?? undefined,
    capturedAtDevice: r.captured_at_device,
    receivedAtServer: r.received_at_server,
  }));
}

export async function getMonthlyChecks(
  opts: { truckId?: string; driverId?: string; limit?: number } = {},
) {
  const sb = await createClient();
  let q = sb.from("truck_monthly_checks").select("*");
  if (opts.truckId) q = q.eq("truck_id", opts.truckId);
  if (opts.driverId) q = q.eq("driver_id", opts.driverId);
  const { data, error } = await q
    .order("received_at_server", { ascending: false })
    .limit(opts.limit ?? 24);
  if (error) throw error;
  return toMonthly(data ?? []);
}

export async function getMonthlyCheck(id: string) {
  if (!isUuid(id)) return null;
  const sb = await createClient();
  const { data } = await sb
    .from("truck_monthly_checks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? (await toMonthly([data]))[0] : null;
}

/** Last monthly check time for each truck */
export async function getLastMonthlyChecks(): Promise<Record<string, string>> {
  const sb = await createClient();
  const since = new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("truck_monthly_checks")
    .select("truck_id, received_at_server")
    .gte("received_at_server", since)
    .order("received_at_server", { ascending: false });
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const r of data ?? [])
    if (!out[r.truck_id]) out[r.truck_id] = r.received_at_server;
  return out;
}

export async function createMonthlyCheck(input: {
  truckId: string;
  driverId: string;
  items: {
    key: string;
    label: string;
    status: CheckStatus;
    notes?: string;
    photo: string;
  }[];
  notes?: string;
  capturedAtDevice: string;
  lat: number | null;
  lng: number | null;
}) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("truck_monthly_checks")
    .insert({
      truck_id: input.truckId,
      driver_id: input.driverId,
      items: input.items.map((i) => ({
        ...i,
        notes: i.notes ?? null,
      })) as unknown as Json,
      notes: input.notes || null,
      captured_at_device: input.capturedAtDevice,
      lat: input.lat,
      lng: input.lng,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

/* =========================================================
   Expiry alerts: 30 days, 7 days and the day it expires.
   To the driver (driver documents, or the truck's assigned driver) and all admins.
   Safe to run often: each alert is sent once per document.
   ========================================================= */
export async function runExpiryAlerts() {
  const sb = createAdminClient();
  const [docsRes, sentRes, trucksRes, peopleRes] = await Promise.all([
    sb
      .from("fleet_documents")
      .select("id, truck_id, driver_id, doc_type, expires_on, created_at")
      .is("deleted_at", null)
      .in("doc_type", EXPIRING_DOC_TYPES),
    sb.from("doc_expiry_alerts").select("document_id, stage"),
    sb.from("trucks").select("id, unit_number, active, assigned_driver_id"),
    sb.from("profiles").select("id, name, email, role, active"),
  ]);
  if (docsRes.error) throw docsRes.error;
  if (sentRes.error) throw sentRes.error;

  const sent = new Set(
    (sentRes.data ?? []).map((r) => `${r.document_id}:${r.stage}`),
  );
  const trucks = new Map((trucksRes.data ?? []).map((t) => [t.id, t]));
  const people = new Map((peopleRes.data ?? []).map((p) => [p.id, p]));
  const today = todayEastern();

  // Only the latest document of each type counts
  const latest = new Map<string, NonNullable<typeof docsRes.data>[number]>();
  for (const d of [...(docsRes.data ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )) {
    const k = `${d.truck_id ?? d.driver_id}:${d.doc_type}`;
    if (!latest.has(k)) latest.set(k, d);
  }

  let count = 0;
  for (const d of latest.values()) {
    if (!d.expires_on) continue;
    const truck = d.truck_id ? trucks.get(d.truck_id) : undefined;
    const driver = d.driver_id
      ? people.get(d.driver_id)
      : truck?.assigned_driver_id
        ? people.get(truck.assigned_driver_id)
        : undefined;
    if (d.truck_id && !truck?.active) continue;
    if (d.driver_id && !driver?.active) continue;

    const days = daysUntil(d.expires_on, today);
    const stage = alertStage(days);
    if (!stage || sent.has(`${d.id}:${stage}`)) continue;
    // A later stage already went out (e.g. uploaded with 5 days left): skip the earlier one
    if (stage === "30" && (sent.has(`${d.id}:7`) || sent.has(`${d.id}:0`)))
      continue;
    if (stage === "7" && sent.has(`${d.id}:0`)) continue;

    const ok = await sendDocExpiryAlert({
      docLabel: DOC_TYPE_LABELS[d.doc_type as DocType],
      owner: truck
        ? `Truck unit ${truck.unit_number}`
        : (driver?.name ?? "Driver"),
      ownerLink: truck
        ? `/admin/trucks/${truck.id}`
        : `/admin/drivers/${d.driver_id}`,
      expires: d.expires_on,
      days,
      driverEmail:
        driver?.active && driver.role === "driver" ? driver.email : null,
      driverName: driver?.name ?? null,
      forTruck: !!truck,
    });
    if (ok) {
      await sb.from("doc_expiry_alerts").insert({ document_id: d.id, stage });
      count++;
    }
  }
  return count;
}
