// File: scripts/check-granot-period.mjs
// (NEW file)
//
// Shows the portal's numbers for a date range, counted in different ways,
// so we can see which way matches Granot's Salesmen Performance report.
// Changes nothing.
//   node --env-file=.env.local scripts/check-granot-period.mjs 2026-11-01 2026-11-20

import { createClient } from "@supabase/supabase-js";

const from = process.argv[2] ?? "2026-11-01";
const to = process.argv[3] ?? "2026-11-20";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const money = (n) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const leads = [];
for (let i = 0; ; i += 1000) {
  const { data, error } = await sb
    .from("leads")
    .select("granot_id, date, booked_date, status, job_value, granot_rep, is_test, import_batch, created_at, raw")
    .eq("is_test", false)
    .order("id")
    .range(i, i + 999);
  if (error) throw error;
  leads.push(...data);
  if (data.length < 1000) break;
}

const inRange = (d) => !!d && d >= from && d <= to;
const rep = (l) => (l.granot_rep ?? "").trim().toUpperCase() || "(no rep)";
const createdET = (l) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(l.created_at));

const A = leads.filter((l) => inRange(l.date));                          // lead date
const B = leads.filter((l) => l.status === "booked" && inRange(l.booked_date)); // booking date
const C = A.filter((l) => l.status === "booked");                        // booked, by lead date
const D = leads.filter((l) => !l.import_batch && inRange(createdET(l))); // arrived in portal

const sum = (list) => list.reduce((s, l) => s + Number(l.job_value ?? 0), 0);
console.log(`\nPeriod ${from} to ${to} (test leads left out)\n`);
console.log(`1. Leads by lead date:                 ${A.length}`);
console.log(`2. Booked by booking date:             ${B.length}  ${money(sum(B))}`);
console.log(`3. Booked, of the leads in (1):        ${C.length}  ${money(sum(C))}`);
console.log(`4. Leads that arrived in the portal:   ${D.length}  (live sync only)`);
console.log(`\nGranot says: 792 Total In, 45 booked, $325,259.32 booked estimates\n`);

const reps = new Map();
const row = (k) => reps.get(k) ?? reps.set(k, { a: 0, b: 0, bv: 0, c: 0 }).get(k);
A.forEach((l) => row(rep(l)).a++);
B.forEach((l) => { const r = row(rep(l)); r.b++; r.bv += Number(l.job_value ?? 0); });
C.forEach((l) => row(rep(l)).c++);
console.log("Rep            Leads(1)  Booked(2)  Revenue(2)       Booked(3)");
[...reps].sort((x, y) => y[1].a - x[1].a).forEach(([k, r]) =>
  console.log(`${k.padEnd(14)} ${String(r.a).padStart(8)}  ${String(r.b).padStart(9)}  ${money(r.bv).padStart(14)}  ${String(r.c).padStart(9)}`),
);
console.log(`\nGranot says Arthur: 61 leads, 1 booked, $16,109.30`);

// What Granot sends: field names in the latest live-sync event (values hidden)
const live = leads
  .filter((l) => !l.import_batch && l.raw && typeof l.raw === "object")
  .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0];
if (live) console.log(`\nFields Granot sends: ${Object.keys(live.raw).join(", ")}\n`);