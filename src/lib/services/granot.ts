// File: src/lib/services/granot.ts
// (REPLACE the whole file)

import { createAdminClient } from "@/lib/supabase/admin";
import { parseGranot, todayET, type GranotEvent } from "@/lib/granot/parse";
import type { Database, Json } from "@/types/supabase";

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type Admin = ReturnType<typeof createAdminClient>;

const lc = (s: string) => s.trim().toLowerCase();

/** Lead source by name (case-insensitive). Unknown names go to "Other". */
async function findSource(sb: Admin, name: string | null) {
  const { data } = await sb.from("lead_sources").select("id, name");
  const list = data ?? [];
  const match = name ? list.find((s) => lc(s.name) === lc(name)) : undefined;
  if (match) return { id: match.id, matched: true };
  const other = list.find((s) => lc(s.name) === "other") ?? list[0];
  return { id: other?.id ?? null, matched: false };
}

/**
 * Portal user for a Granot rep name (case-insensitive): a sales rep by
 * Granot name, portal name or email, or an admin by Granot name only
 * (admins' leads count in company totals but not in the rep comparison).
 */
async function findRep(sb: Admin, rep: string | null) {
  if (!rep) return null;
  const { data } = await sb
    .from("profiles")
    .select("id, name, email, granot_name, role")
    .in("role", ["sales_rep", "admin"]);
  const key = lc(rep);
  const list = data ?? [];
  const hit =
    list.find(
      (p) =>
        p.role === "sales_rep" &&
        ((p.granot_name && lc(p.granot_name) === key) ||
          lc(p.name ?? "") === key ||
          lc(p.email ?? "") === key),
    ) ??
    list.find(
      (p) => p.role === "admin" && p.granot_name && lc(p.granot_name) === key,
    );
  return hit?.id ?? null;
}

type Result = {
  status: "processed" | "ignored" | "error";
  message: string;
  leadId?: string | null;
};

async function apply(
  sb: Admin,
  ev: GranotEvent,
  raw: Json,
  opts: { sample?: boolean },
): Promise<Result> {
  if (!ev.jobNumber)
    return { status: "ignored", message: "No job number in the event" };
  if (ev.type === "unknown")
    return {
      status: "ignored",
      message: "Couldn't tell what kind of event this is",
    };

  const { data: existing } = await sb
    .from("leads")
    .select("id, rep_id, status, booked_date")
    .eq("granot_id", ev.jobNumber)
    .maybeSingle();

  const repId = await findRep(sb, ev.rep);
  const notes: string[] = [];
  if (ev.rep && !repId) notes.push(`Rep "${ev.rep}" not found in portal`);

  // Every event can create the lead if the "new lead" event never arrived
  let leadId = existing?.id ?? null;
  if (!leadId) {
    const source = await findSource(sb, ev.source);
    if (ev.source && !source.matched)
      notes.push(`Source "${ev.source}" not found, saved as Other`);
    if (!source.id)
      return { status: "error", message: "No lead sources set up" };
    const row: LeadInsert = {
      granot_id: ev.jobNumber,
      date: ev.leadDate ?? todayET(),
      rep_id: repId,
      source_id: source.id,
      status: "open",
      granot_source: ev.source,
      granot_rep: ev.rep,
      raw,
      is_sample: !!opts.sample,
    };
    const { data, error } = await sb
      .from("leads")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      // Two events for the same new lead at once: the other one created it
      if (error.code !== "23505") throw error;
      const again = await sb
        .from("leads")
        .select("id")
        .eq("granot_id", ev.jobNumber)
        .single();
      leadId = again.data?.id ?? null;
    } else {
      leadId = data.id;
      notes.unshift("Lead created");
    }
  }
  if (!leadId)
    return { status: "error", message: "Couldn't find or create the lead" };

  const patch: LeadUpdate = { raw };
  // The rep in the latest Granot event wins, so reassignments in Granot
  // move the lead (an unknown name leaves it "Unmatched" until linked)
  if (ev.rep) {
    patch.granot_rep = ev.rep;
    patch.rep_id = repId;
  }

  if (ev.type === "booked") {
    patch.status = "booked";
    // Granot re-sends "Booked" when an estimate changes: keep the first booking date
    const alreadyBooked =
      existing?.status === "booked" && !!existing.booked_date;
    patch.booked_date =
      ev.bookedDate ?? (alreadyBooked ? existing!.booked_date : todayET());
    if (ev.totalEstimate !== null) patch.job_value = ev.totalEstimate;
    else notes.push("No total estimate in the event");
    notes.push("Marked booked");
  } else if (ev.type === "unbooked") {
    patch.status = "open";
    patch.booked_date = null;
    patch.job_value = null;
    notes.push("Marked open (unbooked)");
  } else if (ev.type === "priority") {
    notes.push("Priority update");
  } else if (existing) {
    notes.push("Lead already existed");
  }

  const { error } = await sb.from("leads").update(patch).eq("id", leadId);
  if (error) throw error;
  return { status: "processed", message: notes.join(" · "), leadId };
}

/**
 * Saves the raw event, then applies it to the leads table.
 * Never throws: problems are written on the event so admin can see them.
 */
export async function handleGranotEvent(
  input: Record<string, unknown>,
  opts: { sample?: boolean } = {},
): Promise<{ id: string | null; status: string; message: string }> {
  const sb = createAdminClient();
  const ev = parseGranot(input);
  const raw = ev.fields as unknown as Json;

  const { data: saved, error: saveErr } = await sb
    .from("granot_events")
    .insert({ event_type: ev.type, job_number: ev.jobNumber, payload: raw })
    .select("id")
    .single();
  if (saveErr) console.error("[granot] couldn't save event", saveErr);

  let result: Result;
  try {
    result = await apply(sb, ev, raw, opts);
  } catch (err) {
    console.error("[granot] couldn't apply event", err);
    result = {
      status: "error",
      message: err instanceof Error ? err.message : "Unexpected error",
    };
  }

  if (saved) {
    await sb
      .from("granot_events")
      .update({
        status: result.status,
        message: result.message,
        lead_id: result.leadId ?? null,
      })
      .eq("id", saved.id);
  }
  return {
    id: saved?.id ?? null,
    status: result.status,
    message: result.message,
  };
}
