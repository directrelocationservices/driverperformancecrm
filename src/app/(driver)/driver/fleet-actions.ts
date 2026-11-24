// File: src/app/(driver)/driver/fleet-actions.ts
// (REPLACE the whole file)

"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import {
  createDocumentFor,
  createMonthlyCheckFor,
  createPreTripFor,
  createRoadsideFor,
} from "@/lib/services/fleet";

export type FleetResult = {
  error?: string;
  fieldErrors?: Record<string, string>;
} | void;

// Inputs are checked on the server, so they arrive as `unknown`.
// Photos, signatures and reports arrive as storage paths (uploaded from the phone first).

export async function createPreTripAction(
  input: unknown,
): Promise<FleetResult> {
  const user = await requireRole("driver");
  const res = await createPreTripFor(user, input);
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  redirect(`/driver/pre-trip/${res.id}`);
}

export async function createRoadsideAction(
  input: unknown,
): Promise<FleetResult> {
  const user = await requireRole("driver");
  const res = await createRoadsideFor(user, input);
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  redirect("/driver/roadside");
}

/** Driver uploads their own DOT medical card or license (front + back, expiry date) */
export async function createDriverDocumentAction(
  input: unknown,
): Promise<FleetResult> {
  const user = await requireRole("driver");
  const res = await createDocumentFor(user, input);
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/driver/documents");
}

export async function createMonthlyCheckAction(
  input: unknown,
): Promise<FleetResult> {
  const user = await requireRole("driver");
  const res = await createMonthlyCheckFor(user, input);
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  redirect(`/driver/monthly-check/${res.id}`);
}
