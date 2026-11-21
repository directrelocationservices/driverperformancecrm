// File: src/app/(admin)/admin/sales-settings-actions.ts
// (NEW file)

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { updateSalesSettings } from "@/lib/data";

const schema = z.object({
  leaderboardMinLeads: z
    .number({ message: "Enter a number" })
    .int("Whole number only")
    .min(0, "0 or more")
    .max(10000),
  repsSeeLeaderboard: z.boolean(),
});

export async function updateSalesSettingsAction(
  input: z.infer<typeof schema>,
): Promise<{ error?: string; fieldErrors?: Record<string, string> }> {
  await requireRole("admin");
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues)
      fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  try {
    await updateSalesSettings(parsed.data);
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save. Please try again." };
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/sales", "layout");
  return {};
}
