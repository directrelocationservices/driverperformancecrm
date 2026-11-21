// File: scripts/check-granot-csv.mjs
// (NEW file)

//
// Compares the Granot CSV with the leads in the portal. Changes nothing.
//   node --env-file=.env.local scripts/check-granot-csv.mjs leads.csv

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
if (!file) {
  console.error("Give the CSV file: node --env-file=.env.local scripts/check-granot-csv.mjs leads.csv");
  process.exit(1);
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const lc = (s) => (s ?? "").trim().toLowerCase();
const money = (n) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (s) => {
  const m = (s ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
};

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

const [header, ...body] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
const col = (n) => header.findIndex((h) => lc(h) === lc(n));
const C = {
  job: col("Job Number"), date: col("Lead Date"), status: col("Status"),
  total: col("Total Estimate"), name: col("Customer Name"), source: col("Lead Source"),
};

/* ---------- CSV ---------- */
const csv = new Map();
let csvBooked = 0, csvRevenue = 0, csvTest = 0, minDate = "9999", maxDate = "0000";
for (const r of body) {
  const v = (i) => (r[i] ?? "").trim();
  const job = v(C.job).replace(/\D/g, "");
  if (!job) continue;
  const booked = lc(v(C.status)) === "booked";
  const total = Number(v(C.total).replace(/[$,]/g, "")) || 0;
  const d = date(v(C.date));
  if (d && d < minDate) minDate = d;
  if (d && d > maxDate) maxDate = d;
  const test = /\btest\b/i.test(`${v(C.name)} ${v(C.source)}`);
  if (test) csvTest++;
  if (booked) { csvBooked++; csvRevenue += total; }
  csv.set(job, { job: v(C.job), booked, total, test, date: d });
}

/* ---------- Portal ---------- */
const db = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from("leads")
    .select("granot_id, date, status, job_value, is_test, import_batch")
    .order("id")
    .range(from, from + 999);
  if (error) throw error;
  db.push(...data);
  if (data.length < 1000) break;
}
const byJob = new Map(db.map((l) => [l.granot_id.replace(/\D/g, ""), l]));

let found = 0, fromImport = 0, fromWebhook = 0;
const missing = [], statusDiff = [], valueDiff = [];
for (const [job, c] of csv) {
  if (c.test) continue;
  const l = byJob.get(job);
  if (!l) { missing.push(c.job); continue; }
  found++;
  if (l.import_batch) fromImport++; else fromWebhook++;
  const dbBooked = l.status === "booked";
  if (dbBooked !== c.booked)
    statusDiff.push(`${c.job}: CSV ${c.booked ? "Booked" : "Not booked"}, portal ${l.status}`);
  else if (c.booked) {
    const dv = Number(l.job_value ?? 0);
    if (Math.abs(dv - c.total) >= 0.01)
      valueDiff.push({ job: c.job, csv: c.total, portal: dv });
  }
}
const extra = db.filter(
  (l) => !l.is_test && l.date >= minDate && l.date <= maxDate &&
    !csv.has(l.granot_id.replace(/\D/g, "")),
);
const inRange = db.filter((l) => !l.is_test && l.date >= minDate && l.date <= maxDate);
const pBooked = inRange.filter((l) => l.status === "booked");
const pRevenue = pBooked.reduce((s, l) => s + Number(l.job_value ?? 0), 0);

console.log(`\nCSV ${minDate} to ${maxDate}`);
console.log(`  ${csv.size} leads, ${csvBooked} booked, ${money(csvRevenue)} (includes ${csvTest} test leads)`);
console.log(`\nCSV leads found in the portal: ${found} (${fromImport} from the CSV import, ${fromWebhook} from the live Granot sync)`);
console.log(`CSV leads missing in the portal: ${missing.length}${missing.length ? " → " + missing.slice(0, 20).join(", ") : ""}`);
console.log(`Booked / not booked different: ${statusDiff.length}`);
statusDiff.slice(0, 20).forEach((d) => console.log(`  ${d}`));
console.log(`Booked value different: ${valueDiff.length}` +
  (valueDiff.length ? ` (portal minus CSV: ${money(valueDiff.reduce((s, d) => s + d.portal - d.csv, 0))})` : ""));
valueDiff
  .sort((a, b) => Math.abs(b.portal - b.csv) - Math.abs(a.portal - a.csv))
  .slice(0, 20)
  .forEach((d) => console.log(`  ${d.job}: CSV ${money(d.csv)}, portal ${money(d.portal)}`));
console.log(`Portal leads in these dates that are not in the CSV: ${extra.length}` +
  (extra.length ? " → " + extra.slice(0, 20).map((l) => l.granot_id).join(", ") : ""));
console.log(`\nPortal ${minDate} to ${maxDate} (no test leads): ${inRange.length} leads, ${pBooked.length} booked, ${money(pRevenue)}\n`);