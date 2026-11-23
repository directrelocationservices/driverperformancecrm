// File: src/lib/email/alerts.ts
// (REPLACE the whole file)

import { createAdminClient } from "@/lib/supabase/admin";
import { CHECK_ITEMS } from "@/types";

/*
 * Admin email alerts, sent with Resend (https://resend.com).
 * Needs these environment variables:
 *   RESEND_API_KEY      – from the Resend dashboard
 *   ALERT_FROM_EMAIL    – e.g. "DRS Portal <alerts@directrelocate.com>" (domain verified in Resend)
 *   NEXT_PUBLIC_APP_URL – e.g. "https://portal.directrelocate.com"
 * Recipients come from Admin → Settings → "Damage alert emails".
 * If anything is missing, the alert is skipped and the driver's save still works.
 */

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

async function getRecipients(): Promise<string[]> {
  // Drivers can't read settings, so use the server-only admin client
  const { data, error } = await createAdminClient()
    .from("settings")
    .select("damage_alert_emails")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return (data?.damage_alert_emails ?? []).filter((e) =>
    /\S+@\S+\.\S+/.test(e),
  );
}

async function send(
  subject: string,
  rows: [string, string][],
  link: string,
  button: string,
  opts: { to?: string[]; extraHtml?: string; extraText?: string } = {},
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  if (!key || !from) {
    console.warn(
      "[alerts] RESEND_API_KEY or ALERT_FROM_EMAIL not set, email skipped:",
      subject,
    );
    return false;
  }
  const to = opts.to?.length ? opts.to : await getRecipients();
  if (!to.length) {
    console.warn(
      "[alerts] No alert emails in Settings, email skipped:",
      subject,
    );
    return false;
  }

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:6px 0;color:#111827">${esc(v)}</td></tr>`,
    )
    .join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 16px;color:#111827;font-size:20px">${esc(subject)}</h2>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:24px">${table}</table>
  ${opts.extraHtml ?? ""}
  ${link ? `<a href="${esc(link)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;font-size:14px">${esc(button)}</a>` : ""}
  <p style="margin-top:24px;color:#9ca3af;font-size:12px">Sent automatically by the DRS Performance Portal.</p>
</div>`;

  const text = [
    subject,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(opts.extraText ? ["", opts.extraText] : []),
    "",
    link,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return true;
}

/** Never throws: a failed email must not fail the driver's save. True when sent. */
async function safe(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn();
  } catch (err) {
    console.error("[alerts] email failed", err);
    return false;
  }
}

export function sendDamageAlert(input: {
  jobId: string;
  jobNumber: string;
  driverName: string;
  item: string;
  description: string;
  estimatedCost: number | null;
  claimFiled: boolean;
  photoCount: number;
}) {
  return safe(() =>
    send(
      `Damage reported on job ${input.jobNumber}`,
      [
        ["Job", input.jobNumber],
        ["Driver", input.driverName],
        ["Item", input.item],
        ["What happened", input.description],
        [
          "Estimated cost",
          input.estimatedCost == null
            ? "Not given"
            : `$${input.estimatedCost.toLocaleString("en-US")}`,
        ],
        ["Claim filed", input.claimFiled ? "Yes" : "No"],
        ["Photos", String(input.photoCount)],
      ],
      appUrl() ? `${appUrl()}/admin/jobs/${input.jobId}` : "",
      "Open the job",
    ),
  );
}

export function sendDoNotDriveAlert(input: {
  preTripId: string;
  unitNumber: string;
  driverName: string;
  odometer: number;
  failedItems: { key: string; notes?: string }[];
  notes?: string;
}) {
  const label = (k: string) => CHECK_ITEMS.find((c) => c.key === k)?.label ?? k;
  const failed = input.failedItems.length
    ? input.failedItems
        .map((i) => (i.notes ? `${label(i.key)} (${i.notes})` : label(i.key)))
        .join(", ")
    : "No items marked";

  return safe(() =>
    send(
      `DO NOT DRIVE: truck ${input.unitNumber}`,
      [
        ["Truck", input.unitNumber],
        ["Driver", input.driverName],
        ["Odometer", input.odometer.toLocaleString("en-US")],
        ["Needs attention", failed],
        ["Driver notes", input.notes || "None"],
      ],
      appUrl() ? `${appUrl()}/admin/pre-trip/${input.preTripId}` : "",
      "Open the inspection",
    ),
  );
}

/** Carrier insurance expires soon (or already expired). True when the email went out. */
export function sendInsuranceExpiryAlert(input: {
  carrierId: string;
  companyName: string;
  expires: string;
  days: number;
  expired: boolean;
}) {
  return safe(() =>
    send(
      input.expired
        ? `Insurance expired: ${input.companyName}`
        : `Insurance expires in ${input.days} day${input.days === 1 ? "" : "s"}: ${input.companyName}`,
      [
        ["Carrier", input.companyName],
        ["Insurance expires", input.expires],
        [
          "Status",
          input.expired
            ? `Expired ${input.days} day${input.days === 1 ? "" : "s"} ago`
            : `${input.days} day${input.days === 1 ? "" : "s"} left`,
        ],
      ],
      appUrl() ? `${appUrl()}/admin/carriers/${input.carrierId}` : "",
      "Open the carrier",
    ),
  );
}
/* ---------- Offload ---------- */
async function getOffloadRecipients(): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from("settings")
    .select("offload_alert_emails")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return (data?.offload_alert_emails ?? []).filter((e) =>
    /\S+@\S+\.\S+/.test(e),
  );
}

/** Links to private files that work for 7 days (for the email) */
async function signForEmail(paths: string[]) {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data } = await createAdminClient()
    .storage.from("evidence")
    .createSignedUrls(paths, 60 * 60 * 24 * 7);
  (data ?? []).forEach(
    (d) => d.path && d.signedUrl && map.set(d.path, d.signedUrl),
  );
  return map;
}

/** Sent to dispatch as soon as a driver submits an offload */
export function sendOffloadAlert(input: {
  jobId: string;
  jobNumber: string;
  driverName: string;
  where: string;
  whereDetails?: string;
  note?: string;
  address?: string | null;
  lat: number | null;
  lng: number | null;
  receivedAt: string;
  capturedAt: string;
  savedOffline: boolean;
  photoPaths: string[];
  forms: { name: string; required: boolean; pages: string[] }[];
}) {
  return safe(async () => {
    const all = [...input.photoPaths, ...input.forms.flatMap((f) => f.pages)];
    const links = await signForEmail(all);
    const fmt = (iso: string) =>
      new Date(iso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " ET";
    const map =
      input.lat != null && input.lng != null
        ? `https://www.google.com/maps?q=${input.lat},${input.lng}`
        : "";

    const photos = input.photoPaths
      .map((p) => links.get(p))
      .filter(Boolean)
      .map(
        (u, i) =>
          `<a href="${esc(u!)}"><img src="${esc(u!)}" alt="Photo ${i + 1}" width="160" style="width:160px;height:120px;object-fit:cover;border-radius:6px;margin:0 6px 6px 0;border:1px solid #e5e7eb"></a>`,
      )
      .join("");

    const paperwork = input.forms
      .map((f) => {
        const pages = f.pages.length
          ? f.pages
              .map((p, i) => {
                const u = links.get(p);
                return u
                  ? `<a href="${esc(u)}" style="color:#2563eb">Page ${i + 1}</a>`
                  : `Page ${i + 1}`;
              })
              .join(" · ")
          : `<span style="color:#dc2626;font-weight:bold">Missing${f.required ? " (required)" : ""}</span>`;
        return `<tr><td style="padding:4px 12px 4px 0;color:#111827">${esc(f.name)}</td><td style="padding:4px 0">${pages}</td></tr>`;
      })
      .join("");

    const missing = input.forms
      .filter((f) => !f.pages.length)
      .map((f) => f.name);

    const to = await getOffloadRecipients();
    return send(
      `Offload: job ${input.jobNumber} (${input.where})`,
      [
        ["Job", input.jobNumber],
        ["Driver", input.driverName],
        ["Offloaded at", input.where],
        ...(input.whereDetails
          ? ([["Details", input.whereDetails]] as [string, string][])
          : []),
        ...(input.note ? ([["Note", input.note]] as [string, string][]) : []),
        ["Address", input.address || "Not found"],
        [
          "GPS",
          map
            ? `${input.lat!.toFixed(5)}, ${input.lng!.toFixed(5)}`
            : "Not captured",
        ],
        ["Time (server)", fmt(input.receivedAt)],
        ...(input.savedOffline
          ? ([["Saved offline at", fmt(input.capturedAt)]] as [
              string,
              string,
            ][])
          : []),
        ["Missing paperwork", missing.length ? missing.join(", ") : "None"],
      ],
      appUrl() ? `${appUrl()}/admin/jobs/${input.jobId}` : "",
      "Open the job",
      {
        to,
        extraHtml:
          (map
            ? `<p style="margin:0 0 16px"><a href="${esc(map)}" style="color:#2563eb;font-weight:bold">Open location in Google Maps</a></p>`
            : "") +
          (photos
            ? `<h3 style="margin:0 0 8px;font-size:15px;color:#111827">Photos</h3><div style="margin-bottom:16px">${photos}</div>`
            : "") +
          (paperwork
            ? `<h3 style="margin:0 0 8px;font-size:15px;color:#111827">Paperwork</h3><table style="border-collapse:collapse;font-size:14px;margin-bottom:24px">${paperwork}</table>`
            : "") +
          `<p style="color:#6b7280;font-size:12px">Photo and file links work for 7 days. The job page always has them.</p>`,
        extraText: map ? `Map: ${map}` : undefined,
      },
    );
  });
}
