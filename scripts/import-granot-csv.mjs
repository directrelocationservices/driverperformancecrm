// File: scripts/import-granot-csv.mjs
// (NEW file)
//
// Imports the Granot leads CSV into the portal.
//   Check only (changes nothing):  node --env-file=.env.local scripts/import-granot-csv.mjs leads.csv
//   Import for real:               node --env-file=.env.local scripts/import-granot-csv.mjs leads.csv --apply
// Undo (Supabase SQL editor):      delete from public.leads where import_batch = 'granot-csv-2026';

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BATCH = "granot-csv-2026";
// Reps who left: they get an inactive account so their old numbers still show
const FORMER_REPS = ["LEVI", "VINNY", "ISIAH", "MIA", "VICTOR"];
// Source names in the CSV that mean another portal source
const SOURCE_ALIASES = { "2003": "equate warm calls" };

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const APPLY = process.argv.includes("--apply");
if (!file) {
  console.error("Give the CSV file: node --env-file=.env.local scripts/import-granot-csv.mjs leads.csv");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  process.exit(1);
}
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const lc = (s) => (s ?? "").trim().toLowerCase();
const money = (n) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- read the CSV ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
const date = (s) => {
  const m = (s ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
};

const [header, ...body] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
const col = (name) => {
  const i = header.findIndex((h) => lc(h) === lc(name));
  if (i < 0) throw new Error(`Column "${name}" not found in the CSV`);
  return i;
};
const C = {
  job: col("Job Number"), date: col("Lead Date"), source: col("Lead Source"),
  rep: col("Sales Rep"), status: col("Status"), booked: col("Booking Date"),
  total: col("Total Estimate"), name: col("Customer Name"),
};

/* ---------- what's already in the portal ---------- */
async function all(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
const existing = await all(() => sb.from("leads").select("granot_id").order("id"));
const have = new Set(existing.map((l) => l.granot_id.replace(/\D/g, "")));

const { data: sources, error: sErr } = await sb.from("lead_sources").select("id, name, active");
if (sErr) throw sErr;
const findSource = (name) => {
  const key = SOURCE_ALIASES[lc(name)] ?? lc(name);
  const hits = sources.filter((s) => lc(s.name) === key);
  return hits.find((s) => s.active) ?? hits[0] ?? null;
};
const other = sources.find((s) => lc(s.name) === "other");
if (!other) throw new Error('No "Other" lead source in the portal');

let { data: reps, error: rErr } = await sb
  .from("profiles")
  .select("id, name, email, granot_name")
  .eq("role", "sales_rep");
if (rErr) throw rErr;
const findRep = (u) =>
  !lc(u)
    ? null
    : reps.find(
        (p) => lc(p.granot_name) === lc(u) || lc(p.name) === lc(u) || lc(p.email) === lc(u),
      ) ?? null;

/* ---------- inactive accounts for former reps ---------- */
const toCreate = FORMER_REPS.filter((u) => !findRep(u));
if (APPLY) {
  for (const u of toCreate) {
    const name = u[0] + u.slice(1).toLowerCase();
    const { data, error } = await sb.auth.admin.createUser({
      email: `former+${u.toLowerCase()}@directrelocate.com`,
      password: crypto.randomUUID() + "Aa1!",
      email_confirm: true,
      app_metadata: { role: "sales_rep" },
      user_metadata: { name },
    });
    if (error) throw new Error(`Couldn't create ${u}: ${error.message}`);
    await sb.auth.admin.updateUserById(data.user.id, { ban_duration: "876000h" });
    const { error: pErr } = await sb
      .from("profiles")
      .update({ granot_name: u, active: false })
      .eq("id", data.user.id);
    if (pErr) throw pErr;
    reps.push({ id: data.user.id, name, email: null, granot_name: u });
  }
}

/* ---------- build the rows ---------- */
const rows = [];
const skip = { already: 0, test: 0, bad: 0, dupe: 0 };
const negative = []; // booked jobs with a minus total in Granot: saved as $0
const seen = new Set();
const bySource = new Map();
const byRep = new Map();
for (const r of body) {
  const v = (i) => (r[i] ?? "").trim();
  const job = v(C.job).replace(/\D/g, "");
  const leadDate = date(v(C.date));
  if (!job || !leadDate) { skip.bad++; continue; }
  if (have.has(job)) { skip.already++; continue; }
  if (seen.has(job)) { skip.dupe++; continue; }
  seen.add(job);
  const customer = v(C.name);
  const srcName = v(C.source);
  if (/\btest\b/i.test(`${customer} ${srcName}`)) { skip.test++; continue; }

  const src = findSource(srcName) ?? other;
  const repName = v(C.rep);
  const rep = findRep(repName);
  const booked = lc(v(C.status)) === "booked";
  let total = Number(v(C.total).replace(/[$,]/g, ""));
  if (booked && total < 0) {
    negative.push(`${v(C.job)}  ${customer}  ${v(C.total)}`);
    total = 0;
  }

  rows.push({
    granot_id: job,
    date: leadDate,
    source_id: src.id,
    granot_source: srcName || null,
    rep_id: rep?.id ?? null,
    granot_rep: repName || null,
    status: booked ? "booked" : "open",
    booked_date: booked ? date(v(C.booked)) ?? leadDate : null,
    job_value: booked && Number.isFinite(total) ? total : null,
    raw: { name: customer, job_number: v(C.job), imported_from: "csv" },
    import_batch: BATCH,
  });

  const sKey = `${srcName || "(blank)"} → ${src.name}`;
  bySource.set(sKey, (bySource.get(sKey) ?? 0) + 1);
  const rKey = !repName
    ? "(no rep) → Unassigned"
    : rep
      ? `${repName} → ${rep.name}`
      : FORMER_REPS.includes(repName.toUpperCase()) && !APPLY
        ? `${repName} → new inactive account`
        : `${repName} → NOT LINKED (Unmatched)`;
  byRep.set(rKey, (byRep.get(rKey) ?? 0) + 1);
}

/* ---------- report ---------- */
const booked = rows.filter((r) => r.status === "booked");
const list = (m) =>
  [...m].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
console.log(`\nCSV rows: ${body.length}`);
console.log(`Already in portal (skipped): ${skip.already}`);
console.log(`Test leads (skipped): ${skip.test}`);
if (skip.dupe) console.log(`Duplicate job numbers in CSV (skipped): ${skip.dupe}`);
if (skip.bad) console.log(`Rows with no job number or date (skipped): ${skip.bad}`);
console.log(`To import: ${rows.length} leads, ${booked.length} booked, ${money(booked.reduce((s, r) => s + (r.job_value ?? 0), 0))} revenue`);
console.log(`\nReps:`); list(byRep);
console.log(`\nSources:`); list(bySource);
if (negative.length) {
  console.log(`\nBooked with a minus total (saved as $0):`);
  negative.forEach((n) => console.log(`  ${n}`));
}
if (toCreate.length)
  console.log(`\nInactive accounts ${APPLY ? "created" : "to create"}: ${toCreate.join(", ")}`);

if (!APPLY) {
  console.log(`\nCheck only. Nothing was changed. Run again with --apply to import.\n`);
  process.exit(0);
}

/* ---------- write ---------- */
let done = 0;
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from("leads").insert(rows.slice(i, i + 500));
  if (error) throw new Error(`Insert failed after ${done} leads: ${error.message}`);
  done += Math.min(500, rows.length - i);
  console.log(`  inserted ${done}/${rows.length}`);
}
// Lead costs from the weekly cost table, for every source we touched
for (const id of new Set(rows.map((r) => r.source_id))) {
  const { error } = await sb.rpc("recalc_lead_costs", { p_source: id });
  if (error) console.warn(`  lead cost update failed for a source: ${error.message}`);
}
console.log(`\nDone. Imported ${done} leads (batch "${BATCH}").\n`);