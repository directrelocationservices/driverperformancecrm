// File: scripts/fill-reps-from-csv.mjs
// (NEW file)
//
// Leads that came in through the live sync have no rep, because Granot's
// "new lead" event doesn't send one. This fills them in from a Granot CSV
// export (its "Sales Rep" column = the user the lead is assigned to).
// Only leads with NO rep are changed. Run again with any newer export.
//   Check only (changes nothing):  node --env-file=.env.local scripts/fill-reps-from-csv.mjs leads.csv
//   Fill for real:                 node --env-file=.env.local scripts/fill-reps-from-csv.mjs leads.csv --apply

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const APPLY = process.argv.includes("--apply");
if (!file) {
  console.error("Give the CSV file: node --env-file=.env.local scripts/fill-reps-from-csv.mjs leads.csv");
  process.exit(1);
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const lc = (s) => (s ?? "").trim().toLowerCase();
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

const [header, ...body] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
const col = (n) => header.findIndex((h) => lc(h) === n);
const J = col("job number"), R = col("sales rep");
if (J < 0 || R < 0) {
  console.error('The CSV needs "Job Number" and "Sales Rep" columns.');
  process.exit(1);
}
const csvRep = new Map();
for (const r of body) {
  const rep = (r[R] ?? "").trim();
  if (r[J] && rep) csvRep.set(digits(r[J]), rep.toUpperCase());
}

// Same matching as the live sync: sales rep by Granot name / name / email, or admin by Granot name
const { data: people, error: pErr } = await sb
  .from("profiles")
  .select("id, name, email, granot_name, role")
  .in("role", ["sales_rep", "admin"]);
if (pErr) throw pErr;
function findRep(rep) {
  const key = lc(rep);
  return (
    people.find(
      (p) =>
        p.role === "sales_rep" &&
        ((p.granot_name && lc(p.granot_name) === key) || lc(p.name) === key || lc(p.email) === key),
    ) ?? people.find((p) => p.role === "admin" && p.granot_name && lc(p.granot_name) === key)
  );
}

const leads = [];
for (let i = 0; ; i += 1000) {
  const { data, error } = await sb
    .from("leads")
    .select("id, granot_id, date, rep_id, granot_rep")
    .is("rep_id", null)
    .order("id")
    .range(i, i + 999);
  if (error) throw error;
  leads.push(...data);
  if (data.length < 1000) break;
}

const fixes = leads
  .filter((l) => !l.granot_rep && csvRep.has(digits(l.granot_id)))
  .map((l) => {
    const rep = csvRep.get(digits(l.granot_id));
    return { l, rep, person: findRep(rep) };
  });

console.log(`\nLeads with no rep that the CSV has a rep for: ${fixes.length}`);
const byRep = {};
fixes.forEach((f) => {
  const k = `${f.rep} → ${f.person ? f.person.name + (f.person.role === "admin" ? " (admin)" : "") : "NOT LINKED (Unmatched)"}`;
  byRep[k] = (byRep[k] ?? 0) + 1;
});
Object.entries(byRep).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k}: ${n}`));

if (!APPLY) {
  console.log(`\nCheck only. Nothing was changed. Run again with --apply to fill them in.\n`);
  process.exit(0);
}
for (const f of fixes) {
  const { error } = await sb
    .from("leads")
    .update({ granot_rep: f.rep, rep_id: f.person?.id ?? null })
    .eq("id", f.l.id)
    .is("rep_id", null);
  if (error) throw error;
}
console.log(`\nDone. ${fixes.length} leads now have their rep.\n`);