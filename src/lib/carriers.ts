// File: src/lib/carriers.ts
// (NEW file)

/** Days before the insurance expiry date when the alert goes out */
export const INSURANCE_ALERT_DAYS = 30;

/** Private bucket for carrier files (admins only) */
export const CARRIER_BUCKET = "carriers";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const INSURANCE_RE = new RegExp(`^insurance/${UUID}\\.(pdf|jpg|png)$`);

export const isInsurancePath = (p: string) => INSURANCE_RE.test(p);

export type InsuranceStatus =
  | { kind: "missing" }
  | { kind: "expired"; days: number }
  | { kind: "expiring"; days: number }
  | { kind: "ok"; days: number };

/** Today's date in Eastern time (the company's time zone), YYYY-MM-DD */
export function todayEastern() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

const dayNumber = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;

/** How the insurance stands on a given day */
export function insuranceStatus(
  expires: string | null,
  today = todayEastern(),
): InsuranceStatus {
  if (!expires) return { kind: "missing" };
  const days = Math.round(dayNumber(expires) - dayNumber(today));
  if (days < 0) return { kind: "expired", days: -days };
  if (days <= INSURANCE_ALERT_DAYS) return { kind: "expiring", days };
  return { kind: "ok", days };
}

const CLAIM_FILE_RE = new RegExp(`^claims/(${UUID})/${UUID}\\.(pdf|jpg|png)$`);

/** Claim files live in claims/<claim_id>/<file> */
export function isClaimPathFor(path: string, claimId: string) {
  const m = CLAIM_FILE_RE.exec(path);
  return !!m && m[1] === claimId.toLowerCase();
}
