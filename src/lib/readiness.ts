// File: src/lib/readiness.ts
// (NEW file)

import { todayEastern } from "@/lib/carriers";
import {
  DOC_TYPE_LABELS,
  EXPIRING_DOC_TYPES,
  type DocStatus,
  type DocType,
  type ExpiryState,
  type FleetDocument,
} from "@/types";

/** Alerts go out this many days before a document expires */
export const EXPIRY_WARN_DAYS = 30;

/** Documents every truck must have (the expiring ones block the trip when expired) */
export const REQUIRED_TRUCK_DOCS: DocType[] = [
  "registration",
  "insurance",
  "annual_inspection",
  "eld_manual",
  "eld_officer",
  "eld_malfunction",
];
export const REQUIRED_DRIVER_DOCS: DocType[] = ["medical_card", "license"];

const dayNumber = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

/** Days until the date (0 = today, negative = days since) */
export function daysUntil(date: string, today = todayEastern()) {
  return Math.round(dayNumber(date) - dayNumber(today));
}

/** A document is good through its expiry date and expired the day after */
export function expiryState(expiresOn: string | null, today = todayEastern()) {
  if (!expiresOn) return { state: "ok" as ExpiryState, days: null };
  const days = daysUntil(expiresOn, today);
  const state: ExpiryState =
    days < 0 ? "expired" : days <= EXPIRY_WARN_DAYS ? "expiring" : "ok";
  return { state, days };
}

/** Latest document of each type (an upload replaces the one before it) */
export function latestByType(docs: FleetDocument[]) {
  const map = new Map<DocType, FleetDocument>();
  for (const d of [...docs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )) {
    if (d.docType !== "other" && !map.has(d.docType)) map.set(d.docType, d);
  }
  return map;
}

/** Where each required document stands for one truck or driver */
export function docStatuses(
  docs: FleetDocument[],
  required: DocType[],
  today = todayEastern(),
): DocStatus[] {
  const latest = latestByType(docs);
  return required.map((t) => {
    const doc = latest.get(t) ?? null;
    if (!doc)
      return {
        docType: t,
        label: DOC_TYPE_LABELS[t],
        doc,
        state: "missing",
        days: null,
      };
    const { state, days } = EXPIRING_DOC_TYPES.includes(t)
      ? expiryState(doc.expiresOn, today)
      : { state: "ok" as ExpiryState, days: null };
    return { docType: t, label: DOC_TYPE_LABELS[t], doc, state, days };
  });
}

export function expiryText(s: Pick<DocStatus, "state" | "days">) {
  if (s.state === "missing") return "Not uploaded";
  if (s.days == null) return "On file";
  if (s.days < 0)
    return `Expired ${-s.days} day${s.days === -1 ? "" : "s"} ago`;
  if (s.days === 0) return "Expires today";
  return `Expires in ${s.days} day${s.days === 1 ? "" : "s"}`;
}

/** Which expiry alert is due: 30 days, 7 days, or the day it expires */
export function alertStage(days: number): "30" | "7" | "0" | null {
  if (days <= 0) return "0";
  if (days <= 7) return "7";
  if (days <= EXPIRY_WARN_DAYS) return "30";
  return null;
}

/** "2026-11" for a timestamp, in Eastern time */
export function monthKeyET(iso: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));
}

/** The monthly truck check is due when there's none this calendar month */
export function monthlyCheckDue(lastCheckAt: string | null | undefined) {
  return !lastCheckAt || monthKeyET(lastCheckAt) !== monthKeyET(new Date());
}
