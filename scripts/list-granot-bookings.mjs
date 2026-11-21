// File: scripts/list-granot-bookings.mjs
// (NEW file)
//
// Lists every booked job with a booking date in the range, to compare with
// Granot's Salesmen Performance report. Changes nothing. Also saves a CSV.
//   node --env-file=.env.local scripts/list-granot-bookings.mjs 2026-11-01 2026-11-20

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const from = process.argv[2] ?? "2026-11-01";
const to = process.argv[3] ?? "2026-11-20";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data, error } = await sb
  .from("leads")
  .select("granot_id, date, booked_date, job_value, granot_rep, import_batch, created_at, updated_at, raw")
  .eq("is_test", false)
  .eq("status", "booked")
  .gte("booked_date", from)
  .lte("booked_date", to)
  .order("booked_date")
  .limit(5000);
if (error) throw error;

const rows = data.map((l) => ({
  job: (l.raw && l.raw.job_number) || l.granot_id,
  rep: (l.granot_rep ?? "").toUpperCase() || "(no rep)",
  lead_date: l.date,
  booked_date: l.booked_date,
  value: Number(l.job_value ?? 0).toFixed(2),
  from: l.import_batch ? "csv" : "live",
  lead_status: (l.raw && l.raw.lead_status) ?? "",
  booked_on_portal: l.import_batch ? "" : l.updated_at.slice(0, 10),
}));

const head = Object.keys(rows[0] ?? { job: "" });
console.log(`\n${rows.length} booked jobs with booking date ${from} to ${to}\n`);
console.log(head.join(" | "));
rows.forEach((r) => console.log(head.map((k) => r[k]).join(" | ")));

const zero = rows.filter((r) => Number(r.value) <= 0).length;
console.log(`\n$0 jobs: ${zero} · from CSV import: ${rows.filter((r) => r.from === "csv").length} · from live sync: ${rows.filter((r) => r.from === "live").length}`);

const file = `bookings-${from}-to-${to}.csv`;
writeFileSync(file, [head.join(","), ...rows.map((r) => head.map((k) => `"${String(r[k]).replace(/"/g, '""')}"`).join(","))].join("\n"));
console.log(`Saved: ${file}\n`);