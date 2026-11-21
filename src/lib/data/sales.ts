// File: src/lib/data/sales.ts
// (REPLACE the whole file)

import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { shiftWeek, weekStartOf } from "@/lib/weeks";
import { getAdmins, getReps, getUserById } from "./users";
import type {
  CostRange,
  CostRangeChange,
  CostRangeMode,
  DateRange,
  Lead,
  LeadCost,
  LeadSourceRow,
  RepMetrics,
  SalesMonthlyPoint,
  SourceBreakdownRow,
} from "@/types";
import { UNASSIGNED_REP_ID, UNMATCHED_REP_ID } from "@/types";
import type { Database } from "@/types/supabase";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

const pct = (a: number, b: number) => (b === 0 ? 0 : a / b);

/* =========================================================
   Lead sources
   ========================================================= */
export async function getLeadSources(
  includeInactive = true,
): Promise<LeadSourceRow[]> {
  const sb = await createClient();
  let q = sb.from("lead_sources").select("id, name, active, created_at");
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? [])
    .map((s) => ({
      id: s.id,
      name: s.name,
      active: s.active,
      createdAt: s.created_at,
    }))
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
    );
}

export async function leadSourceNameExists(name: string, excludeId?: string) {
  const sb = await createClient();
  const exact = name.trim().replace(/[\\%_]/g, (m) => `\\${m}`); // exact text, ignoring case
  let q = sb.from("lead_sources").select("id").ilike("name", exact);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.limit(1);
  return !!data?.length;
}

export async function createLeadSource(name: string): Promise<LeadSourceRow> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("lead_sources")
    .insert({ name: name.trim() })
    .select("id, name, active, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    active: data.active,
    createdAt: data.created_at,
  };
}

export async function renameLeadSource(
  id: string,
  name: string,
): Promise<LeadSourceRow | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("lead_sources")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("id, name, active, created_at")
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: data.id,
        name: data.name,
        active: data.active,
        createdAt: data.created_at,
      }
    : null;
}

export async function setLeadSourceActive(
  id: string,
  active: boolean,
): Promise<LeadSourceRow | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("lead_sources")
    .update({ active })
    .eq("id", id)
    .select("id, name, active, created_at")
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: data.id,
        name: data.name,
        active: data.active,
        createdAt: data.created_at,
      }
    : null;
}

/* =========================================================
   Leads + metrics (reps only see their own leads; the database enforces it)
   ========================================================= */
const LEAD_COLS =
  "id, granot_id, date, rep_id, source_id, lead_cost, cost_overridden, status, booked_date, job_value, is_sample, granot_rep";

const toLead = (
  l: Pick<
    LeadRow,
    | "id"
    | "granot_id"
    | "date"
    | "rep_id"
    | "source_id"
    | "lead_cost"
    | "cost_overridden"
    | "status"
    | "booked_date"
    | "job_value"
    | "is_sample"
    | "granot_rep"
  >,
): Lead => ({
  id: l.id,
  granotId: l.granot_id,
  date: l.date,
  repId: l.rep_id ?? "",
  sourceId: l.source_id,
  leadCost: Number(l.lead_cost),
  costOverridden: l.cost_overridden,
  status: l.status,
  bookedDate: l.booked_date,
  jobValue: l.job_value === null ? null : Number(l.job_value),
  isSample: l.is_sample,
  granotRep: l.granot_rep,
});

/** Supabase returns at most 1000 rows per request, so read big lists page by page */
const PAGE = 1000;
async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export async function getLeads(
  opts: {
    repId?: string;
    range?: DateRange;
    sourceId?: string;
    status?: string;
  } = {},
): Promise<Lead[]> {
  const sb = await createClient();
  // Leads with "test" in the customer name or lead source never count
  const build = () => {
    let q = sb.from("leads").select(LEAD_COLS).eq("is_test", false);
    if (opts.repId) q = q.eq("rep_id", opts.repId);
    if (opts.sourceId) q = q.eq("source_id", opts.sourceId);
    if (opts.status === "open" || opts.status === "booked")
      q = q.eq("status", opts.status);
    if (opts.range?.from) q = q.gte("date", opts.range.from);
    if (opts.range?.to) q = q.lte("date", opts.range.to);
    return q
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id");
  };
  const data = await fetchAll((from, to) => build().range(from, to));
  return data.map(toLead);
}

function summarizeLeads(leads: Lead[]) {
  const booked = leads.filter((l) => l.status === "booked");
  const totalLeadCost = leads.reduce((s, l) => s + l.leadCost, 0);
  return {
    leads: leads.length,
    booked: booked.length,
    closingRatio: pct(booked.length, leads.length),
    totalLeadCost,
    cpa: pct(totalLeadCost, booked.length),
    revenue: booked.reduce((s, l) => s + (l.jobValue ?? 0), 0),
  };
}

export async function getRepMetrics(
  repId: string,
  opts: { range?: DateRange; sourceId?: string } = {},
  repName?: string,
): Promise<RepMetrics> {
  const [name, leads] = await Promise.all([
    repName
      ? Promise.resolve(repName)
      : getUserById(repId).then((u) => u?.name ?? "Unknown"),
    getLeads({ repId, ...opts }),
  ]);
  return { repId, repName: name, ...summarizeLeads(leads) };
}

export async function getAllRepMetrics(
  opts: { range?: DateRange; sourceId?: string } = {},
) {
  const [reps, admins, leads] = await Promise.all([
    getReps(true),
    getAdmins(true),
    getLeads(opts),
  ]);
  const rows: RepMetrics[] = reps.map((r) => ({
    repId: r.id,
    repName: r.name,
    ...summarizeLeads(leads.filter((l) => l.repId === r.id)),
  }));
  // Admins' own Granot leads: counted in company totals under their name,
  // but kept out of the rep comparison (kind "admin")
  for (const a of admins) {
    const mine = leads.filter((l) => l.repId === a.id);
    if (mine.length)
      rows.push({
        repId: a.id,
        repName: a.name,
        kind: "admin",
        ...summarizeLeads(mine),
      });
  }
  // Leads with no sales rep in Granot at all: still counted, shown as "Unassigned"
  const known = new Set([...reps, ...admins].map((r) => r.id));
  const unassigned = leads.filter(
    (l) => !l.repId && !(l.granotRep ?? "").trim(),
  );
  if (unassigned.length) {
    rows.push({
      repId: UNASSIGNED_REP_ID,
      repName: "Unassigned",
      ...summarizeLeads(unassigned),
    });
  }
  // Leads whose Granot rep isn't linked to anyone: still counted, shown as "Unmatched"
  const unmatched = leads.filter(
    (l) =>
      (l.repId && !known.has(l.repId)) ||
      (!l.repId && (l.granotRep ?? "").trim()),
  );
  if (unmatched.length) {
    rows.push({
      repId: UNMATCHED_REP_ID,
      repName: "Unmatched",
      ...summarizeLeads(unmatched),
    });
  }
  return rows;
}

export async function getSourceBreakdown(
  opts: { repId?: string; range?: DateRange } = {},
): Promise<SourceBreakdownRow[]> {
  const [leads, sources] = await Promise.all([
    getLeads(opts),
    getLeadSources(true),
  ]);
  const names = Object.fromEntries(sources.map((s) => [s.id, s.name]));
  const ids = Array.from(new Set(leads.map((l) => l.sourceId)));
  return ids
    .map((sourceId) => ({
      sourceId,
      sourceName: names[sourceId] ?? "Unknown",
      ...summarizeLeads(leads.filter((l) => l.sourceId === sourceId)),
    }))
    .sort((a, b) => b.leads - a.leads);
}

export async function getRepMonthlyTrend(
  repId?: string,
  months = 6,
): Promise<SalesMonthlyPoint[]> {
  const now = new Date();
  const leads = await getLeads({
    repId,
    range: {
      from: format(startOfMonth(subMonths(now, months - 1)), "yyyy-MM-dd"),
      to: format(endOfMonth(now), "yyyy-MM-dd"),
    },
  });
  return Array.from({ length: months }, (_, i) => {
    const d = subMonths(now, months - 1 - i);
    const key = format(d, "yyyy-MM");
    const s = summarizeLeads(leads.filter((l) => l.date.startsWith(key)));
    return {
      month: format(d, "MMM"),
      leads: s.leads,
      booked: s.booked,
      closingRatio: Math.round(s.closingRatio * 100),
      cpa: Math.round(s.cpa),
      revenue: s.revenue,
    };
  });
}

/* =========================================================
   Weekly lead costs (week = Monday). A week without its own cost
   uses the most recent earlier week's cost.
   ========================================================= */
type CostRow = { source_id: string; week: string; cost: number; id: string };

async function getAllCosts(): Promise<CostRow[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("lead_costs")
    .select("id, source_id, week, cost")
    .order("week", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, cost: Number(c.cost) }));
}

function effectiveFrom(costs: CostRow[], sourceId: string, week: string) {
  // costs are newest first
  const row = costs.find((c) => c.source_id === sourceId && c.week <= week);
  return row
    ? { cost: row.cost, fromWeek: row.week }
    : { cost: 0, fromWeek: null as string | null };
}

/** Costs entered for this exact week */
export async function getLeadCosts(week: string): Promise<LeadCost[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("lead_costs")
    .select("id, source_id, week, cost")
    .eq("week", week);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    sourceId: c.source_id,
    week: c.week,
    cost: Number(c.cost),
  }));
}

/** Cost in effect for each source in a week, and whether it was carried over */
export async function getEffectiveCosts(
  week: string,
): Promise<
  Record<string, { cost: number; fromWeek: string | null; carried: boolean }>
> {
  const [costs, sources] = await Promise.all([
    getAllCosts(),
    getLeadSources(true),
  ]);
  return Object.fromEntries(
    sources.map((s) => {
      const e = effectiveFrom(costs, s.id, week);
      return [s.id, { ...e, carried: e.fromWeek !== week }];
    }),
  );
}

/** Weekly cost history for every source, newest week first */
export async function getCostHistory(weeks = 16) {
  const [costs, sources] = await Promise.all([
    getAllCosts(),
    getLeadSources(true),
  ]);
  const thisWeek = weekStartOf(new Date());
  const list = Array.from({ length: weeks }, (_, i) => shiftWeek(thisWeek, -i));
  const cells: Record<
    string,
    Record<string, { cost: number; carried: boolean; set: boolean }>
  > = {};
  for (const week of list) {
    cells[week] = Object.fromEntries(
      sources.map((s) => {
        const e = effectiveFrom(costs, s.id, week);
        return [
          s.id,
          {
            cost: e.cost,
            carried: e.fromWeek !== week,
            set: e.fromWeek !== null,
          },
        ];
      }),
    );
  }
  return { weeks: list, sources, cells };
}

export async function countLeadsBySource(
  week: string,
): Promise<Record<string, number>> {
  const leads = await getLeads({
    range: { from: week, to: shiftWeek(week, 1) },
  });
  const out: Record<string, number> = {};
  leads
    .filter((l) => weekStartOf(parseISO(l.date)) === week)
    .forEach((l) => (out[l.sourceId] = (out[l.sourceId] ?? 0) + 1));
  return out;
}

/** Sets a source's cost for one week. Returns how many leads changed. */
export async function upsertLeadCost(
  sourceId: string,
  week: string,
  cost: number,
): Promise<number> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_set_weekly_cost", {
    p_source: sourceId,
    p_week: week,
    p_cost: cost,
  });
  if (error) throw error;
  return data ?? 0;
}

/** Removes a week's own cost so it falls back to the previous week's cost */
export async function removeLeadCost(
  sourceId: string,
  week: string,
): Promise<number> {
  const sb = await createClient();
  // null = remove this week's cost (the database function accepts it; generated types say number)
  const { data, error } = await sb.rpc("admin_set_weekly_cost", {
    p_source: sourceId,
    p_week: week,
    p_cost: null as unknown as number,
  });
  if (error) throw error;
  return data ?? 0;
}

/** cost = null resets the lead back to its source's weekly cost */
export async function overrideLeadCost(
  leadId: string,
  cost: number | null,
): Promise<{ id: string } | null> {
  const sb = await createClient();
  // null = back to the weekly cost (the database function accepts it; generated types say number)
  const { data, error } = await sb.rpc("admin_override_lead_cost", {
    p_lead: leadId,
    p_cost: cost as unknown as number,
  });
  if (error) {
    if (/not found/i.test(error.message)) return null;
    throw error;
  }
  return { id: data };
}

/* =========================================================
   Granot webhook log (admin only)
   ========================================================= */
export type GranotEventRow = {
  id: string;
  receivedAt: string;
  type: string;
  jobNumber: string | null;
  status: string;
  message: string | null;
  payload: Record<string, string>;
  leadId: string | null;
};

export async function getGranotEvents(limit = 100): Promise<GranotEventRow[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("granot_events")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    receivedAt: e.received_at,
    type: e.event_type,
    jobNumber: e.job_number,
    status: e.status,
    message: e.message,
    payload: (e.payload as Record<string, string>) ?? {},
    leadId: e.lead_id,
  }));
}
/** Active sales reps and admins with their Granot username (reps first) */
export async function getRepGranotNames(): Promise<
  { id: string; name: string; granotName: string; isAdmin: boolean }[]
> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("profiles")
    .select("id, name, granot_name, role")
    .in("role", ["sales_rep", "admin"])
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      granotName: p.granot_name ?? "",
      isAdmin: p.role === "admin",
    }))
    .sort((a, b) => Number(a.isAdmin) - Number(b.isAdmin));
}

/** Granot usernames on leads that aren't linked to a portal rep yet */
export async function getUnmatchedGranotReps(): Promise<
  { username: string; leads: number }[]
> {
  const sb = await createClient();
  const data = await fetchAll((from, to) =>
    sb
      .from("leads")
      .select("granot_rep")
      .eq("is_test", false)
      .is("rep_id", null)
      .not("granot_rep", "is", null)
      .order("id")
      .range(from, to),
  );
  const counts = new Map<string, number>();
  for (const l of data) {
    const u = (l.granot_rep ?? "").trim();
    if (u) counts.set(u, (counts.get(u) ?? 0) + 1);
  }
  return Array.from(counts, ([username, leads]) => ({ username, leads })).sort(
    (a, b) => b.leads - a.leads,
  );
}

/* =========================================================
   Lead costs for a date range (cost per lead, or total spend
   divided across the source's leads in the range)
   ========================================================= */
export async function getCostRanges(): Promise<CostRange[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("lead_cost_ranges")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    startDate: r.start_date,
    endDate: r.end_date,
    mode: r.mode as CostRangeMode,
    amount: Number(r.amount),
    costPerLead: Number(r.cost_per_lead),
    leadCount: r.lead_count,
    note: r.note,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
  }));
}

export async function getCostRangeChanges(
  limit = 50,
): Promise<CostRangeChange[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("lead_cost_range_log")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    rangeId: c.range_id,
    sourceId: c.source_id,
    action: c.action as CostRangeChange["action"],
    before: c.before as CostRangeChange["before"],
    after: c.after as CostRangeChange["after"],
    changedBy: c.changed_by,
    changedAt: c.changed_at,
  }));
}

/** Creates (no id) or edits a date-range cost. Returns its id. */
export async function saveCostRange(input: {
  id?: string;
  sourceId: string;
  startDate: string;
  endDate: string;
  mode: CostRangeMode;
  amount: number;
  note?: string;
}): Promise<string> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_save_cost_range", {
    // null = new range (the database function accepts it; generated types say string)
    p_id: (input.id ?? null) as unknown as string,
    p_source: input.sourceId,
    p_start: input.startDate,
    p_end: input.endDate,
    p_mode: input.mode,
    p_amount: input.amount,
    p_note: input.note ?? "",
  });
  if (error) throw error;
  return data;
}

export async function deleteCostRange(id: string) {
  const sb = await createClient();
  const { error } = await sb.rpc("admin_delete_cost_range", { p_id: id });
  if (error) throw error;
}
