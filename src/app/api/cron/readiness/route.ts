// File: src/app/api/cron/readiness/route.ts
// (NEW file)

import { NextResponse, type NextRequest } from "next/server";
import { flagCarrierInsurance, runExpiryAlerts } from "@/lib/data";

/**
 * Runs once a day (vercel.json → crons). Sends document expiry alerts
 * (30 days, 7 days, day of expiry) and carrier insurance alerts.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sent = await runExpiryAlerts();
    await flagCarrierInsurance();
    return NextResponse.json({ ok: true, documentAlerts: sent });
  } catch (err) {
    console.error("[cron] readiness failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
