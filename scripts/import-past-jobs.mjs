// File: scripts/import-past-jobs.mjs
// (NEW file)
//
// Loads past jobs from a CSV. Each job is marked "Entered by <admin>" and
// counts in the driver's stats. Jobs whose number already exists are skipped.
//
//   Check only (changes nothing):
//     node --env-file=.env.local scripts/import-past-jobs.mjs past-jobs.csv --entered-by=justin@example.com
//   Import for real:
//     node --env-file=.env.local scripts/import-past-jobs.mjs past-jobs.csv --entered-by=justin@example.com --apply
//   Undo an import (removes that batch's jobs that have nothing added to them):
//     node --env-file=.env.local scripts/import-past-jobs.mjs --undo=past-jobs-20261126-1530 --apply
//
// CSV columns (first row = these names, any order; * = required):
//   job_number*, date* (pickup date), driver_email*, crew_emails (split with ;),
//   customer_name, origin_city*, origin_state*, dest_city*, dest_state*,
//   delivered_by (DRS or Partner, default DRS), carrier (partner company name),
//   on_time_pickup (yes / no / blank), on_time_delivery (yes / no / blank),
//   delivery_date
// Dates can be 2026-10-01 or 10/1/2026.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const opt = (name) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const file = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const UNDO = opt("undo");
const ENTERED_BY = opt("entered-by");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/* ---------- Undo ---------- */
if (UNDO) {
  const { data: jobs, error } = await sb
    .from("jobs")
    .select("id, job_number")
    .eq("import_batch", UNDO);
  if (error) throw error;
  const ids = jobs.map((j) => j.id);
  const used = new Set();
  for (const t of ["pre_damages", "damage_incidents", "reviews", "upsells", "job_documents", "carrier_claims"]) {
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error: e } = await sb.from(t).select("job_id").in("job_id", ids.slice(i, i + 200));
      if (e) throw e;
      data.forEach((r) => used.add(r.job_id));
    }
  }
  const free = jobs.filter((j) => !used.has(j.id));
  console.log(`\nBatch ${UNDO}: ${jobs.length} jobs. Can remove: ${free.length}.`);
  if (used.size) console.log(`Kept (have damage, reviews, upsells or files added): ${used.size}`);
  if (!APPLY) {
    console.log(`\nCheck only. Nothing was changed. Run again with --apply to remove.\n`);
    process.exit(0);
  }
  for (let i = 0; i < free.length; i += 200) {
    const { error: e } = await sb.from("jobs").delete().in("id", free.slice(i, i + 200).map((j) => j.id));
    if (e) throw e;
  }
  console.log(`\nDone. ${free.length} jobs removed.\n`);
  process.exit(0);
}

/* ---------- Import ---------- */
if (!file || !ENTERED_BY) {
  console.error(
    "Give the CSV file and your admin email:\n  node --env-file=.env.local scripts/import-past-jobs.mjs past-jobs.csv --entered-by=you@example.com",
  );
  process.exit(1);
}

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

const lc = (s) => (s ?? "").trim().toLowerCase();
const key = (s) => lc(s).replace(/[^a-z]/g, "");
function toDate(s) {
  const v = (s ?? "").trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return "bad";
}
function toTri(s) {
  const v = lc(s);
  if (!v) return null;
  if (["yes", "y", "true", "1"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  return "bad";
}
const state = (s) => (s ?? "").trim().toUpperCase();

const [header, ...body] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
const col = Object.fromEntries(header.map((h, i) => [key(h), i]));
const get = (r, name) => (col[key(name)] === undefined ? "" : (r[col[key(name)]] ?? "").trim());
for (const need of ["job_number", "date", "driver_email", "origin_city", "origin_state", "dest_city", "dest_state"]) {
  if (col[key(need)] === undefined) {
    console.error(`Missing column: ${need}`);
    process.exit(1);
  }
}

// People and carriers
const { data: people, error: pe } = await sb.from("profiles").select("id, name, email, role, active");
if (pe) throw pe;
const byEmail = new Map(people.map((p) => [lc(p.email), p]));
const admin = byEmail.get(lc(ENTERED_BY));
if (!admin || admin.role !== "admin") {
  console.error(`${ENTERED_BY} is not an admin login.`);
  process.exit(1);
}
const { data: carriers, error: ce } = await sb.from("carriers").select("id, company_name");
if (ce) throw ce;
const carrierByName = new Map(carriers.map((c) => [lc(c.company_name), c.id]));

// Job numbers already in the portal
const existing = new Set();
for (let i = 0; ; i += 1000) {
  const { data, error } = await sb.from("jobs").select("job_number").order("id").range(i, i + 999);
  if (error) throw error;
  data.forEach((j) => existing.add(lc(j.job_number)));
  if (data.length < 1000) break;
}

const today = new Date().toISOString().slice(0, 10);
const now = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const BATCH = `past-jobs-${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}`;

const ok = [], problems = [], skipped = [];
const seen = new Set();
body.forEach((r, i) => {
  const line = i + 2;
  const err = [];
  const jobNumber = get(r, "job_number");
  const date = toDate(get(r, "date"));
  const deliveryDate = toDate(get(r, "delivery_date"));
  const driver = byEmail.get(lc(get(r, "driver_email")));
  const crewEmails = get(r, "crew_emails").split(/[;|]/).map(lc).filter(Boolean);
  const crew = crewEmails.map((e) => byEmail.get(e));
  const deliveredBy = lc(get(r, "delivered_by")) || "drs";
  const carrierName = get(r, "carrier");
  const pickup = toTri(get(r, "on_time_pickup"));
  const delivery = toTri(get(r, "on_time_delivery"));
  const row = {
    origin_city: get(r, "origin_city"),
    origin_state: state(get(r, "origin_state")),
    dest_city: get(r, "dest_city"),
    dest_state: state(get(r, "dest_state")),
  };

  if (!jobNumber) err.push("no job number");
  if (!date || date === "bad") err.push("bad date");
  else if (date > today) err.push("date is in the future");
  if (deliveryDate === "bad") err.push("bad delivery date");
  else if (deliveryDate && date && deliveryDate < date) err.push("delivery before pickup");
  if (!driver) err.push(`driver email not found: ${get(r, "driver_email") || "(blank)"}`);
  else if (driver.role !== "driver") err.push(`${driver.email} is not a driver`);
  crew.forEach((c, k) => {
    if (!c) err.push(`crew email not found: ${crewEmails[k]}`);
    else if (c.role !== "driver") err.push(`${c.email} is not a driver`);
  });
  if (!row.origin_city || !row.dest_city) err.push("missing city");
  if (!/^[A-Z]{2}$/.test(row.origin_state) || !/^[A-Z]{2}$/.test(row.dest_state)) err.push("state must be 2 letters");
  if (!["drs", "partner"].includes(deliveredBy)) err.push("delivered_by must be DRS or Partner");
  const carrierId = carrierName ? carrierByName.get(lc(carrierName)) : null;
  if (carrierName && !carrierId) err.push(`carrier not found: ${carrierName}`);
  if (pickup === "bad" || delivery === "bad") err.push("on-time must be yes, no or blank");

  if (err.length) return problems.push(`  Row ${line} (${jobNumber || "?"}): ${err.join("; ")}`);
  if (existing.has(lc(jobNumber)) || seen.has(lc(jobNumber)))
    return skipped.push(`  Row ${line}: ${jobNumber} already exists`);
  seen.add(lc(jobNumber));

  ok.push({
    job_number: jobNumber,
    date,
    delivery_date: deliveryDate,
    ...row,
    driver_id: driver.id,
    crew_ids: [...new Set([driver.id, ...crew.map((c) => c.id)])],
    delivered_by: deliveredBy,
    carrier_id: deliveredBy === "partner" ? carrierId : null,
    customer_name: get(r, "customer_name") || null,
    on_time_pickup: pickup,
    on_time_delivery: delivery,
    entered_by: admin.id,
    import_batch: BATCH,
  });
});

console.log(`\nRows in file: ${body.length}`);
console.log(`Ready to import: ${ok.length}`);
console.log(`Skipped (job number already in the portal): ${skipped.length}`);
skipped.slice(0, 20).forEach((s) => console.log(s));
console.log(`Problems (not imported): ${problems.length}`);
problems.forEach((s) => console.log(s));

if (!APPLY) {
  console.log(`\nCheck only. Nothing was changed. Fix any problems, then run again with --apply.\n`);
  process.exit(0);
}
for (let i = 0; i < ok.length; i += 200) {
  const { error } = await sb.from("jobs").insert(ok.slice(i, i + 200));
  if (error) throw error;
}
console.log(`\nDone. ${ok.length} jobs imported, entered by ${admin.name}.`);
console.log(`Batch name (to undo): ${BATCH}\n`);