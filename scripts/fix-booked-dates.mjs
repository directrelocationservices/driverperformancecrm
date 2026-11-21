// File: scripts/fix-booked-dates.mjs
// (NEW file)
//
// Puts back the real booking date (from the Granot CSV) on live-sync leads
// whose booking date was moved to the day Granot re-sent a "Booked" update.
//   Check only (changes nothing):  node --env-file=.env.local scripts/fix-booked-dates.mjs leads.csv
//   Fix for real:                  node --env-file=.env.local scripts/fix-booked-dates.mjs leads.csv --apply

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const APPLY = process.argv.includes("--apply");
if (!file) {
  console.error("Give the CSV file: node --env-file=.env.local scripts/fix-booked-dates.mjs leads.csv");
  process.exit(1);
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const lc = (s) => (s ?? "").trim().toLowerCase();
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
const C = { job: col("Job Number"), status: col("Status"), booked: col("Booking Date") };

// Real booking dates of the jobs that were already booked in the export
const csvBooked = new Map();
for (const r of body) {
  const job = (r[C.job] ?? "").replace(/\D/g, "");
  const d = date(r[C.booked]);
  if (job && d && lc(r[C.status]) === "booked") csvBooked.set(job, { job: r[C.job].trim(), d });
}

const leads = [];
for (let i = 0; ; i += 1000) {
  const { data, error } = await sb
    .from("leads")
    .select("id, granot_id, status, booked_date")
    .is("import_batch", null)
    .eq("status", "booked")
    .order("id")
    .range(i, i + 999);
  if (error) throw error;
  leads.push(...data);
  if (data.length < 1000) break;
}

const fixes = leads
  .map((l) => ({ l, c: csvBooked.get(l.granot_id.replace(/\D/g, "")) }))
  .filter(({ l, c }) => c && l.booked_date && l.booked_date > c.d);

console.log(`\nLive-sync bookings with a later date than Granot's export: ${fixes.length}`);
fixes.forEach(({ l, c }) => console.log(`  ${c.job}: portal ${l.booked_date} → ${c.d}`));

if (!APPLY) {
  console.log(`\nCheck only. Nothing was changed. Run again with --apply to fix.\n`);
  process.exit(0);
}
for (const { l, c } of fixes) {
  const { error } = await sb.from("leads").update({ booked_date: c.d }).eq("id", l.id);
  if (error) throw error;
}
console.log(`\nDone. ${fixes.length} booking dates fixed.\n`);