// File: scripts/check-granot-user.mjs
// (NEW file)
//
// Checks why leads land in "Unassigned" (no rep). Changes nothing.
//  1. Finds the client's job numbers in the portal and shows their rep.
//  2. Counts portal leads with no rep that the Granot CSV gives a rep (user) for.
//  3. Lists the field names Granot sends in live events (is there a "user" field?).
//   node --env-file=.env.local scripts/check-granot-user.mjs leads.csv

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
const JOBS = ["E5453449", "E5453457", "E5453465", "E5453472", "E5453490", "E5454057", "E5454292"];
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const digits = (s) => String(s ?? "").replace(/\D/g, "");

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

// Granot CSV: job → Sales Rep (the user the lead is assigned to)
const csvRep = new Map();
if (file) {
  const [header, ...body] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const col = (n) => header.findIndex((h) => h.trim().toLowerCase() === n);
  const J = col("job number"), R = col("sales rep");
  for (const r of body) if (r[J]) csvRep.set(digits(r[J]), (r[R] ?? "").trim().toUpperCase());
}

const leads = [];
for (let i = 0; ; i += 1000) {
  const { data, error } = await sb
    .from("leads")
    .select("id, granot_id, date, status, rep_id, granot_rep, import_batch, is_test, raw")
    .order("id")
    .range(i, i + 999);
  if (error) throw error;
  leads.push(...data);
  if (data.length < 1000) break;
}
const { data: people } = await sb.from("profiles").select("id, name");
const name = new Map(people.map((p) => [p.id, p.name]));

console.log("\n1. Client's job numbers in the portal");
for (const j of JOBS) {
  const l = leads.find((x) => digits(x.granot_id) === digits(j));
  const inCsv = csvRep.has(digits(j)) ? `CSV says ${csvRep.get(digits(j)) || "(blank)"}` : "not in CSV";
  if (!l) { console.log(`   ${j}: NOT in portal · ${inCsv}`); continue; }
  console.log(
    `   ${j}: lead date ${l.date} · ${l.status} · portal rep: ${l.rep_id ? name.get(l.rep_id) : "Unassigned"}` +
      ` (Granot rep "${l.granot_rep ?? ""}") · came from ${l.import_batch ? "CSV import" : "live sync"} · ${inCsv}`,
  );
}

const noRep = leads.filter((l) => !l.is_test && !l.rep_id && !l.granot_rep);
const fixable = noRep.filter((l) => csvRep.get(digits(l.granot_id)));
console.log(`\n2. Leads with no rep: ${noRep.length} (live sync: ${noRep.filter((l) => !l.import_batch).length})`);
console.log(`   Of these, the Granot CSV has a rep for: ${fixable.length}`);
const byRep = {};
fixable.forEach((l) => (byRep[csvRep.get(digits(l.granot_id))] = (byRep[csvRep.get(digits(l.granot_id))] ?? 0) + 1));
Object.entries(byRep).sort((a, b) => b[1] - a[1]).forEach(([r, n]) => console.log(`   ${r.padEnd(12)} ${n}`));

console.log("\n3. Fields Granot sends in live events (latest 5, values hidden)");
leads
  .filter((l) => !l.import_batch && l.raw && typeof l.raw === "object")
  .sort((a, b) => (a.date < b.date ? 1 : -1))
  .slice(0, 5)
  .forEach((l) => console.log(`   ${l.granot_id}: ${Object.keys(l.raw).join(", ")}`));
console.log("");